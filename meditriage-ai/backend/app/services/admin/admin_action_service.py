from typing import Dict, Any, Optional, Callable, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User
from app.models.rbac import Permission
from app.services.auth.rbac_service import user_has_permission
from app.services.audit.audit_service import AuditService


class AdminActionService:
    """
    Operational Admin Action Engine.
    Enforces: permission check -> step-up -> reason requirement -> dual-control -> single transaction execution -> admin_actions row write.
    """

    @staticmethod
    def execute_admin_action(
        actor: User,
        action_code: str,
        required_permission: str,
        target_type: str,
        target_id: str,
        action_fn: Callable[[Session], Tuple[Dict[str, Any] | None, Dict[str, Any] | None]],
        db: Session,
        reason: Optional[str] = None,
        approver: Optional[User] = None,
        ticket_ref: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        stepup_verified: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes a governed administrative action within a single database transaction.
        """
        # 1. Permission check
        if not user_has_permission(actor, required_permission, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Admin action forbidden: actor '{actor.email}' lacks required permission '{required_permission}'."
            )

        # 2. Check permission metadata
        perm = db.query(Permission).filter(Permission.code == required_permission).first()
        is_sensitive = perm.is_sensitive if perm else False
        requires_stepup = perm.requires_stepup if perm else False
        requires_dual_control = perm.requires_dual_control if perm else False

        # Step-up verification check for sensitive actions
        if requires_stepup and not stepup_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Step-up authentication (MFA verification) is required for sensitive administrative action."
            )

        # Reason requirement check for sensitive actions
        if is_sensitive and not reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Operational reason is mandatory for sensitive administrative actions."
            )

        # Dual control check
        self_approved_demo = False
        approver_id = None
        if requires_dual_control:
            if settings.DUAL_CONTROL_MODE == "strict":
                if not approver or approver.id == actor.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Dual control violation: Requester cannot be approver under strict dual control mode."
                    )
                if not user_has_permission(approver, required_permission, db):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Approver '{approver.email}' lacks required permission '{required_permission}'."
                    )
                approver_id = approver.id
            else:
                # Demo mode: requester can approve after 2-step confirmation
                approver_id = approver.id if approver else actor.id
                if approver_id == actor.id:
                    self_approved_demo = True

        # Execute action function in transaction
        try:
            before_state, after_state = action_fn(db)

            # Record admin action in audit log
            record = AuditService.write_admin_action(
                actor_id=actor.id,
                action_code=action_code,
                target_type=target_type,
                target_id=target_id,
                before_state=before_state,
                after_state=after_state,
                reason=reason,
                ticket_ref=ticket_ref,
                status="APPLIED",
                approver_id=approver_id,
                idempotency_key=idempotency_key,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
                self_approved_demo=self_approved_demo,
                db=db,
            )

            db.commit()
            return {
                "status": "success",
                "admin_action_id": record.id,
                "action_code": action_code,
                "entry_hash": record.entry_hash,
                "self_approved_demo": self_approved_demo,
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Admin action execution failed: {e}"
            )
