from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.domain_substrate import DailyCheckin, PatientBaseline


class TrendsService:
    """
    Computes deterministic physiological trends by comparing patient_baselines
    against daily_checkins and recent vitals history.
    """

    @classmethod
    def compute_trends(
        cls,
        user_id: int,
        db: Session,
        limit: int = 7,
    ) -> Dict[str, Any]:
        # 1. Fetch patient baseline
        baseline_rec = db.query(PatientBaseline).filter(PatientBaseline.user_id == user_id).first()
        baseline_data = baseline_rec.payload if baseline_rec and baseline_rec.payload else {}
        base_vitals = baseline_data.get("vitals", {})

        # 2. Fetch recent checkins
        checkins = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id)
            .order_by(DailyCheckin.created_at.desc())
            .limit(limit)
            .all()
        )

        pulse_history: List[int] = []
        systolic_history: List[int] = []
        pain_history: List[int] = []

        for c in reversed(checkins):
            payload = c.payload or {}
            v = payload.get("vitals", {})
            if v.get("pulse") is not None:
                pulse_history.append(v.get("pulse"))
            if v.get("systolic_bp") is not None:
                systolic_history.append(v.get("systolic_bp"))
            if payload.get("pain_score") is not None:
                pain_history.append(payload.get("pain_score"))

        # Deterministic summary statistics
        def calc_trend(series: List[int], base_val: Optional[int]) -> Dict[str, Any]:
            if not series:
                return {"status": "insufficient_data", "baseline": base_val, "current": None, "delta": None}
            current = series[-1]
            avg = sum(series) / len(series)
            delta = (current - base_val) if base_val is not None else 0
            direction = "stable"
            if delta > 10:
                direction = "elevated"
            elif delta < -10:
                direction = "decreased"
            return {
                "status": "active",
                "baseline": base_val,
                "current": current,
                "mean_recent": round(avg, 1),
                "delta_from_baseline": delta,
                "direction": direction,
                "data_points": series,
            }

        pulse_trend = calc_trend(pulse_history, base_vitals.get("pulse"))
        systolic_trend = calc_trend(systolic_history, base_vitals.get("systolic_bp"))
        pain_trend = calc_trend(pain_history, baseline_data.get("typical_pain_score", 0))

        return {
            "user_id": user_id,
            "checkins_analyzed": len(checkins),
            "trends": {
                "pulse": pulse_trend,
                "systolic_bp": systolic_trend,
                "pain_score": pain_trend,
            },
            "is_deterministic": True,
        }
