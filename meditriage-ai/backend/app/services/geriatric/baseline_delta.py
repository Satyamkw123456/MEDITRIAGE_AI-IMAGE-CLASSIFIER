from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass


@dataclass(frozen=True)
class DeltaEvaluation:
    flag_name: str
    is_triggered: bool
    description: str
    severity_level: str  # "URGENT", "EMERGENCY", "INFO"


class BaselineDeltaComparator:
    """
    Compares current patient vitals, cognitive status, and functional state
    against their individual historical baseline stored in patient_baselines.
    """

    @classmethod
    def evaluate_deltas(
        cls,
        current_vitals: Optional[Dict[str, Any]],
        current_symptoms: Optional[List[Dict[str, Any]]],
        chief_complaint: str,
        baseline_payload: Optional[Dict[str, Any]]
    ) -> Tuple[List[DeltaEvaluation], bool]:
        """
        Returns:
            Tuple[List[DeltaEvaluation], has_baseline: bool]
        """
        if not baseline_payload:
            return [], False

        deltas: List[DeltaEvaluation] = []
        current_vitals = current_vitals or {}

        # 1. SBP Drop vs Baseline
        # Baseline SBP e.g. {"systolic_bp": 135} or {"typical_sbp": 130}
        baseline_sbp = baseline_payload.get("systolic_bp") or baseline_payload.get("typical_sbp")
        curr_bp = current_vitals.get("blood_pressure")
        curr_sbp = None
        if curr_bp and isinstance(curr_bp, str) and "/" in curr_bp:
            try:
                curr_sbp = float(curr_bp.split("/")[0].strip())
            except Exception:
                pass
        elif curr_bp and isinstance(curr_bp, (int, float)):
            curr_sbp = float(curr_bp)

        if baseline_sbp is not None and curr_sbp is not None:
            sbp_drop = baseline_sbp - curr_sbp
            if sbp_drop >= 30:
                deltas.append(DeltaEvaluation(
                    flag_name="sbp_severe_drop_vs_baseline",
                    is_triggered=True,
                    description=f"Systolic BP dropped by {sbp_drop:.0f} mmHg from patient baseline ({baseline_sbp} -> {curr_sbp})",
                    severity_level="URGENT"
                ))
            elif sbp_drop >= 20:
                deltas.append(DeltaEvaluation(
                    flag_name="sbp_drop_vs_baseline",
                    is_triggered=True,
                    description=f"Systolic BP dropped by {sbp_drop:.0f} mmHg from baseline ({baseline_sbp} -> {curr_sbp})",
                    severity_level="INFO"
                ))

        # 2. SpO2 Drop vs Personal Target
        baseline_spo2_target = baseline_payload.get("target_spo2_min") or baseline_payload.get("typical_spo2")
        curr_spo2 = current_vitals.get("spo2")
        if baseline_spo2_target is not None and curr_spo2 is not None:
            if curr_spo2 < (baseline_spo2_target - 3):
                deltas.append(DeltaEvaluation(
                    flag_name="spo2_drop_vs_personal_target",
                    is_triggered=True,
                    description=f"SpO2 ({curr_spo2}%) is more than 3% below patient personal target baseline ({baseline_spo2_target}%)",
                    severity_level="URGENT"
                ))

        # 3. New Confusion vs Usual Cognition Baseline
        # Baseline: e.g. "cognition": "Normal" or "Mild Cognitive Impairment (stable)"
        baseline_cognition = (baseline_payload.get("cognition") or "Normal").lower()
        full_text = f"{chief_complaint} {' '.join([s.get('symptom', '') for s in (current_symptoms or [])])}".lower()
        has_acute_confusion = any(w in full_text for w in ["confusion", "disoriented", "delirium", "hallucination", "altered mental"])

        if has_acute_confusion and "delirium" not in baseline_cognition:
            deltas.append(DeltaEvaluation(
                flag_name="new_confusion_vs_baseline",
                is_triggered=True,
                description=f"Acute cognitive decline/delirium noted against baseline cognitive status ('{baseline_cognition}')",
                severity_level="URGENT"
            ))

        # 4. Functional Decline (Independent -> Needs Help)
        baseline_adls = (baseline_payload.get("functional_status") or "Independent").lower()
        has_acute_functional_drop = any(w in full_text for w in ["cannot walk", "bedbound", "needs help with toilet", "unable to get out of bed", "cannot stand", "sudden mobility loss"])
        if has_acute_functional_drop and "bedbound" not in baseline_adls:
            deltas.append(DeltaEvaluation(
                flag_name="functional_decline_vs_baseline",
                is_triggered=True,
                description=f"Acute loss of mobility or ADL independence vs baseline ('{baseline_adls}')",
                severity_level="URGENT"
            ))

        # 5. Weight Change
        weight_change_kg = baseline_payload.get("weight_change_7d_kg")
        if weight_change_kg is not None and abs(weight_change_kg) >= 2.0:
            deltas.append(DeltaEvaluation(
                flag_name="weight_change_acute",
                is_triggered=True,
                description=f"Acute weight change of {weight_change_kg} kg in 7 days (fluid retention or acute dehydration risk)",
                severity_level="INFO"
            ))

        return deltas, True
