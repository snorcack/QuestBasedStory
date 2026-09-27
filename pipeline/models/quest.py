"""Quest, Attachment Point, and Achievement models for QuestForge."""
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, model_validator
from pipeline.models.trait import TraitRequirement


class QuestType(str, Enum):
    MAIN_BLOCKING = "main_blocking"
    LATENT_ADVANTAGE = "latent_advantage"
    NEUTRAL = "neutral"
    ACHIEVEMENT = "achievement"
    STORY_ARC = "story_arc"
    INVESTIGATION = "investigation"
    STEALTH = "stealth"
    CRAFTING = "crafting"
    CHARACTER_FAVOR = "character_favor"
    SIDE_QUEST = "side_quest"


class LatentPayoff(BaseModel):
    """Specification of a future narrative or mechanical reward for an optional quest."""
    chapter_id: str = Field(description="Chapter ID where the payoff occurs")
    description: str = Field(description="Description of the narrative advantage or unlock")


class Quest(BaseModel):
    """A formalised quest gate or activity tagged onto the narrative."""
    quest_id: str = Field(description="Unique quest ID, e.g. 'quest_017'")
    title: str = Field(description="Quest title for player quest log")
    type: QuestType = Field(
        default=QuestType.MAIN_BLOCKING,
        description="Type: 'main_blocking', 'latent_advantage', 'neutral', 'achievement', 'investigation', 'character_favor', etc.",
    )
    chapter_id: str = Field(description="Chapter where this quest takes place")
    location_id: str = Field(description="Location ID where quest is engaged")
    trigger_flag: str = Field(description="World state flag that activates this quest")
    objective: str = Field(description="Clear player objective statement")
    journal_entry: str = Field(
        default="",
        description="First-person protagonist journal entry written by Narrator",
    )
    required_trait: TraitRequirement | None = Field(
        default=None,
        description="Optional minimum trait level required to attempt or complete",
    )
    reward_flags: list[str] = Field(
        default_factory=list,
        description="Flags set upon completing this quest",
    )
    latent_payoff: LatentPayoff | None = Field(
        default=None,
        description="Future chapter narrative reward if type is latent_advantage",
    )
    expires_after_flag: str | None = Field(
        default=None,
        description="Flag that makes this quest no longer available if missed",
    )
    attachment_point_id: str | None = Field(
        default=None,
        description="Attachment slot ID if this is a side quest plugged into an open slot",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_quest(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize quest_id
            if not data.get("quest_id"):
                ch = data.get("chapter_id", "ch")
                data["quest_id"] = f"quest_{ch}_{abs(hash(str(data))) % 10000}"

            # Normalize title
            if not data.get("title"):
                data["title"] = data.get("name", "Untitled Quest")

            # Normalize type
            raw_type = data.get("type", "neutral")
            if hasattr(raw_type, "value"):
                raw_type = raw_type.value
            q_type = str(raw_type).lower().strip()
            type_mapping = {
                "main_blocking": QuestType.MAIN_BLOCKING,
                "main": QuestType.MAIN_BLOCKING,
                "blocking": QuestType.MAIN_BLOCKING,
                "primary": QuestType.MAIN_BLOCKING,
                "latent_advantage": QuestType.LATENT_ADVANTAGE,
                "latent": QuestType.LATENT_ADVANTAGE,
                "advantage": QuestType.LATENT_ADVANTAGE,
                "neutral": QuestType.NEUTRAL,
                "optional": QuestType.NEUTRAL,
                "achievement": QuestType.ACHIEVEMENT,
                "story_arc": QuestType.STORY_ARC,
                "investigation": QuestType.INVESTIGATION,
                "stealth": QuestType.STEALTH,
                "crafting": QuestType.CRAFTING,
                "character_favor": QuestType.CHARACTER_FAVOR,
                "favor": QuestType.CHARACTER_FAVOR,
                "side_quest": QuestType.SIDE_QUEST,
                "side": QuestType.SIDE_QUEST,
            }
            data["type"] = type_mapping.get(q_type, QuestType.NEUTRAL)

            # Normalize required_trait
            req_trait = data.get("required_trait")
            if req_trait and isinstance(req_trait, str):
                data["required_trait"] = {"name": req_trait, "strength": "emerging"}
            elif req_trait and isinstance(req_trait, dict) and not req_trait.get("name"):
                data["required_trait"] = None

            # Ensure reward_flags is list
            if isinstance(data.get("reward_flags"), str):
                data["reward_flags"] = [data["reward_flags"]]
            elif data.get("reward_flags") is None:
                data["reward_flags"] = []

            # Ensure location_id
            if not data.get("location_id"):
                data["location_id"] = "loc_default"

            # Ensure trigger_flag
            if not data.get("trigger_flag"):
                ch = data.get("chapter_id", "ch")
                data["trigger_flag"] = f"{ch}_started"

            # Ensure objective
            if not data.get("objective"):
                data["objective"] = data.get("description", "Complete the chapter objective.")

        return data


class AttachmentPoint(BaseModel):
    """An open slot in a chapter where side quests can be injected."""
    slot_id: str = Field(description="Unique slot ID, e.g. 'slot_ch02_03'")
    chapter_id: str = Field(description="Chapter containing this attachment point")
    location_id: str = Field(description="Location where side quest takes place")
    available_after: str = Field(description="Flag that opens this slot")
    expires_after: str = Field(description="Flag that closes this slot")
    npcs_present: list[str] = Field(
        default_factory=list,
        description="NPC IDs present and available for interaction",
    )
    arc_type: str = Field(
        default="simple",
        description="'simple' (one-off quest) or 'parallel' (running side arc)",
    )
    assigned_quest_id: str | None = Field(
        default=None,
        description="Quest ID plugged into this slot, if assigned",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_attachment_point(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "slot_id" not in data:
                data["slot_id"] = f"slot_{data.get('chapter_id', 'ch')}_{abs(hash(str(data))) % 10000}"
            if "chapter_id" not in data:
                data["chapter_id"] = "chapter_01"
            if "location_id" not in data:
                data["location_id"] = "loc_default"
            if "available_after" not in data:
                data["available_after"] = "chapter_start"
            if "expires_after" not in data:
                data["expires_after"] = "chapter_end"
        return data


class Achievement(BaseModel):
    """An achievement badge unlockable via optional actions."""
    achievement_id: str = Field(description="Unique achievement ID, e.g. 'ach_diplomat'")
    title: str = Field(description="Display title of achievement")
    description: str = Field(description="Condition or flavour text")
    icon: str = Field(default="trophy", description="Icon identifier for UI")
    trigger_flag: str = Field(description="Flag whose activation unlocks this achievement")

    @model_validator(mode="before")
    @classmethod
    def normalize_achievement(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("achievement_id"):
                data["achievement_id"] = f"ach_{abs(hash(str(data))) % 10000}"
            if not data.get("title"):
                data["title"] = data.get("name", "Achievement Unlocked")
            if not data.get("description"):
                data["description"] = "Completed secret story objective."
            if not data.get("icon"):
                data["icon"] = "trophy"
            if not data.get("trigger_flag"):
                data["trigger_flag"] = "achievement_unlocked"
        return data
