from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.case import Case
from app.models.triage import TriageResult
from app.models.user import User
from app.services.auth.rbac_service import get_utc_now
from app.services.admin.admin_action_service import AdminActionService
from app.services.lifecycle.lifecycle_service import LifecycleService
from app.services.audit.audit_service import AuditService


ALLOWED_CASE_METADATA_FIELDS = {
    "id",
    "patient_id",
    "status",
    "triage_level",
    "risk_score",
    "is_emergency_flag",
    "emergency_rule_fired",
    "red_flag_retracted",
    "created_at",
    "assigned_clinician_id",
    "acknowledged_at",
    "legal_hold",
    "is_archived",
    "deleted_at",
    "purge_after",
}


class CaseOversightService:
    """
    AC-05: Case & Queue Oversight Service.
    Enforces strict zero-PHI allowlist on metadata-only search endpoints.
    Provides governed clinical queue worklists and administrative case mutations.
    """

    @classmethod
    def search_cases_metadata(
        cls,
        db: Session,
        status_filter: Optional[str] = None,
        triage_level: Optional[str] = None,
        is_emergency: Optional[bool] = None,
        assigned_clinician_id: Optional[int] = None,
        legal_hold: Optional[bool] = None,
        is_archived: Optional[bool] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Metadata-Only Case Search.
        Strict field-allowlist enforced: zero PHI fields (chief_complaint, symptoms, names)
        are queried or serialized in the response payload.
        """
        q = db.query(Case)

        if status_filter:
            q = q.filter(Case.status == status_filter)
        if is_emergency is not None:
            q = q.filter(Case.is_emergency_flag == is_emergency)
        if assigned_clinician_id is not None:
            q = q.filter(Case.assigned_clinician_id == assigned_clinician_id)
        if legal_hold is not None:
            q = q.filter(Case.legal_hold == legal_hold)
        if is_archived is not None:
            q = q.filter(Case.is_archived == is_archived)
        if date_from:
            q = q.filter(Case.created_at >= date_from)
        if date_to:
            q = q.filter(Case.created_at <= date_to)

        total = q.count()
        cases = q.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

        results = []
        for c in cases:
            # Query current triage result for metadata
            t_res = (
                db.query(TriageResult)
                .filter(TriageResult.case_id == c.id)
                .filter(TriageResult.is_current.in_(["true", "True"]))
                .first()
            )

            raw_item = {
                "id": c.id,
                "patient_id": c.patient_id,
                "status": c.status,
                "triage_level": t_res.triage_level if t_res else "Pending",
                "risk_score": t_res.risk_score if t_res else None,
                "is_emergency_flag": c.is_emergency_flag,
                "emergency_rule_fired": c.emergency_rule_fired,
                "red_flag_retracted": c.red_flag_retracted,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "assigned_clinician_id": c.assigned_clinician_id,
                "acknowledged_at": c.acknowledged_at.isoformat() if c.acknowledged_at else None,
                "legal_hold": c.legal_hold,
                "is_archived": c.is_archived,
                "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
                "purge_after": c.purge_after.isoformat() if c.purge_after else None,
            }

            # Enforce strict allowlist filter
            filtered_item = {k: v for k, v in raw_item.items() if k in ALLOWED_CASE_METADATA_FIELDS}
            results.append(filtered_item)

        return results, total

    @classmethod
    def metadata_only_search(
        cls,
        db: Session,
        case_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        triage_level: Optional[str] = None,
        is_emergency_flag: Optional[bool] = None,
        status: Optional[str] = None,
        assigned_clinician_id: Optional[int] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_desc: bool = True,
        limit: int = 50,
        offset: int = 0,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Zero-PHI metadata-only search. Returns strictly approved metadata fields.
        Chief complaints, symptoms, patient names, and demographic details are never returned.
        """
        q = db.query(Case)

        if case_id is not None:
            q = q.filter(Case.id == case_id)
        if patient_id is not None:
            q = q.filter(Case.patient_id == patient_id)
        if status:
            q = q.filter(Case.status == status)
        if is_emergency_flag is not None:
            q = q.filter(Case.is_emergency_flag == is_emergency_flag)
        if assigned_clinician_id is not None:
            q = q.filter(Case.assigned_clinician_id == assigned_clinician_id)
        if created_after:
            q = q.filter(Case.created_at >= created_after)
        if created_before:
            q = q.filter(Case.created_at <= created_before)

        total = q.count()
        cases = q.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()

        results = []
        for c in cases:
            t_res = (
                db.query(TriageResult)
                .filter(TriageResult.case_id == c.id)
                .filter(TriageResult.is_current.in_(["true", "True"]))
                .first()
            )

            raw_item = {
                "id": c.id,
                "patient_id": c.patient_id,
                "status": c.status,
                "triage_level": t_res.triage_level if t_res else "Pending",
                "risk_score": t_res.risk_score if t_res else None,
                "is_emergency_flag": c.is_emergency_flag,
                "emergency_rule_fired": c.emergency_rule_fired,
                "red_flag_retracted": c.red_flag_retracted,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "assigned_clinician_id": c.assigned_clinician_id,
                "acknowledged_at": c.acknowledged_at.isoformat() if c.acknowledged_at else None,
                "legal_hold": c.legal_hold,
                "is_archived": c.is_archived,
                "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
                "purge_after": c.purge_after.isoformat() if c.purge_after else None,
            }

            if triage_level and raw_item["triage_level"] != triage_level:
                continue

            filtered_item = {k: v for k, v in raw_item.items() if k in ALLOWED_CASE_METADATA_FIELDS}
            results.append(filtered_item)

        return {
            "cases": results,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @classmethod
    def get_worklists(
        cls,
        db: Session,
        unreviewed_hours: int = 24,
        unreviewed_threshold_hours: Optional[int] = None,
        confidence_threshold: float = 0.60,
        **kwargs,
    ) -> Dict[str, Any]:
        """Returns worklists as queries."""
        hours = unreviewed_threshold_hours if unreviewed_threshold_hours is not None else unreviewed_hours
        now = get_utc_now()
        threshold_time = now - timedelta(hours=hours)

        # 1. Unreviewed > N hours (not acknowledged and not reviewed)
        unreviewed = (
            db.query(Case)
            .filter(Case.deleted_at.is_(None))
            .filter(Case.acknowledged_at.is_(None))
            .filter(Case.created_at < threshold_time)
            .all()
        )

        # 2. Low-confidence backlog (risk_score < confidence_threshold on current triage)
        low_confidence_triage = (
            db.query(TriageResult)
            .filter(TriageResult.is_current.in_(["true", "True"]))
            .filter(TriageResult.risk_score < confidence_threshold)
            .all()
        )
        low_conf_case_ids = {t.case_id for t in low_confidence_triage}
        low_confidence_cases = (
            db.query(Case)
            .filter(Case.id.in_(low_conf_case_ids))
            .filter(Case.deleted_at.is_(None))
            .all()
        )

        # 3. Red-flag retractions
        retractions = (
            db.query(Case)
            .filter(Case.red_flag_retracted == True)
            .filter(Case.deleted_at.is_(None))
            .all()
        )

        # 4. Stuck in processing (submitted for > 2 hours without triage)
        two_hours_ago = now - timedelta(hours=2)
        stuck = (
            db.query(Case)
            .filter(Case.status == "submitted")
            .filter(Case.created_at < two_hours_ago)
            .filter(Case.deleted_at.is_(None))
            .all()
        )

        # 5. Purge-pending (soft-deleted cases awaiting retention expiration)
        purge_pending = (
            db.query(Case)
            .filter(Case.deleted_at.isnot(None))
            .all()
        )

        def to_meta(cases_list):
            out = []
            for c in cases_list:
                out.append({
                    "id": c.id,
                    "patient_id": c.patient_id,
                    "status": c.status,
                    "is_emergency_flag": c.is_emergency_flag,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "assigned_clinician_id": c.assigned_clinician_id,
                    "legal_hold": c.legal_hold,
                })
            return out

        worklists_dict = {
            "unreviewed_cases": to_meta(unreviewed[:20]),
            "low_confidence_backlog": to_meta(low_confidence_cases[:20]),
            "red_flag_retractions": to_meta(retractions[:20]),
            "stuck_cases": to_meta(stuck[:20]),
            "purge_pending": to_meta(purge_pending[:20]),
        }

        return {
            "summary": {
                "unreviewed_count": len(unreviewed),
                "low_confidence_count": len(low_confidence_cases),
                "red_flag_retractions_count": len(retractions),
                "stuck_in_processing_count": len(stuck),
                "purge_pending_count": len(purge_pending),
            },
            "worklists": worklists_dict,
            "unreviewed": to_meta(unreviewed[:20]),
            "low_confidence": to_meta(low_confidence_cases[:20]),
            "red_flag_retractions": to_meta(retractions[:20]),
            "stuck_in_processing": to_meta(stuck[:20]),
            "purge_pending": to_meta(purge_pending[:20]),
        }

    @classmethod
    def reassign_clinician(
        cls,
        case_id: int,
        actor: User,
        db: Session,
        reason: str = "",
        clinician_id: Optional[int] = None,
        new_clinician_id: Optional[int] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        target_clinician_id = new_clinician_id if new_clinician_id is not None else clinician_id
        if target_clinician_id is None:
            raise HTTPException(status_code=400, detail="Target clinician ID required.")

        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")

        clinician = db.query(User).filter(User.id == target_clinician_id).first()
        if not clinician or clinician.role != "clinician":
            raise HTTPException(status_code=400, detail="Target user must be a valid clinician.")

        def action_fn(s: Session):
            before = {"assigned_clinician_id": case.assigned_clinician_id}
            case.assigned_clinician_id = target_clinician_id
            s.flush()
            after = {"assigned_clinician_id": target_clinician_id}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CASE_REASSIGN_CLINICIAN",
            required_permission="perm.admin.cases.oversight",
            target_type="case",
            target_id=str(case_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
        )

    @classmethod
    def force_reopen_review(
        cls,
        case_id: int,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")

        def action_fn(s: Session):
            before = {"status": case.status, "acknowledged_at": case.acknowledged_at.isoformat() if case.acknowledged_at else None}
            case.status = "submitted"
            case.acknowledged_at = None
            s.flush()
            after = {"status": "submitted", "acknowledged_at": None}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CASE_FORCE_REOPEN",
            required_permission="perm.admin.cases.oversight",
            target_type="case",
            target_id=str(case_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
        )

    force_reopen_case = force_reopen_review

    @classmethod
    def restore_case(
        cls,
        case_id: int,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        """Restores a soft-deleted case via Cycle 2's LifecycleService."""
        def action_fn(s: Session):
            restored_case = LifecycleService.restore_case(db=s, case_id=case_id, user=actor, reason=reason)
            return {"deleted_at": "soft_deleted"}, {"status": restored_case.status, "deleted_at": None}

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CASE_RESTORE",
            required_permission="perm.cases.restore",
            target_type="case",
            target_id=str(case_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )

    @classmethod
    def archive_case(
        cls,
        case_id: int,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")

        def action_fn(s: Session):
            before = {"is_archived": case.is_archived}
            case.is_archived = True
            case.status = "archived"
            s.flush()
            after = {"is_archived": True, "status": "archived"}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CASE_ARCHIVE",
            required_permission="perm.admin.cases.oversight",
            target_type="case",
            target_id=str(case_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
        )

    @classmethod
    def request_purge_case(
        cls,
        case_id: int,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Requests purge of case PHI.
        CRITICAL INVARIANT: Active legal_hold BLOCKS purge request immediately!
        Creates a PENDING_APPROVAL admin action for dual-control sign-off.
        """
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")

        # Hard invariant: Legal hold BLOCKS purge!
        if case.legal_hold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Purge blocked: Case #{case_id} is under mandatory legal hold ({case.legal_hold_reason or 'No reason provided'})."
            )

        # Record PENDING_APPROVAL admin action
        record = AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="CASE_PURGE_REQUEST",
            target_type="case",
            target_id=str(case_id),
            before_state={"case_id": case_id, "status": case.status},
            after_state={"purge_requested": True},
            reason=reason,
            status="PENDING_APPROVAL",
            db=db,
        )
        db.commit()

        return {
            "status": "pending_approval",
            "admin_action_id": record.id,
            "message": "Purge request submitted for dual-control approval.",
            "case_id": case_id,
        }

    request_case_purge = request_purge_case

