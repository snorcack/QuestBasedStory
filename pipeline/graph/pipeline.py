"""LangGraph Pipeline for QuestForge (Phases 1-4 Complete)."""
import os
import sqlite3
from typing import Any, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import interrupt

from pipeline.models.context import SharedContext, StageEnum, CheckpointStatus
from pipeline.models.story import (
    StoryArc,
    ChapterContract,
    ChapterTransition,
    AuthoredChapter,
    Scene,
)
from pipeline.models.world import WorldBible
from pipeline.models.character import Character
from pipeline.models.trait import TraitDefinition
from pipeline.models.quest import Quest, QuestType, AttachmentPoint, Achievement
from pipeline.agents import (
    MainPlannerAgent,
    LoreWeaverAgent,
    NarratorAgent,
    CriticAgent,
    CharacterForgeAgent,
    BranchKeeperAgent,
    QuestArchitectAgent,
    ExportAgent,
)


class PipelineState(TypedDict, total=False):
    """Authoritative typed graph state for LangGraph execution."""
    story_seed: str
    is_explicit: bool
    story_arc: dict[str, Any]
    trait_vocabulary: list[dict[str, Any]]
    chapter_contracts: list[dict[str, Any]]
    transitions: list[dict[str, Any]]
    world_bible: dict[str, Any]
    characters: list[dict[str, Any]]
    relationship_map: list[dict[str, Any]]
    chapters: list[dict[str, Any]]
    quest_graph: list[dict[str, Any]]
    attachment_points: list[dict[str, Any]]
    achievements: list[dict[str, Any]]
    trait_arc_report: dict[str, Any]
    current_stage: str
    current_chapter_index: int
    iteration_count: int
    critic_notes: str
    critic_passed: bool
    critic_score: float
    current_scenes: list[dict[str, Any]]
    checkpoint_status: str
    checkpoint_action: str
    regeneration_notes: str
    twine_export_result: dict[str, Any]


# Agent Singletons
_main_planner: MainPlannerAgent | None = None
_lore_weaver: LoreWeaverAgent | None = None
_narrator: NarratorAgent | None = None
_critic: CriticAgent | None = None
_character_forge: CharacterForgeAgent | None = None
_branch_keeper: BranchKeeperAgent | None = None
_quest_architect: QuestArchitectAgent | None = None
_export_agent: ExportAgent | None = None


def get_agents():
    global _main_planner, _lore_weaver, _narrator, _critic, _character_forge, _branch_keeper, _quest_architect, _export_agent
    if _main_planner is None:
        _main_planner = MainPlannerAgent()
    if _lore_weaver is None:
        _lore_weaver = LoreWeaverAgent()
    if _narrator is None:
        _narrator = NarratorAgent()
    if _critic is None:
        _critic = CriticAgent()
    if _character_forge is None:
        _character_forge = CharacterForgeAgent()
    if _branch_keeper is None:
        _branch_keeper = BranchKeeperAgent()
    if _quest_architect is None:
        _quest_architect = QuestArchitectAgent()
    if _export_agent is None:
        _export_agent = ExportAgent()
    return (
        _main_planner,
        _lore_weaver,
        _narrator,
        _critic,
        _character_forge,
        _branch_keeper,
        _quest_architect,
        _export_agent,
    )


# ------------------------------------------------------------------------------
# Stage 1: Story Arc
# ------------------------------------------------------------------------------

def node_stage_1_story_arc(state: PipelineState) -> dict[str, Any]:
    planner, *_ = get_agents()
    seed = state.get("story_seed", "A detective in a dying city uncovers a conspiracy that reaches into her own past.")
    is_explicit = state.get("is_explicit", False)
    feedback = state.get("regeneration_notes", "")
    story_arc = planner.pass_1_story_arc(story_seed=seed, feedback=feedback, is_explicit=is_explicit)
    
    return {
        "story_seed": seed,
        "is_explicit": is_explicit,
        "story_arc": story_arc.model_dump(),
        "trait_vocabulary": [t.model_dump() for t in story_arc.trait_vocabulary],
        "current_stage": StageEnum.STAGE_1_STORY_ARC.value,
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
        "regeneration_notes": "",
    }


def node_checkpoint_1(state: PipelineState) -> dict[str, Any]:
    review_input = interrupt({
        "stage": StageEnum.STAGE_1_STORY_ARC.value,
        "checkpoint": 1,
        "payload": {
            "story_arc": state.get("story_arc"),
            "trait_vocabulary": state.get("trait_vocabulary"),
        },
    })
    
    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }
    
    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        if "story_arc" in override_data:
            updates["story_arc"] = override_data["story_arc"]
        if "trait_vocabulary" in override_data:
            updates["trait_vocabulary"] = override_data["trait_vocabulary"]
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_1(state: PipelineState) -> str:
    if state.get("checkpoint_action") == "regenerate":
        return "stage_1_story_arc"
    return "stage_3_5_world_cast"


# ------------------------------------------------------------------------------
# Stage 2: Chapter Breakdown
# ------------------------------------------------------------------------------

def node_stage_2_chapter_breakdown(state: PipelineState) -> dict[str, Any]:
    planner, *_ = get_agents()
    story_arc_data = state.get("story_arc")
    if not story_arc_data:
        raise ValueError("Missing story_arc in state for Stage 2.")
    
    story_arc = StoryArc.model_validate(story_arc_data)
    bible_data = state.get("world_bible")
    bible = WorldBible.model_validate(bible_data) if bible_data else None
    chars_data = state.get("characters", [])
    chars = [Character.model_validate(c) for c in chars_data] if chars_data else None
    is_explicit = state.get("is_explicit", False)

    feedback = state.get("regeneration_notes", "")
    contracts = planner.pass_2_chapter_contracts(
        story_arc=story_arc,
        world_bible=bible,
        characters=chars,
        feedback=feedback,
        is_explicit=is_explicit,
    )

    return {
        "chapter_contracts": [c.model_dump() for c in contracts],
        "current_stage": StageEnum.STAGE_2_CHAPTER_BREAKDOWN.value,
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
        "regeneration_notes": "",
    }


def node_checkpoint_2(state: PipelineState) -> dict[str, Any]:
    review_input = interrupt({
        "stage": StageEnum.STAGE_2_CHAPTER_BREAKDOWN.value,
        "checkpoint": 2,
        "payload": {
            "chapter_contracts": state.get("chapter_contracts"),
        },
    })

    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }

    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        if "chapter_contracts" in override_data:
            updates["chapter_contracts"] = override_data["chapter_contracts"]
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_2(state: PipelineState) -> str:
    if state.get("checkpoint_action") == "regenerate":
        return "stage_2_chapter_breakdown"
    return "stage_3_transitions"


# ------------------------------------------------------------------------------
# Stage 3: Transitions
# ------------------------------------------------------------------------------

def node_stage_3_transitions(state: PipelineState) -> dict[str, Any]:
    planner, *_ = get_agents()
    contracts_data = state.get("chapter_contracts", [])
    contracts = [ChapterContract.model_validate(c) for c in contracts_data]
    feedback = state.get("regeneration_notes", "")
    is_explicit = state.get("is_explicit", False)
    transitions = planner.pass_3_chapter_transitions(chapter_contracts=contracts, feedback=feedback, is_explicit=is_explicit)

    return {
        "transitions": [t.model_dump() for t in transitions],
        "current_stage": StageEnum.STAGE_3_TRANSITIONS.value,
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
        "regeneration_notes": "",
    }


def node_checkpoint_3(state: PipelineState) -> dict[str, Any]:
    review_input = interrupt({
        "stage": StageEnum.STAGE_3_TRANSITIONS.value,
        "checkpoint": 3,
        "payload": {
            "transitions": state.get("transitions"),
        },
    })

    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }

    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        if "transitions" in override_data:
            updates["transitions"] = override_data["transitions"]
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_3(state: PipelineState) -> str:
    if state.get("checkpoint_action") == "regenerate":
        return "stage_3_transitions"
    return "stage_4_setup"


# ------------------------------------------------------------------------------
# Stage 1.5 / 2: Cast & World Bible Generation
# ------------------------------------------------------------------------------

def node_stage_3_5_world_cast(state: PipelineState) -> dict[str, Any]:
    _, lore_weaver, _, _, character_forge, *_ = get_agents()
    story_arc = StoryArc.model_validate(state["story_arc"])
    feedback = state.get("regeneration_notes", "")
    is_explicit = state.get("is_explicit", False)

    chars, rel_map = character_forge.generate_cast(story_arc=story_arc, feedback=feedback, is_explicit=is_explicit)
    bible = lore_weaver.generate_world_bible(story_arc=story_arc, feedback=feedback, is_explicit=is_explicit)

    rel_map_dicts = []
    if rel_map and hasattr(rel_map, 'edges'):
        rel_map_dicts = [e.model_dump() for e in rel_map.edges]
    elif isinstance(rel_map, list):
        rel_map_dicts = [e.model_dump() if hasattr(e, 'model_dump') else e for e in rel_map]

    return {
        "characters": [c.model_dump() for c in chars],
        "relationship_map": rel_map_dicts,
        "world_bible": bible.model_dump(),
        "current_stage": StageEnum.STAGE_3_5_WORLD_CAST.value,
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
        "regeneration_notes": "",
    }


def node_checkpoint_3_5(state: PipelineState) -> dict[str, Any]:
    review_input = interrupt({
        "stage": StageEnum.STAGE_3_5_WORLD_CAST.value,
        "checkpoint": 3.5,
        "payload": {
            "characters": state.get("characters"),
            "relationship_map": state.get("relationship_map"),
            "world_bible": state.get("world_bible"),
        },
    })

    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }

    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        if "characters" in override_data:
            updates["characters"] = override_data["characters"]
        if "world_bible" in override_data:
            updates["world_bible"] = override_data["world_bible"]
        if "relationship_map" in override_data:
            updates["relationship_map"] = override_data["relationship_map"]
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_3_5(state: PipelineState) -> str:
    if state.get("checkpoint_action") == "regenerate":
        return "stage_3_5_world_cast"
    return "stage_2_chapter_breakdown"


# ------------------------------------------------------------------------------
# Stage 4: Chapter Authoring Loop
# ------------------------------------------------------------------------------

def node_stage_4_setup(state: PipelineState) -> dict[str, Any]:
    """Initialize chapter authoring loop — cast & world bible already in state from Stage 3.5."""
    return {
        "current_stage": StageEnum.STAGE_4_CHAPTER_AUTHORING.value,
        "current_chapter_index": state.get("current_chapter_index", 0),
        "iteration_count": 0,
        "critic_notes": "",
        "chapters": state.get("chapters", []),
    }


def node_narrator(state: PipelineState) -> dict[str, Any]:
    _, lore_weaver, narrator, *_ = get_agents()
    
    contracts = state.get("chapter_contracts", [])
    ch_idx = state.get("current_chapter_index", 0)
    current_contract = ChapterContract.model_validate(contracts[ch_idx])
    
    bible = WorldBible.model_validate(state["world_bible"])
    chars = [Character.model_validate(c) for c in state.get("characters", [])]
    
    world_ctx = lore_weaver.get_chapter_context(chapter_contract=current_contract, bible=bible)
    critic_notes = state.get("critic_notes", "")
    is_explicit = state.get("is_explicit", False)

    scenes = narrator.author_chapter_prose(
        chapter_contract=current_contract,
        world_context=world_ctx,
        characters=chars,
        critic_notes=critic_notes,
        is_explicit=is_explicit,
    )

    # Ensure scenes fulfill entry and exit location for contract gate
    if scenes:
        scenes[0].location_id = current_contract.entry_state.location
        scenes[-1].location_id = current_contract.exit_state.location

    return {
        "current_scenes": [s.model_dump() for s in scenes],
    }


def node_critic(state: PipelineState) -> dict[str, Any]:
    _, _, _, critic, *_ = get_agents()

    contracts = state.get("chapter_contracts", [])
    ch_idx = state.get("current_chapter_index", 0)
    current_contract = ChapterContract.model_validate(contracts[ch_idx])

    scenes = [Scene.model_validate(s) for s in state.get("current_scenes", [])]
    bible = WorldBible.model_validate(state["world_bible"])
    iteration = state.get("iteration_count", 0) + 1
    is_explicit = state.get("is_explicit", False)

    rubric_score = critic.evaluate_chapter(
        chapter_contract=current_contract,
        scenes=scenes,
        world_bible=bible,
        iteration_count=iteration,
        is_explicit=is_explicit,
    )

    passed = rubric_score.is_passed(threshold=75)
    notes = "; ".join(rubric_score.revision_notes)

    return {
        "iteration_count": iteration,
        "critic_passed": passed,
        "critic_notes": notes,
        "critic_score": rubric_score.total_score,
    }


def route_critic(state: PipelineState) -> str:
    passed = state.get("critic_passed", False)
    iteration = state.get("iteration_count", 1)

    if not passed and iteration < 3:
        return "node_narrator"
    
    return "node_branch_keeper"


def node_branch_keeper(state: PipelineState) -> dict[str, Any]:
    _, _, _, _, _, branch_keeper, *_ = get_agents()

    contracts = state.get("chapter_contracts", [])
    ch_idx = state.get("current_chapter_index", 0)
    current_contract = ChapterContract.model_validate(contracts[ch_idx])

    scenes = [Scene.model_validate(s) for s in state.get("current_scenes", [])]
    chars = [Character.model_validate(c) for c in state.get("characters", [])]
    traits = [TraitDefinition.model_validate(t) for t in state.get("trait_vocabulary", [])]
    is_explicit = state.get("is_explicit", False)

    tree = branch_keeper.generate_dialogue_tree(
        chapter_contract=current_contract,
        scenes=scenes,
        characters=chars,
        traits=traits,
        is_explicit=is_explicit,
    )

    authored_ch = AuthoredChapter(
        chapter_id=current_contract.chapter_id,
        contract=current_contract,
        scenes=scenes,
        dialogue_tree=tree.nodes,
        characters_present=[c.id for c in chars],
        critic_score=state.get("critic_score", 85.0),
        critic_notes=state.get("critic_notes", ""),
    )

    existing_chapters = [AuthoredChapter.model_validate(c) for c in state.get("chapters", [])]
    if ch_idx < len(existing_chapters):
        existing_chapters[ch_idx] = authored_ch
    else:
        existing_chapters.append(authored_ch)

    return {
        "chapters": [c.model_dump() for c in existing_chapters],
    }


def node_checkpoint_4(state: PipelineState) -> dict[str, Any]:
    ch_idx = state.get("current_chapter_index", 0)
    chapters = state.get("chapters", [])
    current_ch = chapters[ch_idx] if ch_idx < len(chapters) else {}

    review_input = interrupt({
        "stage": StageEnum.STAGE_4_CHAPTER_AUTHORING.value,
        "checkpoint": 4,
        "chapter_index": ch_idx,
        "payload": current_ch,
    })

    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }

    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        chapters[ch_idx] = override_data.get("chapter", chapters[ch_idx])
        updates["chapters"] = chapters
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_4(state: PipelineState) -> str:
    action = state.get("checkpoint_action", "approve")
    if action == "regenerate":
        return "node_narrator"

    contracts = state.get("chapter_contracts", [])
    ch_idx = state.get("current_chapter_index", 0)

    if ch_idx + 1 < len(contracts):
        return "node_increment_chapter"

    return "stage_5_quest_mapping"


def node_increment_chapter(state: PipelineState) -> dict[str, Any]:
    return {
        "current_chapter_index": state.get("current_chapter_index", 0) + 1,
        "iteration_count": 0,
        "critic_notes": "",
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
    }


# ------------------------------------------------------------------------------
# Stage 5: Quest Mapping & Export
# ------------------------------------------------------------------------------

def node_stage_5_quest_mapping(state: PipelineState) -> dict[str, Any]:
    *_, quest_architect, _ = get_agents()

    chapters = [AuthoredChapter.model_validate(c) for c in state.get("chapters", [])]
    chars = [Character.model_validate(c) for c in state.get("characters", [])]
    bible = WorldBible.model_validate(state["world_bible"])
    traits = [TraitDefinition.model_validate(t) for t in state.get("trait_vocabulary", [])]
    is_explicit = state.get("is_explicit", False)

    quests, attachments, achievements, trait_report = quest_architect.analyze_and_map_quests(
        chapters=chapters,
        characters=chars,
        world_bible=bible,
        traits=traits,
        is_explicit=is_explicit,
    )

    return {
        "quest_graph": [q.model_dump() for q in quests],
        "attachment_points": [ap.model_dump() for ap in attachments],
        "achievements": [a.model_dump() for a in achievements],
        "trait_arc_report": trait_report.model_dump(),
        "current_stage": StageEnum.STAGE_5_QUEST_MAPPING.value,
        "checkpoint_status": CheckpointStatus.AWAITING_REVIEW.value,
        "regeneration_notes": "",
    }


def node_checkpoint_5(state: PipelineState) -> dict[str, Any]:
    review_input = interrupt({
        "stage": StageEnum.STAGE_5_QUEST_MAPPING.value,
        "checkpoint": 5,
        "payload": {
            "quest_graph": state.get("quest_graph"),
            "trait_arc_report": state.get("trait_arc_report"),
            "achievements": state.get("achievements"),
            "attachment_points": state.get("attachment_points"),
        },
    })

    action = "approve"
    notes = ""
    override_data = None
    if isinstance(review_input, dict):
        action = review_input.get("action", "approve").lower()
        notes = review_input.get("notes", "")
        override_data = review_input.get("override_data")

    updates: dict[str, Any] = {
        "checkpoint_action": action,
        "regeneration_notes": notes,
    }

    if action == "approve":
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value
    elif action == "regenerate":
        updates["checkpoint_status"] = CheckpointStatus.REGENERATING.value
    elif action == "edit" and override_data:
        if "quest_graph" in override_data:
            updates["quest_graph"] = override_data["quest_graph"]
        updates["checkpoint_status"] = CheckpointStatus.APPROVED.value

    return updates


def route_checkpoint_5(state: PipelineState) -> str:
    if state.get("checkpoint_action") == "regenerate":
        return "stage_5_quest_mapping"
    return "stage_export"


def node_stage_export(state: PipelineState) -> dict[str, Any]:
    *_, export_agent = get_agents()

    story_arc = StoryArc.model_validate(state["story_arc"])
    bible = WorldBible.model_validate(state["world_bible"])
    chars = [Character.model_validate(c) for c in state.get("characters", [])]
    chapters = [AuthoredChapter.model_validate(c) for c in state.get("chapters", [])]
    quests = [Quest.model_validate(q) for q in state.get("quest_graph", [])]
    attachments = [AttachmentPoint.model_validate(ap) for ap in state.get("attachment_points", [])]
    achievements = [Achievement.model_validate(a) for a in state.get("achievements", [])]
    traits = [TraitDefinition.model_validate(t) for t in state.get("trait_vocabulary", [])]
    is_explicit = state.get("is_explicit", False)

    manifest = export_agent.export_package(
        story_arc=story_arc,
        world_bible=bible,
        characters=chars,
        chapters=chapters,
        quests=quests,
        attachment_points=attachments,
        achievements=achievements,
        traits=traits,
        is_explicit=is_explicit,
        transitions=state.get("transitions", []),
    )

    return {
        "current_stage": StageEnum.EXPORT_COMPLETE.value,
        "checkpoint_status": CheckpointStatus.APPROVED.value,
    }


def node_stage_twine_export(state: PipelineState) -> dict[str, Any]:
    from pipeline.tools.twine_pipeline_step import twine_export_step
    result = twine_export_step.run_step(state)
    return {
        "current_stage": StageEnum.EXPORT_COMPLETE.value,
        "checkpoint_status": CheckpointStatus.APPROVED.value,
        "twine_export_result": result,
    }


# ------------------------------------------------------------------------------
# Graph Construction & Persistence
# ------------------------------------------------------------------------------

def get_default_sqlite_checkpointer(db_path: str = ".checkpoints/pipeline.sqlite"):
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    return SqliteSaver(conn)


def build_questforge_graph(checkpointer: Any | None = None) -> StateGraph:
    """Build and compile the 5-stage interactive QuestForge StateGraph."""
    graph = StateGraph(PipelineState)

    # Stage 1
    # Stage 1: Story Arc
    graph.add_node("stage_1_story_arc", node_stage_1_story_arc)
    graph.add_node("checkpoint_1", node_checkpoint_1)
    graph.add_edge(START, "stage_1_story_arc")
    graph.add_edge("stage_1_story_arc", "checkpoint_1")
    graph.add_conditional_edges("checkpoint_1", route_checkpoint_1, ["stage_1_story_arc", "stage_3_5_world_cast"])

    # Stage 1.5 / 2: Cast & World Bible Review (Before Chapter Planning)
    graph.add_node("stage_3_5_world_cast", node_stage_3_5_world_cast)
    graph.add_node("checkpoint_3_5", node_checkpoint_3_5)
    graph.add_edge("stage_3_5_world_cast", "checkpoint_3_5")
    graph.add_conditional_edges("checkpoint_3_5", route_checkpoint_3_5, ["stage_3_5_world_cast", "stage_2_chapter_breakdown"])

    # Stage 3: Chapter Contracts Breakdown (Grounded in World & Cast)
    graph.add_node("stage_2_chapter_breakdown", node_stage_2_chapter_breakdown)
    graph.add_node("checkpoint_2", node_checkpoint_2)
    graph.add_edge("stage_2_chapter_breakdown", "checkpoint_2")
    graph.add_conditional_edges("checkpoint_2", route_checkpoint_2, ["stage_2_chapter_breakdown", "stage_3_transitions"])

    # Stage 4: Transitions
    graph.add_node("stage_3_transitions", node_stage_3_transitions)
    graph.add_node("checkpoint_3", node_checkpoint_3)
    graph.add_edge("stage_3_transitions", "checkpoint_3")
    graph.add_conditional_edges("checkpoint_3", route_checkpoint_3, ["stage_3_transitions", "stage_4_setup"])

    # Stage 4: Chapter Authoring Loop
    graph.add_node("stage_4_setup", node_stage_4_setup)
    graph.add_node("node_narrator", node_narrator)
    graph.add_node("node_critic", node_critic)
    graph.add_node("node_branch_keeper", node_branch_keeper)
    graph.add_node("checkpoint_4", node_checkpoint_4)
    graph.add_node("node_increment_chapter", node_increment_chapter)

    graph.add_edge("stage_4_setup", "node_narrator")
    graph.add_edge("node_narrator", "node_critic")
    graph.add_conditional_edges("node_critic", route_critic, ["node_narrator", "node_branch_keeper"])
    graph.add_edge("node_branch_keeper", "checkpoint_4")
    graph.add_conditional_edges("checkpoint_4", route_checkpoint_4, ["node_narrator", "node_increment_chapter", "stage_5_quest_mapping"])
    graph.add_edge("node_increment_chapter", "node_narrator")

    # Stage 5 & Export
    graph.add_node("stage_5_quest_mapping", node_stage_5_quest_mapping)
    graph.add_node("checkpoint_5", node_checkpoint_5)
    graph.add_node("stage_export", node_stage_export)
    graph.add_node("stage_twine_export", node_stage_twine_export)

    graph.add_edge("stage_5_quest_mapping", "checkpoint_5")
    graph.add_conditional_edges("checkpoint_5", route_checkpoint_5, ["stage_5_quest_mapping", "stage_export"])
    graph.add_edge("stage_export", "stage_twine_export")
    graph.add_edge("stage_twine_export", END)

    memory = checkpointer if checkpointer is not None else MemorySaver()
    return graph.compile(checkpointer=memory)
