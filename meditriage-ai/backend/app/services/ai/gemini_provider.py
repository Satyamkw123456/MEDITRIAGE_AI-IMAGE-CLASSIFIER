from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, AsyncIterator, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.services.ai.port import (
    LLMBlocked,
    LLMInvalidOutput,
    LLMProvider,
    LLMResult,
    LLMUnavailable,
)
from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class GeminiProvider(LLMProvider):
    """
    Official Google GenAI SDK adapter.
    Uses async client.aio.models.generate_content with structured Pydantic schemas.
    Model ID is strictly configured via GEMINI_MODEL env var.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: float = 10.0,
    ):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY or ""
        # Strictly read from GEMINI_MODEL env var or settings, never hardcoded
        self.model_name = model_name or os.environ.get("GEMINI_MODEL") or settings.GEMINI_MODEL
        self.timeout_seconds = timeout_seconds

        # Lazy initialize client
        self._client: Any = None

    @property
    def client(self) -> Any:
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key or "DUMMY_KEY")
        return self._client

    @classmethod
    def verify_model_availability(
        cls,
        client: Optional[Any] = None,
        api_key: Optional[str] = None,
        target_model: Optional[str] = None,
    ) -> bool:
        """
        Spike 3: Startup model list verification.
        Calls models.list, checks presence of configured GEMINI_MODEL,
        logs a warning (never crashes) if missing, and returns True/False.
        """
        model_id = target_model or os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
        clean_model_id = model_id.removeprefix("models/")

        try:
            from google import genai
            c = client or genai.Client(api_key=api_key or os.environ.get("GEMINI_API_KEY", "DUMMY_KEY"))
            
            # List models
            available_models = []
            for m in c.models.list():
                m_name = getattr(m, "name", "")
                available_models.append(m_name.removeprefix("models/"))
            
            is_present = clean_model_id in available_models
            if not is_present:
                logger.warning(
                    f"Startup Model Check: Configured model '{model_id}' was NOT found in "
                    f"models.list() response! Available models: {available_models[:5]}... "
                    "Inference will proceed with configured identifier or failover gracefully."
                )
            else:
                logger.info(f"Startup Model Check: Configured model '{model_id}' successfully verified.")
            return is_present
        except Exception as e:
            logger.warning(
                f"Startup Model Check: Unable to query models.list() ({type(e).__name__}: {e}). "
                f"Configured model '{model_id}' cannot be confirmed."
            )
            return False

    async def generate_structured(
        self,
        *,
        system: str,
        user: str,
        schema: Type[T],
        temperature: float = 0.2,
    ) -> LLMResult[T]:
        """
        Executes async structured generation with Pydantic schema validation.
        Maps network failures, safety filters, and schema parsing errors.
        """
        from google.genai import types

        start_time = time.perf_counter()
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=user,
                config=config,
            )
        except Exception as e:
            err_msg = str(e).lower()
            # Check for timeout, rate-limit, 5xx, or network errors
            if any(term in err_msg for term in ["timeout", "deadline", "rate limit", "quota", "503", "500", "504", "unavailable", "connection"]):
                raise LLMUnavailable(f"Gemini API unavailable: {e}") from e
            elif any(term in err_msg for term in ["safety", "blocked", "harm"]):
                raise LLMBlocked(f"Gemini API safety block: {e}") from e
            else:
                raise LLMUnavailable(f"Gemini API request failed: {e}") from e

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        # Safety & candidate validation
        if not response or not getattr(response, "candidates", None):
            raise LLMBlocked("Gemini API returned no candidates (safety block or empty output)")

        candidate = response.candidates[0]
        finish_reason = str(getattr(candidate, "finish_reason", "")).upper()
        if "SAFETY" in finish_reason or "BLOCK" in finish_reason:
            raise LLMBlocked(f"Gemini candidate blocked by safety filter: {finish_reason}")

        raw_text = response.text or ""
        if not raw_text.strip():
            raise LLMBlocked("Gemini returned empty text response")

        # Parse & validate schema
        try:
            parsed_data = json.loads(raw_text)
            content = schema.model_validate(parsed_data)
        except (json.JSONDecodeError, ValidationError) as e:
            raise LLMInvalidOutput(f"Failed to validate response against {schema.__name__}: {e}") from e

        # Extract token usage if available
        usage = getattr(response, "usage_metadata", None)
        tokens_in = getattr(usage, "prompt_token_count", None) if usage else None
        tokens_out = getattr(usage, "candidates_token_count", None) if usage else None

        return LLMResult(
            content=content,
            raw_response=raw_text,
            model=self.model_name,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=latency_ms,
        )

    async def stream_text(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream raw text tokens asynchronously."""
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
        )

        try:
            stream = await self.client.aio.models.generate_content_stream(
                model=self.model_name,
                contents=user,
                config=config,
            )
            async for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            err_msg = str(e).lower()
            if any(term in err_msg for term in ["timeout", "quota", "503", "500", "unavailable"]):
                raise LLMUnavailable(f"Gemini stream unavailable: {e}") from e
            elif "safety" in err_msg or "blocked" in err_msg:
                raise LLMBlocked(f"Gemini stream blocked: {e}") from e
            else:
                raise LLMUnavailable(f"Gemini stream failed: {e}") from e
