"""Twine Export Pipeline Step for QuestForge.

Provides a unified pipeline step for exporting both existing projects (on disk)
and new projects (in-memory or pipeline graph execution) to Twee 3 (.twee)
and standalone Twine 2 HTML (.html) formats.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Union

from pipeline.models.context import SharedContext, StageEnum
from pipeline.tools.twine_exporter import TwineExporter

logger = logging.getLogger(__name__)


class TwineExportStep:
    """Pipeline step responsible for generating Twine 2 HTML & Twee 3 packages."""

    def __init__(self, projects_dir: str = "projects"):
        self.projects_dir = Path(projects_dir)
        self.exporter = TwineExporter(projects_dir=projects_dir)

    def execute_for_existing_project(
        self,
        project_id: str,
        output_dir: Union[str, Path, None] = None,
    ) -> dict[str, Any]:
        """Runs the Twine export step on an existing project saved on disk."""
        logger.info(f"[TwineExportStep] Running step for existing project: {project_id}")
        
        # Run exporter
        stats = self.exporter.export_project(project_id, output_dir=output_dir)

        # Update metadata in project.json if present
        pdir = self.projects_dir / project_id
        meta_path = pdir / "project.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                meta["has_twine_export"] = True
                meta["twine_twee_file"] = stats.get("twee_file", "")
                meta["twine_html_file"] = stats.get("html_file", "")
                meta["updated_at"] = datetime.now(timezone.utc).isoformat()
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
            except Exception as e:
                logger.warning(f"Could not update project.json for {project_id}: {e}")

        twee_path = Path(stats["twee_file"])
        html_path = Path(stats["html_file"])

        return {
            "step_name": "twine_export",
            "status": "success",
            "project_id": project_id,
            "title": stats.get("title", project_id),
            "passages_count": stats.get("passages_count", 0),
            "chapters_count": stats.get("chapters_count", 0),
            "quests_count": stats.get("quests_count", 0),
            "twee_file": str(twee_path),
            "html_file": str(html_path),
            "canonical_twee": stats.get("canonical_twee", ""),
            "canonical_html": stats.get("canonical_html", ""),
            "twee_size_bytes": twee_path.stat().st_size if twee_path.exists() else 0,
            "html_size_bytes": html_path.stat().st_size if html_path.exists() else 0,
            "has_twine_export": True,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }

    def execute_for_new_project(
        self,
        story_arc: dict[str, Any],
        chapters: list[dict[str, Any]],
        contracts: list[dict[str, Any]] | None = None,
        transitions: list[dict[str, Any]] | None = None,
        world_bible: dict[str, Any] | None = None,
        characters: list[dict[str, Any]] | None = None,
        traits: list[dict[str, Any]] | None = None,
        quests: list[dict[str, Any]] | None = None,
        achievements: list[dict[str, Any]] | None = None,
        is_explicit: bool = False,
        output_dir: Union[str, Path, None] = None,
        project_id: str = "new_project",
    ) -> dict[str, Any]:
        """Runs the Twine export step on a newly generated project (in-memory state)."""
        logger.info(f"[TwineExportStep] Running step for new project: {story_arc.get('title', project_id)}")

        twee_text, html_text, stats = self.exporter.build_twee_and_html(
            story_arc=story_arc,
            chapters=chapters,
            contracts=contracts,
            transitions=transitions,
            world_bible=world_bible,
            characters=characters,
            traits=traits,
            quests=quests,
            achievements=achievements,
            is_explicit=is_explicit,
        )

        target_dir = Path(output_dir) if output_dir else (self.projects_dir / project_id / "twine")
        target_dir.mkdir(parents=True, exist_ok=True)

        slug = self.exporter._slugify(story_arc.get("title") or project_id)
        twee_file = target_dir / f"{slug}.twee"
        html_file = target_dir / f"{slug}.html"
        canon_twee = target_dir / "story.twee"
        canon_html = target_dir / "story.html"

        with open(twee_file, "w", encoding="utf-8") as f:
            f.write(twee_text)
        with open(canon_twee, "w", encoding="utf-8") as f:
            f.write(twee_text)

        with open(html_file, "w", encoding="utf-8") as f:
            f.write(html_text)
        with open(canon_html, "w", encoding="utf-8") as f:
            f.write(html_text)

        return {
            "step_name": "twine_export",
            "status": "success",
            "project_id": project_id,
            "title": story_arc.get("title", "QuestForge Story"),
            "passages_count": stats.get("passages_count", 0),
            "chapters_count": stats.get("chapters_count", len(chapters)),
            "quests_count": stats.get("quests_count", len(quests or [])),
            "twee_file": str(twee_file),
            "html_file": str(html_file),
            "canonical_twee": str(canon_twee),
            "canonical_html": str(canon_html),
            "twee_size_bytes": twee_file.stat().st_size if twee_file.exists() else 0,
            "html_size_bytes": html_file.stat().st_size if html_file.exists() else 0,
            "has_twine_export": True,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }

    def run_step(self, input_data: Union[str, dict[str, Any], SharedContext], output_dir: Union[str, Path, None] = None) -> dict[str, Any]:
        """Unified entry point for the Twine export step.

        Accepts a project_id (str), state dict, or SharedContext object.
        """
        if isinstance(input_data, str):
            return self.execute_for_existing_project(input_data, output_dir=output_dir)
        elif isinstance(input_data, SharedContext):
            data = input_data.to_dict()
            return self.execute_for_new_project(
                story_arc=data.get("story_arc") or {},
                chapters=data.get("chapters") or [],
                contracts=data.get("chapter_contracts") or [],
                transitions=data.get("transitions") or [],
                world_bible=data.get("world_bible") or {},
                characters=data.get("characters") or [],
                traits=data.get("trait_vocabulary") or [],
                quests=data.get("quest_graph") or [],
                achievements=data.get("achievements") or [],
                is_explicit=data.get("is_explicit", False),
                output_dir=output_dir,
            )
        elif isinstance(input_data, dict):
            # Check if dict contains project_id reference to an existing project on disk
            pid = input_data.get("project_id") or input_data.get("id")
            if pid and (self.projects_dir / pid).exists() and not input_data.get("chapters"):
                return self.execute_for_existing_project(pid, output_dir=output_dir)

            return self.execute_for_new_project(
                story_arc=input_data.get("story_arc") or {},
                chapters=input_data.get("chapters") or [],
                contracts=input_data.get("chapter_contracts") or [],
                transitions=input_data.get("transitions") or [],
                world_bible=input_data.get("world_bible") or {},
                characters=input_data.get("characters") or [],
                traits=input_data.get("trait_vocabulary") or input_data.get("traits") or [],
                quests=input_data.get("quest_graph") or input_data.get("quests") or [],
                achievements=input_data.get("achievements") or [],
                is_explicit=input_data.get("is_explicit", False),
                output_dir=output_dir,
                project_id=pid or "new_project",
            )
        else:
            raise TypeError(f"Unsupported input type for TwineExportStep: {type(input_data)}")


# Singleton instance for quick module access
twine_export_step = TwineExportStep()
