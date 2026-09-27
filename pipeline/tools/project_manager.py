"""Project Manager for multi-story workspace, persistence, and review in QuestForge."""
import os
import re
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from pipeline.models.project import ProjectSummary, ProjectDetail


class ProjectManager:
    """Manages multi-story projects on disk with independent SQLite checkpoints,

    state snapshots, and exported packages.
    """

    def __init__(self, base_dir: str = "projects"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_sample_project()

    def _slugify(self, text: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9_-]", "_", text.lower().strip())
        slug = re.sub(r"_+", "_", slug).strip("_")
        return slug[:28] or "story"

    def _get_project_dir(self, project_id: str) -> Path:
        return self.base_dir / project_id

    def _get_metadata_path(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "project.json"

    def _get_state_path(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "state_snapshot.json"

    def get_sqlite_path(self, project_id: str) -> str:
        pdir = self._get_project_dir(project_id)
        pdir.mkdir(parents=True, exist_ok=True)
        return str(pdir / "pipeline.sqlite")

    def get_package_dir(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "game_package"

    def _ensure_sample_project(self):
        """Creates an initial sample project if workspace has no projects."""
        sample_id = "proj_neon_grave"
        sample_dir = self._get_project_dir(sample_id)
        if not sample_dir.exists():
            now = datetime.now().isoformat()
            sample_dir.mkdir(parents=True, exist_ok=True)
            meta = {
                "id": sample_id,
                "title": "A Neon Grave",
                "story_seed": "A cyber-noir detective plagued by memory glitches uncovers a syndicate conspiracy.",
                "genre": "Cyber-Noir Mystery",
                "tone": "Gritty, melancholic, suspenseful",
                "created_at": now,
                "updated_at": now,
                "current_stage": "export_complete",
                "status": "completed",
                "chapter_count": 8,
                "quest_count": 6,
                "has_export": True,
            }
            with open(sample_dir / "project.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            # Check if root game_package has manifest to copy over
            root_package = Path("game_package")
            if root_package.exists() and (root_package / "manifest.json").exists():
                pkg_dest = sample_dir / "game_package"
                if not pkg_dest.exists():
                    shutil.copytree(root_package, pkg_dest)

            # Build full state snapshot for the sample project
            world_bible = {}
            if (sample_dir / "game_package" / "world_bible.json").exists():
                with open(sample_dir / "game_package" / "world_bible.json", "r", encoding="utf-8") as f:
                    world_bible = json.load(f)

            characters = []
            if (sample_dir / "game_package" / "characters.json").exists():
                with open(sample_dir / "game_package" / "characters.json", "r", encoding="utf-8") as f:
                    characters = json.load(f)

            achievements = []
            if (sample_dir / "game_package" / "achievements.json").exists():
                with open(sample_dir / "game_package" / "achievements.json", "r", encoding="utf-8") as f:
                    achievements = json.load(f)

            attachment_points = []
            if (sample_dir / "game_package" / "attachment_points.json").exists():
                with open(sample_dir / "game_package" / "attachment_points.json", "r", encoding="utf-8") as f:
                    attachment_points = json.load(f)

            chapters = []
            ch_dir = sample_dir / "game_package" / "chapters"
            if ch_dir.exists():
                for cf in sorted(ch_dir.glob("chapter_*.json")):
                    try:
                        with open(cf, "r", encoding="utf-8") as f:
                            chapters.append(json.load(f))
                    except Exception:
                        pass

            quests = []
            q_dir = sample_dir / "game_package" / "side_quests"
            if q_dir.exists():
                for qf in sorted(q_dir.glob("*.json")):
                    try:
                        with open(qf, "r", encoding="utf-8") as f:
                            quests.append(json.load(f))
                    except Exception:
                        pass

            chapter_contracts = []
            for i, ch in enumerate(chapters, 1):
                chapter_contracts.append({
                    "chapter_id": ch.get("chapter_id", f"chapter_{i:02d}"),
                    "order": i,
                    "title": ch.get("title", f"Chapter {i}"),
                    "narrative_scope": ch.get("opening_state", {}).get("location", "Urban Underbelly"),
                    "entry_state": ch.get("opening_state", {"location": "loc_district_01", "trait_snapshot": {}}),
                    "exit_state": ch.get("closing_state", {"location": "loc_district_01", "trait_snapshot": {}}),
                    "attachment_points": [ap for ap in attachment_points if ap.get("chapter_id") == ch.get("chapter_id")],
                })

            sample_state = {
                "values": {
                    "story_seed": meta["story_seed"],
                    "current_stage": "export_complete",
                    "story_arc": {
                        "title": "A Neon Grave",
                        "genre": "Cyber-Noir Mystery",
                        "tone": "Gritty, melancholic, suspenseful",
                        "themes": ["Institutional corruption", "The burden of memory", "Redemption through truth"],
                        "protagonist_sketch": "Detective Elena Cross, plagued by neural glitches from an unsolved case.",
                        "antagonist_sketch": "Councilman Julian Sterling, civic leader who buried his criminal past.",
                        "central_conflict": "A serial cipher killer targets the syndicate that Cross investigated before her memory wipe.",
                        "acts": [
                            {"act_number": 1, "title": "The Ghost in the Circuit", "summary": "Cross investigates an impossible murder."},
                            {"act_number": 2, "title": "The Sunken Ward", "summary": "Cross infiltrates flooded archives."},
                            {"act_number": 3, "title": "The Glass Terminal", "summary": "Cross breaches Spire Archive core."},
                        ],
                        "trait_vocabulary": [
                            {"name": "Cunning", "description": "Electronic intrusion, exploiting vulnerabilities", "color_hex": "#E0A82E"},
                            {"name": "Empathy", "description": "Reading emotional tells, building alliances", "color_hex": "#2EA8E0"},
                        ],
                    },
                    "trait_vocabulary": [
                        {"name": "Cunning", "description": "Electronic intrusion, exploiting vulnerabilities", "color_hex": "#E0A82E"},
                        {"name": "Empathy", "description": "Reading emotional tells, building alliances", "color_hex": "#2EA8E0"},
                    ],
                    "chapter_contracts": chapter_contracts,
                    "world_bible": world_bible,
                    "characters": characters,
                    "chapters": chapters,
                    "quest_graph": quests,
                    "attachment_points": attachment_points,
                    "achievements": achievements,
                },
                "checkpoint_data": None,
                "saved_at": now,
            }
            with open(sample_dir / "state_snapshot.json", "w", encoding="utf-8") as f:
                json.dump(sample_state, f, indent=2)

    def list_projects(self) -> list[ProjectSummary]:
        """List all story projects ordered by last modified timestamp."""
        projects: list[ProjectSummary] = []
        if not self.base_dir.exists():
            return projects

        for item in self.base_dir.iterdir():
            if item.is_dir():
                meta_file = item / "project.json"
                if meta_file.exists():
                    try:
                        with open(meta_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        # Check export
                        has_export = (item / "game_package" / "manifest.json").exists()
                        data["has_export"] = has_export
                        projects.append(ProjectSummary.model_validate(data))
                    except Exception as e:
                        print(f"Error loading project {item.name}: {e}")

        projects.sort(key=lambda p: p.updated_at, reverse=True)
        return projects

    def get_project(self, project_id: str) -> ProjectDetail | None:
        """Fetch full project details including latest state snapshot."""
        meta_file = self._get_metadata_path(project_id)
        if not meta_file.exists():
            return None

        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        state_file = self._get_state_path(project_id)
        state_data: dict[str, Any] = {}
        if state_file.exists():
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state_data = json.load(f)
            except Exception:
                state_data = {}

        has_export = (self.get_package_dir(project_id) / "manifest.json").exists()
        meta["has_export"] = has_export

        return ProjectDetail(
            **meta,
            state_snapshot=state_data.get("values", state_data),
            checkpoint_data=state_data.get("checkpoint_data"),
        )

    def create_project(
        self,
        title: str,
        story_seed: str,
        genre: str = "Interactive Fiction",
        tone: str = "Engaging, atmospheric",
        is_explicit: bool = False,
    ) -> ProjectDetail:
        """Initialize a new story project on disk."""
        now = datetime.now()
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        slug = self._slugify(title or "new_story")
        project_id = f"proj_{slug}_{timestamp_str}"

        pdir = self._get_project_dir(project_id)
        pdir.mkdir(parents=True, exist_ok=True)

        meta = {
            "id": project_id,
            "title": title.strip() or "Untitled Story",
            "story_seed": story_seed.strip(),
            "genre": genre.strip() or "Interactive Fiction",
            "tone": tone.strip() or "Atmospheric",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "current_stage": "stage_1_story_arc",
            "status": "idle",
            "chapter_count": 0,
            "quest_count": 0,
            "has_export": False,
            "is_explicit": is_explicit,
        }

        with open(pdir / "project.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        initial_state = {
            "values": {
                "story_seed": story_seed.strip(),
                "current_stage": "stage_1_story_arc",
                "is_explicit": is_explicit,
            },
            "checkpoint_data": None,
        }
        with open(pdir / "state_snapshot.json", "w", encoding="utf-8") as f:
            json.dump(initial_state, f, indent=2)

        return ProjectDetail(**meta, state_snapshot=initial_state["values"])

    def save_project_state(
        self,
        project_id: str,
        state_values: dict[str, Any],
        checkpoint_data: dict[str, Any] | None = None,
        status: str | None = None,
    ) -> bool:
        """Save latest pipeline state snapshot and update project metadata."""
        pdir = self._get_project_dir(project_id)
        if not pdir.exists():
            pdir.mkdir(parents=True, exist_ok=True)

        now = datetime.now().isoformat()
        meta_file = self._get_metadata_path(project_id)
        meta: dict[str, Any] = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception:
                meta = {}

        # Update metadata stats
        meta["updated_at"] = now
        stage = state_values.get("current_stage") or meta.get("current_stage", "stage_1_story_arc")
        meta["current_stage"] = stage

        # Chapters count
        chapters = state_values.get("chapters") or state_values.get("chapter_contracts") or []
        if chapters:
            meta["chapter_count"] = len(chapters)

        # Quests count
        quests = state_values.get("quest_graph") or []
        if quests:
            meta["quest_count"] = len(quests)

        # Story title refinement if main planner created a title
        arc = state_values.get("story_arc")
        if isinstance(arc, dict) and arc.get("title"):
            if meta.get("title") in ("Untitled Story", "New Story", ""):
                meta["title"] = arc["title"]
            if arc.get("genre"):
                meta["genre"] = arc["genre"]
            if arc.get("tone"):
                meta["tone"] = arc["tone"]

        # Status calculation
        if status:
            meta["status"] = status
        elif checkpoint_data:
            meta["status"] = "awaiting_review"
        elif stage == "export_complete":
            meta["status"] = "completed"
        else:
            meta["status"] = "running"

        meta["has_export"] = (self.get_package_dir(project_id) / "manifest.json").exists()

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        # Write state snapshot
        state_payload = {
            "values": state_values,
            "checkpoint_data": checkpoint_data,
            "saved_at": now,
        }
        with open(self._get_state_path(project_id), "w", encoding="utf-8") as f:
            json.dump(state_payload, f, indent=2, default=str)

        return True

    def delete_project(self, project_id: str) -> bool:
        """Permanently delete a story project directory."""
        import gc
        import time

        pdir = self._get_project_dir(project_id)
        if not pdir.exists():
            return False

        gc.collect()
        for attempt in range(3):
            try:
                shutil.rmtree(pdir)
                return True
            except (PermissionError, OSError):
                time.sleep(0.1)
                gc.collect()

        return not pdir.exists()

    def run_twine_export_step(self, project_id: str, output_dir: str | Path | None = None) -> dict[str, Any]:
        """Runs the Twine export pipeline step for a project by ID."""
        from pipeline.tools.twine_pipeline_step import twine_export_step
        result = twine_export_step.execute_for_existing_project(project_id, output_dir=output_dir)
        
        # Touch metadata to mark updated_at
        meta_path = self._get_metadata_path(project_id)
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                meta["has_twine_export"] = True
                meta["updated_at"] = datetime.now().isoformat()
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
            except Exception:
                pass
        return result

    def export_all_projects_twine(self) -> list[dict[str, Any]]:
        """Scans all projects in projects directory and runs Twine export pipeline step for each."""
        from pipeline.tools.twine_pipeline_step import twine_export_step
        results = []
        for p in self.list_projects():
            try:
                res = twine_export_step.execute_for_existing_project(p.id)
                results.append(res)
            except Exception as e:
                results.append({"project_id": p.id, "status": "error", "error": str(e)})
        return results


_global_project_manager: ProjectManager | None = None


def get_project_manager() -> ProjectManager:
    global _global_project_manager
    if _global_project_manager is None:
        _global_project_manager = ProjectManager()
    return _global_project_manager
