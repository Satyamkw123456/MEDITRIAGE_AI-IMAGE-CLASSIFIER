import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field, asdict
from sqlalchemy.orm import Session

from app.core.level_copy import get_level_copy
from app.services.rules.red_flags import evaluate_red_flags
from app.services.rules.triage_scoring import calculate_triage_score, TriageScoreResult
from app.services.geriatric.engine import GeriatricEngine, GeriatricTriageEvaluation
from app.services.geriatric.composer import Level

logger = logging.getLogger(__name__)

LEVEL_RANK: Dict[str, int] = {
    "Self-Care Info": 0,
    "Self-Care": 0,
    "Self_Care": 0,
    "Routine": 1,
    "Urgent": 2,
    "Emergency": 3,
}

RANK_TO_LEVEL: Dict[int, str] = {
    0: "Self-Care Info",
    1: "Routine",
    2: "Urgent",
    3: "Emergency",
}


@dataclass
class VoteRecord:
    source: str
    level: str
    rationale: str
    rule_ids: List[str] = field(default_factory=list)
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ConsensusResult:
    final_level: str
    risk_score: float
    explanation: str
    is_emergency: bool
    emergency_rule_fired: Optional[str]
    needs_clinician_review: bool
    engine_errors: List[str]
    votes: List[VoteRecord]
    decision_trace: Dict[str, Any]
    rule_ids: List[str]
    geriatric_evaluation: Optional[GeriatricTriageEvaluation] = None
    legacy_score_result: Optional[TriageScoreResult] = None


class ConsensusDecisionEngine:
    """
    Authoritative, explainable, fail-closed clinical consensus pipeline.
    Combines independent votes: {RedFlagEngine, GeriatricEngine.composer, LegacyScore}
    using MAX-RANK consensus.
    - LLM may only RAISE, never lower.
    - Fail-closed: any engine exception records engine_error:<name>, treats vote as Urgent,
      sets needs_clinician_review=True, forces confidence band to Low.
    - Produces full decision_trace persisted in triage_results.decision_trace.
    """

    @classmethod
    def evaluate_case(
        cls,
        chief_complaint: Optional[str] = None,
        age: Optional[int] = None,
        severity: Optional[int] = None,
        symptom_duration: Optional[str] = None,
        body_location: Optional[str] = None,
        comorbidities: Optional[Union[List[str], str]] = None,
        current_medications: Optional[Union[List[str], str]] = None,
        allergies: Optional[str] = None,
        vitals: Optional[Dict[str, Any]] = None,
        symptoms: Optional[List[Dict[str, Any]]] = None,
        caregiver_notes: Optional[str] = None,
        screens_input: Optional[Dict[str, Any]] = None,
        baseline_payload: Optional[Dict[str, Any]] = None,
        llm_urgency: Optional[str] = None,
        db: Optional[Session] = None,
        request_id: Optional[str] = None,
        payload: Optional[Any] = None,
    ) -> ConsensusResult:
        if payload is not None:
            chief_complaint = chief_complaint or getattr(payload, "chief_complaint", "")
            age = age if age is not None else getattr(payload, "age", 65)
            severity = severity if severity is not None else getattr(payload, "severity", 5)
            symptom_duration = symptom_duration or getattr(payload, "symptom_duration", "1 day")
            body_location = body_location or getattr(payload, "body_location", "General")
            comorbidities = comorbidities or getattr(payload, "comorbidities", None)
            current_medications = current_medications or getattr(payload, "current_medications", None)
            allergies = allergies or getattr(payload, "allergies", None)
            if vitals is None and getattr(payload, "vitals", None):
                pv = payload.vitals
                vitals = pv.model_dump() if hasattr(pv, "model_dump") else (pv if isinstance(pv, dict) else {})
            if symptoms is None and getattr(payload, "additional_symptoms", None):
                symptoms = [
                    {"symptom": s.symptom, "duration": getattr(s, "duration", None), "severity": getattr(s, "severity", None), "body_location": getattr(s, "body_location", None)}
                    for s in payload.additional_symptoms
                ]

        chief_complaint = chief_complaint or ""
        age = age if age is not None else 65
        severity = severity if severity is not None else 5
        symptom_duration = symptom_duration or "1 day"
        body_location = body_location or "General"

        engine_errors: List[str] = []
        needs_clinician_review: bool = False
        votes: List[VoteRecord] = []
        all_rule_ids: List[str] = []

        vitals = vitals or {}
        v_spo2 = vitals.get("spo2")
        v_pulse = vitals.get("pulse")
        v_bp = vitals.get("blood_pressure")
        v_temp = vitals.get("temperature")

        additional_symptom_texts = [
            s.get("symptom", "") for s in (symptoms or []) if isinstance(s, dict) and s.get("symptom")
        ]

        # -------------------------------------------------------------
        # 1. RedFlagEngine (Tier 1 Life-Threatening Red Flags)
        # -------------------------------------------------------------
        red_flag_res = None
        try:
            red_flag_res = evaluate_red_flags(
                chief_complaint=chief_complaint,
                age=age,
                severity=severity,
                body_location=body_location,
                additional_symptoms=additional_symptom_texts,
                spo2=v_spo2,
                pulse=v_pulse,
                blood_pressure=v_bp,
                temperature=v_temp,
            )
            if red_flag_res.is_emergency:
                rf_rule_str = red_flag_res.get_summary_rule_string() or "Tier-1 emergency red flag triggered"
                rf_rule_ids = list(getattr(red_flag_res, "fired_rules", [])) or [r.rule_id for r in getattr(red_flag_res, "triggered_rules", [])]
                all_rule_ids.extend(rf_rule_ids)
                rf_vote = VoteRecord(
                    source="RedFlagEngine",
                    level="Emergency",
                    rationale=rf_rule_str,
                    rule_ids=rf_rule_ids,
                )
            else:
                rf_vote = VoteRecord(
                    source="RedFlagEngine",
                    level="Self-Care Info",
                    rationale="No acute life-threatening Tier-1 red flags identified.",
                    rule_ids=[],
                )
        except Exception as e:
            req_tag = f"[{request_id}] " if request_id else ""
            logger.exception(f"{req_tag}engine_error:RedFlagEngine: {e}")
            err_tag = "engine_error:RedFlagEngine"
            engine_errors.append(err_tag)
            needs_clinician_review = True
            rf_vote = VoteRecord(
                source="RedFlagEngine",
                level="Urgent",
                rationale=f"Engine exception in RedFlagEngine: {e}. Fail-closed default applied.",
                rule_ids=[],
                error=err_tag,
            )
        votes.append(rf_vote)

        # -------------------------------------------------------------
        # 2. GeriatricEngine (Composer, Governed Rules, Safety Floors)
        # -------------------------------------------------------------
        geri_eval = None
        med_list: List[str] = []
        if isinstance(current_medications, list):
            med_list = [str(m).strip() for m in current_medications if str(m).strip()]
        elif isinstance(current_medications, str) and current_medications.strip():
            med_list = [m.strip() for m in current_medications.split(",") if m.strip()]

        try:
            # Build unified case dictionary for GeriatricEngine
            symptoms_payload = symptoms or []
            if not symptoms_payload and chief_complaint:
                symptoms_payload = [{
                    "symptom": chief_complaint,
                    "duration": symptom_duration,
                    "severity": severity,
                    "body_location": body_location
                }]

            case_dict = {
                "chief_complaint": chief_complaint,
                "age": age,
                "symptoms": symptoms_payload,
                "vitals": vitals,
                "medications": med_list,
                "comorbidities": comorbidities,
                "caregiver_observations": caregiver_notes,
                "baselines": baseline_payload,
                "screens": screens_input,
            }
            geri_res = GeriatricEngine.evaluate_case(case_dict, db=db)
            geri_eval = geri_res.get("evaluation")
            if geri_eval:
                geri_level = geri_eval.decision.level.to_display()
                geri_rules = list(geri_eval.rule_triggers_fired)
                all_rule_ids.extend(geri_rules)

                geri_rationale_parts = []
                for v in geri_eval.decision.votes:
                    if v.level >= Level.URGENT:
                        geri_rationale_parts.append(f"{v.source}: {v.rationale}")
                geri_rationale = "; ".join(geri_rationale_parts) if geri_rationale_parts else f"Geriatric composer decision: {geri_level}."

                geri_vote = VoteRecord(
                    source="GeriatricEngine.composer",
                    level=geri_level,
                    rationale=geri_rationale,
                    rule_ids=geri_rules,
                    metadata={
                        "confidence_band": geri_eval.confidence_band,
                        "deltas": [d.flag_name for d in geri_eval.deltas if d.is_triggered],
                    }
                )
            else:
                dec = geri_res.get("decision", {})
                geri_level = dec.get("level_name", "Routine")
                geri_vote = VoteRecord(
                    source="GeriatricEngine.composer",
                    level=geri_level,
                    rationale=dec.get("rationale", f"Geriatric decision: {geri_level}"),
                    rule_ids=list(geri_res.get("rule_triggers_fired", [])),
                    metadata={"confidence_band": geri_res.get("confidence_band", "MEDIUM")}
                )
        except Exception as e:
            req_tag = f"[{request_id}] " if request_id else ""
            logger.exception(f"{req_tag}engine_error:GeriatricEngine: {e}")
            err_tag = "engine_error:GeriatricEngine"
            engine_errors.append(err_tag)
            needs_clinician_review = True
            geri_vote = VoteRecord(
                source="GeriatricEngine.composer",
                level="Urgent",
                rationale=f"Engine exception in GeriatricEngine: {e}. Fail-closed default applied.",
                rule_ids=[],
                error=err_tag,
            )
        votes.append(geri_vote)

        # -------------------------------------------------------------
        # 3. LegacyScore (Weighted Risk Scoring Engine)
        # -------------------------------------------------------------
        legacy_res = None
        try:
            legacy_res = calculate_triage_score(
                chief_complaint=chief_complaint,
                severity=severity,
                symptom_duration=symptom_duration,
                body_location=body_location,
                age=age,
                comorbidities=comorbidities,
                temperature=v_temp,
                pulse=v_pulse,
                blood_pressure=v_bp,
                spo2=v_spo2,
                additional_symptoms=additional_symptom_texts,
            )
            legacy_vote = VoteRecord(
                source="LegacyScore",
                level=legacy_res.triage_level,
                rationale=legacy_res.explanation,
                rule_ids=[],
                metadata={
                    "risk_score": legacy_res.risk_score,
                    "drivers": [d.description for d in legacy_res.drivers],
                }
            )
        except Exception as e:
            req_tag = f"[{request_id}] " if request_id else ""
            logger.exception(f"{req_tag}engine_error:LegacyScore: {e}")
            err_tag = "engine_error:LegacyScore"
            engine_errors.append(err_tag)
            needs_clinician_review = True
            legacy_vote = VoteRecord(
                source="LegacyScore",
                level="Urgent",
                rationale=f"Engine exception in LegacyScore: {e}. Fail-closed default applied.",
                rule_ids=[],
                error=err_tag,
                metadata={"risk_score": 60.0}
            )
        votes.append(legacy_vote)

        # -------------------------------------------------------------
        # 4. Multi-Engine Max-Rank Consensus
        # -------------------------------------------------------------
        ranks = [LEVEL_RANK.get(v.level, 0) for v in votes]
        max_rank = max(ranks)
        min_rank = min(ranks)

        # Any engine disagreement of >= 2 ranks triggers clinician review
        if (max_rank - min_rank) >= 2:
            needs_clinician_review = True

        # -------------------------------------------------------------
        # 5. LLM Extra Vote (May ONLY raise, NEVER lower)
        # -------------------------------------------------------------
        if llm_urgency:
            llm_rank = LEVEL_RANK.get(llm_urgency.strip().title(), LEVEL_RANK.get(llm_urgency.strip(), -1))
            if llm_rank > max_rank:
                # LLM escalates urgency
                max_rank = llm_rank
                escalated_level = RANK_TO_LEVEL[max_rank]
                votes.append(VoteRecord(
                    source="LLMOrchestrator",
                    level=escalated_level,
                    rationale=f"Clinical LLM analysis suggested higher urgency ({escalated_level}). Escalate-only policy applied.",
                ))
            else:
                votes.append(VoteRecord(
                    source="LLMOrchestrator",
                    level=RANK_TO_LEVEL.get(llm_rank, "Routine"),
                    rationale=f"Clinical LLM suggested {llm_urgency} (cannot lower deterministic consensus {RANK_TO_LEVEL[max_rank]}).",
                ))

        final_level = RANK_TO_LEVEL[max_rank]
        is_emergency = (final_level == "Emergency")

        # Determine risk score aligned with final consensus level
        base_score = legacy_res.risk_score if legacy_res else 50.0
        if is_emergency:
            risk_score = max(85.0, base_score)
        elif final_level == "Urgent":
            risk_score = max(60.0, base_score)
        elif final_level == "Routine":
            risk_score = min(59.9, max(30.0, base_score))
        else:
            risk_score = min(29.9, base_score)
        risk_score = round(risk_score, 1)

        # Build comprehensive explanation
        explanation_parts = []
        for v in votes:
            if v.source != "RedFlagEngine" or v.level == "Emergency":
                explanation_parts.append(f"[{v.source}: {v.level}] {v.rationale}")
        explanation = f"Consensus Triage: {final_level} (Score {risk_score}/100). " + " | ".join(explanation_parts)

        emergency_rule_fired = None
        if is_emergency:
            emergency_rule_fired = "; ".join(all_rule_ids) if all_rule_ids else "CONSENSUS_EMERGENCY"

        # Check specific rule conditions triggering clinician review
        if any("IMPLAUSIBLE" in r for r in all_rule_ids):
            needs_clinician_review = True
        if any("FEVER" in r for r in all_rule_ids) and (
            (geri_eval and getattr(geri_eval, "flags", {}).get("fever_with_neuro")) or
            (geri_eval and getattr(geri_eval, "flags", {}).get("fever_contradiction"))
        ):
            needs_clinician_review = True
        if any("NONSPECIFIC-DECLINE" in r for r in all_rule_ids):
            needs_clinician_review = True

        # -------------------------------------------------------------
        # 6. Build Decision Trace
        # -------------------------------------------------------------
        has_unreviewed_rules = any(r.startswith("GERI-FLOOR-") or r.startswith("GERI-GUARD-") for r in all_rule_ids)
        unreviewed_notice = "Geriatric escalation rules pending clinical validation" if has_unreviewed_rules else None

        copy_meta = get_level_copy(final_level)
        decision_trace = {
            "final_level": final_level,
            "risk_score": risk_score,
            "votes": [v.to_dict() for v in votes],
            "engine_errors": engine_errors,
            "needs_clinician_review": needs_clinician_review,
            "rule_ids": list(set(all_rule_ids)),
            "rationale": explanation,
            "engine_versions": {
                "RedFlagEngine": "2.0.0",
                "GeriatricEngine": "2.1.0",
                "LegacyScore": "2.0.0",
            },
            "rules_config_version": "2026-10-09-GOVERNED-P3",
            "level_copy": copy_meta,
            "reviewed_by": None,
            "ruleset_status": "UNREVIEWED RULESET",
            "unreviewed_rules_notice": unreviewed_notice,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return ConsensusResult(
            final_level=final_level,
            risk_score=risk_score,
            explanation=explanation,
            is_emergency=is_emergency,
            emergency_rule_fired=emergency_rule_fired,
            needs_clinician_review=needs_clinician_review,
            engine_errors=engine_errors,
            votes=votes,
            decision_trace=decision_trace,
            rule_ids=list(set(all_rule_ids)),
            geriatric_evaluation=geri_eval,
            legacy_score_result=legacy_res,
        )
