"""Quest Architect Agent: Analyzes completed story, formalizes quests, and validates trait arcs."""
import json
import logging
from typing import Any
from pydantic import TypeAdapter

from pipeline.models.story import AuthoredChapter
from pipeline.models.character import Character
from pipeline.models.world import WorldBible
from pipeline.models.trait import TraitDefinition, TraitArcValidation, TraitTier, tier_to_min_count
from pipeline.models.quest import Quest, QuestType, AttachmentPoint, Achievement, LatentPayoff
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client, clean_json_text

logger = logging.getLogger(__name__)


class QuestArchitectAgent:
    """The Quest Mapper: runs last, identifies quests from narrative, and validates trait progression."""

    def __init__(self):
        self.prompt_config = load_agent_prompt("quest_architect")
        self.llm = get_llm_client()

    def analyze_and_map_quests(
        self,
        chapters: list[AuthoredChapter],
        characters: list[Character],
        world_bible: WorldBible,
        traits: list[TraitDefinition],
        is_explicit: bool = False,
    ) -> tuple[list[Quest], list[AttachmentPoint], list[Achievement], TraitArcValidation]:
        """Analyze all authored chapters and extract quests, side slots, achievements, and trait report."""
        ch_summaries = []
        for ch in chapters:
            contract_info = ""
            if ch.contract:
                contract_info = f"Title: {ch.contract.title} | Scope: {ch.contract.narrative_scope} | Entry: {ch.contract.entry_state.location} | Exit: {ch.contract.exit_state.location}"
            scenes_info = "\n".join([
                f"  - Scene {s.scene_id} ({s.title}): {s.emotional_beat} [Location: {s.location_id}] Characters: {s.characters_present}"
                for s in ch.scenes
            ])
            slots_info = ""
            if ch.contract and ch.contract.attachment_points:
                slots_info = "Open Attachment Slots: " + ", ".join([ap.slot_id for ap in ch.contract.attachment_points])
            ch_summaries.append(f"[Chapter {ch.chapter_id}]:\n{contract_info}\nScenes:\n{scenes_info}\n{slots_info}")

        chapters_summary = "\n\n".join(ch_summaries) if ch_summaries else "No authored chapters provided."

        prompt = self.prompt_config.render_user_prompt(
            chapters=chapters_summary,
            characters=json.dumps([c.model_dump() for c in characters]),
            world_bible=world_bible.model_dump_json(),
            trait_arc=json.dumps([t.model_dump() for t in traits]),
        )

        trait_a = traits[0].name if traits else "Cunning"
        trait_b = traits[1].name if len(traits) > 1 else "Empathy"

        mock_quests = [
            # Chapter 1 Quests
            {
                "quest_id": "quest_ch01_01",
                "title": "Decipher the Precinct Archive Backup",
                "type": "main_blocking",
                "chapter_id": "chapter_01",
                "location_id": "loc_precinct_07",
                "trigger_flag": "ch_01_started",
                "objective": "Access the decommissioned terminal and extract the encrypted memory log before the purge sweep.",
                "journal_entry": "The precinct system is shutting down sector by sector. I need to pull my old casework before it's scrubbed.",
                "reward_flags": ["ch_01_completed", "cipher_acquired"],
                "required_trait": None,
            },
            {
                "quest_id": "quest_ch01_side_01",
                "title": "Distract the Shift Sergeant",
                "type": "latent_advantage",
                "chapter_id": "chapter_01",
                "location_id": "loc_precinct_07",
                "trigger_flag": "ch_01_started",
                "objective": "Trigger a false power surge in the evidence locker to clear the hallway.",
                "journal_entry": "If I can lure the duty officer away from the front desk, I can leave without having my security badge flagged.",
                "reward_flags": ["stealth_exit_unflagged"],
                "required_trait": {"name": trait_a, "strength": "emerging"},
                "latent_payoff": {"chapter_id": "chapter_03", "description": "Spire patrols do not recognize Elena on district security cameras."},
                "attachment_point_id": "slot_ch01_01",
            },
            # Chapter 2 Quests
            {
                "quest_id": "quest_ch02_01",
                "title": "Infiltrate the Sunken Bazaar",
                "type": "main_blocking",
                "chapter_id": "chapter_02",
                "location_id": "loc_sunken_bazaar",
                "trigger_flag": "ch_02_started",
                "objective": "Locate Orin Vance in the drainage conduits and establish an encrypted frequency.",
                "journal_entry": "Orin is the only slicer alive who knows how the Council's purge cipher was compiled.",
                "reward_flags": ["ch_02_completed", "orin_allied"],
                "required_trait": {"name": trait_b, "strength": "emerging"},
            },
            {
                "quest_id": "quest_ch02_side_01",
                "title": "Recover the Smuggler's Ledger",
                "type": "latent_advantage",
                "chapter_id": "chapter_02",
                "location_id": "loc_district_01",
                "trigger_flag": "ch_02_started",
                "objective": "Retrieve Tariq's hidden identity ledger behind the conduit floodgate.",
                "journal_entry": "Tariq will trade information on Sterling's private vault if I retrieve his confiscated client book.",
                "reward_flags": ["has_broker_ledger"],
                "latent_payoff": {"chapter_id": "chapter_05", "description": "Reveals the secret maintenance entrance to the Spire peak."},
                "attachment_point_id": "slot_ch02_01",
            },
            # Chapter 3 Quests
            {
                "quest_id": "quest_ch03_01",
                "title": "Breach the Sub-Level Archives",
                "type": "main_blocking",
                "chapter_id": "chapter_03",
                "location_id": "loc_archives",
                "trigger_flag": "ch_03_started",
                "objective": "Work with Dr. Maya Lin to decrypt the neural backup cylinders.",
                "journal_entry": "Maya preserved the physical plates from the purge. If we decrypt them, we have proof of the meltdown.",
                "reward_flags": ["ch_03_completed", "archives_decrypted"],
                "required_trait": {"name": trait_a, "strength": "established"},
            },
            {
                "quest_id": "quest_ch03_side_01",
                "title": "Sabotage Sentinel Relay",
                "type": "neutral",
                "chapter_id": "chapter_03",
                "location_id": "loc_archives",
                "trigger_flag": "ch_03_started",
                "objective": "Cut the primary signal cable to prevent Aegis drones from pinpointing Maya's laboratory.",
                "journal_entry": "The scanner array on the roof is spinning up. If I don't sever the line, Maya's sanctuary is burned.",
                "reward_flags": ["relay_disabled", "maya_safe"],
                "required_trait": None,
            },
        ]

        mock_achievements = [
            {
                "achievement_id": "ach_ghost_protocol",
                "title": "Ghost Protocol",
                "description": "Escape Precinct 07 without alerting surveillance or triggering emergency locks.",
                "icon": "shield-check",
                "trigger_flag": "stealth_exit_unflagged",
            },
            {
                "achievement_id": "ach_memory_keeper",
                "title": "Memory Keeper",
                "description": "Decrypt the historical archive cylinders in the Old City Sub-Levels.",
                "icon": "book-open",
                "trigger_flag": "archives_decrypted",
            },
            {
                "achievement_id": "ach_shadow_broker",
                "title": "Debt Settler",
                "description": "Secure Tariq Chen's ledger and earn the underworld's trust.",
                "icon": "key",
                "trigger_flag": "has_broker_ledger",
            }
        ]

        response_text = self.llm.generate(
            system_prompt=self.prompt_config.system_prompt,
            user_prompt=prompt,
            temperature=self.prompt_config.parameters.temperature,
            max_tokens=self.prompt_config.parameters.max_tokens,
            json_mode=True,
            mock_response=json.dumps({
                "quests": mock_quests,
                "achievements": mock_achievements,
            }) if self.llm.backend in ("mock", "test") else None,
            is_explicit=is_explicit,
        )

        data = json.loads(clean_json_text(response_text))
        
        quests_raw = data.get("quests", [])
        if isinstance(quests_raw, dict):
            quests_raw = list(quests_raw.values())
        elif not isinstance(quests_raw, list):
            quests_raw = []

        quests: list[Quest] = []
        for q_item in quests_raw:
            try:
                quests.append(Quest.model_validate(q_item))
            except Exception as e:
                logger.warning(f"Error parsing quest item: {e}, item={q_item}")

        achs_raw = data.get("achievements", [])
        if isinstance(achs_raw, dict):
            achs_raw = list(achs_raw.values())
        elif not isinstance(achs_raw, list):
            achs_raw = []

        achievements: list[Achievement] = []
        for a_item in achs_raw:
            try:
                achievements.append(Achievement.model_validate(a_item))
            except Exception as e:
                logger.warning(f"Error parsing achievement item: {e}, item={a_item}")

        # If quests failed to parse completely, provide fallback quests from chapters
        if not quests:
            for idx, ch in enumerate(chapters):
                ch_id = ch.chapter_id
                quests.append(
                    Quest(
                        quest_id=f"quest_{ch_id}_01",
                        title=f"Resolve {ch.contract.title if ch.contract else f'Chapter {idx+1}'}",
                        type=QuestType.MAIN_BLOCKING,
                        chapter_id=ch_id,
                        location_id=ch.contract.entry_state.location if ch.contract else "loc_default",
                        trigger_flag=f"{ch_id}_started",
                        objective=ch.contract.narrative_scope if ch.contract else f"Complete story goals in {ch_id}.",
                        journal_entry=f"We must press forward through {ch_id}.",
                        reward_flags=[f"{ch_id}_completed"],
                    )
                )

        # Collect attachment points across chapters
        attachment_points: list[AttachmentPoint] = []
        for ch in chapters:
            if ch.contract and ch.contract.attachment_points:
                attachment_points.extend(ch.contract.attachment_points)

        # Validate Trait Reachability
        trait_validation = self._validate_trait_reachability(chapters, quests, traits)

        return quests, attachment_points, achievements, trait_validation

    def _validate_trait_reachability(
        self,
        chapters: list[AuthoredChapter],
        quests: list[Quest],
        traits: list[TraitDefinition],
    ) -> TraitArcValidation:
        """Verify that every BLOCKING quest requirement is mathematically reachable."""
        # Calculate maximum choices available per trait up to each chapter
        trait_names_lower = {t.name.lower(): t.name for t in traits}
        running_counts = {t.name: 0 for t in traits}
        chapter_max_counts: dict[str, dict[str, int]] = {}

        for ch in chapters:
            for node in ch.dialogue_tree:
                for choice in node.choices:
                    if choice.trait_tag:
                        canonical = trait_names_lower.get(choice.trait_tag.lower())
                        if canonical:
                            running_counts[canonical] += 1
            chapter_max_counts[ch.chapter_id] = dict(running_counts)

        warnings: list[str] = []
        unreachable: list[str] = []

        for quest in quests:
            q_type_val = quest.type.value if hasattr(quest, "type") and hasattr(quest.type, "value") else getattr(quest, "type", "")
            if isinstance(quest, dict):
                q_type_val = quest.get("type", "")
            q_type = str(q_type_val).lower()
            req = quest.required_trait if hasattr(quest, "required_trait") else quest.get("required_trait")
            if ("main" in q_type or "blocking" in q_type) and req:
                req_name = req.name if hasattr(req, "name") else req.get("name", "")
                req_strength = req.strength if hasattr(req, "strength") else req.get("strength", "emerging")
                ch_id = quest.chapter_id if hasattr(quest, "chapter_id") else quest.get("chapter_id", "")
                q_id = quest.quest_id if hasattr(quest, "quest_id") else quest.get("quest_id", "quest")

                canonical = trait_names_lower.get(req_name.lower(), req_name)
                max_avail = chapter_max_counts.get(ch_id, {}).get(canonical, 0)
                min_req = tier_to_min_count(req_strength)
                if max_avail < min_req:
                    str_name = req_strength.value if hasattr(req_strength, "value") else str(req_strength)
                    msg = (
                        f"Unreachable blocking quest '{q_id}' in {ch_id}: "
                        f"requires {req_name} at '{str_name}' (min {min_req} choices), "
                        f"but only {max_avail} choices are available."
                    )
                    warnings.append(msg)
                    unreachable.append(q_id)

        is_valid = len(unreachable) == 0
        return TraitArcValidation(
            is_valid=is_valid,
            warnings=warnings,
            max_reachable_counts=running_counts,
            unreachable_gates=unreachable,
        )
