from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.services.ai.circuit_breaker import CircuitBreaker
from app.services.ai.fallback import DeterministicFallbackEngine
from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.grounding import GroundingChecker
from app.services.ai.phi_scrubber import PHIScrubber
from app.services.ai.port import (
    LLMBlocked,
    LLMInvalidOutput,
    LLMProvider,
    LLMResult,
    LLMUnavailable,
)
from app.services.ai.prompt_registry import PromptRegistryService
from app.services.ai.schemas import CaseAnalysis, DifferentialItem

logger = logging.getLogger(__name__)


class NonSyntheticPatientError(Exception):
    """Raised when non-synthetic patient data is supplied while AI Gateway is in synthetic mode."""
    pass


class StartupConfigurationError(Exception):
    """Raised when gateway configuration violates production safety requirements."""
    pass


class RateLimitExceeded(Exception):
    """Raised when a user exceeds the permitted AI inference request quota."""
    pass


@dataclass
class GatewayResult:
    analysis: CaseAnalysis
    model_name: str
    prompt_version: str
    prompt_hash: str
    raw_prompt: str
    raw_response: str
    tokens_in: Optional[int]
    tokens_out: Optional[int]
    latency_ms: float
    scrub_report: Dict[str, Any]
    block_reason: Optional[str]
    fallback_used: bool
    retrieved_chunks: Optional[str]
    agreement_score: float
    evidence_density_score: float
    dropped_differentials: List[DifferentialItem] = field(default_factory=list)


class SimpleRateLimiter:
    """In-memory sliding window rate limiter per user ID."""
    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.history: Dict[str, List[float]] = {}

    def check_and_record(self, user_id: str) -> bool:
        now = time.time()
        timestamps = self.history.get(user_id, [])
        valid_ts = [t for t in timestamps if (now - t) < self.window_seconds]
        if len(valid_ts) >= self.max_requests:
            return False
        valid_ts.append(now)
        self.history[user_id] = valid_ts
        return True


class SimpleCache:
    """In-memory hash-keyed cache with TTL."""
    def __init__(self, ttl_seconds: float = 300.0):
        self.ttl_seconds = ttl_seconds
        self.entries: Dict[str, Tuple[float, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        if key in self.entries:
            ts, val = self.entries[key]
            if now - ts <= self.ttl_seconds:
                return val
            del self.entries[key]
        return None

    def set(self, key: str, val: Any) -> None:
        self.entries[key] = (time.time(), val)


class AIGateway:
    """
    Central AI Gateway enforcing clinical safety, PHI minimisation, rate-limiting,
    RAG grounding checks, resilience (timeout/retry/circuit-breaker), and audit logging.
    """

    def __init__(
        self,
        provider: Optional[LLMProvider] = None,
        config_service: Optional[Any] = None,
        data_mode: Optional[str] = None,
        paid_tier_attested: Optional[bool] = None,
    ):
        self.data_mode = data_mode or settings.AI_DATA_MODE
        self.paid_tier_attested = (
            paid_tier_attested
            if paid_tier_attested is not None
            else settings.AI_PAID_TIER_ATTESTED
        )

        # Enforce startup mode invariant
        if self.data_mode == "real" and not self.paid_tier_attested:
            raise StartupConfigurationError(
                "CRITICAL: Gateway cannot start in 'real' mode without AI_PAID_TIER_ATTESTED=true!"
            )

        self.provider = provider or GeminiProvider(
            timeout_seconds=settings.AI_TIMEOUT_SECONDS
        )
        self.config_service = config_service
        self.scrubber = PHIScrubber()
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=settings.AI_CIRCUIT_BREAKER_FAILURES,
            cooldown_seconds=settings.AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS,
        )
        self.rate_limiter = SimpleRateLimiter()
        self.cache = SimpleCache(ttl_seconds=settings.AI_CACHE_TTL_SECONDS)

    def _is_kill_switch_active(self) -> bool:
        """Reads global AI kill switch from ConfigService (namespace=flags, key=ai.global)."""
        if not self.config_service:
            return False
        try:
            flag_val = self.config_service.get_config(namespace="flags", key="ai.global")
            if flag_val is not None:
                # If explicitly set to False, kill switch is active (AI disabled)
                return not bool(flag_val.get("enabled", True) if isinstance(flag_val, dict) else flag_val)
        except Exception as e:
            logger.warning(f"Error checking AI killswitch: {e}")
        return False

    def _compute_agreement(self, rule_level_str: str, llm_urgency: str) -> float:
        """Computes agreement score between rule triage level and LLM suggestion."""
        urgency_map = {
            "emergency": 3,
            "urgent": 2,
            "routine": 1,
            "self_care": 0,
            "self-care info": 0,
        }
        r_val = urgency_map.get(rule_level_str.lower(), 1)
        l_val = urgency_map.get(llm_urgency.lower(), 1)
        diff = abs(r_val - l_val)
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.5
        return 0.0

    async def analyze_case(
        self,
        case_data: Dict[str, Any],
        retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
        user_id: Optional[str] = None,
        is_synthetic_patient: bool = True,
    ) -> GatewayResult:
        """
        Executes end-to-end clinical analysis with strict safety, resilience,
        grounding verification, and audit logging.
        """
        start_time = time.perf_counter()

        # 1. AI_DATA_MODE Enforcement
        if self.data_mode == "synthetic" and not is_synthetic_patient:
            raise NonSyntheticPatientError(
                "Safety Violation: In synthetic mode, AI Gateway strictly refuses non-synthetic patient cases."
            )

        # 2. Rate Limiting
        effective_user_id = user_id or "anonymous"
        if not self.rate_limiter.check_and_record(effective_user_id):
            raise RateLimitExceeded(f"AI rate limit exceeded for user '{effective_user_id}'.")

        # 3. PHI Scrubbing (Allowlist + Regex Defense-in-Depth)
        scrubbed_payload, scrub_report = self.scrubber.build_safe_payload(case_data)

        # 4. Check Global AI Kill-Switch
        if self._is_kill_switch_active():
            logger.info("Global AI kill switch active. Routing to deterministic fallback.")
            fallback = DeterministicFallbackEngine.generate_fallback_analysis(
                scrubbed_payload,
                retrieved_source_ids=[c.get("id", "src_1") for c in (retrieved_chunks or [])],
            )
            lat_ms = (time.perf_counter() - start_time) * 1000.0
            return GatewayResult(
                analysis=fallback,
                model_name="deterministic_fallback",
                prompt_version="v1.0-killswitch-fallback",
                prompt_hash="killswitch_active",
                raw_prompt="N/A (Killswitch Active)",
                raw_response=fallback.model_dump_json(indent=2),
                tokens_in=0,
                tokens_out=0,
                latency_ms=lat_ms,
                scrub_report=scrub_report.to_dict(),
                block_reason="global_kill_switch_active",
                fallback_used=True,
                retrieved_chunks=None,
                agreement_score=1.0,
                evidence_density_score=0.8,
            )

        # 5. Prompt Construction
        prompt_ver = PromptRegistryService.get_active_prompt()
        rendered_prompt = PromptRegistryService.render_user_prompt(
            scrubbed_payload, retrieved_chunks
        )

        # 6. Cache Check
        cache_key = hashlib.sha256(
            f"{rendered_prompt}::{prompt_ver.template_hash}".encode("utf-8")
        ).hexdigest()
        cached_result = self.cache.get(cache_key)
        if cached_result:
            logger.info("AI Gateway cache hit.")
            return cached_result

        # 7. Resilient Execution (Circuit Breaker + Retries)
        raw_response = ""
        analysis: Optional[CaseAnalysis] = None
        block_reason: Optional[str] = None
        fallback_used = False
        tokens_in = None
        tokens_out = None
        model_name = getattr(self.provider, "model_name", "llm-provider")

        if not self.circuit_breaker.can_execute():
            logger.warning("Circuit breaker OPEN. Routing directly to fallback.")
            fallback_used = True
            block_reason = "circuit_breaker_open"
        else:
            # Attempt LLM execution with max 2 retries strictly for LLMUnavailable
            max_retries = settings.AI_MAX_RETRIES
            attempt = 0
            while attempt <= max_retries:
                attempt += 1
                try:
                    result: LLMResult[CaseAnalysis] = await self.provider.generate_structured(
                        system=prompt_ver.system_template,
                        user=rendered_prompt,
                        schema=CaseAnalysis,
                        temperature=0.2,
                    )
                    analysis = result.content
                    raw_response = result.raw_response
                    tokens_in = result.tokens_in
                    tokens_out = result.tokens_out
                    model_name = result.model
                    self.circuit_breaker.record_success()
                    break
                except LLMUnavailable as e:
                    logger.warning(f"LLMUnavailable on attempt {attempt}: {e}")
                    if attempt > max_retries:
                        self.circuit_breaker.record_failure()
                        fallback_used = True
                        block_reason = f"llm_unavailable: {e}"
                        break
                    # Exponential backoff
                    time.sleep(0.1 * (2 ** (attempt - 1)))
                except LLMBlocked as e:
                    # Never retry safety blocks
                    logger.warning(f"LLMBlocked (no retry): {e}")
                    fallback_used = True
                    block_reason = f"llm_blocked: {e}"
                    break
                except LLMInvalidOutput as e:
                    # Never retry invalid schema output
                    logger.warning(f"LLMInvalidOutput (no retry): {e}")
                    fallback_used = True
                    block_reason = f"llm_invalid_output: {e}"
                    break
                except Exception as e:
                    logger.error(f"Unexpected error calling LLM provider: {e}")
                    self.circuit_breaker.record_failure()
                    fallback_used = True
                    block_reason = f"unexpected_error: {e}"
                    break

        # 8. Fallback Execution if Needed
        if analysis is None or fallback_used:
            fallback_used = True
            analysis = DeterministicFallbackEngine.generate_fallback_analysis(
                scrubbed_payload,
                retrieved_source_ids=[c.get("id", "src_1") for c in (retrieved_chunks or [])],
            )
            raw_response = analysis.model_dump_json(indent=2)

        # 9. Grounding Check & Differential Filtering
        retrieved_ids = {c["id"] for c in (retrieved_chunks or []) if "id" in c}
        filtered_analysis, dropped_diffs, evidence_density = GroundingChecker.verify_and_filter(
            analysis=analysis,
            retrieved_source_ids=retrieved_ids,
            symptoms=scrubbed_payload.get("symptoms") or [],
            vitals=scrubbed_payload.get("vitals") or {},
        )

        # 10. Agreement Score
        agreement = self._compute_agreement(
            scrubbed_payload.get("rule_triage_level", "routine"),
            filtered_analysis.suggested_urgency,
        )

        total_lat_ms = (time.perf_counter() - start_time) * 1000.0

        gateway_res = GatewayResult(
            analysis=filtered_analysis,
            model_name=model_name,
            prompt_version=f"v{prompt_ver.version}-{prompt_ver.prompt_code}",
            prompt_hash=prompt_ver.template_hash,
            raw_prompt=rendered_prompt,
            raw_response=raw_response,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=total_lat_ms,
            scrub_report=scrub_report.to_dict(),
            block_reason=block_reason,
            fallback_used=fallback_used,
            retrieved_chunks=json.dumps(retrieved_chunks) if retrieved_chunks else None,
            agreement_score=agreement,
            evidence_density_score=evidence_density,
            dropped_differentials=dropped_diffs,
        )

        # Cache on successful non-fallback call
        if not fallback_used:
            self.cache.set(cache_key, gateway_res)

        return gateway_res
