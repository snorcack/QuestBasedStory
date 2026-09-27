"""Tests for Phase 4: Full Pipeline and Export (Terminal-Complete MVP)."""
import os
import json
import pytest
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver

from pipeline.agents import QuestArchitectAgent, ExportAgent
from pipeline.models import (
    StoryArc,
    ChapterContract,
    ChapterState,
    WorldBible,
    Location,
    NPC,
    Character,
    AuthoredChapter,
    Scene,
    DialogueNode,
    DialogueChoice,
    TraitDefinition,
    TraitRequirement,
    TraitTier,
    Quest,
    QuestType,
    StageEnum,
)
from pipeline.graph.pipeline import build_questforge_graph


@pytest.fixture
def test_export_dir(tmp_path):
    return str(tmp_path / "game_package")


def test_quest_architect_trait_reachability():
    """Verify Quest Architect flags unreachable gates when required choices aren't present."""
    architect = QuestArchitectAgent()
    traits = [
        TraitDefinition(name="Cunning", description="Electronic infiltration", color_hex="#E0A82E"),
        TraitDefinition(name="Empathy", description="Human alliance building", color_hex="#2EA8E0"),
    ]

    # Chapter with 0 Cunning choices
    ch1 = AuthoredChapter(
        chapter_id="chapter_01",
        scenes=[],
        dialogue_tree=[
            DialogueNode(
                node_id="node_01",
                text="Hello",
                choices=[DialogueChoice(label="Choice 1", trait_tag="Empathy")],
            )
        ],
    )

    # Quest requiring 'established' Cunning (min 4 choices) in chapter_01 -> must be flagged unreachable!
    impossible_quest = Quest(
        quest_id="quest_hard_gate",
        title="Crack the Vault",
        type=QuestType.MAIN_BLOCKING,
        chapter_id="chapter_01",
        location_id="loc_district_01",
        trigger_flag="vault_seen",
        objective="Crack the vault using advanced ICE breaking.",
        required_trait=TraitRequirement(name="Cunning", strength=TraitTier.ESTABLISHED),
    )

    validation = architect._validate_trait_reachability(
        chapters=[ch1],
        quests=[impossible_quest],
        traits=traits,
    )

    assert validation.is_valid is False
    assert "quest_hard_gate" in validation.unreachable_gates
    assert len(validation.warnings) > 0


def test_export_agent_referential_validation(test_export_dir):
    """Verify Export Agent catches broken location references and missing dialogue nodes."""
    exporter = ExportAgent(output_dir=test_export_dir)

    bible = WorldBible(locations=[Location(id="loc_valid", name="Valid Loc", description="Desc")])
    chars = [Character(id="char_valid", name="Valid Char")]
    arc = StoryArc(
        title="Test Arc",
        genre="Noir",
        tone="Dark",
        themes=[],
        protagonist_sketch="",
        antagonist_sketch="",
        central_conflict="",
    )

    # Broken quest pointing to loc_unknown
    broken_quest = Quest(
        quest_id="quest_broken",
        title="Broken",
        type=QuestType.MAIN_BLOCKING,
        chapter_id="chapter_01",
        location_id="loc_unknown",
        trigger_flag="f",
        objective="o",
    )

    # Broken dialogue node pointing to node_ghost
    ch = AuthoredChapter(
        chapter_id="chapter_01",
        scenes=[],
        dialogue_tree=[
            DialogueNode(node_id="node_01", next_node="node_ghost")
        ],
    )

    report = exporter.validate_package(
        story_arc=arc,
        world_bible=bible,
        characters=chars,
        chapters=[ch],
        quests=[broken_quest],
    )

    assert report.is_valid is False
    assert len(report.errors) >= 2
    error_cats = [e.category for e in report.errors]
    assert "reference" in error_cats
    assert "graph" in error_cats


def test_export_agent_writes_complete_package(test_export_dir):
    """Verify Export Agent writes valid JSON files for all components."""
    exporter = ExportAgent(output_dir=test_export_dir)
    bible = WorldBible(locations=[Location(id="loc_market", name="Market", description="Busy market")])
    chars = [Character(id="char_elena", name="Elena Cross")]
    traits = [TraitDefinition(name="Cunning", description="Deception", color_hex="#E0A82E")]
    ch = AuthoredChapter(
        chapter_id="chapter_01",
        scenes=[Scene(scene_id="sc_01", title="Scene 1", location_id="loc_market", prose="Rain drops.")],
        dialogue_tree=[DialogueNode(node_id="node_01", text="Welcome")],
        characters_present=["char_elena"],
    )
    quests = [
        Quest(
            quest_id="quest_01",
            title="Investigate",
            type=QuestType.MAIN_BLOCKING,
            chapter_id="chapter_01",
            location_id="loc_market",
            trigger_flag="start",
            objective="Find clues",
        )
    ]

    manifest = exporter.export_package(
        story_arc=StoryArc(title="Neon City", genre="Noir", tone="Dark", themes=[], protagonist_sketch="", antagonist_sketch="", central_conflict=""),
        world_bible=bible,
        characters=chars,
        chapters=[ch],
        quests=quests,
        attachment_points=[],
        achievements=[],
        traits=traits,
    )

    assert manifest.title == "Neon City"
    assert manifest.chapters_count == 1
    assert os.path.exists(os.path.join(test_export_dir, "manifest.json"))
    assert os.path.exists(os.path.join(test_export_dir, "world_bible.json"))
    assert os.path.exists(os.path.join(test_export_dir, "characters.json"))
    assert os.path.exists(os.path.join(test_export_dir, "trait_arc.json"))
    assert os.path.exists(os.path.join(test_export_dir, "chapters", "chapter_01.json"))
    assert os.path.exists(os.path.join(test_export_dir, "achievements.json"))
    assert os.path.exists(os.path.join(test_export_dir, "attachment_points.json"))


def test_phase_4_end_to_end_pipeline_and_export():
    """Phase 4 Milestone: Full pipeline execution from seed through all 5 checkpoints to game_package/."""
    checkpointer = MemorySaver()
    graph = build_questforge_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "test_phase4_full_pipeline"}}

    # Start -> CP1 (Story Arc)
    graph.invoke({"story_seed": "A detective in a dying city uncovers a conspiracy that reaches into her own past."}, config=config)
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

    # Approve CP3 -> Stage 4 (Chapter Authoring Loop)
    graph.invoke(Command(resume={"action": "approve"}), config=config)

    # Approve each chapter at Checkpoint 4 until reaching Checkpoint 5
    state = graph.get_state(config)
    while state.tasks and state.tasks[0].interrupts and state.tasks[0].interrupts[0].value.get("stage") == StageEnum.STAGE_4_CHAPTER_AUTHORING.value:
        graph.invoke(Command(resume={"action": "approve"}), config=config)
        state = graph.get_state(config)

    # At Checkpoint 5 (Quest Mapping)
    assert len(state.tasks[0].interrupts) > 0
    cp5_data = state.tasks[0].interrupts[0].value
    assert cp5_data["stage"] == StageEnum.STAGE_5_QUEST_MAPPING.value
    assert cp5_data["checkpoint"] == 5

    # Approve CP5 -> Stage Export
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    final_state = graph.get_state(config)

    # Verify pipeline reached terminal export completion
    assert final_state.values.get("current_stage") == StageEnum.EXPORT_COMPLETE.value

    # Verify game_package files on disk
    pkg_dir = "game_package"
    assert os.path.exists(os.path.join(pkg_dir, "manifest.json"))
    assert os.path.exists(os.path.join(pkg_dir, "world_bible.json"))
    assert os.path.exists(os.path.join(pkg_dir, "characters.json"))
    assert os.path.exists(os.path.join(pkg_dir, "trait_arc.json"))
    assert os.path.exists(os.path.join(pkg_dir, "chapters", "chapter_01.json"))
    assert os.path.exists(os.path.join(pkg_dir, "achievements.json"))
    assert os.path.exists(os.path.join(pkg_dir, "attachment_points.json"))

    # Read and validate manifest.json
    with open(os.path.join(pkg_dir, "manifest.json"), "r", encoding="utf-8") as f:
        manifest_data = json.load(f)
    assert manifest_data["version"] == "1.0.0"
    assert manifest_data["chapters_count"] > 0
    assert len(manifest_data["traits"]) == 2
