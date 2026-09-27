from typing import Any
from pydantic import BaseModel, Field, model_validator


class RubricScore(BaseModel):
    """Critic 100-point rubric breakdown."""
    plot_coherence: int = Field(ge=0, le=25, description="Plot internal consistency (/25)")
    character_motivation: int = Field(ge=0, le=25, description="Character motivation consistency (/25)")
    world_consistency: int = Field(ge=0, le=20, description="World Bible consistency (/20)")
    pacing_and_flow: int = Field(ge=0, le=15, description="Pacing and narrative rhythm (/15)")
    emotional_impact: int = Field(ge=0, le=15, description="Emotional resonance and depth (/15)")

    contract_passed: bool = Field(
        default=True,
        description="Hard gate: Did the chapter satisfy entry/exit states and traits?",
    )
    contract_violations: list[str] = Field(default_factory=list)
    revision_notes: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_rubric(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Normalize revision_notes (handles None, str, list)
            notes = data.get("revision_notes")
            if notes is None:
                data["revision_notes"] = []
            elif isinstance(notes, str):
                lines = [l.strip("- *1234567890.").strip() for l in notes.splitlines() if l.strip()]
                data["revision_notes"] = lines if lines else [notes.strip()]
            elif isinstance(notes, list):
                data["revision_notes"] = [str(n) for n in notes if n is not None]
            else:
                data["revision_notes"] = [str(notes)]

            # 2. Normalize contract_violations
            viols = data.get("contract_violations")
            if viols is None:
                data["contract_violations"] = []
            elif isinstance(viols, str):
                data["contract_violations"] = [viols.strip()]
            elif isinstance(viols, list):
                data["contract_violations"] = [str(v) for v in viols if v is not None]
            else:
                data["contract_violations"] = [str(viols)]

            # 3. Normalize score fields with bounds clamping
            score_bounds = {
                "plot_coherence": 25,
                "character_motivation": 25,
                "world_consistency": 20,
                "pacing_and_flow": 15,
                "emotional_impact": 15,
            }
            for field, max_val in score_bounds.items():
                val = data.get(field)
                if val is None:
                    data[field] = int(max_val * 0.8)
                else:
                    try:
                        num = int(float(val))
                        data[field] = max(0, min(max_val, num))
                    except (ValueError, TypeError):
                        data[field] = int(max_val * 0.8)

        return data

    @property
    def total_score(self) -> int:
        return (
            self.plot_coherence
            + self.character_motivation
            + self.world_consistency
            + self.pacing_and_flow
            + self.emotional_impact
        )

    def is_passed(self, threshold: int = 75) -> bool:
        """Returns True only if score >= threshold AND contract validation passed."""
        return self.contract_passed and (self.total_score >= threshold)
