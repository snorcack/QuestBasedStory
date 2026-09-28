"""Unit tests for Phase 1: Data Models, Prompt Loader, Lore Store, and Rubrics."""
import pytest
from pipeline.models import (
    Location,
    Faction,
    NPC,
    Rule,
    Event,
    WorldBible,
    CharacterRole,
    Character,
    RelationshipEdge,
    RelationshipMap,
    TraitTier,
    TraitDefinition,
    TraitRequirement,
    TraitSnapshot,
    TraitArcValidation,
    count_to_tier,
    tier_to_min_count,
    DialogueNodeType,
    DialogueChoice,
    DialogueNode,
    DialogueTree,
    QuestType,
    LatentPayoff,
    Quest,
    AttachmentPoint,
    Achievement,
    Act,
    StoryArc,
    ChapterState,
    ChapterContract,
    ChapterTransition,
    Scene,
    AuthoredChapter,
    ExportManifest,
    StageEnum,
    CheckpointStatus,
    SharedContext,
)
from pipeline.tools.prompt_loader import load_agent_prompt, get_prompts_dir
from pipeline.tools.lore_store import LoreStore
from pipeline.tools.rubric import RubricScore
from pipeline.tools.llm_client import LLMClient


def test_trait_tier_calculations():
    """Verify narrative trait count to tier conversions."""
    assert count_to_tier(0) == TraitTier.NONE
    assert count_to_tier(1) == TraitTier.EMERGING
    assert count_to_tier(3) == TraitTier.EMERGING
    assert count_to_tier(4) == TraitTier.ESTABLISHED
    assert count_to_tier(7) == TraitTier.ESTABLISHED
    assert count_to_tier(8) == TraitTier.DOMINANT
    assert count_to_tier(15) == TraitTier.DOMINANT

    assert tier_to_min_count(TraitTier.NONE) == 0
    assert tier_to_min_count(TraitTier.EMERGING) == 1
    assert tier_to_min_count(TraitTier.ESTABLISHED) == 4
    assert tier_to_min_count(TraitTier.DOMINANT) == 8


def test_shared_context_serialization():
    """Verify SharedContext serializes to dict and deserializes cleanly."""
    ctx = SharedContext(story_seed="Test seed about a clockwork detective.")
    
    # Add traits
    t1 = TraitDefinition(name="Precision", description="Mechanical problem solving", color_hex="#112233")
    t2 = TraitDefinition(name="Intuition", description="Human emotional reads", color_hex="#445566")
    ctx.trait_vocabulary = [t1, t2]

    # Add world bible
    loc = Location(id="loc_tower", name="Clock Tower", description="Ancient bronze tower")
    npc = NPC(id="npc_tinkerer", name="Orin", location="loc_tower", role="Artificer", personality="Eccentric", dialogue_voice="Rapid staccato")
    ctx.world_bible = WorldBible(locations=[loc], npcs=[npc])

    # Add chapter contract
    contract = ChapterContract(
        chapter_id="chapter_01",
        order=1,
        title="Tick",
        narrative_scope="The awakening",
        entry_state=ChapterState(location="loc_tower", trait_snapshot={"Precision": TraitTier.NONE}),
        exit_state=ChapterState(location="loc_tower", trait_snapshot={"Precision": TraitTier.EMERGING}),
    )
    ctx.chapter_contracts = [contract]

    # Serialize and deserialize
    dumped = ctx.to_dict()
    assert isinstance(dumped, dict)
    assert dumped["story_seed"] == "Test seed about a clockwork detective."
    assert len(dumped["trait_vocabulary"]) == 2

    restored = SharedContext.from_dict(dumped)
    assert restored.story_seed == ctx.story_seed
    assert restored.trait_vocabulary[0].name == "Precision"
    assert restored.world_bible.locations[0].id == "loc_tower"
    assert restored.chapter_contracts[0].chapter_id == "chapter_01"


def test_all_8_prompts_load():
    """Verify all 8 agent prompt YAML files exist and conform to schema."""
    agent_names = [
        "main_planner",
        "lore_weaver",
        "narrator",
        "critic",
        "character_forge",
        "branch_keeper",
        "quest_architect",
        "export_agent",
    ]
    for name in agent_names:
        prompt_cfg = load_agent_prompt(name)
        assert prompt_cfg.agent == name
        assert prompt_cfg.version == "1.0"
        assert len(prompt_cfg.system_prompt) > 20
        assert len(prompt_cfg.user_prompt_template) > 10
        assert prompt_cfg.parameters.temperature >= 0.0
        assert prompt_cfg.parameters.max_tokens > 0

        # Test safe placeholder rendering
        rendered = prompt_cfg.render_user_prompt(story_seed="Test Seed", feedback="Make it darker")
        assert isinstance(rendered, str)


def test_lore_store_chromadb_in_memory():
    """Verify ChromaDB lore store can add and query entries in memory."""
    store = LoreStore(in_memory=True)
    store.add_entry(
        category="locations",
        entry_id="loc_01",
        text="The sunken archive is cold, damp, and smells of old magnetic tape.",
        metadata={"name": "Sunken Archive", "chapter": "02"},
    )

    results = store.query_similar(category="locations", query_text="wet cold underground tape records", n_results=1)
    assert len(results) == 1
    assert results[0]["id"] == "loc_01"
    assert "sunken archive" in results[0]["document"].lower()


def test_rubric_scoring_and_gates():
    """Verify Critic rubric scoring threshold (75/100) and contract hard gate."""
    # Score 80 with contract passed -> Pass
    passing = RubricScore(
        plot_coherence=20,
        character_motivation=20,
        world_consistency=16,
        pacing_and_flow=12,
        emotional_impact=12,
        contract_passed=True,
    )
    assert passing.total_score == 80
    assert passing.is_passed(threshold=75) is True

    # Score 80 with contract failed -> Hard Fail
    contract_failed = RubricScore(
        plot_coherence=20,
        character_motivation=20,
        world_consistency=16,
        pacing_and_flow=12,
        emotional_impact=12,
        contract_passed=False,
        contract_violations=["Missing exit flag: 'found_datachip'"],
    )
    assert contract_failed.total_score == 80
    assert contract_failed.is_passed(threshold=75) is False

    # Score 70 with contract passed -> Below Threshold Fail
    low_score = RubricScore(
        plot_coherence=15,
        character_motivation=15,
        world_consistency=15,
        pacing_and_flow=10,
        emotional_impact=15,
        contract_passed=True,
    )
    assert low_score.total_score == 70
    assert low_score.is_passed(threshold=75) is False


def test_llm_client_initialization():
    """Verify LLM client switches configurations between gemini_api, vertex_ai, openai, and anthropic."""
    client_gemini = LLMClient(backend="gemini_api")
    assert client_gemini.backend == "gemini_api"

    client_vertex = LLMClient(backend="vertex_ai")
    assert client_vertex.backend == "vertex_ai"

    client_openai = LLMClient(backend="openai")
    assert client_openai.backend == "openai"
    assert hasattr(client_openai, "base_url")
    assert client_openai.model_name is not None

    client_anthropic = LLMClient(backend="anthropic")
    assert client_anthropic.backend == "anthropic"
    assert hasattr(client_anthropic, "base_url")
    assert client_anthropic.model_name is not None

    diag = client_openai.diagnose()
    assert diag["backend"] == "openai"
    assert "base_url" in diag
