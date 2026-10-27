from typing import Optional, Any
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.case import Case
from app.models.patient import PatientProfile
from app.models.domain_substrate import CaregiverLink
from app.models.support_ops import AccessHistoryLog
from app.services.patient.caregiver_service import CaregiverService


def _authorize_case(
    case_id: int,
    db: Session,
    current_user: User,
    write: bool = False,
    include_deleted: bool = False,
) -> Case:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID {case_id} not found.",
        )

    # Soft-deletion check
    if case.deleted_at is not None:
        if not include_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID {case_id} not found.",
            )
        patient_profile = (
            db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()
        )
        is_owner = False
        if current_user.role == "patient":
            is_owner = (case.patient_id == current_user.id) or (
                patient_profile and patient_profile.user_id == current_user.id
            )
        has_restore_perm = current_user.role in ("admin", "super_admin", "ops_admin")
        if not (is_owner or has_restore_perm):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID {case_id} not found.",
            )

    patient_profile = (
        db.query(PatientProfile).filter(PatientProfile.id == case.patient_id).first()
    )
    patient_user_id = (
        patient_profile.user_id
        if (patient_profile and patient_profile.user_id)
        else case.patient_id
    )

    # 1. Patient check (owns case)
    if current_user.role == "patient":
        is_owner = (case.patient_id == current_user.id) or (
            patient_profile and patient_profile.user_id == current_user.id
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID {case_id} not found.",
            )
        return case

    # 2. Caregiver check (active link required; write requires amend permission)
    elif current_user.role == "caregiver":
        candidate_ids = [case.patient_id]
        if patient_profile and patient_profile.user_id:
            candidate_ids.append(patient_profile.user_id)

        link = (
            db.query(CaregiverLink)
            .filter(
                CaregiverLink.caregiver_id == current_user.id,
                CaregiverLink.patient_id.in_(candidate_ids),
            )
            .first()
        )
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID {case_id} not found.",
            )

        if write:
            if not CaregiverService.check_amend_permission(
                db, caregiver_id=current_user.id, patient_id=case.patient_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caregiver does not have permission to amend this case.",
                )
        return case

    # 3. Clinician / Admin check (authorized with logging)
    elif current_user.role in ("clinician", "admin", "super_admin", "ops_admin"):
        try:
            log = AccessHistoryLog(
                case_id=case.id,
                patient_id=patient_user_id,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                access_type="WRITE_MUTATION" if write else "CLINICAL_REVIEW",
                reason="Clinical workspace review",
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        return case

    # 4. Default-deny: unknown role
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: unauthorized role.",
        )


class CaseAuthorizer:
    def __init__(self, write: bool = False, include_deleted: bool = False):
        self.write = write
        self.include_deleted = include_deleted
        self.__name__ = "get_case_for_user"

    def __call__(
        self,
        case_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        *,
        write: Optional[bool] = None,
        include_deleted: Optional[bool] = None,
    ) -> Any:
        # If invoked at route-definition time as a factory, e.g. get_case_for_user(write=True)
        if case_id is None:
            w = self.write if write is None else write
            inc = self.include_deleted if include_deleted is None else include_deleted
            return CaseAuthorizer(write=w, include_deleted=inc)

        # Invoked by FastAPI at request time
        w = self.write if write is None else write
        inc = self.include_deleted if include_deleted is None else include_deleted
        return _authorize_case(
            case_id=case_id,
            db=db,
            current_user=current_user,
            write=w,
            include_deleted=inc,
        )


get_case_for_user = CaseAuthorizer()
