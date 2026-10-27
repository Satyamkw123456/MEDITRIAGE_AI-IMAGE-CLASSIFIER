from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.domain_substrate import CaregiverLink
from app.models.user import User
from app.models.patient import PatientProfile
from app.core.utils import get_utc_now
from app.services.audit.audit_service import AuditService


class CaregiverService:
    """
    Manages caregiver invitations, relationships, and permission scoping
    (e.g., view-only vs amend rights) with proxy intake verification.
    """

    @classmethod
    def invite_or_link_caregiver(
        cls,
        db: Session,
        patient_id: int,
        caregiver_email: str,
        relationship: str = "Caregiver",
        permissions: Optional[List[str]] = None,
        can_amend: bool = True
    ) -> Dict[str, Any]:
        """
        Links an existing caregiver or records an invitation for a caregiver by email,
        storing scoped permissions (e.g. view-only vs amend).
        """
        # Validate patient
        patient = db.query(User).filter(User.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient user not found.")

        # Find or look up caregiver
        caregiver = db.query(User).filter(User.email == caregiver_email.lower().strip()).first()
        if not caregiver:
            from app.core.security import get_password_hash
            caregiver = User(
                email=caregiver_email.lower().strip(),
                name=caregiver_email.split("@")[0].replace(".", " ").title(),
                role="caregiver",
                password_hash=get_password_hash("Caregiver123!")
            )
            db.add(caregiver)
            db.commit()
            db.refresh(caregiver)

        if caregiver.id == patient_id:
            raise HTTPException(status_code=400, detail="Patient cannot be linked as their own caregiver.")

        # Scoped permissions: default to ["view", "amend"] or ["view"] if can_amend is False
        perms = permissions if permissions is not None else (["view", "amend"] if can_amend else ["view"])
        effective_can_amend = "amend" in perms

        now_iso = get_utc_now().isoformat()
        link_payload = {
            "relationship": relationship,
            "permissions": perms,
            "can_amend": effective_can_amend,
            "status": "ACTIVE",
            "invited_at": now_iso,
            "patient_name": patient.name or patient.email,
            "caregiver_name": caregiver.name or caregiver.email
        }

        # Check existing link
        existing_link = db.query(CaregiverLink).filter(
            CaregiverLink.patient_id == patient_id,
            CaregiverLink.caregiver_id == caregiver.id
        ).first()

        if existing_link:
            existing_link.payload = link_payload
            existing_link.updated_at = get_utc_now()
            link = existing_link
        else:
            link = CaregiverLink(
                patient_id=patient_id,
                caregiver_id=caregiver.id,
                payload=link_payload,
                created_at=get_utc_now(),
                updated_at=get_utc_now()
            )
            db.add(link)

        # Audit action
        AuditService.write_admin_action(
            actor_id=patient_id,
            action_code="CAREGIVER_LINK_ESTABLISHED",
            target_type="caregiver_link",
            target_id=str(link.id if link.id else "pending"),
            db=db,
            after_state=link_payload,
            reason=f"Patient linked caregiver {caregiver.email} with scope: {perms}"
        )

        db.commit()
        db.refresh(link)

        return {
            "link_id": link.id,
            "patient_id": patient_id,
            "caregiver_id": caregiver.id,
            "caregiver_email": caregiver.email,
            "caregiver_name": caregiver.name,
            "relationship": relationship,
            "permissions": perms,
            "can_amend": effective_can_amend,
            "status": "ACTIVE"
        }

    @classmethod
    def list_patient_caregivers(cls, db: Session, patient_id: int) -> List[Dict[str, Any]]:
        """Lists all caregivers linked to a patient with their permission scopes."""
        links = db.query(CaregiverLink).filter(CaregiverLink.patient_id == patient_id).all()
        results = []
        for l in links:
            cg = db.query(User).filter(User.id == l.caregiver_id).first()
            p = l.payload or {}
            results.append({
                "link_id": l.id,
                "caregiver_id": l.caregiver_id,
                "caregiver_name": cg.name if cg else p.get("caregiver_name", "Unknown"),
                "caregiver_email": cg.email if cg else "unknown@caregiver.org",
                "relationship": p.get("relationship", "Caregiver"),
                "permissions": p.get("permissions", ["view"]),
                "can_amend": p.get("can_amend", False),
                "created_at": l.created_at.isoformat() if l.created_at else None
            })
        return results

    @classmethod
    def revoke_caregiver_link(cls, db: Session, patient_id: int, link_id: int) -> Dict[str, Any]:
        """Revokes a caregiver link by the patient."""
        link = db.query(CaregiverLink).filter(
            CaregiverLink.id == link_id,
            CaregiverLink.patient_id == patient_id
        ).first()

        if not link:
            raise HTTPException(status_code=404, detail="Caregiver link not found.")

        before_state = link.payload
        db.delete(link)

        AuditService.write_admin_action(
            actor_id=patient_id,
            action_code="CAREGIVER_LINK_REVOKED",
            target_type="caregiver_link",
            target_id=str(link_id),
            db=db,
            before_state=before_state,
            reason="Patient revoked caregiver authorization."
        )
        db.commit()

        return {"status": "REVOKED", "link_id": link_id}

    @classmethod
    def list_caregiver_patients(cls, db: Session, caregiver_id: int) -> List[Dict[str, Any]]:
        """Lists all patients a caregiver is linked to and can act for."""
        links = db.query(CaregiverLink).filter(CaregiverLink.caregiver_id == caregiver_id).all()
        results = []
        for l in links:
            patient = db.query(User).filter(User.id == l.patient_id).first()
            profile = db.query(PatientProfile).filter(PatientProfile.user_id == l.patient_id).first()
            p = l.payload or {}
            results.append({
                "link_id": l.id,
                "patient_id": l.patient_id,
                "patient_name": patient.name if patient else "Patient",
                "patient_age": profile.age if profile else 68,
                "patient_sex": profile.sex if profile else "Female",
                "relationship": p.get("relationship", "Family Member"),
                "permissions": p.get("permissions", ["view"]),
                "can_amend": p.get("can_amend", False)
            })
        return results

    @classmethod
    def check_amend_permission(cls, db: Session, caregiver_id: int, patient_id: int) -> bool:
        """
        Enforces Cycle 2 / Cycle 13 permission scoping.
        Returns True if caregiver has explicit 'amend' permission on the patient's link,
        otherwise raises 403 Forbidden.
        """
        # Resolve patient user ID if case.patient_id is PatientProfile.id
        candidate_ids = [patient_id]
        profile = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if profile and profile.user_id:
            candidate_ids.append(profile.user_id)

        link = db.query(CaregiverLink).filter(
            CaregiverLink.caregiver_id == caregiver_id,
            CaregiverLink.patient_id.in_(candidate_ids)
        ).first()

        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Caregiver not authorized to access or amend this patient's records."
            )

        payload = link.payload or {}
        can_amend = payload.get("can_amend", False)
        perms = payload.get("permissions", [])

        if not can_amend or "amend" not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Caregiver permission scoping prohibits amending records (view-only access granted by patient)."
            )

        return True
