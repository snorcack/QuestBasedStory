"""Narrator Agent: Core prose writer and atmospheric expander."""
import json
import logging
from typing import Any
from pydantic import TypeAdapter

from pipeline.models.story import ChapterContract, Scene
from pipeline.models.character import Character
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class NarratorAgent:
    """The Core Prose Writer: authors scenes, character beats, and first-person protagonist journals."""

    def __init__(self):
        self.prompt_config = load_agent_prompt("narrator")
        self.llm = get_llm_client()

    def author_chapter_prose(
        self,
        chapter_contract: ChapterContract,
        world_context: dict[str, Any],
        characters: list[Character],
        critic_notes: str = "",
        is_explicit: bool = False,
    ) -> list[Scene]:
        """Generate scene-by-scene narrative prose fulfilling the chapter contract."""
        contract_str = chapter_contract.model_dump_json(indent=2)
        world_str = json.dumps(world_context, indent=2)
        char_str = json.dumps([c.model_dump() for c in characters], indent=2)

        prompt = self.prompt_config.render_user_prompt(
            chapter_contract=contract_str,
            world_context=world_str,
            characters=char_str,
            critic_notes=critic_notes,
        )

        mock_scenes = [
            {
                "scene_id": f"sc_{chapter_contract.chapter_id}_01",
                "title": f"Arrival at {chapter_contract.entry_state.location}",
                "location_id": chapter_contract.entry_state.location,
                "prose": (
                    f"The acid precipitation hissed relentlessly against the corrugated steel shutters of the precinct. "
                    f"Elena Cross stepped past the perimeter security cordon into {chapter_contract.entry_state.location}, her coat soaked through with neon-tinted rainwater. "
                    f"Her neural implant vibrated with a jagged harmonic—a phantom sensory echo of an erased archive key trying to complete a forgotten handshake. "
                    f"Around her, the city muttered in the low hum of cooling towers and flickering transit signs. Every terminal in the sector had been rebooted under emergency protocols, "
                    f"wiping today's registry logs before the shift change."
                ),
                "characters_present": ["char_cross"],
                "emotional_beat": "Isolation and persistent cerebral unease",
            },
            {
                "scene_id": f"sc_{chapter_contract.chapter_id}_02",
                "title": f"Investigation and Contact",
                "location_id": chapter_contract.entry_state.location,
                "prose": (
                    f"Deep within the labyrinth of steam lines, shadows detached from the damp concrete. Orin Vance leaned against a buzzing junction box, "
                    f"a pair of modified optic lenses whirring into focus. 'You're late, Elena,' he muttered, tossing a magnetic data cartridge between his gloved fingers. "
                    f"'Spire drones have been sweeping the drainage canals since third bell. If Kane catches wind that we're pulling cold backups, we won't make it to morning.' "
                    f"Cross caught the cartridge, feeling the residual heat of a fresh decrypt pass. 'Sterling wiped my records, Orin. But he didn't wipe what was etched on the physical copper.'"
                ),
                "characters_present": ["char_cross", "char_orin"],
                "emotional_beat": "Wary collaboration under tactical pressure",
            },
            {
                "scene_id": f"sc_{chapter_contract.chapter_id}_03",
                "title": f"Confrontation and Breach to {chapter_contract.exit_state.location}",
                "location_id": chapter_contract.exit_state.location,
                "prose": (
                    f"The breach siren echoed across the flooded conduit as searchlights carved paths through the swirling mist. "
                    f"Footsteps echoed above on the catwalks—Aegis enforcers moving into sweep formation. Elena thumbed the charge selector on her sidearm, "
                    f"her heartbeat syncing with the pulsing alarm strobe. Together with Orin, she forced open the heavy hydraulic floodgate leading into {chapter_contract.exit_state.location}. "
                    f"As the door sealed shut behind them, locking out the pursuit drones, Elena examined the decrypted data fragment in the pale green emergency light. "
                    f"The conspiracy didn't just touch the Council—it began on the very day her own memory was erased."
                ),
                "characters_present": ["char_cross", "char_orin", "char_kane"],
                "emotional_beat": "High stakes confrontation and sudden realization",
            },
        ]

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            mock_response=json.dumps({"scenes": mock_scenes}) if self.llm.backend in ("mock", "test") else None,
            is_explicit=is_explicit,
        )

        data = json.loads(clean_json_text(response_text))
        scenes_data = data.get("scenes", data if isinstance(data, list) else [])
        if isinstance(scenes_data, dict):
            scenes_data = list(scenes_data.values())
        adapter = TypeAdapter(list[Scene])
        return adapter.validate_python(scenes_data)

    def write_journal_entry(self, quest_objective: str, protagonist_voice: str = "") -> str:
        """Write a first-person protagonist journal entry for a blocking obstacle."""
        return f"Journal: {quest_objective} If I can't find a clean bypass, this investigation dies before dawn."
