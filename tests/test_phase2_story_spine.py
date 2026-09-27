"""Tests for Phase 2: The Story Spine (Main Planner, LangGraph Interrupts, SQLite Persistence)."""
import os
import shutil
import pytest
from langgraph.types import Command
from langgraph.checkpoint.sqlite import SqliteSaver

from pipeline.agents.main_planner import MainPlannerAgent
from pipeline.models.story import StoryArc, ChapterContract, ChapterTransition
from pipeline.graph.pipeline import (
    build_questforge_graph,
    get_default_sqlite_checkpointer,
)
from pipeline.models.context import StageEnum, CheckpointStatus


@pytest.fixture
def temp_db_path(tmp_path):
    db_file = tmp_path / "test_checkpoints.sqlite"
    return str(db_file)


def test_main_planner_pass_1_story_arc():
    """Verify Pass 1 produces valid StoryArc with exactly 2 traits."""
    planner = MainPlannerAgent()
    seed = "A detective in a dying city uncovers a conspiracy that reaches into her own past."
    
    arc = planner.pass_1_story_arc(story_seed=seed)
    
    assert isinstance(arc, StoryArc)
    assert len(arc.title) > 0
    assert len(arc.acts) == 3
    assert len(arc.trait_vocabulary) == 2
    assert arc.trait_vocabulary[0].name != arc.trait_vocabulary[1].name


def test_main_planner_pass_2_chapter_contracts():
    """Verify Pass 2 decomposes StoryArc into 6 sequential Chapter Contracts."""
    planner = MainPlannerAgent()
    seed = "A detective in a dying city uncovers a conspiracy that reaches into her own past."
    arc = planner.pass_1_story_arc(story_seed=seed)
    
    contracts = planner.pass_2_chapter_contracts(story_arc=arc)
    
    assert isinstance(contracts, list)
    assert 6 <= len(contracts) <= 8
    for idx, c in enumerate(contracts, start=1):
        assert isinstance(c, ChapterContract)
        assert c.order == idx
        assert c.chapter_id == f"chapter_{idx:02d}"
        assert c.entry_state.location
        assert c.exit_state.location
        assert len(c.attachment_points) >= 0


def test_main_planner_pass_3_chapter_transitions():
    """Verify Pass 3 produces narrative transitions between consecutive chapters."""
    planner = MainPlannerAgent()
    seed = "A detective in a dying city uncovers a conspiracy that reaches into her own past."
    arc = planner.pass_1_story_arc(story_seed=seed)
    contracts = planner.pass_2_chapter_contracts(story_arc=arc)
    
    transitions = planner.pass_3_chapter_transitions(chapter_contracts=contracts)
    
    assert isinstance(transitions, list)
    assert len(transitions) == len(contracts) - 1
    for t in transitions:
        assert isinstance(t, ChapterTransition)
        assert t.from_chapter_id
        assert t.to_chapter_id
        assert len(t.scene_summary) > 0
        assert len(t.narrative_hook) > 0


def test_langgraph_regeneration_loop():
    """Verify that rejecting with 'regenerate' loops back to re-run the stage with notes."""
    graph = build_questforge_graph()
    config = {"configurable": {"thread_id": "test_regen_thread"}}

    # Start -> Checkpoint 1
    graph.invoke({"story_seed": "A thief in a clockwork tower."}, config=config)
    state = graph.get_state(config)
    assert state.tasks[0].interrupts[0].value["checkpoint"] == 1

    # Send 'regenerate' action with notes
    graph.invoke(
        Command(resume={"action": "regenerate", "notes": "Make the tone more cynical and industrial"}),
        config=config,
    )
    
    # Verify graph re-executed stage_1_story_arc and paused again at Checkpoint 1
    state_after_regen = graph.get_state(config)
    assert len(state_after_regen.tasks) > 0
    assert state_after_regen.tasks[0].interrupts[0].value["checkpoint"] == 1

    # Now approve -> advances to Checkpoint 3.5 (World & Cast)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    state_after_approve = graph.get_state(config)
    assert state_after_approve.tasks[0].interrupts[0].value["checkpoint"] == 3.5


def test_sqlite_persistence_and_resume(temp_db_path):
    """Verify sessions save to disk with SqliteSaver and resume accurately after reopening."""
    thread_id = "persistent_detective_session"
    seed = "A detective in a dying city uncovers a conspiracy that reaches into her own past."

    # 1. First run with checkpointer: advance to Checkpoint 1
    saver1 = get_default_sqlite_checkpointer(temp_db_path)
    graph1 = build_questforge_graph(checkpointer=saver1)
    config = {"configurable": {"thread_id": thread_id}}

    graph1.invoke({"story_seed": seed}, config=config)
    state1 = graph1.get_state(config)
    cp1_data = state1.tasks[0].interrupts[0].value
    assert cp1_data["checkpoint"] == 1

    # 2. Simulate process exit and reload from sqlite file
    saver2 = get_default_sqlite_checkpointer(temp_db_path)
    graph2 = build_questforge_graph(checkpointer=saver2)

    # Inspect reloaded state from disk
    reloaded_state = graph2.get_state(config)
    assert reloaded_state.values["story_seed"] == seed
    assert len(reloaded_state.tasks[0].interrupts) > 0
    assert reloaded_state.tasks[0].interrupts[0].value["checkpoint"] == 1

    # 3. Resume from disk and approve Checkpoint 1 -> reaches Checkpoint 3.5
    graph2.invoke(Command(resume={"action": "approve"}), config=config)
    state_cp35 = graph2.get_state(config)
    assert state_cp35.tasks[0].interrupts[0].value["checkpoint"] == 3.5

    # 4. Approve Checkpoint 3.5 -> reaches Checkpoint 2 (Chapter Breakdown)
    graph2.invoke(Command(resume={"action": "approve"}), config=config)
    state_cp2 = graph2.get_state(config)
    assert state_cp2.tasks[0].interrupts[0].value["checkpoint"] == 2

    # 5. Approve Checkpoint 2 -> reaches Checkpoint 3 (Transitions)
    graph2.invoke(Command(resume={"action": "approve"}), config=config)
    state_cp3 = graph2.get_state(config)
    assert state_cp3.tasks[0].interrupts[0].value["checkpoint"] == 3


def test_phase_2_complete_milestone(temp_db_path):
    """Phase 2 Milestone test:
    Input: 'A detective in a dying city uncovers a conspiracy that reaches into her own past.'
    Output: Story Arc, 6 Chapter Contracts, 5 Transitions, saved and verifiable on disk.
    """
    thread_id = "phase_2_milestone"
    seed = "A detective in a dying city uncovers a conspiracy that reaches into her own past."
    saver = get_default_sqlite_checkpointer(temp_db_path)
    graph = build_questforge_graph(checkpointer=saver)
    config = {"configurable": {"thread_id": thread_id}}

    # Start -> CP1
    graph.invoke({"story_seed": seed}, config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 1

    # Approve CP1 -> CP3.5 (World & Cast)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 3.5

    # Approve CP3.5 -> CP2 (Chapter Breakdown)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 2

    # Approve CP2 -> CP3 (Transitions)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 3

    # Verify final Stage 1-3 assets in state
    final_values = graph.get_state(config).values
    
    # 1. Story Arc
    assert "story_arc" in final_values
    arc = StoryArc.model_validate(final_values["story_arc"])
    assert arc.title
    assert len(arc.acts) == 3
    assert len(arc.trait_vocabulary) == 2

    # 2. 6 Chapter Contracts
    assert "chapter_contracts" in final_values
    contracts = [ChapterContract.model_validate(c) for c in final_values["chapter_contracts"]]
    assert len(contracts) == 6

    # 3. 5 Chapter Transitions
    assert "transitions" in final_values
    transitions = [ChapterTransition.model_validate(t) for t in final_values["transitions"]]
    assert len(transitions) == 5

    # 4. Verify DB file exists and contains saved data
    assert os.path.exists(temp_db_path)
    assert os.path.getsize(temp_db_path) > 0
