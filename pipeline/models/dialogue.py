from typing import Any
from enum import Enum
from pydantic import BaseModel, Field, model_validator


class DialogueNodeType(str, Enum):
    SPEAKER = "speaker"
    CHOICE = "choice"
    FLAG = "flag"
    END = "end"


class DialogueChoice(BaseModel):
    """An individual selectable branch option in a dialogue tree."""
    label: str = Field(description="Display text of the choice offered to the player")
    trait_tag: str | None = Field(
        default=None,
        description="Optional hidden trait tag (must match one of the 2 story traits)",
    )
    flags_set: list[str] = Field(
        default_factory=list,
        description="Flags enabled in world state if this choice is selected",
    )
    next_node: str | None = Field(
        default=None,
        description="Target node_id transitioned to when chosen",
    )
    condition_flag: str | None = Field(
        default=None,
        description="Optional flag required for this choice to appear/be selectable",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_choice(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("flags_set") is None:
                data["flags_set"] = []
            elif isinstance(data["flags_set"], str):
                data["flags_set"] = [data["flags_set"]]
            if "label" not in data:
                data["label"] = data.get("text", data.get("choice", data.get("option", "Continue")))
            if "next_node" not in data:
                data["next_node"] = data.get("target_node", data.get("next", None))
        return data


class DialogueNode(BaseModel):
    """A node in the dialogue graph (Ink-compatible structure)."""
    node_id: str = Field(description="Unique identifier, e.g. 'node_042'")
    type: DialogueNodeType = Field(
        default=DialogueNodeType.SPEAKER,
        description="Type: 'speaker', 'choice', 'flag', 'end'",
    )
    speaker: str = Field(
        default="narrator",
        description="Character ID speaking or 'narrator'",
    )
    text: str = Field(
        default="",
        description="Dialogue line spoken or narrative text",
    )
    choices: list[DialogueChoice] = Field(
        default_factory=list,
        description="List of choices if node is interactive or leads to branching",
    )
    next_node: str | None = Field(
        default=None,
        description="Default linear next node if choices are empty and type != end",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_node(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("choices") is None:
                data["choices"] = []
            elif isinstance(data.get("choices"), dict):
                data["choices"] = list(data["choices"].values())
            if "type" in data and isinstance(data["type"], str):
                t = data["type"].lower().strip()
                data["type"] = t if t in ("speaker", "choice", "flag", "end") else "speaker"
            if "node_id" not in data:
                data["node_id"] = data.get("id", data.get("name", f"node_{abs(hash(str(data))) % 10000}"))
            if "next_node" not in data:
                data["next_node"] = data.get("target_node", data.get("next", None))
            if "text" not in data:
                data["text"] = data.get("dialogue", data.get("line", data.get("content", "")))
        return data


class DialogueTree(BaseModel):
    """Complete dialogue graph for a scene or chapter."""
    tree_id: str = Field(description="Unique tree identifier, e.g. 'dtree_ch01_s02'")
    chapter_id: str = Field(description="Chapter ID this dialogue belongs to")
    root_node_id: str = Field(description="Initial entry node ID")
    nodes: list[DialogueNode] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_tree(cls, data: Any) -> Any:
        if isinstance(data, dict):
            nodes = data.get("nodes")
            if isinstance(nodes, dict):
                data["nodes"] = list(nodes.values())
            elif nodes is None:
                data["nodes"] = []
        return data
