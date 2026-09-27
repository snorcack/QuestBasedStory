"""Prompt loader utility for external agent YAML prompts."""
import os
from pathlib import Path
from typing import Any
import yaml
from pydantic import BaseModel, Field


class PromptParameters(BaseModel):
    temperature: float = 0.7
    max_tokens: int = 8192


class AgentPromptConfig(BaseModel):
    agent: str
    version: str = "1.0"
    system_prompt: str
    user_prompt_template: str
    parameters: PromptParameters = Field(default_factory=PromptParameters)

    def render_user_prompt(self, **kwargs: Any) -> str:
        """Format user_prompt_template with provided keyword arguments safely."""
        # Use a safe formatter to avoid KeyError on missing optional placeholders
        template = self.user_prompt_template
        for key, value in kwargs.items():
            placeholder = "{" + key + "}"
            template = template.replace(placeholder, str(value) if value is not None else "")
        return template


_PROMPT_CACHE: dict[str, AgentPromptConfig] = {}


def get_prompts_dir() -> Path:
    """Resolve the prompts directory from environment variable or default relative path."""
    env_dir = os.environ.get("PROMPTS_DIR")
    if env_dir:
        return Path(env_dir)
    # Default to pipeline/prompts relative to project root
    base = Path(__file__).resolve().parent.parent / "prompts"
    return base


def load_agent_prompt(agent_name: str, force_reload: bool = False) -> AgentPromptConfig:
    """Load and validate an agent's prompt YAML configuration from disk."""
    if not force_reload and agent_name in _PROMPT_CACHE:
        return _PROMPT_CACHE[agent_name]

    prompts_dir = get_prompts_dir()
    file_path = prompts_dir / f"{agent_name}.yaml"

    if not file_path.exists():
        raise FileNotFoundError(f"Agent prompt file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise ValueError(f"Invalid prompt configuration in {file_path}: expected dictionary")

    config = AgentPromptConfig.model_validate(data)
    _PROMPT_CACHE[agent_name] = config
    return config
