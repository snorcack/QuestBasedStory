"""Tests for Phase 3: Chapter Authoring Loop (Pipeline Stage 4)."""
import pytest
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver

from pipeline.agents import (
    CharacterForgeAgent,
    LoreWeaverAgent,
    NarratorAgent,
    CriticAgent,
    BranchKeeperAgent,
)
from pipeline.models import (
    StoryArc,
    ChapterContract,
    ChapterState,
    WorldBible,
    AuthoredChapter,
    TraitTier,
    StageEnum,
)
from pipeline.graph.pipeline import build_questforge_graph


@pytest.fixture
def sample_story_arc():
    return StoryArc(
        title="A Neon Grave",
        genre="Cyber-Noir Mystery",
        tone="Gritty, atmospheric",
        themes=["Institutional decay", "Memory manipulation"],
        protagonist_sketch="Elena Cross, disgraced cipher investigator.",
        antagonist_sketch="Councilman Julian Sterling, civic amnesia architect.",
        central_conflict="A conspiracy wiped Cross's memories of Sterling's crimes.",
        acts=[],
        trait_vocabulary=[
            {"name": "Cunning", "description": "Electronic deception", "color_hex": "#E0A82E"},
            {"name": "Empathy", "description": "Human alliance building", "color_hex": "#2EA8E0"},
        ],
    )


@pytest.fixture
def sample_contract():
    return ChapterContract(
        chapter_id="chapter_01",
        order=1,
        title="Rain on Lower Conduit",
        narrative_scope="Elena enters the lower conduit to locate her old informant.",
        entry_state=ChapterState(
            location="loc_district_01",
            trait_snapshot={"Cunning": TraitTier.NONE, "Empathy": TraitTier.NONE},
            inventory=["detective_badge"],
            active_flags=["game_start"],
        ),
        exit_state=ChapterState(
            location="loc_sunken_bazaar",
            trait_snapshot={"Cunning": TraitTier.EMERGING, "Empathy": TraitTier.NONE},
            inventory=["detective_badge", "corrupted_chip"],
            active_flags=["ch01_complete"],
        ),
    )


def test_character_forge_agent(sample_story_arc):
    """Verify Character Forge generates cast sheets and relationship network."""
    forge = CharacterForgeAgent()
    characters, rel_map = forge.generate_cast(sample_story_arc)

    assert len(characters) >= 2
    roles = [c.role.value for c in characters]
    assert "protagonist" in roles
    assert "antagonist" in roles
    assert len(rel_map.edges) > 0


def test_lore_weaver_agent(sample_story_arc, sample_contract):
    """Verify Lore Weaver generates World Bible, indexes into ChromaDB, and extracts context."""
    weaver = LoreWeaverAgent()
    bible = weaver.generate_world_bible(sample_story_arc)

    assert len(bible.locations) >= 2
    assert len(bible.rules) >= 1

    ctx = weaver.get_chapter_context(sample_contract, bible)
    assert "chapter_id" in ctx
    assert len(ctx["locations"]) >= 1


def test_narrator_agent(sample_contract, sample_story_arc):
    """Verify Narrator generates scenes and first-person journal entries."""
    narrator = NarratorAgent()
    scenes = narrator.author_chapter_prose(
        chapter_contract=sample_contract,
        world_context={"chapter_id": sample_contract.chapter_id, "locations": []},
        characters=[],
    )

    assert len(scenes) >= 1
    assert len(scenes[0].prose) > 30
    assert scenes[0].location_id

    journal = narrator.write_journal_entry("Infiltrate the sunken archive.")
    assert "Journal:" in journal
    assert "Infiltrate the sunken archive." in journal


def test_critic_agent_hard_gate(sample_contract):
    """Verify Critic enforces the Chapter Contract hard gate."""
    critic = CriticAgent(pass_threshold=75)
    narrator = NarratorAgent()
    scenes = narrator.author_chapter_prose(sample_contract, {}, [])

    # Ensure scenes visit both entry and exit locations
    scenes[0].location_id = sample_contract.entry_state.location
    scenes[-1].location_id = sample_contract.exit_state.location

    score = critic.evaluate_chapter(sample_contract, scenes)
    assert score.contract_passed is True
    assert score.is_passed(75) is True

    # Intentionally violate contract: remove exit location
    scenes[-1].location_id = "loc_wrong_place"
    failing_score = critic.evaluate_chapter(sample_contract, scenes)
    assert failing_score.contract_passed is False
    assert failing_score.is_passed(75) is False
    assert len(failing_score.contract_violations) > 0


def test_branch_keeper_agent(sample_contract, sample_story_arc):
    """Verify Branch Keeper creates dialogue tree with trait-tagged choices."""
    keeper = BranchKeeperAgent()
    narrator = NarratorAgent()
    scenes = narrator.author_chapter_prose(sample_contract, {}, [])
    
    tree = keeper.generate_dialogue_tree(
        chapter_contract=sample_contract,
        scenes=scenes,
        characters=[],
        traits=sample_story_arc.trait_vocabulary,
    )

    assert tree.chapter_id == sample_contract.chapter_id
    assert len(tree.nodes) >= 2
    # Check that choices carry trait tags
    choices_with_traits = [
        c for node in tree.nodes for c in node.choices if c.trait_tag is not None
    ]
    assert len(choices_with_traits) >= 1
    assert choices_with_traits[0].trait_tag in ("Cunning", "Empathy")


def test_phase_3_chapter_authoring_end_to_end():
    """Phase 3 Milestone: Chapter 1 authored, reviewed by Critic, and paused at Checkpoint 4."""
    checkpointer = MemorySaver()
    graph = build_questforge_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "test_phase3_chapter_thread"}}

    # Start -> Checkpoint 1
    graph.invoke({"story_seed": "A detective in a dying city uncovers a conspiracy."}, config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 1

    # Approve CP1 -> Checkpoint 3.5 (World & Cast)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 3.5

    # Approve CP3.5 -> Checkpoint 2 (Chapter Breakdown)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 2

    # Approve CP2 -> Checkpoint 3 (Transitions)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    assert graph.get_state(config).tasks[0].interrupts[0].value["checkpoint"] == 3

    # Approve CP3 -> triggers Stage 4 (Setup -> Narrator -> Critic -> Branch Keeper -> Checkpoint 4!)
    graph.invoke(Command(resume={"action": "approve"}), config=config)
    
    # State should now be paused at Checkpoint 4 (human review for Chapter 1)
    state = graph.get_state(config)
    assert len(state.tasks[0].interrupts) > 0
    cp4_data = state.tasks[0].interrupts[0].value
    assert cp4_data["stage"] == StageEnum.STAGE_4_CHAPTER_AUTHORING.value
    assert cp4_data["checkpoint"] == 4
    assert cp4_data["chapter_index"] == 0

    # Inspect authored chapter payload
    chapter_payload = cp4_data["payload"]
    assert chapter_payload["chapter_id"] == "chapter_01"
    assert len(chapter_payload["scenes"]) >= 1
    assert len(chapter_payload["dialogue_tree"]) >= 1
    assert chapter_payload["critic_score"] >= 75
