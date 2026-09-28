"""LLM client abstraction for Google Gemini API and Google Cloud Vertex AI."""
import os
import json
import logging
import re
import time
import random
import threading
from typing import Any
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_request_lock = threading.Lock()
_last_request_time = 0.0
_vertex_credentials = None
_http_session = None


def clean_json_text(text: str) -> str:
    """Strip markdown code fence blocks if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def extract_json_list(data: Any, preferred_keys: tuple[str, ...] = ()) -> list:
    """Extract a list from parsed JSON data, unwrapping dict envelopes if present."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in preferred_keys:
            if k in data and isinstance(data[k], list):
                return data[k]
        for v in data.values():
            if isinstance(v, list):
                return v
        if all(str(k).isdigit() for k in data.keys()) and len(data) > 0:
            return [data[k] for k in sorted(data.keys(), key=int)]
        return [data]
    return []


EXPLICIT_MODE_DIRECTIVE = """
[EXPLICIT CONTENT POLICY DIRECTIVE: ADULT / UNCENSORED MODE ACTIVE]
This story is operating under EXPLICIT MODE (Adult / Uncensored / 18+).
All agents are fully authorized, permitted, and expected to author and depict:
1. Adult themes, sexual desire, sensual intimacy, passion, romance, and explicit nudity when suitable to the scene.
2. Uncensored visceral combat, graphic danger, intense physical consequences, and dark psychological stakes.
3. Coarse, gritty, unfiltered adult dialogue, profanity, and morally grey adult decisions without euphemisms or softening.
Do not withhold, censor, or dilute mature realism.
"""


class LLMClient:
    """Unified LLM client interface switching between Gemini API, Vertex AI, and Mock mode."""

    def __init__(self, backend: str | None = None):
        if backend is None and os.getenv("PYTEST_CURRENT_TEST"):
            self.backend = "mock"
        else:
            self.backend = (backend or os.getenv("LLM_BACKEND", "gemini_api")).lower().strip()
        self.min_interval = float(os.getenv("LLM_MIN_INTERVAL_SECONDS", "1.5"))
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "5"))
        self._init_backend()

    def _init_backend(self) -> None:
        """Initialize connection parameters based on configured backend."""
        if self.backend in ("mock", "test"):
            self.model_name = "mock-model"
        elif self.backend in ("gemini_api", "gemini"):
            self.api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
            self.model_name = (os.getenv("GEMINI_MODEL") or "gemini-2.0-flash").strip()
            self.fallback_model = (os.getenv("GEMINI_FALLBACK_MODEL") or "gemini-2.0-pro").strip()
            if not self.api_key or self.api_key == "your_gemini_api_key_here":
                logger.warning("GEMINI_API_KEY not configured. Falling back to mock generator if requested.")
        elif self.backend in ("vertex_ai", "vertexai"):
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and not os.path.exists(cred_path):
                logger.warning(
                    f"GOOGLE_APPLICATION_CREDENTIALS points to non-existent file '{cred_path}'. "
                    "Clearing variable to fall back to system Application Default Credentials."
                )
                del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

            self.project = (os.getenv("GOOGLE_CLOUD_PROJECT") or "").strip()
            self.location = (os.getenv("GOOGLE_CLOUD_LOCATION") or "us-central1").strip()
            self.model_name = (os.getenv("VERTEX_AI_MODEL") or "publishers/xai/models/grok-4.3").strip()
            self.fallback_model = (os.getenv("VERTEX_AI_FALLBACK_MODEL") or "gemini-2.5-flash").strip()
            if not self.project or self.project == "your-gcp-project-id":
                logger.warning("GOOGLE_CLOUD_PROJECT not configured. Falling back to mock generator if requested.")
        elif self.backend in ("openai", "openai_compatible", "openapi"):
            self.api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
            self.model_name = (os.getenv("OPENAI_MODEL") or "gpt-4o").strip()
            self.fallback_model = (os.getenv("OPENAI_FALLBACK_MODEL") or "gpt-4o-mini").strip()
            self.base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip().rstrip("/")
            if not self.api_key or self.api_key == "your_openai_api_key_here":
                logger.warning("OPENAI_API_KEY not configured. Falling back to mock generator if requested.")
        elif self.backend in ("anthropic", "claude"):
            self.api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
            self.model_name = (os.getenv("ANTHROPIC_MODEL") or "claude-3-7-sonnet-20250219").strip()
            self.fallback_model = (os.getenv("ANTHROPIC_FALLBACK_MODEL") or "claude-3-5-haiku-20241022").strip()
            self.base_url = (os.getenv("ANTHROPIC_BASE_URL") or "https://api.anthropic.com/v1").strip().rstrip("/")
            if not self.api_key or self.api_key == "your_anthropic_api_key_here":
                logger.warning("ANTHROPIC_API_KEY not configured. Falling back to mock generator if requested.")
        else:
            raise ValueError(f"Unsupported LLM_BACKEND '{self.backend}'. Must be 'gemini_api', 'vertex_ai', 'openai', 'anthropic', or 'mock'.")

    def _throttle(self) -> None:
        """Enforce a minimum spacing between consecutive API calls to avoid bursting rate limits."""
        global _last_request_time
        with _request_lock:
            now = time.time()
            elapsed = now - _last_request_time
            if elapsed < self.min_interval:
                sleep_sec = self.min_interval - elapsed
                time.sleep(sleep_sec)
            _last_request_time = time.time()

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        json_mode: bool = True,
        mock_response: str | None = None,
        is_explicit: bool = False,
    ) -> str:
        """Generate text or JSON from the selected LLM backend with rate-limiting & backoff retries."""
        if is_explicit:
            system_prompt = f"{system_prompt.strip()}\n\n{EXPLICIT_MODE_DIRECTIVE.strip()}"

        if mock_response is not None and self.backend in ("mock", "test"):
            return clean_json_text(mock_response)

        if self.backend in ("mock", "test"):
            return self._generate_mock(user_prompt)

        # Execute call with exponential backoff for rate limits
        last_exception: Exception | None = None
        current_model = self.model_name

        for attempt in range(self.max_retries):
            self._throttle()
            try:
                if self.backend in ("gemini_api", "gemini"):
                    if not self.api_key or self.api_key == "your_gemini_api_key_here":
                        if os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() in ("true", "1", "yes"):
                            return self._generate_mock(user_prompt)
                        raise RuntimeError("GEMINI_API_KEY not configured. Set your key in .env.")

                    from google import genai
                    client = genai.Client(api_key=self.api_key)
                    config_payload: dict[str, Any] = {
                        "system_instruction": system_prompt,
                        "temperature": temperature,
                        "max_output_tokens": max_tokens,
                        "response_mime_type": "application/json" if json_mode else "text/plain",
                    }
                    if is_explicit:
                        config_payload["safety_settings"] = [
                            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                        ]
                    response = client.models.generate_content(
                        model=current_model,
                        contents=user_prompt,
                        config=config_payload,
                    )
                    return clean_json_text(response.text or "{}")

                elif self.backend in ("vertex_ai", "vertexai"):
                    if not self.project or self.project == "your-gcp-project-id":
                        if os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() in ("true", "1", "yes"):
                            return self._generate_mock(user_prompt)
                        raise RuntimeError("GOOGLE_CLOUD_PROJECT not configured. Set your GCP settings in .env.")

                    is_grok = "grok" in current_model.lower() or current_model.startswith("xai/") or current_model.startswith("publishers/xai")
                    if is_grok:
                        return self._call_vertex_openai(
                            system_prompt, user_prompt, temperature, max_tokens, json_mode, model_override=current_model
                        )

                    # Standard Google Gemini generative models on Vertex AI
                    loc = "us-central1" if self.location.lower() == "global" else self.location
                    import vertexai
                    from vertexai.generative_models import GenerativeModel, GenerationConfig, HarmCategory, HarmBlockThreshold
                    vertexai.init(project=self.project, location=loc)
                    model = GenerativeModel(current_model, system_instruction=[system_prompt])
                    config = GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                        response_mime_type="application/json" if json_mode else "text/plain",
                    )
                    if is_explicit:
                        safety_settings = {
                            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        }
                        response = model.generate_content(user_prompt, generation_config=config, safety_settings=safety_settings)
                    else:
                        response = model.generate_content(user_prompt, generation_config=config)
                    return clean_json_text(response.text or "{}")

                elif self.backend in ("openai", "openai_compatible", "openapi"):
                    if not self.api_key or self.api_key == "your_openai_api_key_here":
                        if os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() in ("true", "1", "yes"):
                            return self._generate_mock(user_prompt)
                        raise RuntimeError("OPENAI_API_KEY not configured. Set your key in .env.")
                    return self._call_openai(
                        system_prompt, user_prompt, temperature, max_tokens, json_mode, model_override=current_model
                    )

                elif self.backend in ("anthropic", "claude"):
                    if not self.api_key or self.api_key == "your_anthropic_api_key_here":
                        if os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() in ("true", "1", "yes"):
                            return self._generate_mock(user_prompt)
                        raise RuntimeError("ANTHROPIC_API_KEY not configured. Set your key in .env.")
                    return self._call_anthropic(
                        system_prompt, user_prompt, temperature, max_tokens, json_mode, model_override=current_model
                    )

            except Exception as e:
                last_exception = e
                err_str = str(e).lower()
                is_rate_limit = any(k in err_str for k in ("429", "resource_exhausted", "rate limit", "too many requests", "quota"))
                is_transient = any(k in err_str for k in ("503", "500", "overloaded", "temporary unavailable", "deadline exceeded", "timeout"))

                if (is_rate_limit or is_transient) and attempt < self.max_retries - 1:
                    backoff = min(60.0, (2 ** attempt) * 2.5 + random.uniform(0.5, 2.0))
                    logger.warning(
                        f"[LLM Rate Limit / Transient Error] ({e}). Backing off for {backoff:.1f}s (attempt {attempt+1}/{self.max_retries})..."
                    )
                    time.sleep(backoff)
                    # Switch to fallback model on second-to-last retry if available
                    if attempt >= 2 and getattr(self, "fallback_model", None) and current_model != self.fallback_model:
                        logger.info(f"Switching to fallback model: {self.fallback_model}")
                        current_model = self.fallback_model
                    continue
                else:
                    logger.error(f"Fatal or unhandled error from LLM backend {self.backend}: {e}")
                    break

        # If retries exhausted, check if mock fallback is explicitly allowed
        if os.getenv("ALLOW_MOCK_FALLBACK", "false").lower() in ("true", "1", "yes"):
            logger.warning(f"All retries exhausted for {self.backend}. Falling back to mock generator: {last_exception}")
            return self._generate_mock(user_prompt)

        if last_exception:
            raise last_exception
        return "{}"

    def _call_vertex_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        json_mode: bool = False,
        model_override: str | None = None,
    ) -> str:
        """Call Vertex AI global OpenAI-compatible endpoint for Model Garden models like xAI Grok."""
        global _vertex_credentials, _http_session
        import google.auth
        import google.auth.transport.requests
        import requests

        if _vertex_credentials is None:
            _vertex_credentials, _ = google.auth.default()
        if not _vertex_credentials.valid:
            req = google.auth.transport.requests.Request()
            _vertex_credentials.refresh(req)
        credentials = _vertex_credentials

        if _http_session is None:
            _http_session = requests.Session()

        model_id = model_override or self.model_name
        if model_id.startswith("publishers/xai/models/"):
            model_id = "xai/" + model_id.replace("publishers/xai/models/", "")
        elif not model_id.startswith("xai/") and "grok" in model_id.lower():
            model_id = f"xai/{model_id}"

        headers = {
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json",
            "X-Goog-User-Project": self.project,
        }
        url = f"https://aiplatform.googleapis.com/v1beta1/projects/{self.project}/locations/global/endpoints/openapi/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = _http_session.post(url, headers=headers, json=payload, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Vertex AI OpenAI endpoint error ({resp.status_code}): {resp.text}")
        data = resp.json()
        return clean_json_text(data["choices"][0]["message"]["content"])

    def _call_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        json_mode: bool = False,
        model_override: str | None = None,
    ) -> str:
        """Call standard OpenAI or OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, DeepSeek, etc.)."""
        global _http_session
        import requests

        if _http_session is None:
            _http_session = requests.Session()

        model_id = model_override or self.model_name
        base = getattr(self, "base_url", "https://api.openai.com/v1").rstrip("/")
        if base.endswith("/chat/completions"):
            url = base
        else:
            url = f"{base}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        if "openrouter" in base.lower():
            headers["HTTP-Referer"] = "https://github.com/questforge"
            headers["X-Title"] = "QuestForge Story Authoring"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        payload: dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = _http_session.post(url, headers=headers, json=payload, timeout=120)
        # Fallback if local/custom endpoint does not support json_object in response_format
        if resp.status_code == 400 and json_mode and "response_format" in resp.text:
            del payload["response_format"]
            resp = _http_session.post(url, headers=headers, json=payload, timeout=120)

        if resp.status_code != 200:
            raise RuntimeError(f"OpenAI / Compatible endpoint error ({resp.status_code}): {resp.text}")

        data = resp.json()
        content = data["choices"][0]["message"].get("content") or ""
        return clean_json_text(content)

    def _call_anthropic(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        json_mode: bool = False,
        model_override: str | None = None,
    ) -> str:
        """Call Anthropic Messages API (Claude)."""
        global _http_session
        import requests

        if _http_session is None:
            _http_session = requests.Session()

        model_id = model_override or self.model_name
        base = getattr(self, "base_url", "https://api.anthropic.com/v1").rstrip("/")
        if base.endswith("/messages"):
            url = base
        else:
            url = f"{base}/messages"

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        sys_text = system_prompt or ""
        if json_mode and "json" not in sys_text.lower():
            sys_text = f"{sys_text}\n\nYou must respond strictly with valid JSON. Do not include markdown codeblocks or explanatory commentary.".strip()

        payload: dict[str, Any] = {
            "model": model_id,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        if sys_text:
            payload["system"] = sys_text

        resp = _http_session.post(url, headers=headers, json=payload, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Anthropic API error ({resp.status_code}): {resp.text}")

        data = resp.json()
        text_blocks = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        content = "".join(text_blocks)
        return clean_json_text(content)

    def diagnose(self) -> dict[str, Any]:
        """Diagnose environment configuration and return status, warnings, and errors."""
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
        cred_found = os.path.exists(cred_path) if cred_path else False
        
        info = {
            "backend": self.backend,
            "model_name": getattr(self, "model_name", "unknown"),
            "fallback_model": getattr(self, "fallback_model", "none"),
            "base_url": getattr(self, "base_url", ""),
            "project": getattr(self, "project", ""),
            "location": getattr(self, "location", ""),
            "credentials_path": cred_path,
            "credentials_found": cred_found,
            "allow_mock_fallback": os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() in ("true", "1", "yes"),
            "warnings": [],
            "errors": [],
        }

        if self.backend in ("vertex_ai", "vertexai"):
            if not self.project or self.project == "your-gcp-project-id":
                info["errors"].append("GOOGLE_CLOUD_PROJECT is not set or using placeholder.")
            if self.location.lower() == "global":
                info["errors"].append(
                    "GOOGLE_CLOUD_LOCATION is set to 'global'. Vertex AI requires a regional endpoint such as 'us-central1' or 'europe-west1'."
                )
            if cred_path and not cred_found:
                info["warnings"].append(
                    f"GOOGLE_APPLICATION_CREDENTIALS points to '{cred_path}', but the file does not exist. Default Application Credentials (gcloud auth) will be attempted."
                )
        elif self.backend in ("gemini_api", "gemini"):
            if not self.api_key or self.api_key == "your_gemini_api_key_here":
                info["warnings"].append("GEMINI_API_KEY is not set or using placeholder key.")
        elif self.backend in ("openai", "openai_compatible", "openapi"):
            if not self.api_key or self.api_key == "your_openai_api_key_here":
                info["warnings"].append("OPENAI_API_KEY is not set or using placeholder key.")
        elif self.backend in ("anthropic", "claude"):
            if not self.api_key or self.api_key == "your_anthropic_api_key_here":
                info["warnings"].append("ANTHROPIC_API_KEY is not set or using placeholder key.")

        return info

    def test_call(
        self,
        prompt: str,
        system_prompt: str = "You are a helpful assistant.",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> dict[str, Any]:
        """Execute test prompt without mock fallback, returning response or formatted error with diagnostics."""
        import time
        start_time = time.perf_counter()
        
        # In test_call, we bypass mock fallback unless backend is specifically 'mock'
        try:
            if self.backend in ("mock", "test"):
                resp = self._generate_mock(prompt)
                latency = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "success": True,
                    "response": resp,
                    "latency_ms": latency,
                    "backend": self.backend,
                    "model": self.model_name,
                    "error": None,
                    "hint": None,
                }

            if self.backend in ("gemini_api", "gemini"):
                if not self.api_key or self.api_key == "your_gemini_api_key_here":
                    raise ValueError("GEMINI_API_KEY is not configured in .env.")
                from google import genai
                client = genai.Client(api_key=self.api_key)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        "system_instruction": system_prompt,
                        "temperature": temperature,
                        "max_output_tokens": max_tokens,
                        "response_mime_type": "application/json" if json_mode else "text/plain",
                    },
                )
                latency = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "success": True,
                    "response": clean_json_text(response.text or ""),
                    "latency_ms": latency,
                    "backend": self.backend,
                    "model": self.model_name,
                    "error": None,
                    "hint": None,
                }

            if self.backend in ("openai", "openai_compatible", "openapi"):
                if not self.api_key or self.api_key == "your_openai_api_key_here":
                    raise ValueError("OPENAI_API_KEY is not configured in .env.")
                resp = self._call_openai(system_prompt, prompt, temperature, max_tokens, json_mode)
                latency = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "success": True,
                    "response": resp,
                    "latency_ms": latency,
                    "backend": self.backend,
                    "model": self.model_name,
                    "error": None,
                    "hint": None,
                }

            if self.backend in ("anthropic", "claude"):
                if not self.api_key or self.api_key == "your_anthropic_api_key_here":
                    raise ValueError("ANTHROPIC_API_KEY is not configured in .env.")
                resp = self._call_anthropic(system_prompt, prompt, temperature, max_tokens, json_mode)
                latency = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "success": True,
                    "response": resp,
                    "latency_ms": latency,
                    "backend": self.backend,
                    "model": self.model_name,
                    "error": None,
                    "hint": None,
                }

            if self.backend in ("vertex_ai", "vertexai"):
                is_grok = "grok" in self.model_name.lower() or self.model_name.startswith("xai/") or self.model_name.startswith("publishers/xai")
                if is_grok:
                    resp = self._call_vertex_openai(system_prompt, prompt, temperature, max_tokens, json_mode)
                    latency = round((time.perf_counter() - start_time) * 1000, 1)
                    return {
                        "success": True,
                        "response": resp,
                        "latency_ms": latency,
                        "backend": self.backend,
                        "model": self.model_name,
                        "error": None,
                        "hint": None,
                    }

                loc = "us-central1" if self.location.lower() == "global" else self.location
                import vertexai
                from vertexai.generative_models import GenerativeModel, GenerationConfig
                vertexai.init(project=self.project, location=loc)
                model = GenerativeModel(self.model_name, system_instruction=[system_prompt])
                config = GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json" if json_mode else "text/plain",
                )
                response = model.generate_content(prompt, generation_config=config)
                latency = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "success": True,
                    "response": clean_json_text(response.text or ""),
                    "latency_ms": latency,
                    "backend": self.backend,
                    "model": self.model_name,
                    "error": None,
                    "hint": None,
                }

            raise ValueError(f"Unknown backend: {self.backend}")

        except Exception as e:
            latency = round((time.perf_counter() - start_time) * 1000, 1)
            err_str = str(e)
            hint = None
            if "Unsupported region" in err_str or "global" in err_str:
                hint = "Change GOOGLE_CLOUD_LOCATION in .env to a supported region like 'us-central1'."
            elif "404" in err_str or "Publisher Model" in err_str or "not found" in err_str.lower():
                hint = f"Model '{self.model_name}' was not found in region '{getattr(self, 'location', '')}'. Check model name spelling or region availability."
            elif "credentials" in err_str.lower() or "permission" in err_str.lower() or "403" in err_str:
                hint = "Authentication failed. Check your GCP service account credentials file and IAM permissions (Vertex AI User)."
            elif "API_KEY_INVALID" in err_str or "API key not valid" in err_str:
                hint = "Invalid Gemini API Key. Please verify your GEMINI_API_KEY in .env."
            elif "OPENAI_API_KEY" in err_str or ("openai" in err_str.lower() and ("401" in err_str or "invalid" in err_str.lower())):
                hint = "Authentication failed. Check your OPENAI_API_KEY in .env."
            elif "ANTHROPIC_API_KEY" in err_str or ("anthropic" in err_str.lower() and ("401" in err_str or "x-api-key" in err_str.lower())):
                hint = "Authentication failed. Check your ANTHROPIC_API_KEY in .env."

            return {
                "success": False,
                "response": None,
                "latency_ms": latency,
                "backend": self.backend,
                "model": self.model_name,
                "error": err_str,
                "hint": hint,
            }

    def _generate_mock(self, prompt: str) -> str:
        """Deterministic mock generator for offline tests and validation."""
        prompt_lower = prompt.lower()
        
        # Match operation specifically
        if "pass 3" in prompt_lower or "chapter transitions" in prompt_lower:
            transitions = []
            for i in range(1, 6):
                transitions.append({
                    "transition_id": f"trans_ch{i:02d}_to_ch{i+1:02d}",
                    "from_chapter_id": f"chapter_{i:02d}",
                    "to_chapter_id": f"chapter_{i+1:02d}",
                    "scene_summary": f"Cross leaves district {i} under heavy acid rain, heading towards district {i+1}.",
                    "state_delta": {"active_flags_added": [f"transit_to_ch{i+1:02d}"]},
                    "narrative_hook": f"The sirens in district {i+1} echo through the concrete canyons."
                })
            return json.dumps(transitions)

        if "pass 2" in prompt_lower or "chapter contracts" in prompt_lower:
            chapters = []
            for i in range(1, 7):
                chapters.append({
                    "chapter_id": f"chapter_{i:02d}",
                    "order": i,
                    "title": f"Chapter {i}: The Trail of Wire",
                    "narrative_scope": f"Elena Cross navigates district {i} uncovering evidence against Sterling.",
                    "entry_state": {
                        "location": f"loc_district_{i:02d}",
                        "trait_snapshot": {"Cunning": "none", "Empathy": "none"},
                        "inventory": ["detective_badge", "service_pistol"],
                        "active_flags": [f"ch_{i:02d}_started"]
                    },
                    "exit_state": {
                        "location": f"loc_district_{i:02d}_exit",
                        "trait_snapshot": {"Cunning": "emerging" if i >= 2 else "none", "Empathy": "emerging" if i >= 3 else "none"},
                        "inventory": ["detective_badge", "service_pistol", f"clue_fragment_{i}"],
                        "active_flags": [f"ch_{i:02d}_completed"]
                    },
                    "attachment_points": [
                        {
                            "slot_id": f"slot_ch{i:02d}_01",
                            "chapter_id": f"chapter_{i:02d}",
                            "location_id": f"loc_district_{i:02d}",
                            "available_after": f"ch_{i:02d}_started",
                            "expires_after": f"ch_{i:02d}_completed",
                            "npcs_present": [f"npc_informant_{i}"],
                            "arc_type": "simple"
                        }
                    ]
                })
            return json.dumps(chapters)

        if "pass 1" in prompt_lower or "story arc" in prompt_lower or "story_arc" in prompt_lower:
            return json.dumps({
                "title": "A Neon Grave",
                "genre": "Cyber-Noir Mystery",
                "tone": "Gritty, melancholic, suspenseful",
                "themes": ["Institutional corruption", "The burden of memory", "Redemption through truth"],
                "protagonist_sketch": "Detective Elena Cross, an investigator plagued by neural glitches from an unsolved case.",
                "antagonist_sketch": "Councilman Julian Sterling, a wealthy civic leader who buried his criminal origins.",
                "central_conflict": "A serial cipher killer targets the syndicate that Cross investigated before her memory was wiped.",
                "acts": [
                    {"act_number": 1, "title": "The Ghost in the Circuit", "summary": "Cross investigates an impossible murder that points to her erased memories."},
                    {"act_number": 2, "title": "The Sunken Ward", "summary": "Delving into the flooded lower district, Cross confronts Sterling's enforcers."},
                    {"act_number": 3, "title": "The Glass Terminal", "summary": "Cross confronts Sterling with the decrypt key at the city memorial tower."}
                ],
                "trait_vocabulary": [
                    {"name": "Cunning", "description": "Deceptive problem solving and electronic intrusion", "color_hex": "#E0A82E"},
                    {"name": "Empathy", "description": "Reading emotional tells and forging loyal human alliances", "color_hex": "#2EA8E0"}
                ]
            })

        return "{}"


_GLOBAL_CLIENT: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Singleton getter for the configured LLM client."""
    global _GLOBAL_CLIENT
    if _GLOBAL_CLIENT is None:
        _GLOBAL_CLIENT = LLMClient()
    return _GLOBAL_CLIENT
