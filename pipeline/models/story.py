"""Story, Chapter Contract, Transition, and Scene models for QuestForge."""
from typing import Any
from pydantic import BaseModel, Field, model_validator
from pipeline.models.trait import TraitDefinition, TraitTier
from pipeline.models.dialogue import DialogueNode
from pipeline.models.quest import Quest, AttachmentPoint


class Act(BaseModel):
    """An act in the 3-act story arc outline."""
    act_number: int = Field(ge=1, le=3)
    title: str = Field(description="Act title or subtitle")
    summary: str = Field(description="Narrative trajectory and key turning points for this act")


class StoryArc(BaseModel):
    """Stage 1 output: overarching story architecture and narrative scope."""
    title: str = Field(description="Working title of the story")
    genre: str = Field(description="Primary genre and stylistic blend")
    tone: str = Field(description="Atmospheric tone, e.g. 'neo-noir, melancholic, tense'")
    themes: list[str] = Field(default_factory=list, description="Core thematic motifs")
    protagonist_sketch: str = Field(
        description="Name, flaw, world role, and connection to the two emergent traits",
    )
    antagonist_sketch: str = Field(
        description="Identity, motivation, opposing worldview, and leverage over protagonist",
    )
    central_conflict: str = Field(
        description="The primary irreconcilable tension driving the narrative",
    )
    acts: list[Act] = Field(
        default_factory=list,
        description="3-act breakdown summarizing the overall plot curve",
    )
    trait_vocabulary: list[TraitDefinition] = Field(
        default_factory=list,
        description="Exactly two emergent traits defined for this story",
    )

    @model_validator(mode="before")
    @classmethod
    def extract_nested_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Unwrap common LLM wrapper keys
            for key in ("story_arc", "pass_1", "storyArc", "data"):
                if key in data and isinstance(data[key], dict):
                    inner = dict(data[key])
                    for k, v in data.items():
                        if k != key and k not in inner:
                            inner[k] = v
                    data = inner
                    break
            # Field aliases
            if "title" not in data and "story_title" in data:
                data["title"] = data["story_title"]
            if "tone" not in data and "atmospheric_tone" in data:
                data["tone"] = data["atmospheric_tone"]
            if "central_conflict" not in data and "conflict" in data:
                data["central_conflict"] = data["conflict"]
            if "protagonist_sketch" in data and isinstance(data["protagonist_sketch"], dict):
                data["protagonist_sketch"] = ", ".join(f"{k}: {v}" for k, v in data["protagonist_sketch"].items())
            elif "protagonist_sketch" not in data and "protagonist" in data:
                data["protagonist_sketch"] = str(data["protagonist"])
            if "antagonist_sketch" in data and isinstance(data["antagonist_sketch"], dict):
                data["antagonist_sketch"] = ", ".join(f"{k}: {v}" for k, v in data["antagonist_sketch"].items())
            elif "antagonist_sketch" not in data and "antagonist" in data:
                data["antagonist_sketch"] = str(data["antagonist"])
            if "trait_vocabulary" not in data and "traits" in data:
                data["trait_vocabulary"] = data["traits"]
        return data


def _normalize_trait_tier(val: Any) -> TraitTier:
    if isinstance(val, TraitTier):
        return val
    if isinstance(val, (int, float)):
        v = int(val)
        if v <= 0:
            return TraitTier.NONE
        elif v <= 2:
            return TraitTier.EMERGING
        elif v <= 4:
            return TraitTier.ESTABLISHED
        else:
            return TraitTier.DOMINANT
    if isinstance(val, str):
        cleaned = val.strip().lower()
        for tier in TraitTier:
            if tier.value == cleaned:
                return tier
        if cleaned.isdigit():
            return _normalize_trait_tier(int(cleaned))
    return TraitTier.NONE


class ChapterState(BaseModel):
    """Fixed boundary state for chapter entry or exit."""
    location: str = Field(description="Location ID where player is situated")
    trait_snapshot: dict[str, TraitTier] = Field(
        default_factory=dict,
        description="Expected minimum trait tier progression (e.g. {'Cunning': 'emerging'})",
    )
    inventory: list[str] = Field(
        default_factory=list,
        description="Items required in inventory at this boundary",
    )
    active_flags: list[str] = Field(
        default_factory=list,
        description="World state flags that must be active at this boundary",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_state(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"location": data}
        if isinstance(data, dict):
            if "location" not in data and "location_id" in data:
                data["location"] = str(data["location_id"])
            elif "location" not in data:
                data["location"] = "loc_unknown"
            if "trait_snapshot" in data and isinstance(data["trait_snapshot"], dict):
                data["trait_snapshot"] = {
                    k: _normalize_trait_tier(v) for k, v in data["trait_snapshot"].items()
                }
        return data


class ChapterContract(BaseModel):
    """Stage 2 output: fixed contract defining chapter boundary requirements."""
    chapter_id: str = Field(description="Unique ID, e.g. 'chapter_01'")
    order: int = Field(description="Sequential position (1-indexed)")
    title: str = Field(description="Working title of the chapter")
    narrative_scope: str = Field(
        description="What happens within this chapter; narrative goals and dramatic beat",
    )
    entry_state: ChapterState = Field(
        description="Guaranteed state when the chapter starts",
    )
    exit_state: ChapterState = Field(
        description="Mandatory state when the chapter concludes (hard gate)",
    )
    attachment_points: list[AttachmentPoint] = Field(
        default_factory=list,
        description="Pre-defined slots available for side quest attachment",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_contract(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "chapter_id" not in data and "id" in data:
                data["chapter_id"] = str(data["id"])
            elif "chapter_id" not in data and "order" in data:
                data["chapter_id"] = f"chapter_{int(data['order']):02d}"
            if "narrative_scope" not in data and "scope" in data:
                data["narrative_scope"] = str(data["scope"])
            elif "narrative_scope" not in data and "summary" in data:
                data["narrative_scope"] = str(data["summary"])
            elif "narrative_scope" not in data and "description" in data:
                data["narrative_scope"] = str(data["description"])
            if "entry_state" not in data and "entry" in data:
                data["entry_state"] = data["entry"]
            if "exit_state" not in data and "exit" in data:
                data["exit_state"] = data["exit"]
            if "order" not in data and "chapter_number" in data:
                data["order"] = data["chapter_number"]
            elif "order" not in data:
                data["order"] = 1
            
            ch_id = data.get("chapter_id", "chapter_01")
            loc_id = "loc_default"
            if isinstance(data.get("entry_state"), dict) and "location" in data["entry_state"]:
                loc_id = data["entry_state"]["location"]
            if "attachment_points" in data and isinstance(data["attachment_points"], list):
                for pt in data["attachment_points"]:
                    if isinstance(pt, dict):
                        if "chapter_id" not in pt:
                            pt["chapter_id"] = ch_id
                        if "location_id" not in pt:
                            pt["location_id"] = loc_id
        return data


class ChapterTransition(BaseModel):
    """Stage 3 output: narrative bridge between consecutive chapters."""
    transition_id: str = Field(description="Unique ID, e.g. 'trans_ch01_to_ch02'")
    from_chapter_id: str = Field(description="Preceding chapter ID")
    to_chapter_id: str = Field(description="Succeeding chapter ID")
    scene_summary: str = Field(
        description="Prose direction bridging the exit state to the new entry state",
    )
    state_delta: dict[str, Any] = Field(
        default_factory=dict,
        description="Specific changes to flags, inventory, or world state occurring during transit",
    )
    narrative_hook: str = Field(
        description="The opening line, visual image, or dramatic hook starting the next chapter",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_transition(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "transition_id" not in data and "id" in data:
                data["transition_id"] = str(data["id"])
            if "from_chapter_id" not in data and "from_chapter" in data:
                data["from_chapter_id"] = str(data["from_chapter"])
            if "to_chapter_id" not in data and "to_chapter" in data:
                data["to_chapter_id"] = str(data["to_chapter"])
            if "scene_summary" not in data and "summary" in data:
                data["scene_summary"] = str(data["summary"])
            elif "scene_summary" not in data and "description" in data:
                data["scene_summary"] = str(data["description"])
            if "narrative_hook" not in data and "hook" in data:
                data["narrative_hook"] = str(data["hook"])
        return data


class Scene(BaseModel):
    """An authored scene within a chapter."""
    scene_id: str = Field(description="Unique scene ID, e.g. 'sc_ch01_01'")
    title: str = Field(description="Scene header title")
    location_id: str = Field(description="Location ID where scene occurs")
    prose: str = Field(description="Full narrative prose")
    characters_present: list[str] = Field(
        default_factory=list,
        description="Character IDs in this scene",
    )
    emotional_beat: str = Field(
        default="",
        description="Internal state or dramatic tone of this scene",
    )


class AuthoredChapter(BaseModel):
    """Stage 4 output: complete authored chapter content."""
    chapter_id: str = Field(description="Chapter ID matching the contract")
    contract: ChapterContract | None = Field(default=None)
    scenes: list[Scene] = Field(default_factory=list)
    dialogue_tree: list[DialogueNode] = Field(
        default_factory=list,
        description="Interactive dialogue graph for this chapter",
    )
    quests: list[Quest] = Field(
        default_factory=list,
        description="Quests annotated within this chapter",
    )
    characters_present: list[str] = Field(default_factory=list)
    critic_score: float | None = Field(default=None)
    critic_notes: str | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def normalize_authored_chapter(cls, data: Any) -> Any:
        if isinstance(data, dict):
            dt = data.get("dialogue_tree")
            if dt is None:
                data["dialogue_tree"] = []
            elif isinstance(dt, dict):
                if "nodes" in dt and isinstance(dt["nodes"], list):
                    data["dialogue_tree"] = dt["nodes"]
                elif "nodes" in dt and isinstance(dt["nodes"], dict):
                    data["dialogue_tree"] = list(dt["nodes"].values())
                else:
                    data["dialogue_tree"] = list(dt.values())
        return data
