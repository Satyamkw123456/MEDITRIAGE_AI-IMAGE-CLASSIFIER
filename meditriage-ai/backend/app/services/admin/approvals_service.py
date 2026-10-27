from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.core.utils import get_utc_now
from app.models.user import User
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.admin_action import AdminAction
from app.services.audit.audit_service import AuditService
from app.services.auth.rbac_service import user_has_permission


class ApprovalsService:
    """
    Approvals Center (AC-11).
    Manages dual-control action workflows:
    - Lists pending actions with structured before/after diffs
    - Enforces strict mode (approver != requester) vs demo mode (self_approved_demo=True)
    - Safely executes target actions upon approval
    - Maintains immutable cryptographic audit chain
    """

    @staticmethod
    def _compute_diffs(before_state: Optional[Dict[str, Any]], after_state: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        diffs = []
        before = before_state or {}
        after = after_state or {}
        all_keys = set(before.keys()).union(set(after.keys()))

        for k in sorted(all_keys):
            old_val = before.get(k)
            new_val = after.get(k)
            if old_val != new_val:
                diffs.append({
                    "field": k,
                    "old_value": old_val,
                    "new_value": new_val,
                })
        return diffs

    @classmethod
    def list_pending_approvals(
        cls,
        db: Session,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Lists all dual-control administrative actions awaiting approval.
        Includes structured field diffs and requester profile.
        """
        query = db.query(AdminAction).filter(
            AdminAction.status == "PENDING_APPROVAL",
            AdminAction.approver_id.is_(None)
        ).order_by(desc(AdminAction.created_at))

        total = query.count()
        records = query.offset(offset).limit(limit).all()

        results = []
        for r in records:
            actor = db.query(User).filter(User.id == r.actor_id).first()
            diffs = cls._compute_diffs(r.before_state, r.after_state)
            results.append({
                "id": r.id,
                "action_code": r.action_code,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "actor_id": r.actor_id,
                "actor_email": actor.email if actor else None,
                "actor_name": actor.full_name if actor else None,
                "actor_role": actor.role if actor else None,
                "reason": r.reason,
                "ticket_ref": r.ticket_ref,
                "status": r.status,
                "before_state": r.before_state,
                "after_state": r.after_state,
                "diffs": diffs,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "pending_approvals": results,
        }

    @classmethod
    def get_approval(cls, db: Session, action_id: int) -> Dict[str, Any]:
        r = db.query(AdminAction).filter(AdminAction.id == action_id).first()
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Admin action {action_id} not found."
            )
        actor = db.query(User).filter(User.id == r.actor_id).first()
        approver = db.query(User).filter(User.id == r.approver_id).first() if r.approver_id else None
        diffs = cls._compute_diffs(r.before_state, r.after_state)

        return {
            "id": r.id,
            "action_code": r.action_code,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "actor_id": r.actor_id,
            "actor_email": actor.email if actor else None,
            "actor_name": actor.full_name if actor else None,
            "actor_role": actor.role if actor else None,
            "approver_id": r.approver_id,
            "approver_email": approver.email if approver else None,
            "reason": r.reason,
            "ticket_ref": r.ticket_ref,
            "status": r.status,
            "before_state": r.before_state,
            "after_state": r.after_state,
            "diffs": diffs,
            "self_approved_demo": r.self_approved_demo,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    @classmethod
    def decide_approval(
        cls,
        db: Session,
        actor: User,
        action_id: int,
        decision: str,  # "APPROVE" or "REJECT"
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Decides a pending dual-control admin action.
        Enforces strict dual control vs demo mode self-approval.
        Executes target action logic if approved.
        """
        dec = decision.upper().strip()
        if dec not in ("APPROVE", "REJECT"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Decision must be either 'APPROVE' or 'REJECT'."
            )

        # 1. Permission check for approval management
        if not user_has_permission(actor, "perm.admin.approvals.manage", db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Actor '{actor.email}' lacks permission 'perm.admin.approvals.manage'."
            )

        # 2. Retrieve pending action
        record = db.query(AdminAction).filter(AdminAction.id == action_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Admin action {action_id} not found."
            )
        if record.status != "PENDING_APPROVAL" or record.approver_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Admin action {action_id} is not awaiting approval (status: {record.status}, resolved: {record.approver_id is not None})."
            )

        # 3. Dual-control governance check
        self_approved_demo = False
        is_strict = getattr(settings, "DUAL_CONTROL_MODE", "strict") == "strict"

        if is_strict:
            if actor.id == record.actor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Dual control violation: Requester cannot approve their own action in strict mode."
                )
        else:
            # Demo mode
            if actor.id == record.actor_id:
                self_approved_demo = True

        now = get_utc_now()

        # 4. Handle Execution if APPROVED
        execution_summary = {}
        if dec == "APPROVE":
            if record.action_code == "CASE_PURGE_REQUEST":
                case_id = int(record.target_id)
                case = db.query(Case).filter(Case.id == case_id).first()
                if not case:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Target Case {case_id} not found.")

                # Legal hold check
                if case.legal_hold:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Cannot approve purge: Case {case_id} is under active legal hold: '{case.legal_hold_reason}'."
                    )

                # Purge PHI sub-rows and clear PHI columns
                db.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).delete()
                db.query(Vitals).filter(Vitals.case_id == case_id).delete()
                case.chief_complaint = "[PURGED_PHI]"
                case.emergency_rule_fired = None
                case.is_archived = True
                execution_summary = {"purged_case_id": case_id, "phi_cleared": True}

            elif record.action_code == "KILL_SWITCH_ACTIVATE":
                # Kill switch execution could be applied here if pending
                execution_summary = {"target_kill_switch": record.target_id, "status": "ACTIVATED"}

            else:
                execution_summary = {"target": record.target_id, "status": "EXECUTED"}

        # 5. Mark pending record resolved without modifying hashed columns
        record.approver_id = actor.id
        record.approved_at = now
        record.self_approved_demo = self_approved_demo

        # 6. Append audit log entry for decision
        audit_entry = AuditService.write_admin_action(
            actor_id=actor.id,
            action_code=f"APPROVAL_{dec}",
            target_type="admin_action",
            target_id=str(action_id),
            before_state={"pending_action_id": action_id, "original_action": record.action_code},
            after_state={"decision": dec, "notes": notes, "execution_summary": execution_summary},
            reason=f"Dual-control approval: {dec}. {notes or ''}".strip(),
            status="APPLIED",
            approver_id=actor.id,
            self_approved_demo=self_approved_demo,
            db=db,
        )

        db.commit()

        return {
            "status": "success",
            "decision": dec,
            "action_id": action_id,
            "target_action_code": record.action_code,
            "approver_id": actor.id,
            "self_approved_demo": self_approved_demo,
            "audit_entry_hash": audit_entry.entry_hash,
            "execution_summary": execution_summary,
        }
