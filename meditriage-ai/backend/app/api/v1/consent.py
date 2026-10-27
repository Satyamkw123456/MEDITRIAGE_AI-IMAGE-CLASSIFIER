from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.user import User
from app.models.consent import ConsentLog
from app.schemas.consent import ConsentRecordCreate, ConsentLogOut, ConsentStatusOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/consent", tags=["Consent & Medical Disclaimer"])


@router.post("/record", response_model=ConsentLogOut, status_code=status.HTTP_201_CREATED)
def record_consent(
    payload: ConsentRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records digital informed consent in compliance with India's Digital Personal Data Protection Act (DPDP), 2023.
    """
    client_ip = request.client.host if request.client else None

    # Validate caregiver details if consent granted by caregiver
    if payload.granted_by == "caregiver" and not payload.caregiver_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Caregiver name is required when consent is recorded on behalf of a patient.",
        )

    consent_entry = ConsentLog(
        user_id=current_user.id,
        consent_type=payload.consent_type,
        version=payload.version,
        granted=payload.granted,
        granted_by=payload.granted_by,
        caregiver_name=payload.caregiver_name,
        caregiver_relationship=payload.caregiver_relationship,
        ip_address=client_ip,
    )
    db.add(consent_entry)
    db.commit()
    db.refresh(consent_entry)
    return consent_entry


@router.get("/status", response_model=ConsentStatusOut)
def get_consent_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Checks if the active authenticated user has an active, valid consent on record.
    """
    latest_consent = (
        db.query(ConsentLog)
        .filter(ConsentLog.user_id == current_user.id)
        .order_by(ConsentLog.created_at.desc())
        .first()
    )

    has_consent = bool(latest_consent and latest_consent.granted)
    return ConsentStatusOut(
        has_consent=has_consent,
        latest_consent=latest_consent,
    )


@router.get("/history", response_model=List[ConsentLogOut])
def get_consent_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves all historical consent audit log entries for the active authenticated user.
    """
    logs = (
        db.query(ConsentLog)
        .filter(ConsentLog.user_id == current_user.id)
        .order_by(ConsentLog.created_at.desc())
        .all()
    )
    return logs
