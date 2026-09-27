"""Unit tests for Multi-Story Workspace and Project Management."""
import pytest
from fastapi.testclient import TestClient
from pipeline.api.server import app
from pipeline.tools.project_manager import get_project_manager


@pytest.fixture
def client():
    return TestClient(app)


def test_list_projects(client):
    """Verify that projects endpoint lists existing projects including sample."""
    res = client.get("/api/projects")
    assert res.status_code == 200
    projects = res.json()
    assert isinstance(projects, list)
    assert len(projects) >= 1
    # Check sample project
    sample = next((p for p in projects if p["id"] == "proj_neon_grave"), None)
    assert sample is not None
    assert sample["title"] == "A Neon Grave"
    assert sample["status"] == "completed"
    assert sample["has_export"] is True


def test_create_and_get_project(client):
    """Verify creating a new story project and fetching its details."""
    payload = {
        "title": "Starlight Rebellion",
        "story_seed": "Scavengers on an abandoned mining orbital find an active battle AI.",
        "genre": "Hard Sci-Fi",
        "tone": "Tense, atmospheric, awe-inspiring",
    }
    res = client.post("/api/projects", json=payload)
    assert res.status_code == 200
    created = res.json()
    project_id = created["id"]
    assert project_id.startswith("proj_starlight_rebellion")
    assert created["title"] == "Starlight Rebellion"
    assert created["current_stage"] == "stage_1_story_arc"

    # Fetch detail
    res_detail = client.get(f"/api/projects/{project_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == project_id
    assert detail["story_seed"] == payload["story_seed"]
    assert "state_snapshot" in detail

    # Clean up
    del_res = client.delete(f"/api/projects/{project_id}")
    assert del_res.status_code == 200


def test_project_pipeline_lifecycle(client):
    """Verify executing checkpoints on an isolated project."""
    # 1. Create project
    create_res = client.post("/api/projects", json={
        "title": "Clockwork Citadel",
        "story_seed": "A guild engineer uncovers sabotage in the city's chronometer spires.",
        "genre": "Steampunk Mystery",
        "tone": "Intriguing, meticulous",
    })
    assert create_res.status_code == 200
    proj_id = create_res.json()["id"]

    try:
        # 2. Start pipeline on this project
        start_res = client.post(f"/api/projects/{proj_id}/start")
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert start_data["status"] == "awaiting_review"
        assert start_data["checkpoint"]["checkpoint"] == 1

        # 3. Check project state snapshot
        state_res = client.get(f"/api/projects/{proj_id}/state")
        assert state_res.status_code == 200
        state_data = state_res.json()
        assert "story_arc" in state_data["values"]

        # 4. Resume to Checkpoint 2
        resume_res = client.post(f"/api/projects/{proj_id}/resume", json={
            "action": "approve",
            "notes": "Spine approved",
        })
        assert resume_res.status_code == 200
        resume_data = resume_res.json()
        assert resume_data["status"] == "awaiting_review"
        assert resume_data["checkpoint"]["checkpoint"] == 3.5

    finally:
        # Clean up test project
        client.delete(f"/api/projects/{proj_id}")


def test_explicit_story_project_lifecycle(client):
    """Verify creating and advancing an explicit / adult uncensored story project."""
    # 1. Create project with explicit mode enabled
    create_res = client.post("/api/projects", json={
        "title": "Neon Sin & Chrome",
        "story_seed": "An undercover agent infiltrates an illicit syndicate den with high adult stakes.",
        "genre": "Cyber-Thriller (Explicit 18+)",
        "tone": "Visceral, unfiltered, seductive",
        "is_explicit": True,
    })
    assert create_res.status_code == 200
    data = create_res.json()
    proj_id = data["id"]
    assert data["is_explicit"] is True

    try:
        # 2. Verify get project detail retains is_explicit
        detail_res = client.get(f"/api/projects/{proj_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["is_explicit"] is True

        # 3. Start pipeline and check snapshot carries is_explicit
        start_res = client.post(f"/api/projects/{proj_id}/start")
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert start_data["current_values"]["is_explicit"] is True
        assert start_data["checkpoint"]["checkpoint"] == 1

    finally:
        client.delete(f"/api/projects/{proj_id}")
