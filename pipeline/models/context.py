"""SharedContext: The central state model for the entire QuestForge pipeline."""
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field

from pipeline.models.world import WorldBible
from pipeline.models.character import Character
from pipeline.models.trait import TraitDefinition, TraitArcValidation
from pipeline.models.story import (
    StoryArc,
    ChapterContract,
    ChapterTransition,
    AuthoredChapter,
)
from pipeline.models.quest import Quest, AttachmentPoint, Achievement


class StageEnum(str, Enum):
    STAGE_1_STORY_ARC = "stage_1_story_arc"
    STAGE_2_CHAPTER_BREAKDOWN = "stage_2_chapter_breakdown"
    STAGE_3_TRANSITIONS = "stage_3_transitions"
    STAGE_3_5_WORLD_CAST = "stage_3_5_world_cast"
    STAGE_4_CHAPTER_AUTHORING = "stage_4_chapter_authoring"
    STAGE_5_QUEST_MAPPING = "stage_5_quest_mapping"
    STAGE_TWINE_EXPORT = "stage_twine_export"
    EXPORT_COMPLETE = "export_complete"


class CheckpointStatus(str, Enum):
    AWAITING_REVIEW = "awaiting_review"
    APPROVED = "approved"
    REGENERATING = "regenerating"


class SharedContext(BaseModel):
    """The authoritative typed pipeline state shared by all agents."""

    # 1. Story Seed & Spine
    story_seed: str = Field(default="", description="Original creative seed text")
    is_explicit: bool = Field(
        default=False,
        description="Whether this story enables explicit uncensored adult content, mature themes, violence, and nudity",
    )
    story_arc: StoryArc | None = Field(
        default=None,
        description="Stage 1: Approved story arc document",
    )
    chapter_contracts: list[ChapterContract] = Field(
        default_factory=list,
        description="Stage 2: Approved chapter contracts with fixed entry/exit boundaries",
    )
    transitions: list[ChapterTransition] = Field(
        default_factory=list,
        description="Stage 3: Approved chapter boundary transitions",
    )
    trait_vocabulary: list[TraitDefinition] = Field(
        default_factory=list,
        description="The two emergent narrative traits defined for this story",
    )

    # 2. World & Cast
    world_bible: WorldBible | None = Field(
        default=None,
        description="World facts, locations, factions, rules, and timeline",
    )
    characters: list[Character] = Field(
        default_factory=list,
        description="Full cast character sheets and relationship data",
    )
    relationship_map: list[dict] = Field(
        default_factory=list,
        description="Cast relationship edges: source_id, target_id, nature, description",
    )

    # 3. Authored Chapters (Stage 4)
    chapters: list[AuthoredChapter] = Field(
        default_factory=list,
        description="Authored scenes, dialogue trees, and local quests per chapter",
    )

    # 4. Quest & Game Mechanics (Stage 5)
    quest_graph: list[Quest] = Field(
        default_factory=list,
        description="Complete list of all annotated quests across all chapters",
    )
    attachment_points: list[AttachmentPoint] = Field(
        default_factory=list,
        description="Manifest of all available and filled side quest slots",
    )
    achievements: list[Achievement] = Field(
        default_factory=list,
        description="List of all achievements unlockable in the game",
    )
    trait_arc_report: TraitArcValidation | None = Field(
        default=None,
        description="Validation report verifying reachability of all trait gates",
    )

    # 5. Pipeline Orchestration State
    current_stage: StageEnum = Field(
        default=StageEnum.STAGE_1_STORY_ARC,
        description="Current stage in the 5-stage interactive pipeline",
    )
    current_chapter_index: int = Field(
        default=0,
        description="0-indexed pointer to the chapter currently being processed in Stage 4",
    )
    iteration_count: int = Field(
        default=0,
        description="Current revision cycle count (e.g. within Critic loop)",
    )
    checkpoint_status: CheckpointStatus = Field(
        default=CheckpointStatus.AWAITING_REVIEW,
        description="Status at human checkpoint: awaiting_review, approved, regenerating",
    )
    regeneration_notes: str = Field(
        default="",
        description="Designer feedback or direction supplied when rejecting a checkpoint",
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize context to a Python dict (Pydantic v2)."""
        return self.model_dump()

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SharedContext":
        """Deserialize context from a Python dict."""
        return cls.model_validate(data)
