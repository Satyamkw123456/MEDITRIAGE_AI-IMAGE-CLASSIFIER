"""Skin & wound image triage endpoints (Triage Flow module)."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.authz import get_case_for_user
from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.case import Case
from app.models.skin_analysis import SkinImageAnalysis
from app.models.user import User
from app.schemas.skin_triage import SkinAnalysisOut, SkinStatusOut
from app.services.skin_triage.classifier import SkinClassifier, get_classifier
from app.services.skin_triage.image_utils import ALLOWED_FORMATS, ImageRejected, sanitize_image
from app.services.skin_triage.knowledge import get_knowledge_base
from app.services.skin_triage.pipeline import PIPELINE_VERSION
from app.services.skin_triage.service import analyze_and_store

router = APIRouter(tags=["Skin Triage"])


def get_skin_classifier() -> SkinClassifier:
    return get_classifier()


@router.get("/skin-triage/status", response_model=SkinStatusOut)
def skin_triage_status(
    _: User = Depends(get_current_user),
    clf: SkinClassifier = Depends(get_skin_classifier),
):
    return SkinStatusOut(
        classifier_available=clf.available,
        classifier_name=clf.name,
        classifier_reason=clf.reason,
        knowledge_entries=len(get_knowledge_base().entries),
        max_upload_bytes=settings.SKIN_MAX_UPLOAD_BYTES,
        allowed_types=sorted(f.lower() for f in ALLOWED_FORMATS),
        pipeline_version=PIPELINE_VERSION,
    )


@router.post(
    "/cases/{case_id}/skin-analysis",
    response_model=SkinAnalysisOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_skin_analysis(
    image: UploadFile = File(...),
    body_part: Optional[str] = Form(None, max_length=100),
    case: Case = Depends(get_case_for_user(write=True)),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    clf: SkinClassifier = Depends(get_skin_classifier),
):
    limit = settings.SKIN_MAX_UPLOAD_BYTES
    raw = await image.read(limit + 1)
    if len(raw) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"Image exceeds the {limit // 1_000_000} MB limit.")
    existing = db.query(SkinImageAnalysis).filter(SkinImageAnalysis.case_id == case.id).count()
    if existing >= settings.SKIN_MAX_ANALYSES_PER_CASE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Maximum number of images for this case reached.")
    try:
        clean = sanitize_image(raw)
    except ImageRejected as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return analyze_and_store(db, case, current_user, clean, clf, body_part)


@router.get("/cases/{case_id}/skin-analysis", response_model=list[SkinAnalysisOut])
def list_skin_analyses(case: Case = Depends(get_case_for_user), db: Session = Depends(get_db)):
    return (
        db.query(SkinImageAnalysis)
        .filter(SkinImageAnalysis.case_id == case.id)
        .order_by(SkinImageAnalysis.created_at.desc(), SkinImageAnalysis.id.desc())
        .all()
    )


@router.get("/cases/{case_id}/skin-analysis/{analysis_id}/image")
def get_skin_image(analysis_id: int, case: Case = Depends(get_case_for_user), db: Session = Depends(get_db)):
    row = (
        db.query(SkinImageAnalysis)
        .filter(SkinImageAnalysis.id == analysis_id, SkinImageAnalysis.case_id == case.id)
        .first()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    return Response(
        content=row.image_data, media_type=row.image_mime,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
