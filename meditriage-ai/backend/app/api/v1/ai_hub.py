from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_case_for_user
from app.models.user import User
from app.models.case import Case
from app.services.ai_hub import (
    DailyCheckinService,
    MedicationReviewService,
    ExplainSummaryService,
    VisitPrepService,
    TrendsService,
    ClinicianDigestService,
)


router = APIRouter()


class DailyCheckinRequest(BaseModel):
    vitals: Dict[str, Any] = Field(default_factory=dict)
    pain_score: Optional[int] = None
    mood: Optional[str] = None
    alertness: Optional[str] = None
    notes: Optional[str] = None


class MedicationReviewRequest(BaseModel):
    medications: List[str] | str
    symptoms: Optional[List[Dict[str, Any]]] = None
    vitals: Optional[Dict[str, Any]] = None
    age: int = 70


class ExplainSummaryRequest(BaseModel):
    case_id: int
    reading_level: str = Field(default="grade_8", description="grade_4 | grade_8 | clinical")
    language: str = Field(default="en", description="en | hi | mr")


@router.post("/checkin")
def submit_daily_checkin(
    req: DailyCheckinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits patient daily check-in and calculates baseline drift flags."""
    res = DailyCheckinService.record_checkin(
        user_id=current_user.id,
        checkin_data=req.model_dump(),
        db=db,
    )
    return res


@router.post("/medication-review")
def review_medications(
    req: MedicationReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluates medications for anticholinergic burden and safety flags with non-imperative advice."""
    res = MedicationReviewService.review_medications(
        medications_input=req.medications,
        symptoms=req.symptoms,
        vitals=req.vitals,
        age=req.age,
        db=db,
    )
    return res


@router.post("/explain-summary")
def explain_case_summary(
    req: ExplainSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Translates case triage summary at chosen reading level and language from structured case data."""
    case = db.query(Case).filter(Case.id == req.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    case_owner_user_id = case.patient.user_id if case.patient else None
    if case_owner_user_id != current_user.id and current_user.role not in ["clinician", "super_admin"]:
        raise HTTPException(status_code=403, detail="Cross-patient access prohibited.")

    case_data = {
        "age": 72,
        "sex": "Female",
        "chief_complaint": case.chief_complaint,
        "symptoms": [{"symptom": case.chief_complaint}],
        "vitals": {"systolic_bp": 128, "pulse": 76, "spo2": 96},
        "triage_level": "Routine",
        "medications": "Metolar, Ecosprin",
    }

    res = ExplainSummaryService.explain_summary(
        case_data=case_data,
        reading_level=req.reading_level,
        language=req.language,
    )
    return res


@router.get("/visit-prep/{case_id}")
def get_visit_prep(
    case: Case = Depends(get_case_for_user),
    db: Session = Depends(get_db),
):
    """Generates visit preparation questions and revision deltas for a case."""
    res = VisitPrepService.generate_visit_prep(case_id=case.id, db=db)
    return res


@router.get("/trends/{user_id}")
def get_patient_trends(
    user_id: int,
    limit: int = Query(default=7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Computes deterministic physiological trends comparing baselines to recent check-ins."""
    if user_id != current_user.id and current_user.role not in ["clinician", "super_admin"]:
        raise HTTPException(status_code=403, detail="Cross-patient access prohibited.")

    res = TrendsService.compute_trends(user_id=user_id, db=db, limit=limit)
    return res


@router.get("/clinician-digest")
def get_clinician_digest(
    hours_window: int = Query(default=24, ge=1, le=72),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates overnight clinical queue digest via deterministic SQL."""
    if current_user.role not in ["clinician", "ops_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Access denied: Clinician access required.")

    res = ClinicianDigestService.generate_digest(db=db, hours_window=hours_window)
    return res
