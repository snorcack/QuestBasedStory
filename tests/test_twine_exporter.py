"""Tests for the Twine / Twee 3 narrative exporter."""
import os
import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from pipeline.tools.twine_exporter import TwineExporter
from pipeline.api.server import app

client = TestClient(app)


def test_twine_exporter_direct_build():
    """Verify core Twee 3 and Twine 2 HTML generator logic with branching choices."""
    exporter = TwineExporter()

    story_arc = {
        "title": "Neon Syndicate",
        "genre": "Cyberpunk Noir",
        "tone": "Gritty, Suspenseful",
        "central_conflict": "An operative uncovers a corporate virus in the city grid.",
        "themes": ["Control", "Identity"],
        "protagonist_sketch": "Agent K, a glitching hacker.",
        "antagonist_sketch": "CEO Vance, an AI transhumanist.",
        "trait_vocabulary": [
            {"name": "Cunning", "description": "Tech subversion", "color_hex": "#E0A82E"},
            {"name": "Empathy", "description": "Human trust", "color_hex": "#2EA8E0"},
        ],
    }

    chapters = [
        {
            "chapter_id": "chapter_01",
            "title": "Breach at Sector 4",
            "scenes": [
                {
                    "scene_id": "sc_01",
                    "title": "Rain on the Glass",
                    "location_id": "loc_sector_4",
                    "prose": "Acid rain drizzled over the chrome fire escapes of Sector 4.",
                    "characters_present": ["Agent K", "Vance"],
                    "emotional_beat": "Isolation",
                }
            ],
            "dialogue_tree": [
                {
                    "node_id": "node_01",
                    "speaker": "Vance",
                    "text": "You should not have bypassed the firewall, operative.",
                    "choices": [
                        {
                            "label": "Hack the terminal bypass.",
                            "trait_tag": "Cunning",
                            "flags_set": ["terminal_hacked"],
                            "next_node": "node_02",
                        },
                        {
                            "label": "Appeal to his former humanity.",
                            "trait_tag": "Empathy",
                            "flags_set": ["vance_appealed"],
                            "next_node": "node_02",
                        },
                    ],
                },
                {
                    "node_id": "node_02",
                    "speaker": "Agent K",
                    "text": "The protocol ends here.",
                    "choices": [],
                    "next_node": None,
                },
            ],
        }
    ]

    quests = [
        {
            "quest_id": "q_hack",
            "title": "Bypass Sector 4 Terminal",
            "type": "main_blocking",
            "objective": "Access the terminal safely.",
            "trigger_flag": "terminal_hacked",
        }
    ]

    twee_text, html_text, stats = exporter.build_twee_and_html(
        story_arc=story_arc,
        chapters=chapters,
        quests=quests,
    )

    # 1. Validate Twee 3 Source Text
    assert ":: StoryTitle\nNeon Syndicate" in twee_text
    assert ":: StoryData" in twee_text
    assert '"format": "Harlowe"' in twee_text
    assert ":: StoryInit" in twee_text
    assert "(set: $cunning to 0)" in twee_text
    assert "(set: $empathy to 0)" in twee_text
    assert ":: Title_Screen [title]" in twee_text
    assert ":: Chapter_01_Intro" in twee_text
    assert ":: Chapter_01_Scene_01" in twee_text
    assert ":: Chapter_01_Dialogue_node_01" in twee_text
    assert ":: Story_Conclusion" in twee_text

    # Verify choices contain Harlowe link setter macro
    assert '(link: "Hack the terminal bypass.")' in twee_text
    assert "(set: $cunning to $cunning + 1)" in twee_text
    assert '(set: $flags to $flags + (a: "terminal_hacked"))' in twee_text
    assert '(go-to: "Chapter_01_Dialogue_node_02")' in twee_text

    # 2. Validate Twine 2 Standalone HTML Format
    assert "<tw-storydata" in html_text
    assert 'name="Neon Syndicate"' in html_text
    assert 'format="Harlowe"' in html_text
    assert "<tw-passagedata" in html_text
    assert 'name="Title_Screen"' in html_text
    assert 'name="Chapter_01_Dialogue_node_01"' in html_text

    # Stats validation
    assert stats["title"] == "Neon Syndicate"
    assert stats["passages_count"] > 10
    assert stats["chapters_count"] == 1


def test_twine_export_project_the_dust_of_time(tmp_path):
    """Verify exporting existing rich project 'proj_the_dust_of_time_20260923_142234'."""
    exporter = TwineExporter()
    project_id = "proj_the_dust_of_time_20260923_142234"

    res = exporter.export_project(project_id)
    assert res["project_id"] == project_id
    assert res["passages_count"] > 100
    assert Path(res["twee_file"]).exists()
    assert Path(res["html_file"]).exists()
    assert Path(res["canonical_twee"]).exists()
    assert Path(res["canonical_html"]).exists()

    with open(res["twee_file"], "r", encoding="utf-8") as f:
        twee_content = f.read()
    assert ":: StoryTitle" in twee_content
    assert "The Timeless Office" in twee_content or "Dust" in twee_content
    assert ":: Chapter_01_Intro" in twee_content
    assert ":: Chapter_07_Intro" in twee_content


def test_twine_export_early_stage_project():
    """Verify exporting early-stage project with contracts only (Clockwork Citadel)."""
    exporter = TwineExporter()
    project_id = "proj_clockwork_citadel_20260921_133251"

    res = exporter.export_project(project_id)
    assert res["project_id"] == project_id
    assert res["passages_count"] >= 15
    assert Path(res["twee_file"]).exists()
    assert Path(res["html_file"]).exists()


def test_twine_api_endpoints():
    """Test FastAPI Twine export and inspection endpoints."""
    project_id = "proj_neon_grave"

    # POST export
    post_res = client.post(f"/api/projects/{project_id}/export/twine")
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["success"] is True
    assert data["passages_count"] > 20

    # GET status
    get_res = client.get(f"/api/projects/{project_id}/export/twine")
    assert get_res.status_code == 200
    status_data = get_res.json()
    assert status_data["has_twine"] is True
    assert status_data["twee_available"] is True
    assert status_data["html_available"] is True
    assert status_data["twee_size_bytes"] > 0

    # GET content preview
    content_res = client.get(f"/api/projects/{project_id}/export/twine/content?format=twee")
    assert content_res.status_code == 200
    assert ":: StoryTitle" in content_res.text
