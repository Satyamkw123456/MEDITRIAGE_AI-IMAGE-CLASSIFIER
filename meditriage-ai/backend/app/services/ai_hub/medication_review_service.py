from typing import Dict, Any, List, Optional
import re
from sqlalchemy.orm import Session

from app.services.geriatric.medication_shield import MedicationShield


class MedicationReviewService:
    """
    Performs comprehensive geriatric medication review.
    Uses drug_brand_map, drug_rules, and MedicationShield.
    Generates safety flags and strictly enforces 'discuss with your doctor' language,
    never 'stop' or 'discontinue'.
    """

    @classmethod
    def review_medications(
        cls,
        medications_input: str | List[str],
        symptoms: Optional[List[Dict[str, Any]] | str] = None,
        vitals: Optional[Dict[str, Any]] = None,
        age: int = 70,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        # 1. Normalize medications input into list of strings
        if isinstance(medications_input, list):
            raw_entries = [str(m).strip() for m in medications_input if str(m).strip()]
        else:
            raw_str = str(medications_input or "")
            raw_entries = [p.strip() for p in re.split(r"[,;\n]+", raw_str) if p.strip()]

        # 2. Run deterministic MedicationShield resolution and evaluation
        resolved_list, unverified_bucket = MedicationShield.resolve_medications(raw_entries)

        symptoms_text = ""
        if isinstance(symptoms, list):
            symptoms_text = " ".join([
                str(s.get("description", s.get("symptom", s.get("name", "")))) if isinstance(s, dict) else str(s)
                for s in symptoms
            ])
        elif isinstance(symptoms, str):
            symptoms_text = symptoms

        triggers, metadata = MedicationShield.evaluate_medication_shield(
            resolved_meds=resolved_list,
            symptoms_text=symptoms_text,
            vitals=vitals or {},
            age=age,
        )

        resolved_meds = []
        for r in resolved_list:
            resolved_meds.append({
                "brand": r.raw_input,
                "generic": r.generic_name,
                "verified": r.is_verified,
                "is_ayush_herbal": r.is_ayush_or_unverified,
                "source": r.source_note,
            })

        safety_flags: List[Dict[str, Any]] = []
        for trig in triggers:
            # Enforce non-stop phrasing
            rec = trig.followup_recommendation
            rec_safe = re.sub(
                r"\b(stop|discontinue|cease|quit)\b",
                "discuss continuing or adjusting with your doctor",
                rec,
                flags=re.IGNORECASE,
            )
            if "discuss with your doctor" not in rec_safe.lower() and "consult" not in rec_safe.lower():
                rec_safe += " Please discuss this medication regimen with your prescribing doctor."

            safety_flags.append({
                "rule_id": trig.rule_id,
                "category": trig.category,
                "rationale": trig.rationale,
                "guidance": rec_safe,
                "references": trig.refs,
            })

        # 3. Double-check anti-imperative invariant
        for flag in safety_flags:
            guidance = flag["guidance"].lower()
            assert "stop taking" not in guidance, "Invariant violation: banned imperative in medication review"
            assert "discontinue" not in guidance, "Invariant violation: banned imperative in medication review"

        all_generics_lower = " ".join([m.generic_name.lower() for m in resolved_list])
        anticholinergic_burden_flag = any(
            k in all_generics_lower
            for k in ["amitriptyline", "chlorpheniramine", "hydroxyzine", "promethazine", "atropine", "hyoscine", "oxybutynin"]
        ) or any(t.category == "delirium" for t in triggers)

        ayush_unverified_flag = len(unverified_bucket) > 0 or any(m.is_ayush_or_unverified for m in resolved_list)

        summary_note = (
            f"Evaluated {len(resolved_meds)} active medication(s). "
            f"Identified {len(safety_flags)} potential geriatric safety flag(s). "
            "All recommendations should be reviewed and confirmed with the patient's primary care physician."
        )

        return {
            "resolved_medications": resolved_meds,
            "safety_flags": safety_flags,
            "anticholinergic_burden_flag": anticholinergic_burden_flag,
            "ayush_unverified_flag": ayush_unverified_flag,
            "summary_note": summary_note,
        }
