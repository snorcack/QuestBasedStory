"""Character Forge Agent: Psychological cast designer for QuestForge."""
import json
import logging
from typing import Any
from pydantic import TypeAdapter

from pipeline.models.story import StoryArc
from pipeline.models.character import Character, CharacterRole, RelationshipMap, RelationshipEdge
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class CharacterForgeAgent:
    """Designs full cast: protagonist, antagonist, allies, neutrals, and relationships."""

    def __init__(self):
        self.prompt_config = load_agent_prompt("character_forge")
        self.llm = get_llm_client()

    def generate_cast(
        self,
        story_arc: StoryArc,
        feedback: str = "",
        is_explicit: bool = False,
    ) -> tuple[list[Character], RelationshipMap]:
        """Generate full cast sheets and relationship network from approved Story Arc."""
        arc_summary = story_arc.model_dump_json(indent=2)
        prompt = self.prompt_config.render_user_prompt(
            story_arc=arc_summary,
            protagonist_seed=story_arc.protagonist_sketch,
            world_bible="",
            feedback=feedback,
        )

        mock_cast = {
            "characters": [
                {
                    "id": "char_cross",
                    "name": "Elena Cross",
                    "role": "protagonist",
                    "location_home": "loc_precinct_07",
                    "backstory": "Former Spire cipher analyst whose memory was selectively erased after stumbling upon Council corruption.",
                    "motivation": "Recover her stolen past and expose the conspiracy before her neural degradation becomes permanent.",
                    "flaw": "Paranoid and prone to cutting off allies before they can betray her.",
                    "arc": "Starts cynical and isolated -> ends committed to public truth.",
                    "dialogue_voice": "Terse, clipped, razor-sharp technical metaphors.",
                    "dominant_trait_alignment": "none",
                    "relationships": {"char_sterling": "Arrested his syndicate partner three years ago; Sterling had her memory purged."}
                },
                {
                    "id": "char_sterling",
                    "name": "Julian Sterling",
                    "role": "antagonist",
                    "location_home": "loc_spire_peak",
                    "backstory": "Architect of the city's memory-scrubbing registry who rose to Councilman through orchestrated amnesia.",
                    "motivation": "Maintain civic order and his personal empire by eliminating all unencrypted records of the collapse.",
                    "flaw": "Arrogant belief that humans cannot survive the truth of their own history.",
                    "arc": "Starts untouchable -> ends desperately attempting to purge the Spire core.",
                    "dialogue_voice": "Cultivated, velvet-toned, patronizing.",
                    "dominant_trait_alignment": "none",
                    "relationships": {"char_cross": "Considers Cross a broken tool that should have been decommissioned."}
                },
                {
                    "id": "char_orin",
                    "name": "Orin Vance",
                    "role": "ally",
                    "location_home": "loc_sunken_bazaar",
                    "backstory": "Black-market data slicer operating out of the drainage conduits.",
                    "motivation": "Keep the undergrid free from Spire surveillance drones.",
                    "flaw": "Greedy, will sell to the highest bidder if cornered.",
                    "arc": "Starts opportunistic -> becomes genuinely loyal to Cross.",
                    "dialogue_voice": "Fast, slang-heavy street patter.",
                    "dominant_trait_alignment": "Cunning",
                    "relationships": {"char_cross": "Owes Cross a debt from their precinct days."}
                },
                {
                    "id": "char_maya",
                    "name": "Dr. Maya Lin",
                    "role": "ally",
                    "location_home": "loc_archives",
                    "backstory": "Neuro-archivist secretly cataloguing suppressed neural backups in the lower city.",
                    "motivation": "Restore cognitive agency to the victims of the memory purge.",
                    "flaw": "Overly trusting of scientific data over human survival instincts.",
                    "arc": "Transitions from passive researcher to active whistleblower.",
                    "dialogue_voice": "Analytical, measured, deeply compassionate.",
                    "dominant_trait_alignment": "Empathy",
                    "relationships": {"char_cross": "Former colleague who warned Cross against the purge protocol."}
                },
                {
                    "id": "char_kane",
                    "name": "Commander Varek Kane",
                    "role": "antagonist_ally",
                    "location_home": "loc_enforcement_hub",
                    "backstory": "Spire security director tasked with cleaning up loose cipher fragments.",
                    "motivation": "Maintain absolute stability regardless of collateral damage.",
                    "flaw": "Blind obedience to institutional hierarchy.",
                    "arc": "Dogged pursuer whose faith in Sterling cracks at the climax.",
                    "dialogue_voice": "Authoritarian, military brevity, cold scrutiny.",
                    "dominant_trait_alignment": "none",
                    "relationships": {"char_sterling": "Answers directly to Sterling's private security detail."}
                },
                {
                    "id": "char_tariq",
                    "name": "Tariq 'The Broker' Chen",
                    "role": "neutral",
                    "location_home": "loc_shadow_exchange",
                    "backstory": "Underworld broker trading in erased identity chips and black market permits.",
                    "motivation": "Profit from the information void while staying off Spire kill lists.",
                    "flaw": "Calculates every human interaction in credits and leverage.",
                    "arc": "Shifts from neutral supplier to indispensable informant.",
                    "dialogue_voice": "Polite, evasive, mercantile smoothness.",
                    "dominant_trait_alignment": "Cunning",
                    "relationships": {"char_orin": "Frequent trade rival and uneasy business partner."}
                }
            ],
            "edges": [
                {"source_id": "char_cross", "target_id": "char_sterling", "nature": "pursues", "description": "Cross investigates Sterling for her stolen past"},
                {"source_id": "char_orin", "target_id": "char_cross", "nature": "owes_debt", "description": "Orin provides black market decryption for old favors"},
                {"source_id": "char_maya", "target_id": "char_cross", "nature": "heals_advises", "description": "Maya stabilizes Elena's neural degradation"},
                {"source_id": "char_kane", "target_id": "char_cross", "nature": "hunts", "description": "Kane leads Spire security sweeps hunting Cross"},
                {"source_id": "char_kane", "target_id": "char_sterling", "nature": "obeys", "description": "Executes Sterling's purge orders"},
                {"source_id": "char_tariq", "target_id": "char_orin", "nature": "rivals", "description": "Underworld information competitors"}
            ]
        }

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            mock_response=json.dumps(mock_cast) if self.llm.backend in ("mock", "test") else None,
            is_explicit=is_explicit,
        )

        data = json.loads(clean_json_text(response_text))
        chars_raw = data.get("characters", data.get("cast", []))
        if isinstance(chars_raw, dict):
            chars_raw = list(chars_raw.values())
        
        char_adapter = TypeAdapter(list[Character])
        characters = char_adapter.validate_python(chars_raw)
        
        edges_raw = data.get("edges", data.get("relationships", []))
        if isinstance(edges_raw, dict):
            edges_raw = [{"source_id": k.split("->")[0], "target_id": k.split("->")[-1], "nature": "connects", "description": str(v)} for k, v in edges_raw.items()]

        edge_adapter = TypeAdapter(list[RelationshipEdge])
        edges = edge_adapter.validate_python(edges_raw) if isinstance(edges_raw, list) else []
        
        rel_map = RelationshipMap(characters=characters, edges=edges)
        return characters, rel_map
