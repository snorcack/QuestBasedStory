"""Export Agent: Validates referential integrity and writes static JSON game package."""
import os
import json
import logging
from pathlib import Path
from typing import Any

from pipeline.models.story import StoryArc, AuthoredChapter
from pipeline.models.world import WorldBible
from pipeline.models.character import Character
from pipeline.models.trait import TraitDefinition
from pipeline.models.quest import Quest, AttachmentPoint, Achievement
from pipeline.models.export import ExportManifest, PackageValidationReport, ValidationIssue
from pipeline.tools.prompt_loader import load_agent_prompt
from pipeline.tools.llm_client import get_llm_client

logger = logging.getLogger(__name__)


class ExportAgent:
    """The Formatter: validates referential integrity and writes static JSON game package."""

    def __init__(self, output_dir: str = "game_package"):
        self.prompt_config = load_agent_prompt("export_agent")
        self.llm = get_llm_client()
        self.output_dir = Path(output_dir)

    def validate_package(
        self,
        story_arc: StoryArc,
        world_bible: WorldBible,
        characters: list[Character],
        chapters: list[AuthoredChapter],
        quests: list[Quest],
    ) -> PackageValidationReport:
        """Perform comprehensive referential integrity checks before exporting."""
        errors: list[ValidationIssue] = []
        warnings: list[ValidationIssue] = []

        valid_locations = {loc.id for loc in world_bible.locations}
        valid_characters = {c.id for c in characters} | {n.id for n in world_bible.npcs}
        valid_chapters = {ch.chapter_id for ch in chapters}

        # 1. Validate Quests
        for q in quests:
            if q.location_id not in valid_locations:
                errors.append(ValidationIssue(
                    severity="error",
                    category="reference",
                    message=f"Quest '{q.quest_id}' references unknown location '{q.location_id}'",
                    location=f"quest:{q.quest_id}",
                ))
            if q.chapter_id not in valid_chapters:
                errors.append(ValidationIssue(
                    severity="error",
                    category="reference",
                    message=f"Quest '{q.quest_id}' references unknown chapter '{q.chapter_id}'",
                    location=f"quest:{q.quest_id}",
                ))

        # 2. Validate Dialogue Trees
        for ch in chapters:
            node_ids = {n.node_id for n in ch.dialogue_tree}
            for node in ch.dialogue_tree:
                if node.next_node and node.next_node not in node_ids:
                    errors.append(ValidationIssue(
                        severity="error",
                        category="graph",
                        message=f"Dialogue node '{node.node_id}' in {ch.chapter_id} points to non-existent next_node '{node.next_node}'",
                        location=f"dialogue:{node.node_id}",
                    ))
                for choice in node.choices:
                    if choice.next_node and choice.next_node not in node_ids:
                        errors.append(ValidationIssue(
                            severity="error",
                            category="graph",
                            message=f"Dialogue choice in node '{node.node_id}' points to non-existent next_node '{choice.next_node}'",
                            location=f"dialogue:{node.node_id}",
                        ))

        is_valid = len(errors) == 0
        return PackageValidationReport(is_valid=is_valid, errors=errors, warnings=warnings)

    def export_package(
        self,
        story_arc: StoryArc,
        world_bible: WorldBible,
        characters: list[Character],
        chapters: list[AuthoredChapter],
        quests: list[Quest],
        attachment_points: list[AttachmentPoint],
        achievements: list[Achievement],
        traits: list[TraitDefinition],
        is_explicit: bool = False,
        transitions: list[Any] | None = None,
    ) -> ExportManifest:
        """Write all assets into the structured game_package directory."""
        # 1. Validate package first
        report = self.validate_package(story_arc, world_bible, characters, chapters, quests)
        if not report.is_valid:
            error_msgs = [e.message for e in report.errors]
            logger.warning(f"Export validation issues detected: {error_msgs}")

        # 2. Prepare directories
        os.makedirs(self.output_dir / "chapters", exist_ok=True)
        os.makedirs(self.output_dir / "side_quests", exist_ok=True)

        # 3. Write world_bible.json
        with open(self.output_dir / "world_bible.json", "w", encoding="utf-8") as f:
            f.write(world_bible.model_dump_json(indent=2))

        # 4. Write characters.json
        with open(self.output_dir / "characters.json", "w", encoding="utf-8") as f:
            json.dump([c.model_dump() for c in characters], f, indent=2)

        # 5. Write trait_arc.json
        with open(self.output_dir / "trait_arc.json", "w", encoding="utf-8") as f:
            json.dump({
                "traits": [t.model_dump() for t in traits],
                "thresholds": {"none": 0, "emerging": 1, "established": 4, "dominant": 8},
            }, f, indent=2)

        # 6. Write chapters/chapter_XX.json
        for ch in chapters:
            ch_file = self.output_dir / "chapters" / f"{ch.chapter_id}.json"
            ch_quests = [q.model_dump() for q in quests if q.chapter_id == ch.chapter_id]
            data = {
                "chapter_id": ch.chapter_id,
                "contract": ch.contract.model_dump() if ch.contract else None,
                "scenes": [s.model_dump() for s in ch.scenes],
                "dialogue_tree": [n.model_dump() for n in ch.dialogue_tree],
                "quests": ch_quests,
                "characters_present": ch.characters_present,
            }
            with open(ch_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

        # 7. Write side_quests
        side_quests = [
            q for q in quests
            if (q.type.value if hasattr(q.type, "value") else str(q.type)) != "main_blocking"
        ]
        for sq in side_quests:
            sq_file = self.output_dir / "side_quests" / f"{sq.quest_id}.json"
            with open(sq_file, "w", encoding="utf-8") as f:
                f.write(sq.model_dump_json(indent=2))

        # 8. Write achievements.json
        with open(self.output_dir / "achievements.json", "w", encoding="utf-8") as f:
            json.dump([a.model_dump() for a in achievements], f, indent=2)

        # 9. Write attachment_points.json
        with open(self.output_dir / "attachment_points.json", "w", encoding="utf-8") as f:
            json.dump([ap.model_dump() for ap in attachment_points], f, indent=2)

        # 10. Generate Twine 2 HTML & Twee 3 Package via TwineExportStep
        has_twine = True
        try:
            from pipeline.tools.twine_pipeline_step import TwineExportStep
            twine_step = TwineExportStep()
            twine_dir = self.output_dir / "twine"
            twine_step.execute_for_new_project(
                story_arc=story_arc.model_dump(),
                chapters=[ch.model_dump() for ch in chapters],
                contracts=[ch.contract.model_dump() for ch in chapters if ch.contract],
                transitions=[t.model_dump() if hasattr(t, "model_dump") else t for t in (transitions or [])],
                world_bible=world_bible.model_dump(),
                characters=[c.model_dump() for c in characters],
                traits=[t.model_dump() for t in traits],
                quests=[q.model_dump() for q in quests],
                achievements=[a.model_dump() for a in achievements],
                is_explicit=is_explicit,
                output_dir=twine_dir,
            )
        except Exception as e:
            logger.warning(f"Twine export step encountered error: {e}")
            has_twine = False

        # 11. Write manifest.json
        manifest = ExportManifest(
            title=story_arc.title,
            version="1.0.0",
            chapters_count=len(chapters),
            traits=[t.name for t in traits],
            total_quests=len(quests),
            total_achievements=len(achievements),
            total_locations=len(world_bible.locations),
            total_characters=len(characters),
            entry_chapter_id=chapters[0].chapter_id if chapters else "chapter_01",
            is_explicit=is_explicit,
            content_rating="Mature 18+ (Explicit)" if is_explicit else "Standard",
            has_twine_export=has_twine,
            twine_twee_file="twine/story.twee" if has_twine else "",
            twine_html_file="twine/story.html" if has_twine else "",
            notes=(
                "Generated and validated by QuestForge Export Agent. [Rating: Mature 18+ Uncensored]"
                if is_explicit
                else "Generated and validated by QuestForge Export Agent."
            ),
        )
        with open(self.output_dir / "manifest.json", "w", encoding="utf-8") as f:
            f.write(manifest.model_dump_json(indent=2))

        return manifest
