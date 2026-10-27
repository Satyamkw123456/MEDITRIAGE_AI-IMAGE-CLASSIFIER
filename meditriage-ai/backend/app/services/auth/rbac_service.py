from datetime import datetime, timezone
from typing import Dict, Set
from sqlalchemy.orm import Session
from app.models.rbac import Permission, Role, RolePermission, UserPermissionGrant
from app.models.user import User


def get_utc_now():
    return datetime.now(timezone.utc)


ALL_PERMISSIONS: Dict[str, Dict[str, str | bool]] = {
    "perm.cases.create": {"desc": "Submit new patient intake cases", "sensitive": False},
    "perm.cases.read": {"desc": "Read patient case details", "sensitive": False},
    "perm.cases.list": {"desc": "List patient or clinician case queues", "sensitive": False},
    "perm.cases.review": {"desc": "Review clinician diagnosis and triage", "sensitive": False},
    "perm.cases.feedback": {"desc": "Submit clinician feedback on AI differentials", "sensitive": False},
    "perm.cases.amend": {"desc": "Amend patient intake symptoms and vitals", "sensitive": False},
    "perm.cases.comment": {"desc": "Add patient/caregiver feedback comment on summary", "sensitive": False},
    "perm.cases.edit_summary": {"desc": "Edit clinician summary text", "sensitive": False},
    "perm.cases.override_triage": {"desc": "Override triage level with clinical justification", "sensitive": True},
    "perm.cases.delete": {"desc": "Soft-delete patient case record", "sensitive": True},
    "perm.cases.restore": {"desc": "Restore soft-deleted patient case record", "sensitive": True},
    "perm.cases.purge": {"desc": "Purge expired soft-deleted case PHI", "sensitive": True, "stepup": True, "dual": True},
    "perm.consent.grant": {"desc": "Record digital consent under DPDP Act 2023", "sensitive": False},
    "perm.consent.read": {"desc": "Check digital consent status and history", "sensitive": False},
    "perm.pdf.export": {"desc": "Export case clinical summary PDF", "sensitive": False},
    "perm.admin.analytics": {"desc": "View system operational analytics", "sensitive": False},
    "perm.admin.audit": {"desc": "Query unified admin audit trail", "sensitive": True, "stepup": True},
    "perm.admin.feedback": {"desc": "View clinician feedback trend metrics", "sensitive": False},
    "perm.admin.config": {"desc": "Manage and publish governed config versions", "sensitive": True, "stepup": True, "dual": True},
    "perm.admin.breakglass": {"desc": "Break-glass unmasking of patient PHI", "sensitive": True, "stepup": True, "dual": True},
    # Cycle 6 Admin Control Plane Permissions
    "perm.admin.users.read": {"desc": "View user directory, login history, and lockout states", "sensitive": False},
    "perm.admin.users.manage": {"desc": "Invite, edit, suspend, reactivate users and assign roles", "sensitive": True, "stepup": True},
    "perm.admin.users.sessions": {"desc": "Force logout, revoke sessions, and reset credentials", "sensitive": True, "stepup": True},
    "perm.admin.clinicians.verify": {"desc": "Approve or reject clinician registration and credential documents", "sensitive": True, "stepup": True, "dual": True},
    "perm.admin.flags.manage": {"desc": "Manage feature flags, kill switches, and layout compositions", "sensitive": True, "stepup": True, "dual": True},
    "perm.admin.cases.oversight": {"desc": "Access case worklists, reassign clinicians, force-reopen, and metadata search", "sensitive": False},
    "perm.admin.dpdp.manage": {"desc": "Process data rights requests, toggle legal holds, and view consent ledgers", "sensitive": True, "stepup": True},
    "perm.admin.approvals.manage": {"desc": "Approve or reject dual-control administrative actions", "sensitive": True, "stepup": True},
    # Cycle 7 Admin Control Plane Part B Permissions
    "perm.support.impersonate": {"desc": "Read-only impersonation session for support investigation", "sensitive": True, "stepup": True},
    "support.impersonate": {"desc": "Read-only impersonation session for support investigation", "sensitive": True, "stepup": True},
    "perm.phi.reveal": {"desc": "Break-glass temporary reveal of masked PHI", "sensitive": True, "stepup": True, "dual": True},
    "phi.reveal": {"desc": "Break-glass temporary reveal of masked PHI", "sensitive": True, "stepup": True, "dual": True},
    "perm.clinical.governance": {"desc": "Manage clinical rules, questionnaires, and impact previews", "sensitive": True, "stepup": True, "dual": True},
    "perm.ai.manage": {"desc": "Manage AI models, prompt registry, budgets, and quotas", "sensitive": True, "stepup": True},
    "perm.ops.manage": {"desc": "Operations, jobs, health, logs, and RAG corpus management", "sensitive": True, "stepup": True},
    "perm.admin.content": {"desc": "Content management, translations, and directory resources", "sensitive": False},
}

ROLE_PERMISSION_MAP: Dict[str, Set[str]] = {
    "patient": {
        "perm.cases.create", "perm.cases.read", "perm.cases.amend", "perm.cases.comment",
        "perm.cases.delete", "perm.consent.grant", "perm.consent.read"
    },
    "caregiver": {
        "perm.cases.create", "perm.cases.read", "perm.cases.amend", "perm.cases.comment",
        "perm.cases.delete", "perm.consent.grant", "perm.consent.read"
    },
    "clinician": {
        "perm.cases.read", "perm.cases.list", "perm.cases.review", "perm.cases.feedback",
        "perm.pdf.export", "perm.cases.amend", "perm.cases.edit_summary",
        "perm.cases.override_triage", "perm.cases.delete"
    },
    "admin": {
        "perm.admin.analytics", "perm.admin.audit", "perm.admin.feedback",
        "perm.admin.config", "perm.admin.breakglass", "perm.cases.restore",
        "perm.cases.purge", "perm.cases.read", "perm.cases.list",
        "perm.admin.users.read", "perm.admin.users.manage", "perm.admin.users.sessions",
        "perm.admin.clinicians.verify", "perm.admin.flags.manage",
        "perm.admin.cases.oversight", "perm.admin.dpdp.manage", "perm.admin.approvals.manage",
        "perm.support.impersonate", "support.impersonate", "perm.phi.reveal", "phi.reveal",
        "perm.clinical.governance", "perm.ai.manage", "perm.ops.manage", "perm.admin.content"
    },
    "super_admin": {
        "perm.admin.analytics", "perm.admin.audit", "perm.admin.feedback",
        "perm.admin.config", "perm.admin.breakglass", "perm.cases.restore",
        "perm.cases.purge", "perm.cases.read", "perm.cases.list",
        "perm.admin.users.read", "perm.admin.users.manage", "perm.admin.users.sessions",
        "perm.admin.clinicians.verify", "perm.admin.flags.manage",
        "perm.admin.cases.oversight", "perm.admin.dpdp.manage", "perm.admin.approvals.manage",
        "perm.support.impersonate", "support.impersonate", "perm.phi.reveal", "phi.reveal",
        "perm.clinical.governance", "perm.ai.manage", "perm.ops.manage", "perm.admin.content"
    },
    "ops_admin": {
        "perm.admin.analytics", "perm.admin.audit", "perm.admin.config", "perm.admin.feedback",
        "perm.admin.users.read", "perm.admin.flags.manage", "perm.admin.cases.oversight", "perm.admin.dpdp.manage",
        "perm.ai.manage", "perm.ops.manage"
    },
    "clinical_admin": {
        "perm.admin.analytics", "perm.admin.feedback", "perm.admin.config", "perm.cases.list", "perm.cases.read",
        "perm.admin.clinicians.verify", "perm.admin.cases.oversight", "perm.admin.approvals.manage",
        "perm.clinical.governance", "perm.phi.reveal", "phi.reveal"
    },
    "support_admin": {
        "perm.admin.analytics", "perm.admin.breakglass", "perm.cases.list", "perm.cases.read",
        "perm.admin.users.read", "perm.admin.cases.oversight",
        "perm.support.impersonate", "support.impersonate", "perm.phi.reveal", "phi.reveal"
    },
    "auditor": {
        "perm.admin.analytics", "perm.admin.audit", "perm.admin.feedback", "perm.cases.read", "perm.consent.read",
        "perm.admin.users.read"
    }
}


def seed_rbac_tables(db: Session) -> None:
    """Seeds permissions, roles, and role_permissions in database."""
    # 1. Seed Permissions
    for code, meta in ALL_PERMISSIONS.items():
        perm = db.query(Permission).filter(Permission.code == code).first()
        if not perm:
            perm = Permission(
                code=code,
                description=str(meta["desc"]),
                is_sensitive=bool(meta.get("sensitive", False)),
                requires_stepup=bool(meta.get("stepup", False)),
                requires_dual_control=bool(meta.get("dual", False))
            )
            db.add(perm)
        else:
            perm.description = str(meta["desc"])
            perm.is_sensitive = bool(meta.get("sensitive", False))
            perm.requires_stepup = bool(meta.get("stepup", False))
            perm.requires_dual_control = bool(meta.get("dual", False))
    db.flush()

    # 2. Seed Roles & Role Permissions
    for role_code, perms in ROLE_PERMISSION_MAP.items():
        role = db.query(Role).filter(Role.code == role_code).first()
        if not role:
            role = Role(code=role_code, description=f"{role_code.replace('_', ' ').title()} role")
            db.add(role)
        db.flush()

        for p_code in perms:
            rp = db.query(RolePermission).filter(
                RolePermission.role_code == role_code,
                RolePermission.permission_code == p_code
            ).first()
            if not rp:
                rp = RolePermission(role_code=role_code, permission_code=p_code)
                db.add(rp)

    db.commit()


def get_user_permissions(user: User, db: Session) -> Set[str]:
    """Resolves all active permission codes for a user based on role, verification status, and direct grants."""
    # 1. Suspended users have zero permissions
    if getattr(user, "is_suspended", False):
        return set()

    # 2. Unverified clinicians have their clinician-permissions held inactive until approved
    ver_status = getattr(user, "clinician_verification_status", "approved")
    if user.role == "clinician" and ver_status in ("unverified", "pending", "rejected"):
        perms = set()
    else:
        perms = set(ROLE_PERMISSION_MAP.get(user.role, set()))
        
        # Query database for mapped role permissions if seeded
        db_role_perms = db.query(RolePermission.permission_code).filter(RolePermission.role_code == user.role).all()
        if db_role_perms:
            perms.update([p[0] for p in db_role_perms])

    # 3. Check for direct grants with expiry enforcement
    now = get_utc_now()
    grants = db.query(UserPermissionGrant).filter(
        UserPermissionGrant.user_id == user.id
    ).all()
    for g in grants:
        if g.expires_at is None:
            perms.add(g.permission_code)
        else:
            exp = g.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                perms.add(g.permission_code)

    return perms


def user_has_permission(user: User, perm_code: str, db: Session) -> bool:
    """Checks if user possesses a specific permission code."""
    # Suspended user cannot act even if role is super_admin
    if getattr(user, "is_suspended", False):
        return False

    if user.role == "super_admin":
        return True

    user_perms = get_user_permissions(user, db)
    if perm_code in user_perms:
        return True
    if perm_code.startswith("perm.") and perm_code[5:] in user_perms:
        return True
    if not perm_code.startswith("perm.") and f"perm.{perm_code}" in user_perms:
        return True
    return False

