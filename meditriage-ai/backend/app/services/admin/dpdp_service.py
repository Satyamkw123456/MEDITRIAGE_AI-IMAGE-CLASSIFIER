from typing import Dict, Any, Optional, Tuple
from datetime import timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.utils import get_utc_now
from app.models.user import User
from app.models.case import Case
from app.models.consent import ConsentLog
from app.models.domain_substrate import DataRightsRequest
from app.services.admin.admin_action_service import AdminActionService
from app.services.lifecycle.lifecycle_service import LifecycleService


class DPDPService:
    """
    Data Rights Queue Service complying with India's Digital Personal Data Protection (DPDP) Act 2023.
    Enforces identity verification, 72-hour SLA tracking, legal hold overrides,
    governed erasure/correction workflows, consent ledger audits, and version bumps.
    """

    @staticmethod
    def create_request(
        db: Session,
        user_id: int,
        request_type: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> DataRightsRequest:
        """
        Creates a new Data Rights Request with a mandatory 72-hour compliance SLA due date.
        """
        valid_types = {"ACCESS", "CORRECTION", "ERASURE", "WITHDRAWAL"}
        req_type = request_type.upper().strip()
        if req_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid request_type '{request_type}'. Must be one of {valid_types}."
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found."
            )

        now = get_utc_now()
        due_date = now + timedelta(hours=72)

        req = DataRightsRequest(
            user_id=user_id,
            request_type=req_type,
            status="PENDING",
            due_date=due_date,
            legal_hold=False,
            payload=payload or {},
            created_at=now,
            updated_at=now,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def list_requests(
        db: Session,
        status_filter: Optional[str] = None,
        request_type: Optional[str] = None,
        overdue_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Lists data rights requests with filtering and SLA urgency indicators.
        """
        query = db.query(DataRightsRequest)

        if status_filter:
            query = query.filter(DataRightsRequest.status == status_filter.upper())
        if request_type:
            query = query.filter(DataRightsRequest.request_type == request_type.upper())

        now = get_utc_now()
        if overdue_only:
            query = query.filter(
                DataRightsRequest.status.in_(["PENDING", "IN_PROGRESS"]),
                DataRightsRequest.due_date < now
            )

        total = query.count()
        records = (
            query.order_by(DataRightsRequest.due_date.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        results = []
        for r in records:
            time_left_hours = None
            is_overdue = False
            if r.due_date:
                r_due = r.due_date.replace(tzinfo=timezone.utc) if r.due_date.tzinfo is None else r.due_date
                diff = (r_due - now).total_seconds() / 3600.0
                time_left_hours = round(diff, 1)
                is_overdue = diff < 0 and r.status in ("PENDING", "IN_PROGRESS")

            user = db.query(User).filter(User.id == r.user_id).first()
            results.append({
                "id": r.id,
                "user_id": r.user_id,
                "user_email": user.email if user else None,
                "user_name": user.full_name if user else None,
                "request_type": r.request_type,
                "status": r.status,
                "due_date": r.due_date.isoformat() if r.due_date else None,
                "time_left_hours": time_left_hours,
                "is_overdue": is_overdue,
                "verified_by": r.verified_by,
                "closed_note": r.closed_note,
                "legal_hold": r.legal_hold,
                "legal_hold_reason": r.legal_hold_reason,
                "payload": r.payload,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "requests": results,
        }

    @staticmethod
    def get_request(db: Session, request_id: int) -> Dict[str, Any]:
        req = db.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Data Rights Request {request_id} not found."
            )
        user = db.query(User).filter(User.id == req.user_id).first()
        now = get_utc_now()
        req_due = req.due_date.replace(tzinfo=timezone.utc) if (req.due_date and req.due_date.tzinfo is None) else req.due_date
        diff = (req_due - now).total_seconds() / 3600.0 if req_due else None
        return {
            "id": req.id,
            "user_id": req.user_id,
            "user_email": user.email if user else None,
            "user_name": user.full_name if user else None,
            "request_type": req.request_type,
            "status": req.status,
            "due_date": req.due_date.isoformat() if req.due_date else None,
            "time_left_hours": round(diff, 1) if diff is not None else None,
            "is_overdue": (diff is not None and diff < 0 and req.status in ("PENDING", "IN_PROGRESS")),
            "verified_by": req.verified_by,
            "closed_note": req.closed_note,
            "legal_hold": req.legal_hold,
            "legal_hold_reason": req.legal_hold_reason,
            "payload": req.payload,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        }

    @staticmethod
    def verify_identity(
        db: Session,
        actor: User,
        request_id: int,
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Marks patient identity verified for a data rights request. Status progresses to IN_PROGRESS.
        """
        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            req = s.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
            if not req:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {request_id} not found.")
            if req.status != "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot verify identity: request is currently {req.status}, expected PENDING."
                )

            before = {"status": req.status, "verified_by": req.verified_by}
            req.verified_by = actor.id
            req.status = "IN_PROGRESS"
            req.updated_at = get_utc_now()
            after = {"status": req.status, "verified_by": req.verified_by}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_VERIFY_IDENTITY",
            required_permission="perm.admin.dpdp.manage",
            target_type="data_rights_request",
            target_id=str(request_id),
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )

    @staticmethod
    def execute_erasure(
        db: Session,
        actor: User,
        request_id: int,
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes DPDP erasure request.
        Blocks unconditionally if active legal hold is present on the request or any of the user's cases.
        """
        # Pre-check legal hold outside/inside transaction
        req = db.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {request_id} not found.")
        if req.legal_hold:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot erase data: Request {request_id} is under active legal hold: '{req.legal_hold_reason}'."
            )

        # Check user cases for legal hold
        user_cases_with_hold = db.query(Case).filter(
            Case.patient_id == req.user_id,
            Case.legal_hold == True
        ).all()
        if user_cases_with_hold:
            hold_ids = [c.id for c in user_cases_with_hold]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot erase data: Patient has cases under active legal hold: {hold_ids}."
            )

        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            r = s.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
            if r.status not in ("PENDING", "IN_PROGRESS"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Request {request_id} is already {r.status}."
                )

            before = {"status": r.status, "closed_note": r.closed_note}

            # Soft delete all active cases for this user via LifecycleService
            cases = s.query(Case).filter(Case.patient_id == r.user_id, Case.deleted_at.is_(None)).all()
            purged_cases = []
            for c in cases:
                LifecycleService.soft_delete_case(db=s, case_id=c.id, user=actor)
                purged_cases.append(c.id)

            r.status = "COMPLETED"
            r.closed_note = f"Erasure executed: {reason}. Cases soft-deleted: {purged_cases}"
            r.updated_at = get_utc_now()

            after = {
                "status": r.status,
                "closed_note": r.closed_note,
                "soft_deleted_cases": purged_cases,
            }
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_EXECUTE_ERASURE",
            required_permission="perm.admin.dpdp.manage",
            target_type="data_rights_request",
            target_id=str(request_id),
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )

    @staticmethod
    def execute_correction(
        db: Session,
        actor: User,
        request_id: int,
        corrections: Dict[str, Any],
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes DPDP personal data correction on user profile.
        """
        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            req = s.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
            if not req:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {request_id} not found.")

            target_user = s.query(User).filter(User.id == req.user_id).first()
            if not target_user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

            before = {
                "full_name": target_user.full_name,
                "phone_number": getattr(target_user, "phone_number", None),
                "emergency_contact": getattr(target_user, "emergency_contact", None),
                "status": req.status,
            }

            if "full_name" in corrections:
                target_user.full_name = corrections["full_name"]
            if "phone_number" in corrections and hasattr(target_user, "phone_number"):
                target_user.phone_number = corrections["phone_number"]
            if "emergency_contact" in corrections and hasattr(target_user, "emergency_contact"):
                target_user.emergency_contact = corrections["emergency_contact"]

            req.status = "COMPLETED"
            req.closed_note = f"Correction applied: {reason}"
            req.updated_at = get_utc_now()

            after = {
                "full_name": target_user.full_name,
                "phone_number": getattr(target_user, "phone_number", None),
                "emergency_contact": getattr(target_user, "emergency_contact", None),
                "status": req.status,
            }
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_EXECUTE_CORRECTION",
            required_permission="perm.admin.dpdp.manage",
            target_type="data_rights_request",
            target_id=str(request_id),
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )

    @staticmethod
    def reject_request(
        db: Session,
        actor: User,
        request_id: int,
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Rejects a data rights request with mandatory explanation.
        """
        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            req = s.query(DataRightsRequest).filter(DataRightsRequest.id == request_id).first()
            if not req:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {request_id} not found.")

            before = {"status": req.status, "closed_note": req.closed_note}
            req.status = "REJECTED"
            req.closed_note = reason
            req.updated_at = get_utc_now()
            after = {"status": req.status, "closed_note": req.closed_note}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_REJECT_REQUEST",
            required_permission="perm.admin.dpdp.manage",
            target_type="data_rights_request",
            target_id=str(request_id),
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )

    @staticmethod
    def toggle_legal_hold(
        db: Session,
        actor: User,
        target_type: str,  # "request" or "case"
        target_id: int,
        enabled: bool,
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Toggles legal hold flag on a case or data rights request.
        Mandatory reason required when enabling or disabling legal hold.
        """
        if not reason or len(reason.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A detailed legal reason is mandatory for modifying legal hold status."
            )

        target_type_clean = target_type.lower().strip()
        if target_type_clean not in ("request", "case"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="target_type must be either 'request' or 'case'."
            )

        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            if target_type_clean == "request":
                target = s.query(DataRightsRequest).filter(DataRightsRequest.id == target_id).first()
                if not target:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {target_id} not found.")
                before = {"legal_hold": target.legal_hold, "legal_hold_reason": target.legal_hold_reason}
                target.legal_hold = enabled
                target.legal_hold_reason = reason if enabled else None
                target.updated_at = get_utc_now()
                after = {"legal_hold": target.legal_hold, "legal_hold_reason": target.legal_hold_reason}
                return before, after
            else:
                target = s.query(Case).filter(Case.id == target_id).first()
                if not target:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case {target_id} not found.")
                before = {"legal_hold": target.legal_hold, "legal_hold_reason": target.legal_hold_reason}
                target.legal_hold = enabled
                target.legal_hold_reason = reason if enabled else None
                after = {"legal_hold": target.legal_hold, "legal_hold_reason": target.legal_hold_reason}
                return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_LEGAL_HOLD_TOGGLE",
            required_permission="perm.admin.dpdp.manage",
            target_type=target_type_clean,
            target_id=str(target_id),
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )

    @staticmethod
    def get_consent_ledger(
        db: Session,
        user_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Retrieves the immutable DPDP consent ledger with patient/caregiver signatures.
        """
        query = db.query(ConsentLog)
        if user_id:
            query = query.filter(ConsentLog.user_id == user_id)

        total = query.count()
        logs = query.order_by(desc(ConsentLog.created_at)).offset(offset).limit(limit).all()

        results = []
        for l in logs:
            user = db.query(User).filter(User.id == l.user_id).first()
            results.append({
                "id": l.id,
                "user_id": l.user_id,
                "user_email": user.email if user else None,
                "consent_type": l.consent_type,
                "version": l.version,
                "granted": l.granted,
                "granted_by": l.granted_by,
                "caregiver_name": l.caregiver_name,
                "caregiver_relationship": l.caregiver_relationship,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "entries": results,
        }

    @staticmethod
    def bump_consent_version(
        db: Session,
        actor: User,
        new_version: str,
        reason: str,
        approver: Optional[User] = None,
        stepup_verified: bool = True,
    ) -> Dict[str, Any]:
        """
        Bumps the active DPDP consent version policy and flags all non-admin users
        with requires_reconsent = True so they must re-accept on next access.
        """
        if not new_version or len(new_version.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="new_version string is required."
            )

        def _action(s: Session) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            # Update all active patient and clinician users to require reconsent
            count = s.query(User).filter(
                User.role.in_(["patient", "caregiver", "clinician"]),
                User.is_suspended == False
            ).update({"requires_reconsent": True}, synchronize_session=False)

            before = {"bumped_version": None, "users_flagged": 0}
            after = {"bumped_version": new_version.strip(), "users_flagged": count}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="DPDP_BUMP_CONSENT_VERSION",
            required_permission="perm.admin.dpdp.manage",
            target_type="system_policy",
            target_id="consent_policy",
            action_fn=_action,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=stepup_verified,
        )
