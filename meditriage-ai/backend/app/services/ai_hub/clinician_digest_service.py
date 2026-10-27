from datetime import timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.models.case import Case, get_utc_now
from app.models.triage import TriageResult
from app.models.feedback import ClinicianFeedback


class ClinicianDigestService:
    """
    Computes clinician daily queue digest via deterministic SQL queries (no LLM invention).
    Aggregates:
      1. Overnight queue additions (last 24 hours)
      2. Low-confidence backlog (triage quality / score < 0.60)
      3. Red-flag or emergency cases
      4. Cases with zero clinician review activity
    """

    @classmethod
    def generate_digest(cls, db: Session, hours_window: int = 24) -> Dict[str, Any]:
        now = get_utc_now()
        since_time = now - timedelta(hours=hours_window)

        # 1. Overnight / Recent Cases
        recent_cases = (
            db.query(Case)
            .filter(Case.created_at >= since_time)
            .order_by(Case.created_at.desc())
            .all()
        )

        overnight_cases_summary = []
        for c in recent_cases:
            t_res = (
                db.query(TriageResult)
                .filter(TriageResult.case_id == c.id)
                .filter(TriageResult.is_current.in_(["true", "True"]))
                .first()
            )
            overnight_cases_summary.append({
                "case_id": c.id,
                "user_id": c.patient.user_id if c.patient else None,
                "patient_id": c.patient_id,
                "created_at": c.created_at.isoformat(),
                "triage_level": t_res.triage_level if t_res else "Pending",
                "triage_score": t_res.risk_score if t_res else None,
            })

        # 2. Low-Confidence Backlog (risk_score < 0.60 or quality score low)
        low_confidence_results = (
            db.query(TriageResult)
            .filter(TriageResult.is_current.in_(["true", "True"]))
            .filter(TriageResult.risk_score.isnot(None))
            .filter(TriageResult.risk_score < 0.60)
            .all()
        )
        low_confidence_cases = [
            {
                "case_id": r.case_id,
                "triage_level": r.triage_level,
                "triage_score": r.risk_score,
                "confidence": "Low",
            }
            for r in low_confidence_results
        ]

        # 3. Emergency & Red-Flag Active Cases
        emergency_results = (
            db.query(TriageResult)
            .filter(TriageResult.is_current.in_(["true", "True"]))
            .filter(TriageResult.triage_level.in_(["EMERGENCY", "Emergency", "emergency"]))
            .all()
        )
        emergency_cases = [
            {
                "case_id": r.case_id,
                "triage_level": r.triage_level,
                "triage_score": r.risk_score,
                "requires_immediate_intervention": True,
            }
            for r in emergency_results
        ]

        # 4. Cases with Zero Review Activity
        # Cases that do not exist in clinician_feedback or have no confirmed review
        reviewed_case_ids = {r.case_id for r in db.query(ClinicianFeedback.case_id).distinct().all()}
        all_active_cases = db.query(Case).filter(Case.deleted_at.is_(None)).all()
        unreviewed_cases = [
            {
                "case_id": c.id,
                "user_id": c.patient.user_id if c.patient else None,
                "patient_id": c.patient_id,
                "created_at": c.created_at.isoformat(),
            }
            for c in all_active_cases
            if c.id not in reviewed_case_ids
        ]

        return {
            "digest_timestamp": now.isoformat(),
            "window_hours": hours_window,
            "metrics": {
                "recent_admissions_count": len(recent_cases),
                "low_confidence_backlog_count": len(low_confidence_cases),
                "active_emergencies_count": len(emergency_cases),
                "unreviewed_cases_count": len(unreviewed_cases),
            },
            "recent_admissions": overnight_cases_summary[:10],
            "low_confidence_backlog": low_confidence_cases[:10],
            "active_emergencies": emergency_cases[:10],
            "unreviewed_cases": unreviewed_cases[:10],
            "computed_via_sql": True,
        }
