from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.services.geriatric.composer import Level, Vote, Decision, compose
from app.services.geriatric.flags import FlagExtractor
from app.services.geriatric.baseline_delta import BaselineDeltaComparator, DeltaEvaluation
from app.services.geriatric.medication_shield import MedicationShield, DrugRuleTrigger, ResolvedMedication
from app.services.geriatric.micro_screens import MicroScreens, ScreenResult
from app.services.geriatric.news2 import calculate_news2, NEWS2Result
from app.services.geriatric.rules_engine import GeriatricRulesEngine


@dataclass
class GeriatricTriageEvaluation:
    decision: Decision
    flags: Dict[str, bool]
    deltas: List[DeltaEvaluation]
    news2: Optional[NEWS2Result]
    medication_triggers: List[DrugRuleTrigger]
    resolved_medications: List[ResolvedMedication]
    unverified_medications: List[str]
    screens: List[ScreenResult]
    followup_questions: List[str]
    rule_triggers_fired: List[str]
    confidence_band: str  # "HIGH", "MEDIUM", "LOW"


class GeriatricEngine:
    """
    Unified Geriatric Clinical Decision Support Engine.
    Executes FlagExtractor, BaselineDelta, MedicationShield, MicroScreens, NEWS2,
    and Governed Geriatric Rules, combining all votes through the Escalate-Only Composer.
    """

    # Unified Geriatric Clinical Decision Support Engine.

    @classmethod
    def evaluate(
        cls,
        chief_complaint: str,
        age: int,
        symptoms: Optional[List[Dict[str, Any]]] = None,
        vitals: Optional[Dict[str, Any]] = None,
        medications: Optional[List[str]] = None,
        comorbidities: Optional[List[str] | str] = None,
        caregiver_notes: Optional[str] = None,
        baseline_payload: Optional[Dict[str, Any]] = None,
        screens_input: Optional[Dict[str, Any]] = None,
        red_flag_retracted: bool = False,
        base_triage_level: Optional[Level] = None,
        db: Optional[Session] = None,
        custom_rules: Optional[List[Dict[str, Any]]] = None,
    ) -> GeriatricTriageEvaluation:
        # 1. Evaluate Baseline Deltas
        deltas, has_baseline = BaselineDeltaComparator.evaluate_deltas(
            current_vitals=vitals,
            current_symptoms=symptoms,
            chief_complaint=chief_complaint,
            baseline_payload=baseline_payload
        )

        # 2. Extract Flags
        flags = FlagExtractor.extract_flags(
            chief_complaint=chief_complaint,
            age=age,
            symptoms=symptoms,
            vitals=vitals,
            medications=medications,
            comorbidities=comorbidities,
            caregiver_notes=caregiver_notes,
            has_baseline=has_baseline,
            red_flag_retracted=red_flag_retracted,
            db=db
        )

        # Update flags from deltas
        for d in deltas:
            if d.is_triggered:
                flags[d.flag_name] = True

        # 3. Resolve Medications & Medication Shield
        med_entries = medications or []
        resolved_meds, unverified_meds = MedicationShield.resolve_medications(med_entries)
        med_triggers, med_meta = MedicationShield.evaluate_medication_shield(
            resolved_meds=resolved_meds,
            symptoms_text=f"{chief_complaint} {' '.join([s.get('symptom', '') for s in (symptoms or [])])}",
            vitals=vitals,
            age=age
        )

        # 4. Micro-Screens Evaluation
        screen_results: List[ScreenResult] = []
        if screens_input:
            if "isar" in screens_input:
                screen_results.append(MicroScreens.evaluate_isar(
                    screens_input["isar"],
                    informant_type=screens_input.get("isar_informant", "self")
                ))
            if "four_at_lite" in screens_input:
                screen_results.append(MicroScreens.evaluate_4at_lite(
                    screens_input["four_at_lite"],
                    informant_type=screens_input.get("four_at_informant", "caregiver")
                ))
            if "frail" in screens_input:
                screen_results.append(MicroScreens.evaluate_frail(
                    screens_input["frail"],
                    informant_type=screens_input.get("frail_informant", "self")
                ))
            if "fall_probe" in screens_input:
                screen_results.append(MicroScreens.evaluate_fall_probe(
                    screens_input["fall_probe"],
                    informant_type=screens_input.get("fall_informant", "self")
                ))

        # Check for 4AT positive
        for s in screen_results:
            if s.tool_name == "4AT_LITE" and s.is_valid and s.is_positive:
                flags["new_confusion"] = True

        # 5. NEWS2 Evaluation
        news2_result: Optional[NEWS2Result] = None
        has_copd = False
        if comorbidities:
            comorb_str = str(comorbidities).lower()
            has_copd = any(w in comorb_str for w in ["copd", "emphysema", "chronic bronchitis", "hypercapn"])

        vitals = vitals or {}
        if any(vitals.get(k) is not None for k in ["pulse", "blood_pressure", "spo2", "temperature"]):
            sbp_val = None
            bp_raw = vitals.get("blood_pressure")
            if bp_raw and isinstance(bp_raw, str) and "/" in bp_raw:
                try:
                    sbp_val = float(bp_raw.split("/")[0].strip())
                except Exception:
                    pass
            elif bp_raw and isinstance(bp_raw, (int, float)):
                sbp_val = float(bp_raw)

            consciousness_state = "C" if flags.get("new_confusion") else "A"
            target_range = (baseline_payload.get("target_spo2_min", 88.0), baseline_payload.get("target_spo2_max", 92.0)) if baseline_payload else (88.0, 92.0)

            news2_result = calculate_news2(
                respiration_rate=vitals.get("respiration_rate"),
                spo2=vitals.get("spo2"),
                on_oxygen=vitals.get("on_oxygen", False),
                systolic_bp=sbp_val,
                pulse=vitals.get("pulse"),
                consciousness=consciousness_state,
                temperature=vitals.get("temperature"),
                has_hypercapnic_risk=has_copd,
                target_spo2_range=target_range
            )

        # 6. Evaluate Geriatric Governed Rules
        votes, forbidden, followups, rule_ids = GeriatricRulesEngine.evaluate_rules(
            flags=flags,
            age=age,
            db=db,
            rules=custom_rules,
        )

        # Add Baseline/Engine Vote
        default_baseline = Level.ROUTINE if age >= 65 else Level.SELF_CARE
        initial_level = base_triage_level if base_triage_level is not None else default_baseline
        votes.append(Vote(
            source="BASELINE_CLINICAL_INTAKE",
            level=initial_level,
            rationale=f"Base clinical intake status: {initial_level.to_display()}"
        ))

        # Add NEWS2 Vote if applicable
        if news2_result:
            if news2_result.risk_band == "HIGH":
                votes.append(Vote(
                    source="NEWS2_PHYSIOLOGY",
                    level=Level.EMERGENCY,
                    rationale=f"NEWS2 aggregate score is {news2_result.total_score} (HIGH risk tier); physiological decompensation."
                ))
                forbidden.update({Level.SELF_CARE, Level.ROUTINE, Level.URGENT})
            elif news2_result.risk_band == "MEDIUM":
                votes.append(Vote(
                    source="NEWS2_PHYSIOLOGY",
                    level=Level.URGENT,
                    rationale=f"NEWS2 aggregate score is {news2_result.total_score} (MEDIUM risk tier); urgent clinical review required."
                ))
                forbidden.add(Level.SELF_CARE)
            elif news2_result.risk_band == "LOW_MEDIUM":
                votes.append(Vote(
                    source="NEWS2_PHYSIOLOGY",
                    level=Level.URGENT,
                    rationale="NEWS2 extreme physiological trigger (score 3 in single vital parameter); warrants urgent clinical assessment."
                ))
                forbidden.add(Level.SELF_CARE)

        # Add Delta Votes
        for d in deltas:
            if d.is_triggered:
                if d.severity_level == "EMERGENCY":
                    votes.append(Vote(source=f"DELTA_{d.flag_name.upper()}", level=Level.EMERGENCY, rationale=d.description))
                    forbidden.update({Level.SELF_CARE, Level.ROUTINE, Level.URGENT})
                elif d.severity_level == "URGENT":
                    votes.append(Vote(source=f"DELTA_{d.flag_name.upper()}", level=Level.URGENT, rationale=d.description))
                    forbidden.add(Level.SELF_CARE)

        # Add Medication Shield Votes
        for m in med_triggers:
            if m.category == "bleeding":
                votes.append(Vote(source="MED_SHIELD_BLEED", level=Level.URGENT, rationale=m.rationale))
                forbidden.add(Level.SELF_CARE)
            elif m.category == "hypoglycemia":
                votes.append(Vote(source="MED_SHIELD_HYPO", level=Level.URGENT, rationale=m.rationale))
                forbidden.add(Level.SELF_CARE)

        # 7. Escalate-Only Compose
        decision = compose(votes, forbidden)

        # 8. Calculate Confidence Band
        # Degraded cases with missing vitals, missing baselines, or contradictory symptoms drop confidence
        completeness_penalty = 0
        if flags.get("vitals_missing"):
            completeness_penalty += 30
        if flags.get("baseline_missing"):
            completeness_penalty += 20
        if unverified_meds:
            completeness_penalty += 10
        if flags.get("not_right_per_caregiver") and flags.get("vitals_missing"):
            completeness_penalty += 15

        if completeness_penalty >= 40:
            confidence_band = "LOW"
        elif completeness_penalty >= 20:
            confidence_band = "MEDIUM"
        else:
            confidence_band = "HIGH"

        return GeriatricTriageEvaluation(
            decision=decision,
            flags=flags,
            deltas=deltas,
            news2=news2_result,
            medication_triggers=med_triggers,
            resolved_medications=resolved_meds,
            unverified_medications=unverified_meds,
            screens=screen_results,
            followup_questions=followups,
            rule_triggers_fired=rule_ids,
            confidence_band=confidence_band
        )

    @classmethod
    def evaluate_case(cls, case_dict: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Convenience adapter executing evaluate() on a raw or parsed case dictionary,
        returning a standardized structured dictionary for downstream services.
        """
        chief_complaint = case_dict.get("chief_complaint", "")
        age = case_dict.get("age", 65)
        symptoms = case_dict.get("symptoms")
        vitals = case_dict.get("vitals")
        medications = case_dict.get("medications")
        if isinstance(medications, str):
            medications = [m.strip() for m in medications.split(",") if m.strip()]
        comorbidities = case_dict.get("comorbidities")
        caregiver_notes = case_dict.get("caregiver_observations") or case_dict.get("caregiver_notes")
        baseline_payload = case_dict.get("baselines") or case_dict.get("baseline_payload")
        screens_input = case_dict.get("screens") or case_dict.get("screens_input")
        red_flag_retracted = bool(case_dict.get("red_flag_retracted", False))

        eval_res = cls.evaluate(
            chief_complaint=chief_complaint,
            age=age,
            symptoms=symptoms,
            vitals=vitals,
            medications=medications,
            comorbidities=comorbidities,
            caregiver_notes=caregiver_notes,
            baseline_payload=baseline_payload,
            screens_input=screens_input,
            red_flag_retracted=red_flag_retracted,
            db=db,
        )

        votes_list = [
            {
                "source": v.source,
                "level": v.level.name if hasattr(v.level, "name") else str(v.level),
                "rationale": v.rationale,
            }
            for v in eval_res.decision.votes
        ]
        primary_rationale = (
            eval_res.decision.votes[0].rationale
            if eval_res.decision.votes
            else "Clinical geriatric assessment."
        )

        if not votes_list:
            votes_list = [
                {
                    "source": "DEFAULT",
                    "level": eval_res.decision.level.name,
                    "rationale": primary_rationale,
                }
            ]

        return {
            "decision": {
                "level_name": eval_res.decision.level.name,
                "level": eval_res.decision.level,
                "votes": votes_list,
                "rationale": primary_rationale,
            },
            "news2": {
                "total_score": eval_res.news2.total_score if eval_res.news2 else 0,
                "risk_tier": eval_res.news2.risk_band if eval_res.news2 else "LOW",
                "risk_band": eval_res.news2.risk_band if eval_res.news2 else "LOW",
            },
            "confidence_band": eval_res.confidence_band,
            "flags": eval_res.flags,
            "deltas": eval_res.deltas,
            "rule_triggers_fired": eval_res.rule_triggers_fired,
            "evaluation": eval_res,
        }

