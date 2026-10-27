from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Generic, Optional, Protocol, Type, TypeVar, runtime_checkable
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMUnavailable(Exception):
    """Raised when the LLM service is unreachable due to timeout, 5xx, or quota limits."""
    pass


class LLMBlocked(Exception):
    """Raised when the LLM response is blocked by safety filters or returned empty candidates."""
    pass


class LLMInvalidOutput(Exception):
    """Raised when the LLM output violates schema validation or cannot be parsed as valid JSON."""
    pass


@dataclass(frozen=True, slots=True)
class LLMResult(Generic[T]):
    content: T
    raw_response: str
    model: str
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    latency_ms: float = 0.0


@runtime_checkable
class LLMProvider(Protocol):
    """
    Abstract Port for LLM providers.
    All live and mock adapters must strictly implement this interface.
    """

    async def generate_structured(
        self,
        *,
        system: str,
        user: str,
        schema: Type[T],
        temperature: float = 0.2,
    ) -> LLMResult[T]:
        """Generate structured data strictly conforming to a Pydantic schema."""
        ...

    def stream_text(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream raw text tokens asynchronously."""
        ...
