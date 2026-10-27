from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.support_ops import ImpersonationSession, BreakGlassReveal, AccessHistoryLog
from app.models.user import User
from app.models.case import Case
from app.core.security import create_access_token
from app.core.utils import get_utc_now
from app.services.audit.audit_service import AuditService


class SupportToolsService:
    """
    AC-07: Support Tools Service.
    Impersonation ("view as") sessions with TTL <= 15m and hard read-only enforcement,
    Break-glass case PHI reveal with TTL <= 10m and auditor transparency,
    and patient-facing access history logging.
    """

    # ------------------------------------------------------------------------
    # Impersonation ("View As")
    # ------------------------------------------------------------------------

    @classmethod
    def start_impersonation(
        cls,
        admin: User,
        target_user_id: int,
        reason: str,
        ticket_ref: str,
        duration_minutes: int,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Starts a read-only impersonation session.
        Max TTL <= 15 minutes.
        Emits JWT containing is_impersonation=True and impersonated_by claims.
        """
        if duration_minutes <= 0 or duration_minutes > 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impersonation duration must be between 1 and 15 minutes (statutory TTL)."
            )

        if not ticket_ref or not ticket_ref.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mandatory support ticket reference (ticket_ref) required for impersonation."
            )

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

        # Disallow impersonating super_admin or other admins
        if target_user.role in ("super_admin", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative accounts cannot be impersonated."
            )

        now = get_utc_now()
        expires_at = now + timedelta(minutes=duration_minutes)

        token = create_access_token(
            subject=target_user.id,
            role=target_user.role,
            email=target_user.email,
            name=target_user.name or f"User-{target_user.id}",
            expires_delta=timedelta(minutes=duration_minutes),
            token_version=getattr(target_user, "token_version", 1),
            is_impersonation=True,
            impersonated_by=admin.id,
            ticket_ref=ticket_ref,
        )

        session_rec = ImpersonationSession(
            admin_id=admin.id,
            target_user_id=target_user.id,
            reason=reason,
            ticket_ref=ticket_ref,
            token=token,
            started_at=now,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(session_rec)
        db.commit()
        db.refresh(session_rec)

        # Log access history for patient
        cls.log_access(
            case_id=None,
            patient_id=target_user.id,
            actor=admin,
            access_type="IMPERSONATION",
            reason=f"Support investigation (Ticket: {ticket_ref}): {reason}",
            ticket_ref=ticket_ref,
            db=db,
        )

        # Write admin audit action
        AuditService.write_admin_action(
            actor_id=admin.id,
            action_code="SUPPORT_IMPERSONATION_START",
            target_type="user",
            target_id=str(target_user.id),
            reason=f"Ticket: {ticket_ref}. {reason}",
            after_state={"ticket_ref": ticket_ref, "duration_minutes": duration_minutes, "session_id": session_rec.id, "summary": f"Admin {admin.email} started read-only impersonation of user {target_user.id}"},
            db=db,
        )

        return {
            "session_id": session_rec.id,
            "target_user_id": target_user.id,
            "target_role": target_user.role,
            "token": token,
            "token_type": "bearer",
            "expires_at": expires_at.isoformat(),
            "ttl_minutes": duration_minutes,
            "is_read_only": True,
            "impersonated_by": admin.id,
        }

    @classmethod
    def stop_impersonation(
        cls,
        session_id: int,
        admin: User,
        db: Session,
    ) -> Dict[str, Any]:
        """Terminates an active impersonation session."""
        session_rec = db.query(ImpersonationSession).filter(ImpersonationSession.id == session_id).first()
        if not session_rec:
            raise HTTPException(status_code=404, detail="Impersonation session not found")

        session_rec.is_active = False
        session_rec.ended_at = get_utc_now()
        db.commit()

        AuditService.write_admin_action(
            actor_id=admin.id,
            action_code="SUPPORT_IMPERSONATION_END",
            target_type="impersonation_session",
            target_id=str(session_rec.id),
            reason="Session ended by administrator",
            after_state={"summary": f"Impersonation session {session_id} ended"},
            db=db,
        )
        return {"status": "success", "session_id": session_id, "is_active": False}

    # ------------------------------------------------------------------------
    # Break-Glass PHI Reveal
    # ------------------------------------------------------------------------

    @classmethod
    def execute_break_glass_reveal(
        cls,
        admin: User,
        case_id: int,
        reason: str,
        duration_minutes: int,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Executes emergency break-glass reveal for a specific case.
        Max TTL <= 10 minutes. Fully audited in auditor-visible list.
        """
        if duration_minutes <= 0 or duration_minutes > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Break-glass duration must be between 1 and 10 minutes (statutory TTL)."
            )

        if not reason or len(reason.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A detailed clinical or operational justification (minimum 10 characters) is required for break-glass reveal."
            )

        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        now = get_utc_now()
        expires_at = now + timedelta(minutes=duration_minutes)

        reveal = BreakGlassReveal(
            user_id=admin.id,
            case_id=case.id,
            reason=reason,
            started_at=now,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(reveal)
        db.commit()
        db.refresh(reveal)

        # Log patient access history
        cls.log_access(
            case_id=case.id,
            patient_id=case.patient_id,
            actor=admin,
            access_type="BREAK_GLASS_REVEAL",
            reason=reason,
            ticket_ref=None,
            db=db,
        )

        # Write admin action
        AuditService.write_admin_action(
            actor_id=admin.id,
            action_code="BREAK_GLASS_REVEAL",
            target_type="case",
            target_id=str(case.id),
            reason=reason,
            after_state={"duration_minutes": duration_minutes, "expires_at": expires_at.isoformat(), "reveal_id": reveal.id, "summary": f"Break-glass PHI reveal activated by {admin.email} for Case {case.id}"},
            db=db,
        )

        # Retrieve unmasked PHI for the authorized reveal response
        patient = db.query(User).filter(User.id == case.patient_id).first()
        patient_name = patient.name if patient else "Unknown"

        return {
            "reveal_id": reveal.id,
            "case_id": case.id,
            "patient_id": case.patient_id,
            "patient_name": patient_name,
            "chief_complaint": case.chief_complaint,
            "started_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "ttl_minutes": duration_minutes,
            "is_active": True,
        }

    @classmethod
    def list_break_glass_reveals(cls, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """Lists break-glass reveal events for clinical compliance auditor inspection."""
        reveals = (
            db.query(BreakGlassReveal)
            .order_by(BreakGlassReveal.id.desc())
            .limit(limit)
            .all()
        )
        now = get_utc_now()
        out = []
        for r in reveals:
            exp = r.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            is_currently_active = r.is_active and (exp > now)
            out.append({
                "reveal_id": r.id,
                "user_id": r.user_id,
                "case_id": r.case_id,
                "reason": r.reason,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                "is_active": is_currently_active,
                "expired": exp <= now,
            })
        return out

    @classmethod
    def is_break_glass_active(cls, case_id: int, user_id: int, db: Session, current_time: Optional[datetime] = None) -> bool:
        """Checks if a user has an active unexpired break-glass authorization on a case."""
        now = current_time or get_utc_now()
        reveal = (
            db.query(BreakGlassReveal)
            .filter(
                BreakGlassReveal.case_id == case_id,
                BreakGlassReveal.user_id == user_id,
                BreakGlassReveal.is_active == True,
            )
            .order_by(BreakGlassReveal.id.desc())
            .first()
        )
        if not reveal:
            return False

        exp = reveal.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > now

    # ------------------------------------------------------------------------
    # Patient Access History
    # ------------------------------------------------------------------------

    @classmethod
    def log_access(
        cls,
        case_id: Optional[int],
        patient_id: int,
        actor: User,
        access_type: str,
        reason: Optional[str] = None,
        ticket_ref: Optional[str] = None,
        db: Session = None,
    ) -> AccessHistoryLog:
        """Records an access log event for transparent patient access history."""
        log = AccessHistoryLog(
            case_id=case_id,
            patient_id=patient_id,
            actor_id=actor.id,
            actor_name=actor.name or actor.email,
            actor_role=actor.role,
            access_type=access_type,
            reason=reason,
            ticket_ref=ticket_ref,
            created_at=get_utc_now(),
        )
        if db:
            db.add(log)
            db.commit()
            db.refresh(log)
        return log

    @classmethod
    def get_patient_access_history(
        cls,
        patient_id: int,
        case_id: Optional[int] = None,
        db: Session = None,
    ) -> List[Dict[str, Any]]:
        # Retrieves transparent record access history for a patient or case
        candidate_ids = [patient_id]
        from app.models.patient import PatientProfile
        profile = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if profile and profile.user_id:
            candidate_ids.append(profile.user_id)
        profile_by_user = db.query(PatientProfile).filter(PatientProfile.user_id == patient_id).first()
        if profile_by_user:
            candidate_ids.append(profile_by_user.id)

        query = db.query(AccessHistoryLog).filter(AccessHistoryLog.patient_id.in_(candidate_ids))
        if case_id:
            query = query.filter((AccessHistoryLog.case_id == case_id) | (AccessHistoryLog.case_id.is_(None)))

        logs = query.order_by(AccessHistoryLog.id.desc()).all()
        return [
            {
                "id": l.id,
                "case_id": l.case_id,
                "actor_id": l.actor_id,
                "actor_name": l.actor_name,
                "actor_role": l.actor_role,
                "access_type": l.access_type,
                "reason": l.reason,
                "ticket_ref": l.ticket_ref,
                "accessed_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ]
