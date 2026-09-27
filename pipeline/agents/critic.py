"""Critic Agent: Rigorous story editor and chapter contract validator."""
import json
import logging
from typing import Any

from pipeline.models.story import ChapterContract, Scene
from pipeline.models.world import WorldBible
from pipeline.tools.rubric import RubricScore
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class CriticAgent:
    """Rigorous Story Editor: scores prose against a 100-point rubric and enforces contract compliance."""

    def __init__(self, pass_threshold: int = 75):
        self.prompt_config = load_agent_prompt("critic")
        self.llm = get_llm_client()
        self.pass_threshold = pass_threshold

    def evaluate_chapter(
        self,
        chapter_contract: ChapterContract,
        scenes: list[Scene],
        world_bible: WorldBible | None = None,
        iteration_count: int = 0,
        is_explicit: bool = False,
    ) -> RubricScore:
        """Evaluate authored chapter scenes against rubric and contract gates."""
        full_prose = "\n\n".join([f"[{s.title} @ {s.location_id}]\n{s.prose}" for s in scenes])
        contract_str = chapter_contract.model_dump_json(indent=2)
        bible_str = world_bible.model_dump_json(indent=2) if world_bible else ""

        # 1. First-line Contract Hard Gate Verification
        contract_passed = True
        violations = []

        locations_visited = {s.location_id for s in scenes}
        if chapter_contract.entry_state.location not in locations_visited:
            contract_passed = False
            violations.append(f"Entry location '{chapter_contract.entry_state.location}' not present in scenes.")
        if chapter_contract.exit_state.location not in locations_visited:
            contract_passed = False
            violations.append(f"Exit location '{chapter_contract.exit_state.location}' not reached in scenes.")

        # 2. LLM Rubric Evaluation
        prompt = self.prompt_config.render_user_prompt(
            chapter_contract=contract_str,
            chapter_prose=full_prose,
            world_bible=bible_str,
            iteration_count=iteration_count,
        )
        if is_explicit:
            prompt += (
                "\n\n[NOTE FOR EXPLICIT STORY EVALUATION]: "
                "This story is in Explicit / Adult mode. Mature themes, sensual scenes, explicit romance/nudity, "
                "visceral combat violence, and gritty adult dialogue are INTENTIONAL design choices. "
                "Do NOT penalize or reject prose for containing mature/explicit content. "
                "Instead, evaluate whether it serves the narrative depth, character stakes, and contract requirements."
            )

        mock_eval = {
            "plot_coherence": 22,
            "character_motivation": 21,
            "world_consistency": 18,
            "pacing_and_flow": 13,
            "emotional_impact": 13,
            "revision_notes": [] if contract_passed else violations,
        }

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            mock_response=json.dumps(mock_eval) if self.llm.backend in ("mock", "test") else None,
            is_explicit=is_explicit,
        )

        data = json.loads(clean_json_text(response_text))
        if isinstance(data, dict):
            for envelope_key in ("rubric", "evaluation", "score", "rubric_score", "assessment"):
                if envelope_key in data and isinstance(data[envelope_key], dict):
                    data = data[envelope_key]
                    break
        elif not isinstance(data, dict):
            data = {}

        raw_notes = data.get("revision_notes")
        if raw_notes is None or (isinstance(raw_notes, list) and len(raw_notes) == 0):
            notes = violations
        else:
            notes = raw_notes

        score = RubricScore(
            plot_coherence=data.get("plot_coherence", 20),
            character_motivation=data.get("character_motivation", 20),
            world_consistency=data.get("world_consistency", 16),
            pacing_and_flow=data.get("pacing_and_flow", 12),
            emotional_impact=data.get("emotional_impact", 12),
            contract_passed=contract_passed,
            contract_violations=violations,
            revision_notes=notes,
        )

        return score
