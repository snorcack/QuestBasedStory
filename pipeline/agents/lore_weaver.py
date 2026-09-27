"""Lore Weaver Agent: World Builder and lore consistency monitor."""
import json
import logging
from typing import Any

from pipeline.models.story import StoryArc, ChapterContract
from pipeline.models.world import WorldBible, Location, Faction, NPC, Rule, Event
from pipeline.tools.lore_store import LoreStore
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class LoreWeaverAgent:
    """World Builder: generates the World Bible and enforces lore consistency across chapters."""

    def __init__(self, lore_store: LoreStore | None = None):
        self.prompt_config = load_agent_prompt("lore_weaver")
        self.llm = get_llm_client()
        self.lore_store = lore_store or LoreStore(in_memory=True)

    def generate_world_bible(self, story_arc: StoryArc, feedback: str = "", is_explicit: bool = False) -> WorldBible:
        """Construct the foundational World Bible from an approved Story Arc."""
        arc_summary = story_arc.model_dump_json(indent=2)
        prompt = self.prompt_config.render_user_prompt(
            story_arc=arc_summary,
            chapter_contract="",
            world_bible="",
        )
        if feedback:
            prompt += f"\n\nDesigner Feedback for this revision: {feedback}"

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            is_explicit=is_explicit,
            mock_response=json.dumps({
                "locations": [
                    {
                        "id": "loc_precinct_07",
                        "name": "Spire Precinct 07 Archive Division",
                        "description": "Perpetually rain-soaked neon corridor riddled with decommissioned cipher terminals and buzzing fluorescent lights.",
                        "accessible_from": ["loc_district_01", "loc_sunken_bazaar"],
                        "notable_npcs": ["char_cross"]
                    },
                    {
                        "id": "loc_district_01",
                        "name": "Lower Conduit District",
                        "description": "Dense industrial maze beneath the high-rise bridges where exhaust plumes and dripping condensate blanket street stalls.",
                        "accessible_from": ["loc_precinct_07", "loc_sunken_bazaar", "loc_shadow_exchange"],
                        "notable_npcs": ["char_orin"]
                    },
                    {
                        "id": "loc_sunken_bazaar",
                        "name": "The Sunken Bazaar",
                        "description": "Flooded subterranean concourse operating under black-market frequency dampeners where illicit data chips are auctioned.",
                        "accessible_from": ["loc_district_01", "loc_archives", "loc_shadow_exchange"],
                        "notable_npcs": ["char_orin", "char_tariq"]
                    },
                    {
                        "id": "loc_archives",
                        "name": "Old City Sub-Level Archives",
                        "description": "Decommissioned subterranean data vault overgrown with synthetic moss, containing pre-purge paper records and optical drives.",
                        "accessible_from": ["loc_sunken_bazaar", "loc_enforcement_hub"],
                        "notable_npcs": ["char_maya"]
                    },
                    {
                        "id": "loc_enforcement_hub",
                        "name": "Aegis Enforcement Bastion",
                        "description": "Fortified ferro-concrete command outpost bristling with surveillance uplinks and tactical drone docking bays.",
                        "accessible_from": ["loc_archives", "loc_spire_peak"],
                        "notable_npcs": ["char_kane"]
                    },
                    {
                        "id": "loc_spire_peak",
                        "name": "Spire Peak Executive Sanctum",
                        "description": "Pristine, temperature-controlled monolithic sky-gardens overseeing the smog canopy, bathed in artificial daylight.",
                        "accessible_from": ["loc_enforcement_hub"],
                        "notable_npcs": ["char_sterling"]
                    }
                ],
                "factions": [
                    {
                        "id": "fac_spire_council",
                        "name": "Spire Executive Council",
                        "goals": "Preserve corporate amnesia and civic stability through total information monopoly.",
                        "relationships": {"fac_undergrid": "hostile", "fac_archivists": "hostile"},
                        "territory": ["loc_spire_peak", "loc_enforcement_hub"]
                    },
                    {
                        "id": "fac_undergrid",
                        "name": "The Undergrid Syndicate",
                        "goals": "Circulate decrypted historical keys and resist automated surveillance sweeps.",
                        "relationships": {"fac_spire_council": "hostile", "fac_archivists": "allied"},
                        "territory": ["loc_sunken_bazaar", "loc_district_01"]
                    },
                    {
                        "id": "fac_archivists",
                        "name": "The Memory Keepers",
                        "goals": "Preserve unadulterated human history and prevent total neural erasure.",
                        "relationships": {"fac_spire_council": "hostile", "fac_undergrid": "allied"},
                        "territory": ["loc_archives"]
                    }
                ],
                "npcs": [
                    {
                        "id": "char_orin",
                        "name": "Orin Vance",
                        "location": "loc_sunken_bazaar",
                        "role": "Black-market data slicer",
                        "personality": "Nervous, razor-smart, self-preserving",
                        "dialogue_voice": "Fast, technical slang"
                    },
                    {
                        "id": "char_tariq",
                        "name": "Tariq Chen",
                        "location": "loc_sunken_bazaar",
                        "role": "Contraband Broker",
                        "personality": "Calculating, discreet, urbane",
                        "dialogue_voice": "Soft-spoken, mercantile precision"
                    }
                ],
                "rules": [
                    {
                        "id": "rule_memory_cipher",
                        "category": "technology",
                        "rule_text": "Neural memory scrubs can only be reversed using the originating cryptographic cipher key; brute-force attempts fry neural synapses."
                    },
                    {
                        "id": "rule_drone_sweeps",
                        "category": "law",
                        "rule_text": "Spire enforcer drones shoot without warning in restricted lower aqueducts past curfew."
                    }
                ],
                "timeline": [
                    {
                        "id": "evt_great_purge",
                        "name": "The Great Memory Scrub",
                        "order": 1,
                        "description": "Five years ago, the Council erased municipal data of the reactor meltdown to avert civil war."
                    },
                    {
                        "id": "evt_cipher_leak",
                        "name": "The Fragment Leak",
                        "order": 2,
                        "description": "Six months ago, an encrypted archive fragment surfaced in the black market, initiating Cross's pursuit."
                    }
                ]
            }) if self.llm.backend in ("mock", "test") else None,
        )

        data = json.loads(clean_json_text(response_text))
        bible = WorldBible.model_validate(data)

        # Index all world entities into LoreStore for semantic contradiction checking
        for loc in bible.locations:
            self.lore_store.add_entry(
                category="locations",
                entry_id=loc.id,
                text=f"{loc.name}: {loc.description}",
                metadata={"name": loc.name},
            )
        for rule in bible.rules:
            self.lore_store.add_entry(
                category="rules",
                entry_id=rule.id,
                text=rule.rule_text,
                metadata={"category": rule.category},
            )

        return bible

    def get_chapter_context(self, chapter_contract: ChapterContract, bible: WorldBible) -> dict[str, Any]:
        """Extract relevant world details matching the entry and exit locations of the chapter."""
        relevant_locations = [
            loc for loc in bible.locations
            if loc.id in (chapter_contract.entry_state.location, chapter_contract.exit_state.location)
        ]
        return {
            "chapter_id": chapter_contract.chapter_id,
            "locations": [loc.model_dump() for loc in relevant_locations],
            "rules": [r.model_dump() for r in bible.rules],
        }

    def check_contradictions(self, proposed_text: str, category: str = "rules") -> list[str]:
        """Semantic search against established lore to highlight potential conflicts."""
        matches = self.lore_store.query_similar(category=category, query_text=proposed_text, n_results=2)
        # Advisory contradiction checks
        warnings = []
        for m in matches:
            if "not" in proposed_text.lower() and "only" in m["document"].lower():
                warnings.append(f"Potential rule conflict with {m['id']}: {m['document']}")
        return warnings
