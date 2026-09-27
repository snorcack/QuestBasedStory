"""Character models for QuestForge."""
from enum import Enum
from pydantic import BaseModel, Field


class CharacterRole(str, Enum):
    PROTAGONIST = "protagonist"
    ANTAGONIST = "antagonist"
    ALLY = "ally"
    NEUTRAL = "neutral"
    ANTAGONIST_ALLY = "antagonist_ally"


class Character(BaseModel):
    """Full character sheet designed by Character Forge."""
    id: str = Field(description="Unique character ID, e.g. 'char_001'")
    name: str = Field(description="Character's full display name")
    role: CharacterRole = Field(
        default=CharacterRole.NEUTRAL,
        description="Narrative role: protagonist, antagonist, ally, neutral, antagonist_ally",
    )
    location_home: str = Field(
        default="",
        description="Home or primary location ID for this character",
    )
    backstory: str = Field(
        default="",
        description="Formative history shaping their current worldview",
    )
    motivation: str = Field(
        default="",
        description="What the character wants most and why",
    )
    flaw: str = Field(
        default="",
        description="Internal blindspot, wound, or moral vulnerability",
    )
    arc: str = Field(
        default="",
        description="Trajectory description, e.g. 'starts cynical -> ends committed'",
    )
    dialogue_voice: str = Field(
        default="",
        description="Distinct speech habits, vocabulary, rhythms, sample phrases",
    )
    dominant_trait_alignment: str = Field(
        default="none",
        description="The trait this character embodies or encourages, e.g. 'Cunning', 'Compassion', 'none'",
    )
    relationships: dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of character_id to description of relationship",
    )
    portrait_url: str | None = Field(
        default=None,
        description="URL or file path to character portrait image",
    )
    portrait_gallery: list[str] = Field(
        default_factory=list,
        description="Collection of generated or uploaded portrait image URLs for this character",
    )
    portrait_prompt: str | None = Field(
        default=None,
        description="AI image generation prompt for this character's portrait",
    )


class RelationshipEdge(BaseModel):
    """Directed connection in the cast relationship graph."""
    source_id: str
    target_id: str
    nature: str = Field(description="Nature of the bond: 'distrusts', 'owes_debt', 'mentors'")
    description: str = Field(default="")


class RelationshipMap(BaseModel):
    """Complete relationship network across the cast."""
    characters: list[Character] = Field(default_factory=list)
    edges: list[RelationshipEdge] = Field(default_factory=list)
