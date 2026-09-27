"""Unit tests for Phase 1: LangGraph Skeleton and FastAPI SSE Server."""
import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from fastapi.testclient import TestClient

from pipeline.graph.pipeline import build_questforge_graph
from pipeline.models.context import StageEnum, CheckpointStatus
from pipeline.api.server import app


def test_langgraph_pipeline_all_5_checkpoints_end_to_end():
    """Verify that the LangGraph skeleton boots and visits all 5 checkpoints."""
    checkpointer = MemorySaver()
    graph = build_questforge_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "test_e2e_thread"}}

    # 1. Start pipeline -> reaches Checkpoint 1
    graph.invoke({"story_seed": "A thief in a city of clockwork masks."}, config=config)
    state = graph.get_state(config)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp1 = state.tasks[0].interrupts[0].value
    assert cp1["stage"] == StageEnum.STAGE_1_STORY_ARC.value
    assert cp1["checkpoint"] == 1
    assert "story_arc" in cp1["payload"]
    assert len(cp1["payload"]["story_arc"]["title"]) > 0

    # 2. Resume Checkpoint 1 -> reaches Checkpoint 3.5 (World & Cast)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    state = graph.get_state(config)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp35 = state.tasks[0].interrupts[0].value
    assert cp35["stage"] == StageEnum.STAGE_3_5_WORLD_CAST.value
    assert cp35["checkpoint"] == 3.5

    # 3. Resume Checkpoint 3.5 -> reaches Checkpoint 2 (Chapter Breakdown)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    state = graph.get_state(config)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp2 = state.tasks[0].interrupts[0].value
    assert cp2["stage"] == StageEnum.STAGE_2_CHAPTER_BREAKDOWN.value
    assert cp2["checkpoint"] == 2

    # 4. Resume Checkpoint 2 -> reaches Checkpoint 3 (Transitions)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    state = graph.get_state(config)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp3 = state.tasks[0].interrupts[0].value
    assert cp3["stage"] == StageEnum.STAGE_3_TRANSITIONS.value
    assert cp3["checkpoint"] == 3

    # 5. Resume Checkpoint 3 -> reaches Checkpoint 4 (Chapter 1)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    state = graph.get_state(config)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp4 = state.tasks[0].interrupts[0].value
    assert cp4["stage"] == StageEnum.STAGE_4_CHAPTER_AUTHORING.value
    assert cp4["checkpoint"] == 4

    # Approve all chapters in Stage 4 until reaching Checkpoint 5
    while state.tasks and state.tasks[0].interrupts and state.tasks[0].interrupts[0].value.get("stage") == StageEnum.STAGE_4_CHAPTER_AUTHORING.value:
        graph.invoke(Command(resume={"action": "approve"}), config=config)
        state = graph.get_state(config)

    # 5. Now at Checkpoint 5 (Quest Mapping)
    assert len(state.tasks) > 0
    assert len(state.tasks[0].interrupts) > 0
    cp5 = state.tasks[0].interrupts[0].value
    assert cp5["stage"] == StageEnum.STAGE_5_QUEST_MAPPING.value
    assert cp5["checkpoint"] == 5

    # 6. Resume Checkpoint 5 -> finishes at Export
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    final_state = graph.get_state(config)
    # No more interrupts, graph reached END
    assert len(final_state.tasks) == 0
    assert final_state.values.get("current_stage") == StageEnum.EXPORT_COMPLETE.value


def test_fastapi_server_endpoints():
    """Verify FastAPI server health and pipeline control endpoints."""
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "QuestForge"

    # 2. Start pipeline on a dedicated thread
    start_payload = {
        "story_seed": "An alchemist seeks a catalyst under siege.",
        "thread_id": "api_test_session",
    }
    res = client.post("/api/pipeline/start", json=start_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["thread_id"] == "api_test_session"
    assert data["status"] == "awaiting_review"
    assert data["checkpoint"]["checkpoint"] == 1

    # 3. Retrieve state snapshot
    res = client.get("/api/pipeline/state/api_test_session")
    assert res.status_code == 200
    state_data = res.json()
    assert "values" in state_data
    assert "story_arc" in state_data["values"]

    # 4. Resume to Checkpoint 3.5 (World & Cast)
    resume_payload = {
        "action": "approve",
        "notes": "Looks solid",
    }
    res = client.post("/api/pipeline/resume/api_test_session", json=resume_payload)
    assert res.status_code == 200
    resume_data = res.json()
    assert resume_data["status"] == "awaiting_review"
    assert resume_data["checkpoint"]["checkpoint"] == 3.5


def test_debug_endpoints():
    """Verify Debug tab API status, logs, and prompt testing endpoints."""
    client = TestClient(app)

    # 1. Debug status check
    res = client.get("/api/debug/status")
    assert res.status_code == 200
    data = res.json()
    assert data["server_status"] == "online"
    assert "llm_diagnostics" in data
    assert "backend" in data["llm_diagnostics"]
    assert "location" in data["llm_diagnostics"]

    # 2. Test Prompt endpoint (mock backend test)
    prompt_payload = {
        "user_prompt": "Pass 1: story arc for testing",
        "backend": "mock",
        "temperature": 0.5,
    }
    res = client.post("/api/debug/test-prompt", json=prompt_payload)
    assert res.status_code == 200
    test_result = res.json()
    assert test_result["success"] is True
    assert test_result["response"] is not None
    assert test_result["latency_ms"] >= 0
    assert test_result["backend"] == "mock"

    # 3. Verify logs recorded the prompt test
    res = client.get("/api/debug/logs")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    assert any("test prompt" in log["message"].lower() for log in logs)

    # 4. Clear logs endpoint
    res = client.post("/api/debug/clear-logs")
    assert res.status_code == 200
    res = client.get("/api/debug/logs")
    logs = res.json()
    assert len(logs) == 1
    assert "cleared" in logs[0]["message"].lower()
