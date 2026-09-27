"""Tests for the Twine Export Pipeline Step (TwineExportStep)."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from pipeline.tools.twine_pipeline_step import TwineExportStep, twine_export_step
from pipeline.tools.project_manager import get_project_manager
from pipeline.models.context import SharedContext, StageEnum
from pipeline.graph.pipeline import build_questforge_graph
from pipeline.api.server import app

client = TestClient(app)


def test_twine_export_step_new_project_in_memory(tmp_path):
    """Test running TwineExportStep on a new project (in-memory state)."""
    step = TwineExportStep(projects_dir=str(tmp_path))

    story_arc = {
        "title": "Quantum Horizon",
        "genre": "Sci-Fi Thriller",
        "tone": "Tense",
        "central_conflict": "A singularity drive goes rogue on deep space station Orion.",
        "trait_vocabulary": [
            {"name": "Intellect", "description": "System analysis", "color_hex": "#00FFCC"},
            {"name": "Grit", "description": "Physical resilience", "color_hex": "#FF9900"},
        ],
    }

    chapters = [
        {
            "chapter_id": "chapter_01",
            "title": "Silent Station",
            "scenes": [
                {
                    "scene_id": "sc_01",
                    "title": "Airlock Unsealed",
                    "prose": "Emergency strobes flashed across the bulkhead.",
                }
            ],
            "dialogue_tree": [
                {
                    "node_id": "node_01",
                    "speaker": "AI Computer",
                    "text": "Core venting in 60 seconds.",
                    "choices": [
                        {
                            "label": "Reroute power to shields.",
                            "trait_tag": "Intellect",
                            "next_node": "node_02",
                        }
                    ],
                }
            ],
        }
    ]

    res = step.execute_for_new_project(
        story_arc=story_arc,
        chapters=chapters,
        output_dir=tmp_path / "quantum_twine",
        project_id="proj_quantum_horizon",
    )

    assert res["status"] == "success"
    assert res["title"] == "Quantum Horizon"
    assert res["passages_count"] > 5
    assert Path(res["twee_file"]).exists()
    assert Path(res["html_file"]).exists()

    with open(res["twee_file"], "r", encoding="utf-8") as f:
        twee = f.read()
    assert "Quantum Horizon" in twee
    assert ":: Chapter_01_Intro" in twee
    assert "(set: $intellect to 0)" in twee


def test_twine_export_step_existing_projects():
    """Test running TwineExportStep on existing saved story projects."""
    step = TwineExportStep()

    # 1. Neon Grave sample project
    res_neon = step.execute_for_existing_project("proj_neon_grave")
    assert res_neon["status"] == "success"
    assert res_neon["project_id"] == "proj_neon_grave"
    assert res_neon["passages_count"] > 20
    assert Path(res_neon["twee_file"]).exists()
    assert Path(res_neon["html_file"]).exists()

    # 2. Dust of Time rich project
    res_dust = step.execute_for_existing_project("proj_the_dust_of_time_20260923_142234")
    assert res_dust["status"] == "success"
    assert res_dust["passages_count"] > 100
    assert Path(res_dust["twee_file"]).exists()


def test_twine_export_step_unified_run_step(tmp_path):
    """Test unified run_step method with string ID, dict, and SharedContext."""
    step = TwineExportStep(projects_dir=str(tmp_path))

    # Test via SharedContext
    context = SharedContext(
        story_seed="A lone wanderer in the frozen wasteland.",
        story_arc={
            "title": "Frostbound",
            "genre": "Survival",
            "tone": "Desolate",
            "protagonist_sketch": "A lone survivalist.",
            "antagonist_sketch": "The encroaching blizzard.",
            "central_conflict": "Surviving the deep freeze.",
            "trait_vocabulary": [{"name": "Warmth", "description": "Compassion", "color_hex": "#FF5555"}],
        },
    )

    res = step.run_step(context, output_dir=tmp_path / "frostbound")
    assert res["status"] == "success"
    assert res["title"] == "Frostbound"
    assert Path(res["twee_file"]).exists()


def test_project_manager_twine_step():
    """Test ProjectManager methods for executing Twine export step."""
    pm = get_project_manager()
    res = pm.run_twine_export_step("proj_neon_grave")
    assert res["status"] == "success"
    assert res["has_twine_export"] is True

    # Test batch export all
    all_res = pm.export_all_projects_twine()
    assert len(all_res) >= 1
    assert any(r.get("project_id") == "proj_neon_grave" for r in all_res)


def test_pipeline_graph_stage_twine_export():
    """Verify that building and inspecting the graph includes node_stage_twine_export."""
    graph = build_questforge_graph()
    nodes = list(graph.nodes.keys())
    assert "stage_twine_export" in nodes


def test_twine_export_api_pipeline_step_endpoint():
    """Test POST /api/pipeline/step/twine endpoint."""
    payload = {
        "story_arc": {
            "title": "API Test Story",
            "genre": "Mystery",
            "tone": "Intriguing",
        },
        "chapters": [
            {
                "chapter_id": "chapter_01",
                "title": "The Beginning",
                "scenes": [],
                "dialogue_tree": [],
            }
        ],
    }

    res = client.post("/api/pipeline/step/twine", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["title"] == "API Test Story"
    assert data["passages_count"] > 0
