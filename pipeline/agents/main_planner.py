"""Main Planner Agent: Orchestrates 3-pass story decomposition."""
import json
import logging
from typing import Any
from pydantic import TypeAdapter

from pipeline.models.story import (
    StoryArc,
    ChapterContract,
    ChapterTransition,
)
from pipeline.models.trait import TraitDefinition
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text, extract_json_list

logger = logging.getLogger(__name__)


class MainPlannerAgent:
    """The Director and Story Architect: decomposes story seeds into arcs, contracts, and transitions."""

    def __init__(self):
        self.prompt_config = load_agent_prompt("main_planner")
        self.llm = get_llm_client()

    def pass_1_story_arc(
        self,
        story_seed: str,
        feedback: str = "",
        is_explicit: bool = False,
    ) -> StoryArc:
        """Pass 1: Decompose seed into a 3-act story arc and exactly 2 narrative traits."""
        prompt = self.prompt_config.render_user_prompt(
            operation="Pass 1: Story Arc and Trait Vocabulary",
            story_seed=story_seed,
            feedback=feedback,
            context_data="",
        )

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            is_explicit=is_explicit,
        )

        data = json.loads(clean_json_text(response_text))
        story_arc = StoryArc.model_validate(data)

        # Enforce maximum 2 narrative traits constraint
        if len(story_arc.trait_vocabulary) > 2:
            logger.warning("Main Planner generated more than 2 traits. Trimming to first 2.")
            story_arc.trait_vocabulary = story_arc.trait_vocabulary[:2]
        elif len(story_arc.trait_vocabulary) < 2:
            # Add default complementary trait if fewer than 2 returned
            defaults = [
                TraitDefinition(name="Cunning", description="Deception, technical intrusion, and exploiting vulnerabilities", color_hex="#E0A82E"),
                TraitDefinition(name="Empathy", description="Emotional insight, alliance building, and moral persuasion", color_hex="#2EA8E0"),
            ]
            for d in defaults:
                if len(story_arc.trait_vocabulary) < 2 and not any(t.name == d.name for t in story_arc.trait_vocabulary):
                    story_arc.trait_vocabulary.append(d)

        return story_arc

    def pass_2_chapter_contracts(
        self,
        story_arc: StoryArc,
        world_bible: Any = None,
        characters: Any = None,
        feedback: str = "",
        is_explicit: bool = False,
    ) -> list[ChapterContract]:
        """Pass 2: Decompose story arc into 6-8 sequential Chapter Contracts using cast and locations."""
        arc_summary = story_arc.model_dump_json(indent=2)
        context_parts = [f"Approved Story Arc:\n{arc_summary}"]

        if world_bible:
            locs = getattr(world_bible, "locations", [])
            facs = getattr(world_bible, "factions", [])
            locs_text = "\n".join([f"- {l.id} ({l.name}): {l.description}" for l in locs])
            facs_text = "\n".join([f"- {f.id} ({f.name}): {f.goals}" for f in facs])
            context_parts.append(f"Available World Locations:\n{locs_text}\n\nFactions:\n{facs_text}")

        if characters:
            chars_text = "\n".join([
                f"- {c.id} ({c.name}, {getattr(c, 'role', 'neutral')}): {getattr(c, 'motivation', '')} | Voice: {getattr(c, 'dialogue_voice', '')}"
                for c in characters
            ])
            context_parts.append(f"Available Cast:\n{chars_text}")

        context_data = "\n\n".join(context_parts)
        prompt = self.prompt_config.render_user_prompt(
            operation="Pass 2: Chapter Contracts (6-8 Contracts, ~1 Hour Gameplay Each)",
            story_seed="",
            feedback=feedback,
            context_data=context_data,
        )

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            is_explicit=is_explicit,
        )

        raw = json.loads(clean_json_text(response_text))
        data = extract_json_list(raw, ("chapter_contracts", "chapters", "contracts"))
        adapter = TypeAdapter(list[ChapterContract])
        contracts = adapter.validate_python(data)

        # Ensure order is 1-indexed and sequential
        for idx, contract in enumerate(contracts, start=1):
            contract.order = idx
            if not contract.chapter_id:
                contract.chapter_id = f"chapter_{idx:02d}"

        return contracts

    def pass_3_chapter_transitions(
        self,
        chapter_contracts: list[ChapterContract],
        feedback: str = "",
        is_explicit: bool = False,
    ) -> list[ChapterTransition]:
        """Pass 3: Generate narrative transitions bridging consecutive chapters."""
        contracts_summary = json.dumps([c.model_dump() for c in chapter_contracts], indent=2)
        prompt = self.prompt_config.render_user_prompt(
            operation="Pass 3: Chapter Transitions",
            story_seed="",
            feedback=feedback,
            context_data=f"Chapter Contracts:\n{contracts_summary}",
        )

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            is_explicit=is_explicit,
        )

        raw = json.loads(clean_json_text(response_text))
        data = extract_json_list(raw, ("transitions", "chapter_transitions"))
        adapter = TypeAdapter(list[ChapterTransition])
        transitions = adapter.validate_python(data)
        return transitions
