from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.models.case_revision import CaseRevision


class VisitPrepService:
    """
    Computes visit preparation summary for patients and caregivers:
      1. What changed since the last visit / revision (computed from case_revisions).
      2. Top structured clinical questions to ask their doctor.
    """

    @classmethod
    def generate_visit_prep(
        cls,
        case_id: int,
        db: Session,
    ) -> Dict[str, Any]:
        # 1. Fetch revisions ordered chronologically
        revisions = (
            db.query(CaseRevision)
            .filter(CaseRevision.case_id == case_id)
            .order_by(CaseRevision.revision_no.desc())
            .all()
        )

        changes_since_last_visit: List[str] = []
        current_rev = revisions[0] if revisions else None
        prev_rev = revisions[1] if len(revisions) > 1 else None

        if current_rev and prev_rev:
            curr_data = current_rev.snapshot_data or {}
            prev_data = prev_rev.snapshot_data or {}

            # Check symptom changes
            curr_symptoms = {s.get("symptom") for s in curr_data.get("symptoms", []) if isinstance(s, dict)}
            prev_symptoms = {s.get("symptom") for s in prev_data.get("symptoms", []) if isinstance(s, dict)}
            new_symptoms = curr_symptoms - prev_symptoms
            if new_symptoms:
                changes_since_last_visit.append(f"Newly reported symptoms: {', '.join(new_symptoms)}")

            # Check vitals changes
            curr_vitals = curr_data.get("vitals", {})
            prev_vitals = prev_data.get("vitals", {})
            for key in ["systolic_bp", "pulse", "spo2", "temperature"]:
                c_val = curr_vitals.get(key)
                p_val = prev_vitals.get(key)
                if c_val is not None and p_val is not None and c_val != p_val:
                    changes_since_last_visit.append(f"{key.replace('_', ' ').title()}: changed from {p_val} to {c_val}")

            # Check medication changes
            curr_meds = str(curr_data.get("medications", ""))
            prev_meds = str(prev_data.get("medications", ""))
            if curr_meds != prev_meds and curr_meds:
                changes_since_last_visit.append("Reported medication list was modified since previous revision")
        elif current_rev:
            changes_since_last_visit.append("Initial baseline intake record (first clinical evaluation)")
        else:
            changes_since_last_visit.append("No prior intake records available for comparison")

        # 2. Compute structured questions for physician
        questions = [
            "Are any of my current symptoms related to side effects or interactions between my medications?",
            "What specific warning signs or symptoms should prompt me to go directly to the emergency room?",
            "Do any of my current dosages need adjustment based on my recent blood pressure and pulse readings?",
            "What should my target normal ranges be for home monitoring over the next month?",
        ]

        if any("hypertension" in c.lower() or "bp" in c.lower() for c in changes_since_last_visit):
            questions.append("My blood pressure has shown recent shifts. Do I need a 24-hour ambulatory BP monitor?")

        return {
            "case_id": case_id,
            "revision_count": len(revisions),
            "changes_since_last_visit": changes_since_last_visit,
            "questions_for_doctor": questions[:5],
            "is_computed_from_revisions": True,
        }
