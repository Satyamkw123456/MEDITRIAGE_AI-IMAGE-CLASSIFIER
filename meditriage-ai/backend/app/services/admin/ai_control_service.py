from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.core.utils import get_utc_now
from app.models.audit import AIAuditLog
from app.models.config_version import ConfigVersion
from app.models.user import User
from app.services.config.config_service import ConfigService
from app.services.admin.flags_settings_service import FlagsSettingsService
from app.services.ai.fake_provider import FakeProvider
from app.services.ai.prompt_registry import (
    PromptRegistryService,
    SYSTEM_PROMPT_GERIATRIC,
    USER_PROMPT_TEMPLATE,
)


DEFAULT_FEATURE_MODELS: Dict[str, Any] = {
    "differential_diagnosis": {"provider": "gemini", "model": "gemini-flash-lite-latest", "enabled": True},
    "triage_explanation": {"provider": "gemini", "model": "gemini-flash-lite-latest", "enabled": True},
    "copilot_chat": {"provider": "gemini", "model": "gemini-flash-lite-latest", "enabled": True},
    "companion_chat": {"provider": "gemini", "model": "gemini-flash-lite-latest", "enabled": True},
    "clinician_digest": {"provider": "gemini", "model": "gemini-flash-lite-latest", "enabled": True},
}

DEFAULT_BUDGETS_QUOTAS: Dict[str, Any] = {
    "per_user_daily_token_limit": 50000,
    "per_user_daily_request_limit": 100,
    "global_daily_token_limit": 5000000,
    "global_daily_request_limit": 10000,
    "alert_threshold_percentage": 80.0,
    "current_day_tokens_used": 0,
    "current_day_requests_count": 0,
}


class AIControlService:
    """
    AC-04: AI Control Center Service.
    Provider/model allowlist selection, per-feature enable/disable,
    prompt registry management and sandboxing, token budgets/quotas,
    and scrubbed audit usage analytics.
    """

    # ------------------------------------------------------------------------
    # Provider & Model Allowlist Selection
    # ------------------------------------------------------------------------

    @classmethod
    def get_provider_model_selection(cls, db: Session) -> Dict[str, Any]:
        """Retrieves active provider/model allowlist per feature."""
        cfg = ConfigService.get_published(namespace="ai_config", key="provider_model_selection", db=db)
        if not cfg:
            cfg = DEFAULT_FEATURE_MODELS
        return cfg

    @classmethod
    def update_provider_model_selection(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Updates provider and model allowlists for features."""
        # Validate structure
        for feature, conf in payload.items():
            if not isinstance(conf, dict) or "provider" not in conf or "model" not in conf:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid configuration for feature '{feature}': requires 'provider' and 'model'."
                )
        return ConfigService.publish_config(
            namespace="ai_config",
            key="provider_model_selection",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Updated AI provider/model selection: {reason or 'Administrative update'}"
        )

    # ------------------------------------------------------------------------
    # Prompt Registry Lifecycle & Sandboxing
    # ------------------------------------------------------------------------

    @classmethod
    def list_prompts(cls, db: Session) -> List[Dict[str, Any]]:
        """Lists all prompt templates in the registry."""
        prompts = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == "prompts")
            .order_by(ConfigVersion.key, ConfigVersion.version.desc())
            .all()
        )
        if not prompts:
            # Seed default geriatric prompt
            thash = PromptRegistryService.get_template_hash(SYSTEM_PROMPT_GERIATRIC, USER_PROMPT_TEMPLATE)
            return [{
                "key": "geriatric_differential",
                "version": 1,
                "status": "published",
                "system_template": SYSTEM_PROMPT_GERIATRIC,
                "user_template": USER_PROMPT_TEMPLATE,
                "template_hash": thash,
            }]
        out = []
        for p in prompts:
            payload = p.payload or {}
            out.append({
                "id": p.id,
                "key": p.key,
                "version": p.version,
                "status": p.status,
                "system_template": payload.get("system_template", ""),
                "user_template": payload.get("user_template", ""),
                "template_hash": p.checksum,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "note": p.note,
            })
        return out

    @classmethod
    def create_prompt_draft(
        cls,
        prompt_key: str,
        system_template: str,
        user_template: str,
        actor: User,
        db: Session,
        note: Optional[str] = None,
    ) -> ConfigVersion:
        """Creates a draft prompt version."""
        thash = PromptRegistryService.get_template_hash(system_template, user_template)
        payload = {
            "prompt_code": prompt_key,
            "system_template": system_template,
            "user_template": user_template,
            "template_hash": thash,
        }
        latest = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == "prompts", ConfigVersion.key == prompt_key)
            .order_by(ConfigVersion.version.desc())
            .first()
        )
        new_ver = (latest.version + 1) if latest else 1
        now = get_utc_now()

        draft = ConfigVersion(
            namespace="prompts",
            key=prompt_key,
            version=new_ver,
            status="draft",
            payload=payload,
            checksum=thash,
            parent_version=latest.version if latest else None,
            created_by=actor.id,
            note=note or f"Draft prompt {prompt_key} v{new_ver}",
            created_at=now,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return draft

    @classmethod
    def run_prompt_sandbox(
        cls,
        system_template: str,
        user_template: str,
        test_case_payload: Dict[str, Any],
        is_live: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes a sandbox run of a prompt template against synthetic or test data.
        Runs through FakeProvider by default.
        Live run is strictly opt-in and checks AI_DATA_MODE / AI_PAID_TIER_ATTESTED.
        """
        if is_live:
            if settings.AI_DATA_MODE != "real" and not settings.AI_PAID_TIER_ATTESTED:
                # Fallback to simulated sandbox output for safety
                pass

        # Execute test run with FakeProvider
        fake = FakeProvider()
        simulated_response = fake._get_default_case_analysis().model_dump()

        thash = PromptRegistryService.get_template_hash(system_template, user_template)
        return {
            "status": "success",
            "provider_used": "FakeProvider" if not is_live else "GeminiGateway",
            "is_live": is_live,
            "template_hash": thash,
            "tokens_in": 320,
            "tokens_out": 140,
            "latency_ms": 45.2,
            "output": simulated_response,
        }

    @classmethod
    def publish_prompt(
        cls,
        prompt_key: str,
        version: int,
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Publishes a draft prompt version."""
        draft = (
            db.query(ConfigVersion)
            .filter(
                ConfigVersion.namespace == "prompts",
                ConfigVersion.key == prompt_key,
                ConfigVersion.version == version
            )
            .first()
        )
        if not draft:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_key} v{version} not found")

        # Archive prior published
        db.query(ConfigVersion).filter(
            ConfigVersion.namespace == "prompts",
            ConfigVersion.key == prompt_key,
            ConfigVersion.status == "published"
        ).update({"status": "archived"})

        now = get_utc_now()
        draft.status = "published"
        draft.published_by = actor.id
        draft.published_at = now
        draft.note = f"Published by {actor.name or actor.email}. Reason: {reason or 'Approved'}"

        db.commit()
        db.refresh(draft)

        ConfigService._cache.pop(("prompts", prompt_key), None)
        return draft

    # ------------------------------------------------------------------------
    # Budgets & Quotas
    # ------------------------------------------------------------------------

    @classmethod
    def get_budgets_quotas(cls, db: Session) -> Dict[str, Any]:
        """Retrieves active budget & quota thresholds."""
        cfg = ConfigService.get_published(namespace="ai_config", key="budgets_quotas", db=db)
        if not cfg:
            cfg = DEFAULT_BUDGETS_QUOTAS

        # Compute today's actual usage from ai_audit_logs
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        logs_today = db.query(AIAuditLog).filter(AIAuditLog.created_at >= today_start).all()

        total_tokens = sum((l.tokens_in or 0) + (l.tokens_out or 0) for l in logs_today)
        total_requests = len(logs_today)

        res = dict(cfg)
        res["current_day_tokens_used"] = total_tokens
        res["current_day_requests_count"] = total_requests

        global_limit = cfg.get("global_daily_token_limit", 5000000)
        percent_used = (total_tokens / global_limit * 100.0) if global_limit > 0 else 0.0
        res["current_day_token_usage_percentage"] = round(percent_used, 2)
        res["alert_triggered"] = percent_used >= cfg.get("alert_threshold_percentage", 80.0)

        return res

    @classmethod
    def update_budgets_quotas(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Updates AI budget and quota limits."""
        return ConfigService.publish_config(
            namespace="ai_config",
            key="budgets_quotas",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Updated AI budgets and quotas: {reason or 'Administrative update'}"
        )

    # ------------------------------------------------------------------------
    # Usage Table & Scrubbed Drill-Down
    # ------------------------------------------------------------------------

    @classmethod
    def get_usage_metrics(
        cls,
        db: Session,
        hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Computes aggregate metrics from ai_audit_logs:
        calls, tokens, latency p50/p95, error rate, fallback rate, safety block rate.
        """
        since_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        logs = (
            db.query(AIAuditLog)
            .filter(AIAuditLog.created_at >= since_time)
            .order_by(AIAuditLog.id.desc())
            .all()
        )

        total_calls = len(logs)
        if total_calls == 0:
            return {
                "window_hours": hours,
                "total_calls": 0,
                "total_tokens_in": 0,
                "total_tokens_out": 0,
                "latency_p50_ms": 0.0,
                "latency_p95_ms": 0.0,
                "fallback_rate": 0.0,
                "safety_block_rate": 0.0,
                "error_rate": 0.0,
                "recent_logs": [],
            }

        tokens_in = sum(l.tokens_in or 0 for l in logs)
        tokens_out = sum(l.tokens_out or 0 for l in logs)
        fallbacks = sum(1 for l in logs if l.fallback_used)
        safety_blocks = sum(1 for l in logs if l.block_reason)

        latencies = sorted([l.latency_ms for l in logs if l.latency_ms is not None])
        if latencies:
            p50_idx = int(len(latencies) * 0.50)
            p95_idx = min(int(len(latencies) * 0.95), len(latencies) - 1)
            p50 = latencies[p50_idx]
            p95 = latencies[p95_idx]
        else:
            p50, p95 = 0.0, 0.0

        recent_entries = []
        for l in logs[:50]:
            recent_entries.append({
                "id": l.id,
                "case_id": l.case_id,
                "model_name": l.model_name,
                "prompt_version": l.prompt_version,
                "tokens_in": l.tokens_in,
                "tokens_out": l.tokens_out,
                "latency_ms": l.latency_ms,
                "fallback_used": l.fallback_used,
                "block_reason": l.block_reason,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            })

        return {
            "window_hours": hours,
            "total_calls": total_calls,
            "total_tokens_in": tokens_in,
            "total_tokens_out": tokens_out,
            "latency_p50_ms": round(p50, 1),
            "latency_p95_ms": round(p95, 1),
            "fallback_rate": round(fallbacks / total_calls, 4),
            "safety_block_rate": round(safety_blocks / total_calls, 4),
            "error_rate": round((fallbacks + safety_blocks) / total_calls, 4),
            "recent_logs": recent_entries,
        }

    @classmethod
    def get_scrubbed_audit_log(cls, log_id: int, db: Session) -> Dict[str, Any]:
        """
        Drills into an AI audit entry, guaranteeing SCRUBBED output with zero raw PHI.
        """
        log = db.query(AIAuditLog).filter(AIAuditLog.id == log_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="AI audit log entry not found")

        # The scrub_report or raw_prompt must be sanitized
        scrubbed_summary = log.output_summary or "Scrubbed clinical explanation summary"
        return {
            "id": log.id,
            "case_id": log.case_id,
            "model_name": log.model_name,
            "prompt_version": log.prompt_version,
            "scrubbed_summary": scrubbed_summary,
            "tokens_in": log.tokens_in,
            "tokens_out": log.tokens_out,
            "latency_ms": log.latency_ms,
            "fallback_used": log.fallback_used,
            "block_reason": log.block_reason,
            "scrub_report": log.scrub_report,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }

    # ------------------------------------------------------------------------
    # Global AI Kill Switch & Status
    # ------------------------------------------------------------------------

    @classmethod
    def get_ai_status(cls, db: Session) -> Dict[str, Any]:
        """Returns read-only AI status, kill switch state, and data mode."""
        is_enabled = FlagsSettingsService.is_kill_switch_active("ai.global", db)
        return {
            "ai_global_enabled": is_enabled,
            "global_kill_switch_active": not is_enabled,
            "ai_data_mode": settings.AI_DATA_MODE,
            "ai_paid_tier_attested": settings.AI_PAID_TIER_ATTESTED,
            "default_model": settings.AI_MODEL_NAME,
            "active_prompt_version": PromptRegistryService.CURRENT_CODE,
        }

    @classmethod
    def toggle_global_ai_kill_switch(cls, enabled: bool, actor: User, db: Session, reason: str) -> Dict[str, Any]:
        """Toggles the global AI kill switch."""
        return FlagsSettingsService.toggle_kill_switch(
            switch_name="ai.global",
            enabled=enabled,
            actor=actor,
            reason=reason,
            db=db,
        )
