"""Project models for multi-story workspace management."""
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ProjectSummary(BaseModel):
    """Compact summary of a story project for library listing."""
    id: str = Field(description="Unique project slug/identifier")
    title: str = Field(description="Story project title")
    story_seed: str = Field(description="Creative premise / story seed")
    genre: str = Field(default="Interactive Fiction", description="Genre or stylistic blend")
    tone: str = Field(default="", description="Atmospheric tone")
    created_at: str = Field(description="ISO timestamp of creation")
    updated_at: str = Field(description="ISO timestamp of last modification")
    current_stage: str = Field(default="stage_1_story_arc", description="Pipeline stage")
    status: str = Field(default="idle", description="'idle' | 'running' | 'awaiting_review' | 'completed' | 'error'")
    chapter_count: int = Field(default=0, description="Total chapters planned or authored")
    quest_count: int = Field(default=0, description="Total quests designed")
    has_export: bool = Field(default=False, description="Whether static game package is generated")
    is_explicit: bool = Field(default=False, description="Whether explicit/adult uncensored content is enabled")


class ProjectDetail(ProjectSummary):
    """Comprehensive project data including latest state snapshot."""
    state_snapshot: dict[str, Any] = Field(
        default_factory=dict,
        description="Current shared pipeline state values (story_arc, contracts, etc.)",
    )
    checkpoint_data: dict[str, Any] | None = Field(
        default=None,
        description="Pending checkpoint interrupt payload if awaiting review",
    )


class CreateProjectRequest(BaseModel):
    """Payload to initialize a new story project."""
    title: str
    story_seed: str
    genre: str = "Interactive Fiction"
    tone: str = "Engaging, immersive"
    is_explicit: bool = False


class ResumeProjectRequest(BaseModel):
    """Payload to advance or regenerate a project checkpoint."""
    action: str = "approve"  # 'approve' | 'regenerate' | 'edit'
    notes: str = ""
    override_data: dict[str, Any] | None = None
