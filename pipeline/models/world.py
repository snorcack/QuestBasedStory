"""World Bible data models for QuestForge."""
from pydantic import BaseModel, Field


class Location(BaseModel):
    """A distinct physical or conceptual location in the story world."""
    id: str = Field(description="Unique location identifier, e.g. 'loc_market'")
    name: str = Field(description="Display name of the location")
    description: str = Field(description="Atmospheric and physical description")
    accessible_from: list[str] = Field(
        default_factory=list,
        description="IDs of locations directly connected to this location",
    )
    notable_npcs: list[str] = Field(
        default_factory=list,
        description="IDs of NPCs frequently or permanently present here",
    )


class Faction(BaseModel):
    """A political, social, or thematic group in the story world."""
    id: str = Field(description="Unique faction identifier, e.g. 'fac_guild'")
    name: str = Field(description="Display name of the faction")
    goals: str = Field(description="Primary motivations and ideological objectives")
    relationships: dict[str, str] = Field(
        default_factory=dict,
        description="Relationship descriptions mapped by faction ID",
    )
    territory: list[str] = Field(
        default_factory=list,
        description="Location IDs under faction control or influence",
    )


class NPC(BaseModel):
    """Non-player character inhabiting the story world."""
    id: str = Field(description="Unique NPC identifier, e.g. 'npc_informant'")
    name: str = Field(description="Display name of the NPC")
    location: str = Field(description="Current primary location ID")
    role: str = Field(description="Role in world, e.g. 'Merchant', 'Guard Captain'")
    personality: str = Field(description="Key personality traits and behavioral style")
    dialogue_voice: str = Field(description="Speech patterns, cadence, dialect notes")
    portrait_url: str | None = Field(
        default=None,
        description="URL or file path to NPC portrait image",
    )
    portrait_gallery: list[str] = Field(
        default_factory=list,
        description="Collection of generated or uploaded portrait image URLs for this NPC",
    )
    portrait_prompt: str | None = Field(
        default=None,
        description="AI image generation prompt for this NPC's portrait",
    )


class Rule(BaseModel):
    """A law governing the story world (magic, technology, social norms)."""
    id: str = Field(description="Unique rule identifier, e.g. 'rule_magic_cost'")
    category: str = Field(description="Category: 'magic', 'technology', 'social', 'law'")
    rule_text: str = Field(description="The authoritative statement of the rule")


class Event(BaseModel):
    """A historical or background timeline event referenced by the story."""
    id: str = Field(description="Unique event identifier, e.g. 'evt_collapse'")
    name: str = Field(description="Short name of the event")
    order: int = Field(description="Chronological sequence order")
    description: str = Field(description="What transpired and why it matters to the present")


class WorldBible(BaseModel):
    """The authoritative source of truth for every physical and cultural fact in the world."""
    locations: list[Location] = Field(default_factory=list)
    factions: list[Faction] = Field(default_factory=list)
    npcs: list[NPC] = Field(default_factory=list)
    rules: list[Rule] = Field(default_factory=list)
    timeline: list[Event] = Field(default_factory=list)
