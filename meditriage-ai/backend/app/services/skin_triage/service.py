"""Persistence + escalation-only integration of skin analysis with case triage."""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.case import Case
from app.models.skin_analysis import SkinImageAnalysis
from app.models.triage import TriageResult
from app.models.user import User
from app.services.lifecycle.lifecycle_service import LifecycleService
from app.services.skin_triage.classifier import SkinClassifier
from app.services.skin_triage.image_utils import SanitizedImage
from app.services.skin_triage.knowledge import get_knowledge_base
from app.services.skin_triage.pipeline import LEVEL_RANK, SkinContext, run_pipeline, to_celsius

logger = logging.getLogger(__name__)


def build_context(case: Case, body_part: Optional[str]) -> SkinContext:
    texts = [case.chief_complaint or ""]
    sev = None
    for s in case.symptoms or []:
        texts.append(s.symptom or "")
        if s.severity is not None:
            sev = max(sev or 0, int(s.severity))
    temp = None
    for v in case.vitals or []:
        if v.temperature is not None:
            temp = v.temperature
    patient = case.patient
    history = " ".join(filter(None, [getattr(patient, "medical_history", None), getattr(patient, "allergies", None)]))
    return SkinContext(
        age=getattr(patient, "age", None),
        symptom_text=" . ".join(t for t in texts if t),
        max_symptom_severity=sev,
        temperature_c=to_celsius(temp),
        history_text=history or "",
        body_part=body_part,
    )


def analyze_and_store(db: Session, case: Case, user: User, image: SanitizedImage, clf: SkinClassifier,
                      body_part: Optional[str]) -> SkinImageAnalysis:
    ctx = build_context(case, body_part)
    result = run_pipeline(
        image.data, clf, get_knowledge_base(), ctx,
        {"width": image.width, "height": image.height},
    )
    sev, desc = result.severity, result.descriptor

    row = SkinImageAnalysis(
        case_id=case.id, created_by=user.id,
        image_data=image.data, image_mime=image.mime, image_sha256=image.sha256,
        image_width=image.width, image_height=image.height, body_part=(body_part or None),
        classifier_name=desc.classifier_name, classifier_available=desc.classifier_available,
        predictions=desc.predictions, relevant_conditions=desc.relevant_conditions, description=desc.summary,
        severity_score=sev.severity_score, suggested_triage_level=sev.triage_level,
        severity_reasons=sev.reasons, rules_fired=sev.rules_fired, confidence_band=sev.confidence_band,
        requires_clinician_review=sev.requires_clinician_review, recommendation=sev.recommendation,
        trace=result.trace, pipeline_version=result.trace["pipeline_version"],
    )
    db.add(row)
    db.flush()

    row.escalation_applied = _apply_escalation(db, case, user, row)
    db.commit()
    db.refresh(row)
    return row


def _apply_escalation(db: Session, case: Case, user: User, row: SkinImageAnalysis) -> bool:
    """Raise (never lower) the current triage level when the image-assisted level is higher."""
    current = (
        db.query(TriageResult)
        .filter(TriageResult.case_id == case.id, TriageResult.is_current == "true")
        .first()
    )
    cur_level = current.triage_level if current else None
    # A case still blocked for clarification has no triage yet: do not invent one here.
    if current is None:
        return False
    if LEVEL_RANK.get(row.suggested_triage_level, 0) <= LEVEL_RANK.get(cur_level, 0):
        return False

    new_level = row.suggested_triage_level
    db.query(TriageResult).filter(TriageResult.case_id == case.id).update(
        {"is_current": "false"}, synchronize_session=False
    )
    reasons = "; ".join(row.severity_reasons or [])[:600]
    db.add(TriageResult(
        case_id=case.id,
        triage_level=new_level,
        risk_score=99.0 if new_level == "Emergency" else max(current.risk_score or 0.0, 60.0),
        explanation=f"Raised from {cur_level} to {new_level} by skin image analysis (severity "
                    f"{row.severity_score}/5). {reasons}",
        decision_trace={"summary_rule": "SKIN_IMAGE_ESCALATION", "rules_fired": row.rules_fired,
                        "analysis_id": row.id, "previous_level": cur_level},
        version=LifecycleService.get_max_triage_version(db, case.id) + 1,
        is_current="true",
        source="IMAGE_ESCALATION",
        supersedes_id=current.id,
    ))
    if new_level == "Emergency":
        case.is_emergency_flag = True
        case.emergency_rule_fired = f"SKIN_IMAGE:{row.rules_fired[0] if row.rules_fired else 'EMERGENCY'}"
    LifecycleService.create_revision(
        db, case.id, user, "IMAGE_ESCALATION", field_path="triage_level",
        before_state={"triage_level": cur_level}, after_state={"triage_level": new_level},
        reason=f"Skin image analysis #{row.id} severity {row.severity_score}/5",
    )
    return True
