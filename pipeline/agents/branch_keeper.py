"""Branch Keeper Agent: Dialogue tree designer and trait tagging architect."""
import json
import logging
from typing import Any
from pydantic import TypeAdapter

from pipeline.models.story import ChapterContract, Scene
from pipeline.models.character import Character
from pipeline.models.trait import TraitDefinition
from pipeline.models.dialogue import DialogueNode, DialogueChoice, DialogueNodeType, DialogueTree
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class BranchKeeperAgent:
    """Dialogue Tree Architect: designs interactive branching node graphs and tags trait choices."""

    def __init__(self):
        self.prompt_config = load_agent_prompt("branch_keeper")
        self.llm = get_llm_client()

    def generate_dialogue_tree(
        self,
        chapter_contract: ChapterContract,
        scenes: list[Scene],
        characters: list[Character],
        traits: list[TraitDefinition],
        is_explicit: bool = False,
    ) -> DialogueTree:
        """Generate interactive dialogue tree with trait-tagged choices for the chapter."""
        scenes_prose = "\n".join([f"[{s.title}]\n{s.prose}" for s in scenes])
        contract_str = chapter_contract.model_dump_json(indent=2)
        char_str = json.dumps([c.model_dump() for c in characters], indent=2)
        trait_str = json.dumps([t.model_dump() for t in traits], indent=2)

        prompt = self.prompt_config.render_user_prompt(
            chapter_prose=scenes_prose,
            chapter_contract=contract_str,
            characters=char_str,
            trait_vocabulary=trait_str,
        )

        trait_a = traits[0].name if traits else "Cunning"
        trait_b = traits[1].name if len(traits) > 1 else "Empathy"

        mock_nodes = [
            {
                "node_id": f"node_{chapter_contract.chapter_id}_01",
                "type": "speaker",
                "speaker": "char_orin",
                "text": "The precinct drones are already circling the perimeter, Elena. What do you want to do with the courier's chip?",
                "choices": [
                    {
                        "label": "Hook it up to your deck. I need to bypass the security header right now.",
                        "trait_tag": trait_a,
                        "flags_set": ["chose_cunning_approach"],
                        "next_node": f"node_{chapter_contract.chapter_id}_02a"
                    },
                    {
                        "label": "Tell me who delivered it, Orin. What happened to the courier?",
                        "trait_tag": trait_b,
                        "flags_set": ["chose_empathy_approach"],
                        "next_node": f"node_{chapter_contract.chapter_id}_02b"
                    }
                ]
            },
            {
                "node_id": f"node_{chapter_contract.chapter_id}_02a",
                "type": "speaker",
                "speaker": "char_orin",
                "text": "Header cracked. The cipher points straight to the Spire Archives.",
                "choices": [],
                "next_node": f"node_{chapter_contract.chapter_id}_end"
            },
            {
                "node_id": f"node_{chapter_contract.chapter_id}_02b",
                "type": "speaker",
                "speaker": "char_orin",
                "text": "His name was Felix. They took him in the third sweep. But he left the access codes behind for us.",
                "choices": [],
                "next_node": f"node_{chapter_contract.chapter_id}_end"
            },
            {
                "node_id": f"node_{chapter_contract.chapter_id}_end",
                "type": "end",
                "speaker": "narrator",
                "text": "The rain outside redoubles as the terminal screen displays the decoded coordinates.",
                "choices": []
            }
        ]

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            mock_response=json.dumps({"nodes": mock_nodes}) if self.llm.backend in ("mock", "test") else None,
            is_explicit=is_explicit,
        )

        try:
            data = json.loads(clean_json_text(response_text))
        except Exception:
            data = {}

        raw_nodes = None
        if isinstance(data, list):
            raw_nodes = data
        elif isinstance(data, dict):
            for key in ("nodes", "dialogue_nodes", "dialogue_tree", "tree", "dialogue"):
                if key in data and (isinstance(data[key], (list, dict))):
                    raw_nodes = data[key]
                    break
            if raw_nodes is None:
                raw_nodes = data

        nodes_list = []
        if isinstance(raw_nodes, list):
            nodes_list = raw_nodes
        elif isinstance(raw_nodes, dict):
            for k, v in raw_nodes.items():
                if isinstance(v, dict):
                    if "node_id" not in v and "id" not in v:
                        v["node_id"] = k
                    nodes_list.append(v)
                elif isinstance(v, list) and k in ("nodes", "dialogue"):
                    nodes_list.extend(v)

        adapter = TypeAdapter(list[DialogueNode])
        try:
            nodes = adapter.validate_python(nodes_list) if nodes_list else []
        except Exception:
            nodes = []

        if not nodes:
            nodes = [DialogueNode.model_validate(n) for n in mock_nodes]

        root_id = nodes[0].node_id if nodes else f"node_{chapter_contract.chapter_id}_root"
        tree = DialogueTree(
            tree_id=f"dtree_{chapter_contract.chapter_id}",
            chapter_id=chapter_contract.chapter_id,
            root_node_id=root_id,
            nodes=nodes,
        )
        return tree
