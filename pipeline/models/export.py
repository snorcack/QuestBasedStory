"""Export package manifest and validation models for QuestForge."""
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class ExportManifest(BaseModel):
    """Metadata manifest file included in game_package/manifest.json."""
    title: str = Field(description="Story title")
    version: str = Field(default="1.0.0", description="Exported package version")
    schema_version: str = Field(default="1.0", description="Game data schema version")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of export",
    )
    chapters_count: int = Field(default=0)
    traits: list[str] = Field(default_factory=list)
    total_quests: int = Field(default=0)
    total_achievements: int = Field(default=0)
    total_locations: int = Field(default=0)
    total_characters: int = Field(default=0)
    entry_chapter_id: str = Field(default="chapter_01")
    is_explicit: bool = Field(default=False, description="Whether package contains explicit adult uncensored content")
    content_rating: str = Field(default="Standard", description="Content rating: 'Standard' | 'Mature 18+ (Explicit)'")
    has_twine_export: bool = Field(default=True, description="Whether package includes Twine 2 HTML and Twee 3 exports")
    twine_twee_file: str = Field(default="twine/story.twee", description="Relative path to exported Twee 3 source")
    twine_html_file: str = Field(default="twine/story.html", description="Relative path to standalone Twine 2 HTML player")
    notes: str = Field(default="", description="Export notes or designer annotations")


class ValidationIssue(BaseModel):
    """Integrity issue detected during pre-export validation."""
    severity: str = Field(description="'error' (blocks export) or 'warning' (advisory)")
    category: str = Field(description="'reference', 'contract', 'trait', 'graph'")
    message: str = Field(description="Clear explanation of the detected issue")
    location: str = Field(default="", description="Contextual path or ID where issue occurred")


class PackageValidationReport(BaseModel):
    """Integrity report verifying all references before writing game_package."""
    is_valid: bool = Field(default=True)
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
