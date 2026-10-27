from typing import Dict, Any, List, Optional
from datetime import timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.models.user import User
from app.models.rbac import Role, Permission, UserPermissionGrant, RolePermission
from app.models.domain_substrate import CaregiverLink
from app.services.auth.rbac_service import get_utc_now
from app.core.security import get_password_hash
from app.services.admin.admin_action_service import AdminActionService


class UserAdminService:
    """
    AC-01: Identity & Access Management Service.
    Enforces user lifecycle management, session revocation, temporary grants,
    clinician verification gate, caregiver oversight, lockout monitor, and super_admin invariants.
    """

    @classmethod
    def list_users(
        cls,
        db: Session,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_suspended: Optional[bool] = None,
        verification_status: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "id",
        sort_desc: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        q = db.query(User)

        if role:
            q = q.filter(User.role == role)
        if is_suspended is not None:
            q = q.filter(User.is_suspended == is_suspended)
        elif is_active is not None:
            q = q.filter(User.is_suspended == (not is_active))

        if verification_status:
            q = q.filter(User.clinician_verification_status == verification_status)

        if search:
            s_term = f"%{search.strip()}%"
            q = q.filter(or_(User.email.ilike(s_term), User.name.ilike(s_term)))

        total = q.count()

        sort_col = getattr(User, sort_by, User.id)
        if sort_desc:
            q = q.order_by(desc(sort_col))
        else:
            q = q.order_by(sort_col)

        users = q.offset(offset).limit(limit).all()
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "users": [
                {
                    "id": u.id,
                    "name": u.name,
                    "full_name": u.name,
                    "email": u.email,
                    "role": u.role,
                    "is_active": not u.is_suspended,
                    "is_suspended": u.is_suspended,
                    "token_version": u.token_version,
                    "clinician_verification_status": u.clinician_verification_status,
                    "requires_reconsent": u.requires_reconsent,
                    "failed_login_attempts": u.failed_login_attempts,
                    "locked_until": u.locked_until.isoformat() if u.locked_until else None,
                }
                for u in users
            ],
        }

    @classmethod
    def get_user_detail(cls, db: Session, user_id: int) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        now = get_utc_now()
        grants = (
            db.query(UserPermissionGrant)
            .filter(UserPermissionGrant.user_id == user_id)
            .all()
        )
        active_grants = [
            {
                "id": g.id,
                "permission_code": g.permission_code,
                "expires_at": g.expires_at.isoformat() if g.expires_at else None,
                "is_active": (g.expires_at is None or g.expires_at > now),
            }
            for g in grants
        ]

        return {
            "id": user.id,
            "name": user.name,
            "full_name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": not user.is_suspended,
            "is_suspended": user.is_suspended,
            "token_version": user.token_version,
            "clinician_verification_status": user.clinician_verification_status,
            "clinician_registration_number": user.clinician_registration_number,
            "clinician_credential_doc": user.clinician_credential_doc,
            "requires_reconsent": user.requires_reconsent,
            "failed_login_attempts": user.failed_login_attempts,
            "locked_until": user.locked_until.isoformat() if user.locked_until else None,
            "temporary_grants": active_grants,
        }

    @classmethod
    def create_user_invite(
        cls,
        db: Session,
        actor: User,
        email: str,
        role: str,
        full_name: str,
        reason: str,
        phone_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(status_code=422, detail="Valid email is required.")

        existing = db.query(User).filter(User.email == clean_email).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"User with email '{clean_email}' already exists.")

        def action_fn(s: Session):
            new_user = User(
                name=full_name.strip(),
                email=clean_email,
                password_hash=get_password_hash("TemporaryPass123!"),
                role=role.strip(),
                clinician_verification_status="unverified" if role == "clinician" else "approved",
                token_version=1,
                is_suspended=False,
                failed_login_attempts=0,
            )
            s.add(new_user)
            s.flush()
            s.refresh(new_user)
            after = {
                "user_id": new_user.id,
                "email": new_user.email,
                "role": new_user.role,
                "status": "created",
            }
            return None, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_CREATE",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=clean_email,
            action_fn=action_fn,
            db=db,
            reason=reason or f"Invited/created user {clean_email} as {role}",
            stepup_verified=True,
        )
        created_user = db.query(User).filter(User.email == clean_email).first()
        return {
            **res,
            "user_id": created_user.id if created_user else None,
            "email": clean_email,
            "role": role,
        }

    @classmethod
    def update_user(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        data: Optional[Dict[str, Any]] = None,
        reason: str = "",
        updates: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        field_updates = data or updates or {}

        def action_fn(s: Session):
            before = {"name": user.name, "email": user.email}
            if "name" in field_updates or "full_name" in field_updates:
                user.name = (field_updates.get("name") or field_updates.get("full_name")).strip()
            if "email" in field_updates:
                user.email = field_updates["email"].strip().lower()
            if "is_suspended" in field_updates:
                user.is_suspended = bool(field_updates["is_suspended"])
            s.flush()
            after = {"name": user.name, "email": user.email}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_EDIT",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, **field_updates}

    @classmethod
    def suspend_user(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        # Invariant: Cannot suspend last super_admin!
        if user.role == "super_admin":
            super_count = db.query(User).filter(User.role == "super_admin", User.is_suspended == False).count()
            if super_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot suspend the last active super_admin."
                )

        def action_fn(s: Session):
            before = {"is_suspended": user.is_suspended}
            user.is_suspended = True
            user.token_version += 1
            s.flush()
            after = {"is_suspended": True, "token_version": user.token_version}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_SUSPEND",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "is_suspended": True}

    @classmethod
    def reactivate_user(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        def action_fn(s: Session):
            before = {"is_suspended": user.is_suspended}
            user.is_suspended = False
            user.failed_login_attempts = 0
            user.locked_until = None
            s.flush()
            after = {"is_suspended": False}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_REACTIVATE",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "is_suspended": False}

    @classmethod
    def revoke_user_sessions(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        def action_fn(s: Session):
            before = {"token_version": user.token_version}
            user.token_version += 1
            s.flush()
            after = {"token_version": user.token_version}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_REVOKE_SESSIONS",
            required_permission="perm.admin.users.sessions",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "new_token_version": user.token_version}

    @classmethod
    def reset_user_password(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
        new_password: Optional[str] = None,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        pwd = new_password or "ResetPassword123!"

        def action_fn(s: Session):
            user.password_hash = get_password_hash(pwd)
            user.token_version += 1
            s.flush()
            return {"password": "[REDACTED]"}, {"password": "[RESET]", "token_version": user.token_version}

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_RESET_PASSWORD",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "password_reset": True}

    @classmethod
    def reset_user_mfa(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        def action_fn(s: Session):
            before = {"mfa_enabled": user.mfa_enabled}
            user.mfa_enabled = "false"
            user.mfa_secret = None
            s.flush()
            return before, {"mfa_enabled": "false"}

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_RESET_MFA",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "mfa_reset": True}

    @classmethod
    def assign_user_role(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        new_role: str,
        reason: str,
        ticket_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        # Invariant: Cannot demote the last super_admin!
        if user.role == "super_admin" and new_role != "super_admin":
            super_count = db.query(User).filter(User.role == "super_admin", User.is_suspended == False).count()
            if super_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot demote the last super_admin."
                )

        def action_fn(s: Session):
            before = {"role": user.role}
            user.role = new_role
            if new_role == "clinician" and not user.clinician_verification_status:
                user.clinician_verification_status = "unverified"
            s.flush()
            after = {"role": user.role}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_ASSIGN_ROLE",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            ticket_ref=ticket_ref,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "new_role": new_role}

    @classmethod
    def grant_temporary_permission(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        permission_code: str,
        reason: str,
        duration_minutes: int = 60,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        expires = get_utc_now() + timedelta(minutes=duration_minutes)

        def action_fn(s: Session):
            grant = UserPermissionGrant(
                user_id=user_id,
                permission_code=permission_code,
                expires_at=expires,
                granted_by=actor.id,
                reason=reason,
            )
            s.add(grant)
            s.flush()
            return None, {
                "permission_code": permission_code,
                "expires_at": expires.isoformat(),
                "duration_minutes": duration_minutes,
            }

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_PERMISSION_GRANT",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {
            **res,
            "user_id": user_id,
            "permission_code": permission_code,
            "expires_at": expires.isoformat(),
        }

    @classmethod
    def revoke_temporary_permission(
        cls,
        db: Session,
        actor: User,
        grant_id: int,
        reason: str,
    ) -> Dict[str, Any]:
        grant = db.query(UserPermissionGrant).filter(UserPermissionGrant.id == grant_id).first()
        if not grant:
            raise HTTPException(status_code=404, detail="Grant not found.")

        def action_fn(s: Session):
            before = {"grant_id": grant_id, "perm": grant.permission_code}
            s.delete(grant)
            s.flush()
            return before, {"deleted": True}

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_PERMISSION_REVOKE",
            required_permission="perm.admin.users.manage",
            target_type="user_grant",
            target_id=str(grant_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )

    @classmethod
    def submit_clinician_verification(
        cls,
        db: Session,
        user_id: int,
        registration_number: str,
        credential_doc_url: str = "",
        credential_doc: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        doc_payload = credential_doc or {"doc_url": credential_doc_url}
        user.clinician_registration_number = registration_number.strip()
        user.clinician_credential_doc = doc_payload
        user.clinician_verification_status = "pending"
        db.commit()
        db.refresh(user)
        return {
            "status": "pending",
            "verification_status": "pending",
            "message": "Clinician verification credentials submitted. Awaiting administrative review.",
            "registration_number": user.clinician_registration_number,
        }

    @classmethod
    def decide_clinician_verification(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        decision: str,  # approve | reject
        reason: str,
        approver: Optional[User] = None,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        target_status = "approved" if decision.lower() in ("approve", "approved") else "rejected"

        def action_fn(s: Session):
            before = {"clinician_verification_status": user.clinician_verification_status}
            user.clinician_verification_status = target_status
            s.flush()
            after = {"clinician_verification_status": target_status}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code=f"CLINICIAN_VERIFY_{target_status.upper()}",
            required_permission="perm.admin.clinicians.verify",
            target_type="clinician",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            approver=approver,
            stepup_verified=True,
        )
        return {
            **res,
            "user_id": user_id,
            "verification_status": target_status,
        }

    @classmethod
    def list_caregiver_links(
        cls,
        db: Session,
        patient_id: Optional[int] = None,
        caregiver_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        q = db.query(CaregiverLink)
        if patient_id:
            q = q.filter(CaregiverLink.patient_id == patient_id)
        if caregiver_id:
            q = q.filter(CaregiverLink.caregiver_id == caregiver_id)

        links = q.all()
        return {
            "links": [
                {
                    "id": l.id,
                    "patient_id": l.patient_id,
                    "caregiver_id": l.caregiver_id,
                    "payload": l.payload,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                }
                for l in links
            ]
        }

    @classmethod
    def revoke_caregiver_link(
        cls,
        db: Session,
        actor: User,
        link_id: int,
        reason: str,
    ) -> Dict[str, Any]:
        link = db.query(CaregiverLink).filter(CaregiverLink.id == link_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Caregiver link not found.")

        patient_id = link.patient_id
        caregiver_id = link.caregiver_id

        def action_fn(s: Session):
            before = {"patient_id": patient_id, "caregiver_id": caregiver_id}
            s.delete(link)
            s.flush()
            return before, {"deleted": True}

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CAREGIVER_LINK_REVOKE",
            required_permission="perm.admin.users.manage",
            target_type="caregiver_link",
            target_id=str(link_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "revoked_link_id": link_id}

    @classmethod
    def execute_bulk_action(
        cls,
        db: Session,
        actor: User,
        action_type: str,
        user_ids: List[int],
        reason: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not user_ids:
            raise HTTPException(status_code=422, detail="user_ids cannot be empty.")
        if not reason:
            raise HTTPException(status_code=422, detail="Mandatory reason required for bulk actions.")

        results = []
        for uid in user_ids:
            if action_type == "suspend":
                r = cls.suspend_user(db=db, actor=actor, user_id=uid, reason=reason)
            elif action_type == "reactivate":
                r = cls.reactivate_user(db=db, actor=actor, user_id=uid, reason=reason)
            elif action_type == "revoke_sessions":
                r = cls.revoke_user_sessions(db=db, actor=actor, user_id=uid, reason=reason)
            elif action_type == "force_reconsent":
                u = db.query(User).filter(User.id == uid).first()
                if u:
                    u.requires_reconsent = True
                    db.commit()
                r = {"status": "success"}
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported bulk action '{action_type}'")
            results.append({"user_id": uid, "status": r.get("status", "success")})

        return {
            "action": action_type,
            "processed_count": len(results),
            "results": results,
            "reason": reason,
        }

    @classmethod
    def list_lockouts(
        cls,
        db: Session,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        now = get_utc_now()
        q = db.query(User).filter(or_(User.failed_login_attempts >= 5, User.locked_until > now))
        total = q.count()
        locked_users = q.offset(offset).limit(limit).all()
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "lockouts": [
                {
                    "user_id": u.id,
                    "email": u.email,
                    "role": u.role,
                    "failed_login_attempts": u.failed_login_attempts,
                    "locked_until": u.locked_until.isoformat() if u.locked_until else None,
                    "is_suspended": u.is_suspended,
                }
                for u in locked_users
            ],
        }

    @classmethod
    def unlock_user(
        cls,
        db: Session,
        actor: User,
        user_id: int,
        reason: str,
    ) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        def action_fn(s: Session):
            before = {"failed_attempts": user.failed_login_attempts, "locked_until": user.locked_until.isoformat() if user.locked_until else None}
            user.failed_login_attempts = 0
            user.locked_until = None
            s.flush()
            after = {"failed_attempts": 0, "locked_until": None}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="USER_UNLOCK",
            required_permission="perm.admin.users.manage",
            target_type="user",
            target_id=str(user_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "user_id": user_id, "unlocked": True}

    @classmethod
    def list_roles(cls, db: Session) -> Dict[str, Any]:
        roles = db.query(Role).all()
        builtin_roles = {"patient", "caregiver", "clinician", "admin", "super_admin", "ops_admin", "clinical_admin", "support_admin", "auditor"}
        role_list = []
        for r in roles:
            perm_count = db.query(RolePermission).filter(RolePermission.role_code == r.code).count()
            user_count = db.query(User).filter(User.role == r.code).count()
            role_list.append({
                "code": r.code,
                "description": r.description or f"{r.code.replace('_', ' ').title()} role",
                "is_builtin": r.code in builtin_roles,
                "permission_count": perm_count,
                "user_count": user_count,
            })
        return {"total": len(role_list), "roles": role_list}

    @classmethod
    def create_role(
        cls,
        db: Session,
        actor: User,
        code: str,
        description: Optional[str],
        permissions: List[str],
        reason: str,
    ) -> Dict[str, Any]:
        clean_code = code.strip().lower().replace(" ", "_")
        existing = db.query(Role).filter(Role.code == clean_code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Role with code '{clean_code}' already exists.")

        def action_fn(s: Session):
            from app.services.auth.rbac_service import ALL_PERMISSIONS
            # Ensure permissions exist in permissions table
            existing_perm_codes = {p[0] for p in s.query(Permission.code).filter(Permission.code.in_(permissions)).all()}
            for p in permissions:
                if p not in existing_perm_codes:
                    meta = ALL_PERMISSIONS.get(p, {})
                    s.add(Permission(
                        code=p,
                        description=meta.get("desc", ""),
                        is_sensitive=bool(meta.get("sensitive", False)),
                        requires_stepup=bool(meta.get("stepup", False)),
                        requires_dual_control=bool(meta.get("dual", False)),
                    ))
            new_role = Role(code=clean_code, description=description or f"{clean_code.replace('_', ' ').title()} role")
            s.add(new_role)
            s.flush()
            for p in set(permissions):
                rp = RolePermission(role_code=clean_code, permission_code=p)
                s.add(rp)
            s.flush()
            before = None
            after = {"code": clean_code, "description": description, "permissions": permissions}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="ROLE_CREATE",
            required_permission="perm.admin.users.manage",
            target_type="role",
            target_id=clean_code,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "role_code": clean_code, "permissions": permissions}

    @classmethod
    def list_permissions(cls, db: Session) -> Dict[str, Any]:
        from app.services.auth.rbac_service import ALL_PERMISSIONS
        perms_db = db.query(Permission).all()
        db_map = {p.code: p for p in perms_db}

        results = []
        for code, meta in ALL_PERMISSIONS.items():
            db_p = db_map.get(code)
            if code.startswith("perm.cases"):
                category = "Clinical Cases & Triage"
            elif code.startswith("perm.consent") or "dpdp" in code:
                category = "DPDP & Patient Consent"
            elif "users" in code or "clinicians" in code or "approvals" in code:
                category = "Identity, Users & Approvals"
            elif "flags" in code or "governance" in code or "config" in code:
                category = "System Governance & Flags"
            elif "ai" in code or "ops" in code or "analytics" in code or "audit" in code or "feedback" in code or "content" in code:
                category = "AI, Ops & Observability"
            else:
                category = "Emergency & Clinical Safety"

            results.append({
                "code": code,
                "description": db_p.description if db_p and db_p.description else str(meta.get("desc", "")),
                "category": category,
                "is_sensitive": db_p.is_sensitive if db_p else bool(meta.get("sensitive", False)),
                "requires_stepup": db_p.requires_stepup if db_p else bool(meta.get("stepup", False)),
                "requires_dual_control": db_p.requires_dual_control if db_p else bool(meta.get("dual", False)),
            })
        return {"total": len(results), "permissions": results}

    @classmethod
    def get_role_permissions(cls, db: Session, role_code: str) -> Dict[str, Any]:
        role = db.query(Role).filter(Role.code == role_code).first()
        if not role:
            raise HTTPException(status_code=404, detail=f"Role '{role_code}' not found.")
        rps = db.query(RolePermission.permission_code).filter(RolePermission.role_code == role_code).all()
        perms = [p[0] for p in rps]
        return {"role_code": role_code, "permissions": perms}

    @classmethod
    def update_role_permissions(
        cls,
        db: Session,
        actor: User,
        role_code: str,
        permissions: List[str],
        reason: str,
    ) -> Dict[str, Any]:
        role = db.query(Role).filter(Role.code == role_code).first()
        if not role:
            raise HTTPException(status_code=404, detail=f"Role '{role_code}' not found.")

        # Self-lockout check: If the actor has this role, they cannot strip critical management permissions from themselves!
        if actor.role == role_code:
            critical_perms = {"perm.admin.users.manage", "perm.admin.flags.manage"}
            missing = critical_perms - set(permissions)
            if missing and actor.role != "super_admin":
                raise HTTPException(
                    status_code=400,
                    detail=f"Self-lockout prevented: Cannot remove critical permission(s) {missing} from your own active role."
                )

        def action_fn(s: Session):
            from app.services.auth.rbac_service import ALL_PERMISSIONS
            # Ensure permissions exist in permissions table
            existing_perm_codes = {p[0] for p in s.query(Permission.code).filter(Permission.code.in_(permissions)).all()}
            for p in permissions:
                if p not in existing_perm_codes:
                    meta = ALL_PERMISSIONS.get(p, {})
                    s.add(Permission(
                        code=p,
                        description=meta.get("desc", ""),
                        is_sensitive=bool(meta.get("sensitive", False)),
                        requires_stepup=bool(meta.get("stepup", False)),
                        requires_dual_control=bool(meta.get("dual", False)),
                    ))
            current = s.query(RolePermission).filter(RolePermission.role_code == role_code).all()
            before_perms = [p.permission_code for p in current]
            for rp in current:
                s.delete(rp)
            s.flush()
            for p in set(permissions):
                s.add(RolePermission(role_code=role_code, permission_code=p))
            s.flush()
            return {"permissions": before_perms}, {"permissions": list(set(permissions))}

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="ROLE_PERMISSIONS_UPDATE",
            required_permission="perm.admin.users.manage",
            target_type="role",
            target_id=role_code,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "role_code": role_code, "permissions": permissions}
