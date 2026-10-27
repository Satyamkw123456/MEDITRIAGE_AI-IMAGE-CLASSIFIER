from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import case, asc

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.support_ops import EmergencyResource
from app.services.patient.emergency_card_service import EmergencyCardService
from app.services.patient.caregiver_service import CaregiverService

router = APIRouter()


# ---------------------------------------------------------------------
# Emergency Card Schemas
# ---------------------------------------------------------------------

class EmergencyCardMintInput(BaseModel):
    ttl_days: int = Field(default=30, ge=1, le=365)
    medications: Optional[List[str]] = None
    baseline_summary: Optional[str] = None
    allergies: Optional[List[str]] = None
    blood_group: Optional[str] = None


class EmergencyCardRevokeInput(BaseModel):
    card_id: Optional[int] = None


class CaregiverInviteInput(BaseModel):
    caregiver_email: EmailStr
    relationship: str = Field(default="Caregiver", min_length=2, max_length=100)
    permissions: List[str] = Field(default=["view", "amend"])
    can_amend: bool = True


# ---------------------------------------------------------------------
# Emergency Card Endpoints (Patient Authenticated)
# ---------------------------------------------------------------------

@router.post("/patient/emergency-card/mint")
def mint_emergency_card(
    data: EmergencyCardMintInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Issues a new expiring, revocable Emergency Card for the patient.
    Stores hashed token and returns raw token for QR generation.
    """
    return EmergencyCardService.mint_card(
        db=db,
        user_id=current_user.id,
        ttl_days=data.ttl_days,
        custom_meds=data.medications,
        custom_summary=data.baseline_summary,
        custom_allergies=data.allergies,
        custom_blood_group=data.blood_group
    )


@router.post("/patient/emergency-card/revoke")
def revoke_emergency_card(
    data: Optional[EmergencyCardRevokeInput] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revokes the patient's active emergency card."""
    card_id = data.card_id if data else None
    return EmergencyCardService.revoke_card(db=db, user_id=current_user.id, card_id=card_id)


@router.get("/patient/emergency-card")
def get_patient_emergency_card(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns active emergency card metadata for the patient."""
    card = EmergencyCardService.get_patient_active_card(db=db, user_id=current_user.id)
    if not card:
        return {"has_active_card": False, "card": None}
    return {"has_active_card": True, "card": card}


# ---------------------------------------------------------------------
# Public Emergency Card Endpoint (Rate Limited, Zero Token State Leakage)
# ---------------------------------------------------------------------

@router.get("/public/emergency-card/{token}")
def get_public_emergency_card(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Public read-only lookup endpoint for emergency responders.
    Rate-limited (HTTP 429).
    Expired, revoked, or non-existent tokens return HTTP 404 (no information leakage).
    Every access is transparently recorded in AccessHistoryLog.
    """
    from app.core.rate_limit import get_client_ip
    client_ip = get_client_ip(request)

    return EmergencyCardService.get_public_card(
        db=db,
        raw_token=token,
        client_ip=client_ip
    )


# ---------------------------------------------------------------------
# Caregiver Linking & Permission Scoping Endpoints
# ---------------------------------------------------------------------

@router.post("/patient/caregivers/invite")
def invite_caregiver(
    data: CaregiverInviteInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Patient links or invites a caregiver and defines their permission scope
    (e.g., view-only vs amend rights).
    """
    return CaregiverService.invite_or_link_caregiver(
        db=db,
        patient_id=current_user.id,
        caregiver_email=str(data.caregiver_email),
        relationship=data.relationship,
        permissions=data.permissions,
        can_amend=data.can_amend
    )


@router.get("/patient/caregivers")
def list_patient_caregivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all caregivers authorized for the logged-in patient."""
    return CaregiverService.list_patient_caregivers(db=db, patient_id=current_user.id)


@router.delete("/patient/caregivers/{link_id}")
def revoke_caregiver(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revokes authorization for a linked caregiver."""
    return CaregiverService.revoke_caregiver_link(
        db=db,
        patient_id=current_user.id,
        link_id=link_id
    )


@router.get("/caregiver/patients")
def list_caregiver_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Caregiver views all patients they are authorized to support."""
    return CaregiverService.list_caregiver_patients(db=db, caregiver_id=current_user.id)


# ---------------------------------------------------------------------
# Consumer Resource Directory (Pune-First Ordering)
# ---------------------------------------------------------------------

@router.get("/public/resources")
def list_public_emergency_resources(
    db: Session = Depends(get_db)
):
    """
    Returns public verified emergency services and helplines.
    Ordered with Pune/PCMC local facilities first, followed by national/regional resources.
    Includes last_verified_at timestamp.
    """
    # Order Pune / PCMC first, then alphabetically by category and name
    pune_priority = case(
        (EmergencyResource.city_region.ilike("%pune%"), 0),
        (EmergencyResource.city_region.ilike("%pcmc%"), 0),
        else_=1
    )

    resources = (
        db.query(EmergencyResource)
        .filter(EmergencyResource.is_active == True)
        .order_by(pune_priority, asc(EmergencyResource.category), asc(EmergencyResource.name))
        .all()
    )

    # Seed default Pune and National emergency resources if database table is empty
    if not resources:
        default_resources = [
            EmergencyResource(
                name="Sassoon General Hospital & Trauma Center",
                category="hospital",
                phone_number="+91 20 2612 8000",
                city_region="Pune, Maharashtra",
                is_active=True
            ),
            EmergencyResource(
                name="Pune Municipal Corporation (PMC) Emergency Ambulance (108)",
                category="ambulance",
                phone_number="108",
                city_region="Pune, Maharashtra",
                is_active=True
            ),
            EmergencyResource(
                name="National Emergency Support Center",
                category="helpline",
                phone_number="112",
                city_region="National",
                is_active=True
            ),
            EmergencyResource(
                name="Senior Citizen Helpline (National)",
                category="helpline",
                phone_number="14567",
                city_region="National / Maharashtra",
                is_active=True
            ),
            EmergencyResource(
                name="KEM Hospital Pune Emergency Room",
                category="hospital",
                phone_number="+91 20 6603 7300",
                city_region="Pune, Maharashtra",
                is_active=True
            )
        ]
        for r in default_resources:
            db.add(r)
        db.commit()
        resources = (
            db.query(EmergencyResource)
            .filter(EmergencyResource.is_active == True)
            .order_by(pune_priority, asc(EmergencyResource.category), asc(EmergencyResource.name))
            .all()
        )

    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "phone_number": r.phone_number,
            "city_region": r.city_region,
            "last_verified_at": r.last_verified_at.isoformat() if r.last_verified_at else r.created_at.isoformat(),
            "is_pune_local": any(loc in r.city_region.lower() for loc in ["pune", "pcmc"]),
            "is_active": r.is_active
        }
        for r in resources
    ]
