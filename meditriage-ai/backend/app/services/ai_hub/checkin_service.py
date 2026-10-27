from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.models.domain_substrate import DailyCheckin, PatientBaseline, get_utc_now


class DailyCheckinService:
    """
    Ingests daily health check-in reports from patients/caregivers,
    persists them in daily_checkins, and computes deltas against patient_baselines.
    """

    @classmethod
    def record_checkin(
        cls,
        user_id: int,
        checkin_data: Dict[str, Any],
        db: Session,
    ) -> Dict[str, Any]:
        now = get_utc_now()
        record = DailyCheckin(
            user_id=user_id,
            payload=checkin_data,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        # Retrieve baseline for comparison
        baseline_rec = db.query(PatientBaseline).filter(PatientBaseline.user_id == user_id).first()
        baseline_payload = baseline_rec.payload if baseline_rec and baseline_rec.payload else {}

        # Compute deltas and drift flags
        drift_flags: List[str] = []
        deltas: Dict[str, Any] = {}

        vitals = checkin_data.get("vitals", {})
        baseline_vitals = baseline_payload.get("vitals", {})

        # Pulse comparison
        pulse = vitals.get("pulse")
        base_pulse = baseline_vitals.get("pulse")
        if pulse is not None and base_pulse is not None:
            delta_pulse = pulse - base_pulse
            deltas["pulse_delta"] = delta_pulse
            if delta_pulse >= 20:
                drift_flags.append(f"Tachycardia shift (+{delta_pulse} bpm above baseline)")
            elif delta_pulse <= -20:
                drift_flags.append(f"Bradycardia shift ({delta_pulse} bpm below baseline)")

        # Systolic BP comparison
        systolic = vitals.get("systolic_bp")
        base_systolic = baseline_vitals.get("systolic_bp")
        if systolic is not None and base_systolic is not None:
            delta_sys = systolic - base_systolic
            deltas["systolic_delta"] = delta_sys
            if delta_sys >= 25:
                drift_flags.append(f"Hypertension surge (+{delta_sys} mmHg above baseline)")
            elif delta_sys <= -25:
                drift_flags.append(f"Hypotension drop ({delta_sys} mmHg below baseline)")

        # Temperature check
        temp = vitals.get("temperature")
        if temp is not None and temp >= 100.4:
            drift_flags.append(f"Febrile temperature detected ({temp}°F)")

        # Pain score check
        pain = checkin_data.get("pain_score")
        if pain is not None and pain >= 8:
            drift_flags.append(f"Severe acute pain reported ({pain}/10)")

        # Alertness check
        alertness = checkin_data.get("alertness")
        if alertness in ["confused", "lethargic", "unusually_sleepy"]:
            drift_flags.append(f"Acute alteration in alertness/cognition reported ({alertness})")

        return {
            "checkin_id": record.id,
            "recorded_at": now.isoformat(),
            "deltas": deltas,
            "drift_flags": drift_flags,
            "has_warnings": len(drift_flags) > 0,
        }
