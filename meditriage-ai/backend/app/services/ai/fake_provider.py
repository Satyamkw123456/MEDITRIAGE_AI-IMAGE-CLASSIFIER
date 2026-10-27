from __future__ import annotations

from typing import AsyncIterator, Optional, Type, TypeVar
from pydantic import BaseModel

from app.services.ai.port import (
    LLMBlocked,
    LLMInvalidOutput,
    LLMProvider,
    LLMResult,
    LLMUnavailable,
)
from app.services.ai.schemas import CaseAnalysis, DifferentialItem

T = TypeVar("T", bound=BaseModel)


class FakeProvider(LLMProvider):
    """
    Mock LLM provider for deterministic offline testing.
    Supports simulated failures, custom canned outputs, and call recording.
    """

    def __init__(
        self,
        canned_response: Optional[BaseModel] = None,
        should_fail_unavailable: bool = False,
        should_fail_blocked: bool = False,
        should_fail_invalid_output: bool = False,
        failure_count_before_success: int = 0,
        model_name: str = "fake-mock-model-v1",
    ):
        self.canned_response = canned_response
        self.should_fail_unavailable = should_fail_unavailable
        self.should_fail_blocked = should_fail_blocked
        self.should_fail_invalid_output = should_fail_invalid_output
        self.failure_count_before_success = failure_count_before_success
        self.model_name = model_name

        self.calls_count = 0
        self.last_system_prompt: Optional[str] = None
        self.last_user_prompt: Optional[str] = None

    def _get_default_case_analysis(self) -> CaseAnalysis:
        return CaseAnalysis(
            summary="Elderly patient evaluated for acute symptoms. Hemodynamic status and risk factors considered.",
            suggested_urgency="urgent",
            urgency_rationale="Atypical geriatric presentation requiring structured clinical assessment.",
            differentials=[
                DifferentialItem(
                    condition="Atypical Acute Infection / Sepsis",
                    likelihood="more_likely",
                    supporting_evidence=["Altered functional status", "Vague fatigue"],
                    against_or_missing=["No recorded fever"],
                    source_ids=["src_1"],
                ),
                DifferentialItem(
                    condition="Medication-Induced Adverse Reaction",
                    likelihood="possible",
                    supporting_evidence=["Active polypharmacy"],
                    against_or_missing=["Stable renal parameters"],
                    source_ids=["src_2"],
                ),
            ],
            followup_questions=["When did the patient last eat or drink?", "Any recent falls?"],
            geriatric_concerns=["atypical_presentation", "polypharmacy"],
            is_rule_based_fallback=False,
        )

    async def generate_structured(
        self,
        *,
        system: str,
        user: str,
        schema: Type[T],
        temperature: float = 0.2,
    ) -> LLMResult[T]:
        self.calls_count += 1
        self.last_system_prompt = system
        self.last_user_prompt = user

        # Check transient failure counter
        if self.failure_count_before_success > 0:
            self.failure_count_before_success -= 1
            raise LLMUnavailable("Simulated transient network timeout (attempt failed)")

        if self.should_fail_unavailable:
            raise LLMUnavailable("Simulated LLM service unavailable / 503")

        if self.should_fail_blocked:
            raise LLMBlocked("Simulated safety filter block / empty response")

        if self.should_fail_invalid_output:
            raise LLMInvalidOutput("Simulated malformed JSON output failing schema validation")

        if self.canned_response is not None:
            if isinstance(self.canned_response, schema):
                res_content = self.canned_response
            else:
                res_content = schema.model_validate(self.canned_response.model_dump())
        elif schema == CaseAnalysis:
            res_content = self._get_default_case_analysis()  # type: ignore
        else:
            res_content = schema.model_validate({})

        raw_str = res_content.model_dump_json(indent=2)
        return LLMResult(
            content=res_content,  # type: ignore
            raw_response=raw_str,
            model=self.model_name,
            tokens_in=150,
            tokens_out=80,
            latency_ms=12.5,
        )

    async def stream_text(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        self.calls_count += 1
        self.last_system_prompt = system
        self.last_user_prompt = user

        if self.should_fail_unavailable:
            raise LLMUnavailable("Simulated stream error")

        tokens = ["Geriatric ", "clinical ", "assessment ", "summary."]
        for t in tokens:
            yield t
