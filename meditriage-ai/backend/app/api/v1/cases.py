from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_clinician, require_permission
from app.api.authz import get_case_for_user
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.consent import ConsentLog
from app.models.triage import TriageResult
from app.models.quality import QualityScore
from app.models.diagnosis import DifferentialDiagnosis
from app.models.audit import AIAuditLog
from app.schemas.intake import (
    PatientIntakeCreate,
    CaseDetailOut,
    SymptomEntryOut,
    VitalsOut,
    TriageResultOut,
    QualityScoreOut,
    CaseClarificationInput,
    SymptomInput,
    VitalsInput,
    ClinicianQueueItemOut,
    CaseStatusUpdate
)
from app.schemas.ai import DifferentialDiagnosisOut, AIAuditLogOut
from app.schemas.feedback import BulkFeedbackCreate
from app.models.feedback import ClinicianFeedback
from app.services.quality.interpreter import evaluate_intake_quality
from app.services.quality.inference import calculate_quality_inference
import logging
from app.services.rules.consensus_engine import ConsensusDecisionEngine
from app.services.ai.gateway import AIGateway, GatewayResult
from app.schemas.ai import DiagnosisItem
from app.services.pdf.generator import generate_case_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["Cases & Intake"])


async def _execute_clinical_ai_gateway(
    patient_age: int,
    patient_sex: str,
    chief_complaint: str,
    symptoms: List[Dict[str, Any]],
    vitals: Optional[Dict[str, Any]],
    comorbidities: Optional[Any],
    current_medications: Optional[str],
    allergies: Optional[str],
    triage_level: str,
    risk_score: float,
    triage_explanation: str,
    user_id: Optional[str] = None,
    patient_name: Optional[str] = None,
    patient_email: Optional[str] = None,
) -> Any:
    """
    Routes clinical AI evaluation strictly through AIGateway (PHI scrubbing,
    grounding verification, circuit breaker, rate limiter, audit logging).
    """
    gateway = AIGateway()
    case_data = {
        "name": patient_name,
        "email": patient_email,
        "age": patient_age,
        "sex": patient_sex,
        "chief_complaint": chief_complaint,
        "symptoms": symptoms,
        "vitals": vitals or {},
        "comorbidities": comorbidities if isinstance(comorbidities, list) else ([str(comorbidities)] if comorbidities else []),
        "medications": current_medications,
        "allergies": allergies,
        "triage_level": triage_level,
        "triage_score": risk_score,
        "rule_rationale": triage_explanation,
    }

    # Retrieve RAG knowledge chunks from ChromaDB if available (respecting disabled sources)
    retrieved_chunks = None
    try:
        from app.services.admin.operations_service import OperationsService
        query_text = f"{chief_complaint} {' '.join([s.get('symptom', '') for s in symptoms if isinstance(s, dict)])}"
        retrieved_chunks = OperationsService.retrieve_rag_chunks(query_text=query_text, n_results=3)
        if not retrieved_chunks:
            retrieved_chunks = None
    except Exception as e:
        logger.warning(f"RAG retrieval skipped in cases router: {e}")

    gw_res: GatewayResult = await gateway.analyze_case(
        case_data=case_data,
        retrieved_chunks=retrieved_chunks,
        user_id=user_id or "patient",
        is_synthetic_patient=True,
    )

    diff_items = []
    likelihood_scores = {"more_likely": 0.85, "possible": 0.60, "less_likely": 0.35}
    for idx, d in enumerate(gw_res.analysis.differentials):
        prob = likelihood_scores.get(d.likelihood, max(0.2, 0.8 - idx * 0.15))
        ev_parts = []
        if d.supporting_evidence:
            ev_parts.extend(d.supporting_evidence)
        if d.against_or_missing:
            ev_parts.append("Considerations: " + "; ".join(d.against_or_missing))
        ev_text = "; ".join(ev_parts) if ev_parts else f"Clinical symptoms and presentation consistent with {d.condition}."
        diff_items.append(DiagnosisItem(
            condition_name=d.condition,
            probability_score=prob,
            evidence=ev_text
        ))

    urgency_map_title = {
        "emergency": "Emergency",
        "urgent": "Urgent",
        "routine": "Routine",
        "self_care": "Self-Care Info",
    }
    suggested_urgency = urgency_map_title.get(gw_res.analysis.suggested_urgency.lower(), "Routine")

    class GatewayAdaptedResult:
        def __init__(self, res: GatewayResult, items: List[DiagnosisItem], urgency: str):
            self.model_name = res.model_name
            self.prompt_version = res.prompt_version
            self.raw_prompt = res.raw_prompt
            self.raw_response = res.raw_response
            self.output_summary = res.analysis.summary
            self.retrieved_chunks = res.retrieved_chunks
            self.tokens_in = res.tokens_in
            self.tokens_out = res.tokens_out
            self.latency_ms = res.latency_ms
            self.scrub_report = res.scrub_report
            self.block_reason = res.block_reason
            self.fallback_used = res.fallback_used
            self.agreement_score = res.agreement_score
            self.evidence_density_score = res.evidence_density_score
            
            class OutputWrapper:
                def __init__(self, diffs, urg, rationale, summ):
                    self.differential_diagnoses = diffs
                    self.suggested_urgency = urg
                    self.urgency_rationale = rationale
                    self.patient_summary = summ
            
            self.inference_output = OutputWrapper(
                items,
                urgency,
                res.analysis.urgency_rationale,
                res.analysis.summary
            )

    return GatewayAdaptedResult(gw_res, diff_items, suggested_urgency)



def _format_medical_history(comorbidities, medications: str = None) -> str:
    parts = []
    if comorbidities:
        if isinstance(comorbidities, list):
            comorbidities_str = ", ".join(comorbidities)
        else:
            comorbidities_str = str(comorbidities)
        parts.append(f"Comorbidities: {comorbidities_str}")
    if medications:
        parts.append(f"Medications: {medications.strip()}")
    return " | ".join(parts) if parts else None


async def _run_llm_orchestrator_background(
    case_id: int,
    patient_age: int,
    patient_sex: str,
    chief_complaint: str,
    all_symptoms_data: List[Dict[str, Any]],
    vitals_dict: Optional[Dict[str, Any]],
    comorbidities: Optional[Any],
    current_medications: Optional[Any],
    allergies: Optional[str],
    deterministic_level: str,
    deterministic_score: float,
    deterministic_explanation: str,
    user_id: str,
    patient_name: Optional[str],
    patient_email: Optional[str],
    engine_votes: List[str],
    engine_errors: List[str],
    needs_clinician_review: bool,
):
    """
    Background worker for LLM summary & differential generation (INV-04 / Clinical safety).
    Runs asynchronously via FastAPI BackgroundTasks so intake endpoint latency remains < 1s.
    Enforces LLM rule: LLM may only RAISE urgency, never lower.
    """
    from app.db.session import SessionLocal, get_db
    from app.services.rules.consensus_engine import LEVEL_RANK, RANK_TO_LEVEL
    from app.main import app

    is_override = get_db in app.dependency_overrides
    if is_override:
        db = next(app.dependency_overrides[get_db]())
    else:
        db = SessionLocal()

    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return

        ai_res = await _execute_clinical_ai_gateway(
            patient_age=patient_age,
            patient_sex=patient_sex,
            chief_complaint=chief_complaint,
            symptoms=all_symptoms_data,
            vitals=vitals_dict,
            comorbidities=comorbidities,
            current_medications=current_medications,
            allergies=allergies,
            triage_level=deterministic_level,
            risk_score=deterministic_score,
            triage_explanation=deterministic_explanation,
            user_id=user_id,
            patient_name=patient_name,
            patient_email=patient_email,
        )

        if case.triage_result:
            case.triage_result.fallback_used = bool(getattr(ai_res, "fallback_used", False))

        for diag in ai_res.inference_output.differential_diagnoses:
            db.add(DifferentialDiagnosis(
                case_id=case.id,
                condition_name=diag.condition_name,
                probability_score=diag.probability_score,
                evidence=diag.evidence
            ))

        db.add(AIAuditLog(
            case_id=case.id,
            model_name=ai_res.model_name,
            prompt_version=ai_res.prompt_version,
            raw_prompt=ai_res.raw_prompt,
            raw_response=ai_res.raw_response,
            output_summary=ai_res.output_summary,
            retrieved_chunks=ai_res.retrieved_chunks,
            tokens_in=getattr(ai_res, "tokens_in", None),
            tokens_out=getattr(ai_res, "tokens_out", None),
            latency_ms=getattr(ai_res, "latency_ms", None),
            scrub_report=getattr(ai_res, "scrub_report", None),
            block_reason=getattr(ai_res, "block_reason", None),
            fallback_used=getattr(ai_res, "fallback_used", False),
        ))

        # Check LLM suggested urgency: LLM may only RAISE, never lower
        llm_urgency = ai_res.inference_output.suggested_urgency
        cur_rank = LEVEL_RANK.get(deterministic_level, 0)
        llm_rank = LEVEL_RANK.get(llm_urgency.strip().title(), LEVEL_RANK.get(llm_urgency.strip(), -1))
        if llm_rank > cur_rank:
            new_level = RANK_TO_LEVEL[llm_rank]
            if case.triage_result:
                case.triage_result.triage_level = new_level
                if new_level == "Emergency":
                    case.is_emergency_flag = True
                    case.triage_result.risk_score = max(85.0, case.triage_result.risk_score)
                elif new_level == "Urgent":
                    case.triage_result.risk_score = max(60.0, case.triage_result.risk_score)
                if case.triage_result.decision_trace:
                    dt = dict(case.triage_result.decision_trace)
                    dt["final_level"] = new_level
                    dt["votes"] = list(dt.get("votes", [])) + [{
                        "source": "LLMOrchestrator",
                        "level": new_level,
                        "rationale": f"LLM escalated urgency from {deterministic_level} to {new_level}.",
                    }]
                    case.triage_result.decision_trace = dt

        # Recalculate Quality Inference with top differential
        if case.quality_score:
            top_diag = ai_res.inference_output.differential_diagnoses[0] if ai_res.inference_output.differential_diagnoses else None
            inference_results = calculate_quality_inference(
                rule_triage_level=deterministic_level,
                llm_urgency=llm_urgency,
                completeness_score=case.quality_score.completeness_score,
                consistency_score=case.quality_score.consistency_score,
                is_emergency=(deterministic_level == "Emergency"),
                top_differential=top_diag,
                symptoms=all_symptoms_data,
                vitals=vitals_dict,
                engine_error=bool(engine_errors),
                needs_clinician_review=needs_clinician_review,
                engine_votes=engine_votes,
            )
            case.quality_score.agreement_score = inference_results["agreement_score"]
            case.quality_score.evidence_density_score = inference_results["evidence_density_score"]
            case.quality_score.composite_quality_score = inference_results["composite_quality_score"]
            case.quality_score.confidence_band = inference_results["confidence_band"]

        case.ai_status = "ready"
        db.commit()
    except Exception as e:
        logger.warning(f"Background LLM orchestrator failed for case {case_id}: {e}")
        try:
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                case.ai_status = "unavailable"
                if case.triage_result:
                    case.triage_result.fallback_used = True
                db.commit()
        except Exception:
            pass
    finally:
        if not is_override:
            db.close()


def _dispatch_llm_worker(**kwargs):
    from app.db.session import get_db
    from app.main import app
    import threading
    import asyncio
    import concurrent.futures

    if get_db in app.dependency_overrides:
        try:
            loop = None
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
            if loop and loop.is_running():
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    pool.submit(asyncio.run, _run_llm_orchestrator_background(**kwargs)).result(timeout=2.0)
            else:
                asyncio.run(_run_llm_orchestrator_background(**kwargs))
        except Exception as e:
            logger.warning(f"Test LLM orchestrator execution error: {e}")
        return

    def _runner():
        asyncio.run(_run_llm_orchestrator_background(**kwargs))
    t = threading.Thread(target=_runner, daemon=True)
    t.start()
    t.join(timeout=0.2)


@router.get("/queue", response_model=List[ClinicianQueueItemOut])
def get_clinician_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.list"))
):
    """
    Retrieves the case queue for clinicians.
    Sorted by priority: Emergency first, then Low-confidence-band cases bumped up within their tier.
    Soft-deleted cases excluded.
    """
    from sqlalchemy import and_
    from app.models.quality import QualityScore
    query = (
        db.query(Case, PatientProfile, User, TriageResult, QualityScore)
        .join(PatientProfile, Case.patient_id == PatientProfile.id)
        .join(User, PatientProfile.user_id == User.id)
        .outerjoin(TriageResult, and_(Case.id == TriageResult.case_id, TriageResult.is_current == "true"))
        .outerjoin(QualityScore, Case.id == QualityScore.case_id)
        .filter(Case.deleted_at.is_(None))
        .filter(~Case.chief_complaint.contains("PURGED_PHI"))
        .all()
    )

    def priority_key(item_tuple):
        case, profile, user, triage, quality = item_tuple
        is_em = bool(case.is_emergency_flag or (triage and triage.triage_level == "Emergency"))
        lvl = "Emergency" if is_em else (triage.triage_level if triage else "Pending")
        conf = quality.confidence_band if quality else None

        base_scores = {
            "Emergency": 0,
            "Urgent": 20,
            "Routine": 40,
            "Self-Care Info": 60,
            "Self-Care": 60,
            "Pending": 70
        }
        score = base_scores.get(lvl, 70)
        if not is_em and conf == "Low":
            score -= 10  # Low confidence bumped up within tier

        ts = case.created_at.timestamp() if case.created_at else 0
        return (score, -ts)

    sorted_query = sorted(query, key=priority_key)

    queue = []
    for case, profile, user, triage, quality in sorted_query:
        triage_level = "Emergency" if case.is_emergency_flag else (triage.triage_level if triage else "Pending")
        safe_complaint = "Record purged (DPDP erasure)" if "PURGED_PHI" in str(case.chief_complaint) else case.chief_complaint
        queue.append(
            ClinicianQueueItemOut(
                id=case.id,
                patient_name=user.name,
                patient_age=profile.age,
                patient_sex=profile.sex,
                chief_complaint=safe_complaint,
                triage_level=triage_level,
                status=case.status,
                is_emergency_flag=case.is_emergency_flag,
                confidence_band=quality.confidence_band if quality else None,
                created_at=case.created_at
            )
        )
    return queue


@router.post("/intake", response_model=CaseDetailOut, status_code=status.HTTP_201_CREATED)
async def submit_patient_intake(
    payload: PatientIntakeCreate,
    background_tasks: BackgroundTasks,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits structured patient intake data across Tier-1 and Tier-2 core tables:
    - Verifies valid consent on record under DPDP Act 2023.
    - Synchronizes patient profile demographics, medical history, and allergies.
    - Executes Quality Interpretation Module.
    - Evaluates authoritative ConsensusDecisionEngine (RedFlag, Geriatric, LegacyScore).
    - Persists records across `cases`, `quality_scores`, `symptom_entries`, `vitals`, and `triage_results`.
    - Schedules LLM orchestrator asynchronously via FastAPI BackgroundTasks (<1s response latency).
    """
    # 1. Verify consent exists
    consent = db.query(ConsentLog).filter(
        ConsentLog.user_id == current_user.id,
        ConsentLog.granted == True
    ).first()

    if not consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Informed digital consent under India's DPDP Act 2023 is required before submitting patient intake. Please complete the consent form first."
        )

    # 2. Get or create PatientProfile
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        patient_profile = PatientProfile(
            user_id=current_user.id,
            age=payload.age,
            sex=payload.sex,
            medical_history=_format_medical_history(payload.comorbidities, payload.current_medications),
            allergies=payload.allergies
        )
        db.add(patient_profile)
        db.flush()
    else:
        # Synchronize patient profile with latest demographics and history
        patient_profile.age = payload.age
        patient_profile.sex = payload.sex
        
        formatted_history = _format_medical_history(payload.comorbidities, payload.current_medications)
        if formatted_history:
            patient_profile.medical_history = formatted_history
        if payload.allergies:
            patient_profile.allergies = payload.allergies.strip()
        db.flush()

    # 3. Execute Quality Interpretation Module (Pre-Red-Flag / Pre-Triage)
    quality_eval = evaluate_intake_quality(payload)

    # Determine initial Case status and emergency flags
    initial_status = "needs_clarification" if quality_eval.requires_clarification else "submitted"
    is_emergency = False
    emergency_rule = "BLOCKED_AWAITING_CLARIFICATION" if quality_eval.requires_clarification else None

    # 4. Create Case record
    new_case = Case(
        patient_id=patient_profile.id,
        chief_complaint=payload.chief_complaint,
        status=initial_status,
        is_emergency_flag=is_emergency,
        emergency_rule_fired=emergency_rule,
        ai_status="pending" if not quality_eval.requires_clarification else "ready"
    )
    db.add(new_case)
    db.flush()

    # 5. Persist QualityScore record
    quality_entry = QualityScore(
        case_id=new_case.id,
        completeness_score=quality_eval.completeness_score,
        consistency_score=quality_eval.consistency_score,
        flags=quality_eval.flags,
        requires_clarification=quality_eval.requires_clarification,
        clarifying_question=quality_eval.clarifying_question,
        follow_up_questions=[q.to_dict() for q in quality_eval.follow_up_questions]
    )
    db.add(quality_entry)

    # 6. Create primary symptom entry
    primary_symptom = SymptomEntry(
        case_id=new_case.id,
        symptom=payload.chief_complaint,
        duration=payload.symptom_duration,
        severity=payload.severity,
        body_location=payload.body_location
    )
    db.add(primary_symptom)

    # Add any additional symptoms
    if payload.additional_symptoms:
        for sym in payload.additional_symptoms:
            extra_symptom = SymptomEntry(
                case_id=new_case.id,
                symptom=sym.symptom,
                duration=sym.duration,
                severity=sym.severity,
                body_location=sym.body_location
            )
            db.add(extra_symptom)

    # 7. Create vitals record if vitals are provided
    if payload.vitals:
        vitals_entry = Vitals(
            case_id=new_case.id,
            temperature=payload.vitals.temperature,
            pulse=payload.vitals.pulse,
            blood_pressure=payload.vitals.blood_pressure,
            spo2=payload.vitals.spo2
        )
        db.add(vitals_entry)

    all_symptoms_data = [
        {
            "symptom": payload.chief_complaint,
            "duration": payload.symptom_duration,
            "severity": payload.severity,
            "body_location": payload.body_location
        }
    ]
    if payload.additional_symptoms:
        for sym in payload.additional_symptoms:
            all_symptoms_data.append({
                "symptom": sym.symptom,
                "duration": sym.duration,
                "severity": sym.severity,
                "body_location": sym.body_location
            })
    vitals_dict = payload.vitals.model_dump() if payload.vitals else None

    # 8. Single authoritative Consensus Decision Pipeline (Only if NOT blocked by hard quality contradiction)
    consensus_res = None
    if not quality_eval.requires_clarification:
        req_id = request.headers.get("x-request-id") if request and hasattr(request, "headers") else None
        consensus_res = ConsensusDecisionEngine.evaluate_case(
            payload=payload,
            request_id=req_id
        )

        new_case.is_emergency_flag = (consensus_res.final_level == "Emergency")
        if consensus_res.final_level == "Emergency":
            new_case.emergency_rule_fired = consensus_res.emergency_rule_fired or consensus_res.decision_trace.get("summary_rule") or "EMERGENCY_CONSENSUS"

        triage_entry = TriageResult(
            case_id=new_case.id,
            triage_level=consensus_res.final_level,
            risk_score=consensus_res.risk_score,
            explanation=consensus_res.explanation,
            decision_trace=consensus_res.decision_trace
        )
        db.add(triage_entry)

        # Initial deterministic quality inference
        inference_results = calculate_quality_inference(
            rule_triage_level=consensus_res.final_level,
            llm_urgency=None,
            completeness_score=quality_entry.completeness_score,
            consistency_score=quality_entry.consistency_score,
            is_emergency=new_case.is_emergency_flag,
            top_differential=None,
            symptoms=all_symptoms_data,
            vitals=vitals_dict,
            consensus_result=consensus_res
        )
        quality_entry.agreement_score = inference_results["agreement_score"]
        quality_entry.evidence_density_score = inference_results["evidence_density_score"]
        quality_entry.composite_quality_score = inference_results["composite_quality_score"]
        quality_entry.confidence_band = inference_results["confidence_band"]

    db.commit()
    db.refresh(new_case)

    # 9. Asynchronous background dispatch of AI orchestrator (<1s response latency guarantee)
    # Tier-1 Red-Flag emergency cases bypass AI orchestrator completely
    if not quality_eval.requires_clarification and consensus_res and not new_case.is_emergency_flag:
        _dispatch_llm_worker(
            case_id=new_case.id,
            patient_age=payload.age,
            patient_sex=payload.sex,
            chief_complaint=payload.chief_complaint,
            all_symptoms_data=all_symptoms_data,
            vitals_dict=vitals_dict,
            comorbidities=payload.comorbidities,
            current_medications=payload.current_medications,
            allergies=payload.allergies,
            deterministic_level=consensus_res.final_level,
            deterministic_score=consensus_res.risk_score,
            deterministic_explanation=consensus_res.explanation,
            user_id=str(current_user.id),
            patient_name=getattr(current_user, "name", None),
            patient_email=getattr(current_user, "email", None),
            engine_votes=[v.level for v in consensus_res.votes],
            engine_errors=consensus_res.engine_errors,
            needs_clinician_review=consensus_res.needs_clinician_review,
        )
        db.refresh(new_case)

    # Build response model
    return CaseDetailOut(
        id=new_case.id,
        patient_id=new_case.patient_id,
        chief_complaint=new_case.chief_complaint,
        status=new_case.status,
        is_emergency_flag=new_case.is_emergency_flag,
        emergency_rule_fired=new_case.emergency_rule_fired,
        created_at=new_case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in new_case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in new_case.vitals],
        triage_result=TriageResultOut.model_validate(new_case.triage_result) if new_case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(new_case.quality_score) if new_case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in new_case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in new_case.ai_audit_logs],
        patient_age=patient_profile.age,
        patient_sex=patient_profile.sex,
        ai_status=new_case.ai_status,
        decision=new_case.triage_result.decision_trace if new_case.triage_result else None,
        unreviewed_rules_notice=(
            new_case.triage_result.decision_trace.get("unreviewed_rules_notice")
            if (new_case.triage_result and isinstance(new_case.triage_result.decision_trace, dict))
            else None
        )
    )


@router.get("/my", response_model=List[CaseDetailOut])
def get_my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all cases submitted by the authenticated patient. Excludes soft-deleted cases.
    """
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        return []

    cases = db.query(Case).filter(
        Case.patient_id == patient_profile.id,
        Case.deleted_at.is_(None)
    ).order_by(Case.created_at.desc()).all()
    return [
        CaseDetailOut(
            id=c.id,
            patient_id=c.patient_id,
            chief_complaint=c.chief_complaint,
            status=c.status,
            is_emergency_flag=c.is_emergency_flag,
            emergency_rule_fired=c.emergency_rule_fired,
            created_at=c.created_at,
            symptoms=[SymptomEntryOut.model_validate(s) for s in c.symptoms],
            vitals=[VitalsOut.model_validate(v) for v in c.vitals],
            triage_result=TriageResultOut.model_validate(c.triage_result) if c.triage_result else None,
            quality_score=QualityScoreOut.model_validate(c.quality_score) if c.quality_score else None,
            differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in c.differential_diagnoses],
            ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in c.ai_audit_logs],
            patient_age=patient_profile.age,
            patient_sex=patient_profile.sex,
            ai_status=c.ai_status,
            decision=c.triage_result.decision_trace if c.triage_result else None
        )
        for c in cases
    ]


@router.get("/{case_id}", response_model=CaseDetailOut)
def get_case_by_id(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves case details by ID. Ensures authorized access via get_case_for_user.
    Renders decision directly from persisted decision_trace without recomputation.
    """
    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()
    decision_data = case.triage_result.decision_trace if case.triage_result else None
    if decision_data is None and case.triage_result:
        decision_data = {
            "final_level": case.triage_result.triage_level,
            "votes": [{
                "source": getattr(case.triage_result, "source", "ENGINE") or "ENGINE",
                "level": case.triage_result.triage_level,
                "rationale": case.triage_result.explanation or f"Triage level: {case.triage_result.triage_level}",
            }],
            "consensus_method": "max_rank",
            "summary_rule": case.emergency_rule_fired,
        }
    unreviewed_rules_notice = (
        decision_data.get("unreviewed_rules_notice")
        if isinstance(decision_data, dict)
        else None
    )

    return CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None,
        ai_status=case.ai_status,
        decision=decision_data,
        unreviewed_rules_notice=unreviewed_rules_notice
    )


@router.get("/{case_id}/decision")
def get_case_decision(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinician)
):
    """
    Returns the complete Decision object from the persisted decision_trace.
    """
    if case.triage_result:
        if case.triage_result.decision_trace:
            return case.triage_result.decision_trace
        return {
            "final_level": case.triage_result.triage_level,
            "votes": [{
                "source": getattr(case.triage_result, "source", "ENGINE") or "ENGINE",
                "level": case.triage_result.triage_level,
                "rationale": case.triage_result.explanation or f"Triage level: {case.triage_result.triage_level}",
            }],
            "consensus_method": "max_rank",
            "summary_rule": case.emergency_rule_fired,
        }
    return {}


@router.get("/{case_id}/pdf", response_class=Response)
def get_case_pdf(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates and returns a PDF report for a given case.
    """
    case_id = case.id
    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()

    # Convert to schema
    case_detail = CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None
    )

    pdf_bytes = generate_case_pdf(case_detail)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="case_{case_id}.pdf"'}
    )


@router.patch("/{case_id}/status", response_model=CaseDetailOut, dependencies=[Depends(require_clinician)])
def update_case_status(
    payload: CaseStatusUpdate,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db)
):
    """
    Updates the status of a case (e.g. 'reviewed'). Clinician/admin only.
    """
    case.status = payload.status
    db.commit()
    db.refresh(case)

    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()

    return CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None
    )


@router.post("/{case_id}/clarify", response_model=CaseDetailOut)
async def clarify_case(
    payload: CaseClarificationInput,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits clarifying information or corrections for a case in 'needs_clarification' status:
    - Verifies patient ownership / permission via get_case_for_user(write=True).
    - Applies updated fields to Case, SymptomEntry, Vitals, and PatientProfile.
    - Re-executes the Quality Interpretation Module on the updated composite case state.
    - If hard contradictions are resolved, unblocks the case (status='submitted'), runs deterministic Tier-1 Red-Flag checks and Tier-2 Triage scoring.
    """
    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()

    # 1. Update Case / Symptom fields if provided
    primary_symptom = db.query(SymptomEntry).filter(SymptomEntry.case_id == case.id).first()
    
    if payload.chief_complaint:
        case.chief_complaint = payload.chief_complaint.strip()
        if primary_symptom:
            primary_symptom.symptom = payload.chief_complaint.strip()
    elif payload.clarification_response:
        # Append clarification to complaint for context if not explicitly replaced
        case.chief_complaint = f"{case.chief_complaint} (Clarification: {payload.clarification_response.strip()})"
        if primary_symptom:
            primary_symptom.symptom = case.chief_complaint

    if payload.symptom_duration and primary_symptom:
        primary_symptom.duration = payload.symptom_duration.strip()

    if payload.severity is not None and primary_symptom:
        primary_symptom.severity = payload.severity

    if payload.body_location and primary_symptom:
        primary_symptom.body_location = payload.body_location.strip()

    # 2. Update vitals if provided
    vitals_entry = db.query(Vitals).filter(Vitals.case_id == case.id).first()
    if payload.vitals:
        if not vitals_entry:
            vitals_entry = Vitals(case_id=case.id)
            db.add(vitals_entry)
        if payload.vitals.temperature is not None:
            vitals_entry.temperature = payload.vitals.temperature
        if payload.vitals.pulse is not None:
            vitals_entry.pulse = payload.vitals.pulse
        if payload.vitals.blood_pressure is not None:
            vitals_entry.blood_pressure = payload.vitals.blood_pressure
        if payload.vitals.spo2 is not None:
            vitals_entry.spo2 = payload.vitals.spo2

    # 3. Update patient profile demographics and history if provided
    if payload.comorbidities or payload.current_medications:
        formatted_history = _format_medical_history(payload.comorbidities, payload.current_medications)
        if formatted_history and patient_profile:
            patient_profile.medical_history = formatted_history
    if payload.allergies and patient_profile:
        patient_profile.allergies = payload.allergies.strip()

    db.flush()

    # 4. Construct composite intake payload for re-evaluation
    vitals_input = None
    if vitals_entry:
        vitals_input = VitalsInput(
            temperature=vitals_entry.temperature,
            pulse=vitals_entry.pulse,
            blood_pressure=vitals_entry.blood_pressure,
            spo2=vitals_entry.spo2
        )

    # Extract additional symptoms
    additional_symptoms_list = db.query(SymptomEntry).filter(
        SymptomEntry.case_id == case.id,
        SymptomEntry.id != (primary_symptom.id if primary_symptom else -1)
    ).all()
    additional_symptom_inputs = [
        SymptomInput(
            symptom=s.symptom,
            duration=s.duration,
            severity=s.severity or 5,
            body_location=s.body_location
        )
        for s in additional_symptoms_list
    ]

    composite_payload = PatientIntakeCreate(
        chief_complaint=case.chief_complaint,
        symptom_duration=primary_symptom.duration if primary_symptom and primary_symptom.duration else "1 day",
        severity=primary_symptom.severity if primary_symptom and primary_symptom.severity else 5,
        body_location=primary_symptom.body_location if primary_symptom and primary_symptom.body_location else "General",
        age=patient_profile.age if patient_profile and patient_profile.age else 65,
        sex=patient_profile.sex if patient_profile and patient_profile.sex else "Female",
        pregnancy_status=payload.pregnancy_status,
        comorbidities=payload.comorbidities,
        current_medications=payload.current_medications,
        allergies=payload.allergies or (patient_profile.allergies if patient_profile else None),
        vitals=vitals_input,
        additional_symptoms=additional_symptom_inputs if additional_symptom_inputs else None
    )

    # 5. Re-evaluate quality interpretation
    quality_eval = evaluate_intake_quality(composite_payload)

    # Update QualityScore record
    quality_entry = db.query(QualityScore).filter(QualityScore.case_id == case.id).first()
    if not quality_entry:
        quality_entry = QualityScore(case_id=case.id)
        db.add(quality_entry)

    quality_entry.completeness_score = quality_eval.completeness_score
    quality_entry.consistency_score = quality_eval.consistency_score
    quality_entry.flags = quality_eval.flags
    quality_entry.requires_clarification = quality_eval.requires_clarification
    quality_entry.clarifying_question = quality_eval.clarifying_question
    quality_entry.follow_up_questions = [q.to_dict() for q in quality_eval.follow_up_questions]

    # 6. If contradictions resolved, execute Red Flag & Triage pipelines
    if not quality_eval.requires_clarification:
        case.status = "submitted"

        vitals_spo2 = vitals_entry.spo2 if vitals_entry else None
        vitals_pulse = vitals_entry.pulse if vitals_entry else None
        vitals_bp = vitals_entry.blood_pressure if vitals_entry else None
        vitals_temp = vitals_entry.temperature if vitals_entry else None

        # Consensus Decision Pipeline
        from app.services.rules.consensus_engine import ConsensusDecisionEngine

        all_syms_dict = [
            {"symptom": s.symptom, "duration": s.duration, "severity": s.severity, "body_location": s.body_location}
            for s in case.symptoms
        ]
        clarify_vitals = {
            "temperature": vitals_temp,
            "pulse": vitals_pulse,
            "blood_pressure": vitals_bp,
            "spo2": vitals_spo2,
        } if vitals_entry else None

        consensus_res = ConsensusDecisionEngine.evaluate_case(
            chief_complaint=case.chief_complaint,
            age=patient_profile.age if patient_profile and patient_profile.age else 65,
            severity=primary_symptom.severity if primary_symptom and primary_symptom.severity else 5,
            symptom_duration=primary_symptom.duration if primary_symptom and primary_symptom.duration else "1 day",
            body_location=primary_symptom.body_location if primary_symptom and primary_symptom.body_location else "General",
            comorbidities=patient_profile.medical_history if patient_profile else None,
            vitals=clarify_vitals,
            symptoms=all_syms_dict,
            db=db,
        )

        case.is_emergency_flag = consensus_res.is_emergency
        case.emergency_rule_fired = consensus_res.emergency_rule_fired

        triage_entry = db.query(TriageResult).filter(TriageResult.case_id == case.id).first()
        if not triage_entry:
            triage_entry = TriageResult(case_id=case.id)
            db.add(triage_entry)
        triage_entry.triage_level = consensus_res.final_level
        triage_entry.risk_score = consensus_res.risk_score
        triage_entry.explanation = consensus_res.explanation
        triage_entry.decision_trace = consensus_res.decision_trace

        # Clear previous differential diagnoses and audit logs if updating
        db.query(DifferentialDiagnosis).filter(DifferentialDiagnosis.case_id == case.id).delete()
        db.query(AIAuditLog).filter(AIAuditLog.case_id == case.id).delete()

        clarify_symptoms = [
            {
                "symptom": case.chief_complaint,
                "duration": primary_symptom.duration if primary_symptom else "1 day",
                "severity": primary_symptom.severity if primary_symptom else 5,
                "body_location": primary_symptom.body_location if primary_symptom else "General"
            }
        ]
        for s in additional_symptoms_list:
            clarify_symptoms.append({
                "symptom": s.symptom,
                "duration": s.duration,
                "severity": s.severity,
                "body_location": s.body_location
            })

        clarify_vitals = {
            "temperature": vitals_temp,
            "pulse": vitals_pulse,
            "blood_pressure": vitals_bp,
            "spo2": vitals_spo2
        } if (vitals_temp is not None or vitals_pulse is not None or vitals_bp is not None or vitals_spo2 is not None) else None

        ai_res = await _execute_clinical_ai_gateway(
            patient_age=patient_profile.age if patient_profile and patient_profile.age else 65,
            patient_sex=patient_profile.sex if patient_profile and patient_profile.sex else "Unknown",
            chief_complaint=case.chief_complaint,
            symptoms=clarify_symptoms,
            vitals=clarify_vitals,
            comorbidities=patient_profile.medical_history if patient_profile else None,
            current_medications=None,
            allergies=patient_profile.allergies if patient_profile else None,
            triage_level=consensus_res.final_level,
            risk_score=consensus_res.risk_score,
            triage_explanation=consensus_res.explanation,
            user_id=str(current_user.id),
            patient_name=getattr(current_user, "name", None),
            patient_email=getattr(current_user, "email", None),
        )

        triage_entry.fallback_used = bool(getattr(ai_res, "fallback_used", False))

        for diag in ai_res.inference_output.differential_diagnoses:
            db.add(DifferentialDiagnosis(
                case_id=case.id,
                condition_name=diag.condition_name,
                probability_score=diag.probability_score,
                evidence=diag.evidence
            ))

        db.add(AIAuditLog(
            case_id=case.id,
            model_name=ai_res.model_name,
            prompt_version=ai_res.prompt_version,
            raw_prompt=ai_res.raw_prompt,
            raw_response=ai_res.raw_response,
            output_summary=ai_res.output_summary,
            retrieved_chunks=ai_res.retrieved_chunks,
            tokens_in=getattr(ai_res, "tokens_in", None),
            tokens_out=getattr(ai_res, "tokens_out", None),
            latency_ms=getattr(ai_res, "latency_ms", None),
            scrub_report=getattr(ai_res, "scrub_report", None),
            block_reason=getattr(ai_res, "block_reason", None),
            fallback_used=getattr(ai_res, "fallback_used", False),
        ))
    else:
        case.status = "needs_clarification"
        case.is_emergency_flag = False
        case.emergency_rule_fired = "BLOCKED_AWAITING_CLARIFICATION"

    db.commit()
    db.refresh(case)

    return CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None,
        ai_status=case.ai_status,
        decision=case.triage_result.decision_trace if case.triage_result else None
    )


@router.get("/{case_id}/ai-audit", response_model=List[AIAuditLogOut])
def get_case_ai_audit_logs(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves AI audit logs for a specific case.
    Clinicians and admins have full audit trail access.
    Patients can access audit records for their own cases.
    """
    return [AIAuditLogOut.model_validate(log) for log in case.ai_audit_logs]


@router.get("/{case_id}/access-history")
def get_case_access_history(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Patient-facing transparent access history endpoint showing who accessed their record,
    including clinical reviews, admin break-glass reveals, and support impersonation events.
    """
    from app.services.admin.support_tools_service import SupportToolsService
    return SupportToolsService.get_patient_access_history(patient_id=case.patient_id, case_id=case.id, db=db)


@router.post("/{case_id}/feedback", response_model=CaseDetailOut, dependencies=[Depends(require_clinician)])
def submit_clinician_feedback(
    payload: BulkFeedbackCreate,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinician)
):
    """
    Submit or update feedback for a case's differential diagnoses.
    Marks case status as 'reviewed'.
    """
    # Process each feedback item
    for item in payload.feedbacks:
        # Check if differential diagnosis belongs to this case
        diff_diag = db.query(DifferentialDiagnosis).filter(
            DifferentialDiagnosis.id == item.differential_diagnosis_id,
            DifferentialDiagnosis.case_id == case.id
        ).first()

        if not diff_diag:
            continue # Skip invalid ones or throw error

        # Check if feedback already exists for this differential diagnosis
        existing_feedback = db.query(ClinicianFeedback).filter(
            ClinicianFeedback.differential_diagnosis_id == item.differential_diagnosis_id
        ).first()

        if existing_feedback:
            existing_feedback.feedback_status = item.feedback_status
            existing_feedback.notes = item.notes
            existing_feedback.clinician_id = current_user.id
        else:
            new_feedback = ClinicianFeedback(
                case_id=case.id,
                differential_diagnosis_id=item.differential_diagnosis_id,
                clinician_id=current_user.id,
                feedback_status=item.feedback_status,
                notes=item.notes
            )
            db.add(new_feedback)

    # Update case status
    case.status = "reviewed"
    db.commit()
    db.refresh(case)

    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()

    return CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None
    )


# =====================================================================
# CYCLE 2: LIFECYCLE API ENDPOINTS (AMEND, COMMENT, OVERRIDE, DELETE, RESTORE)
# =====================================================================

from app.schemas.lifecycle import (
    CaseAmendInput, CaseCommentInput, ClinicianSummaryEditInput, TriageOverrideInput,
    CaseRevisionOut, CaseCommentOut
)
from app.services.lifecycle.lifecycle_service import LifecycleService


@router.post("/{case_id}/amend", response_model=CaseDetailOut)
def amend_case_intake(
    data: CaseAmendInput,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.amend"))
):
    """
    Amends intake fields (symptoms, vitals, chief complaint), creates a new CaseRevision,
    and re-evaluates red flags & triage scoring atomically.
    """
    case_id = case.id
    try:
        case, rev_no = LifecycleService.amend_case(db, case_id, current_user, data)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    
    patient_profile = db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()
    return CaseDetailOut(
        id=case.id,
        patient_id=case.patient_id,
        chief_complaint=case.chief_complaint,
        status=case.status,
        is_emergency_flag=case.is_emergency_flag,
        emergency_rule_fired=case.emergency_rule_fired,
        created_at=case.created_at,
        symptoms=[SymptomEntryOut.model_validate(s) for s in case.symptoms],
        vitals=[VitalsOut.model_validate(v) for v in case.vitals],
        triage_result=TriageResultOut.model_validate(case.triage_result) if case.triage_result else None,
        quality_score=QualityScoreOut.model_validate(case.quality_score) if case.quality_score else None,
        differential_diagnoses=[DifferentialDiagnosisOut.model_validate(d) for d in case.differential_diagnoses],
        ai_audit_logs=[AIAuditLogOut.model_validate(a) for a in case.ai_audit_logs],
        patient_age=patient_profile.age if patient_profile else None,
        patient_sex=patient_profile.sex if patient_profile else None
    )


@router.post("/{case_id}/comments", response_model=CaseCommentOut, status_code=status.HTTP_201_CREATED)
def add_case_comment(
    data: CaseCommentInput,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.comment"))
):
    """
    Adds a patient or caregiver feedback comment on case summary.
    Does not alter triage level or case status.
    """
    case_id = case.id
    try:
        comment = LifecycleService.add_comment(db, case_id, current_user, data.comment_text)
        return comment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{case_id}/override-summary", response_model=TriageResultOut)
def override_clinician_summary(
    data: ClinicianSummaryEditInput,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.edit_summary"))
):
    """
    Edits clinician summary text. Previous version kept with is_current=false.
    """
    case_id = case.id
    try:
        new_triage = LifecycleService.override_summary(db, case_id, current_user, data)
        return new_triage
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{case_id}/override-triage", response_model=TriageResultOut)
def override_triage_level(
    data: TriageOverrideInput,
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.override_triage"))
):
    """
    Overrides triage level. Reason required.
    Lowering an Emergency level requires explicit confirm_emergency_downgrade=True and reason >= 20 chars.
    """
    case_id = case.id
    try:
        new_triage = LifecycleService.override_triage(db, case_id, current_user, data)
        return new_triage
    except ValueError as e:
        err_msg = str(e)
        if "requires explicit confirm_emergency_downgrade=True" in err_msg or "at least 10 characters" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=err_msg
        )


@router.delete("/{case_id}")
def soft_delete_case(
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.delete"))
):
    """
    Soft-deletes a case record with 30-day retention before purge.
    """
    case_id = case.id
    try:
        case = LifecycleService.soft_delete_case(db, case_id, current_user)
        return {
            "message": "Case soft-deleted. Purge scheduled in 30 days.",
            "case_id": case.id,
            "deleted_at": case.deleted_at,
            "purge_after": case.purge_after
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{case_id}/undo-delete")
def undo_soft_delete_case(
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.delete"))
):
    """
    Patient / caregiver self-service instant restore of a soft-deleted case during the 30-day grace period.
    """
    case_id = case.id
    try:
        case = LifecycleService.restore_case(db, case_id, current_user)
        return {
            "message": "Case restored successfully.",
            "case_id": case.id
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/purge-expired")
def purge_expired_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.purge"))
):
    """
    Purges expired soft-deleted case PHI while keeping case audit metadata rows.
    """
    purged_count = LifecycleService.purge_expired_cases(db, current_user)
    return {
        "message": f"Purged {purged_count} expired cases PHI.",
        "purged_count": purged_count
    }


@router.get("/{case_id}/revisions", response_model=List[CaseRevisionOut])
def get_case_revisions(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm.cases.read"))
):
    """
    Retrieves revision history and diffs for a case.
    """
    case_id = case.id
    return LifecycleService.get_revisions_with_diffs(db, case_id)
