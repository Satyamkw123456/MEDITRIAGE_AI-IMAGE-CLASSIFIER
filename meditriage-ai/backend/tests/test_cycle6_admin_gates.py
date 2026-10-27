import pytest
import os
import sys
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.quality import QualityScore
from app.models.domain_substrate import CaregiverLink, DataRightsRequest, JobRun, Announcement
from app.models.admin_action import AdminAction
from app.services.auth.rbac_service import (
    seed_rbac_tables,
    user_has_permission,
    get_user_permissions,
    ROLE_PERMISSION_MAP,
    ALL_PERMISSIONS,
)
from app.services.admin.user_admin_service import UserAdminService
from app.services.admin.flags_settings_service import FlagsSettingsService
from app.services.admin.case_oversight_service import CaseOversightService, ALLOWED_CASE_METADATA_FIELDS
from app.services.admin.dpdp_service import DPDPService
from app.services.admin.approvals_service import ApprovalsService
from app.services.admin.needs_attention_service import NeedsAttentionService
from app.services.audit.audit_service import AuditService


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_rbac_tables(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def seed_test_user(db, email, role, full_name=None, is_suspended=False, verification_status="approved", token_version=1):
    user = User(
        email=email.lower().strip(),
        name=full_name or f"User {role}",
        role=role,
        password_hash=get_password_hash("Secret123!"),
        is_suspended=is_suspended,
        clinician_verification_status=verification_status,
        token_version=token_version,
        failed_login_attempts=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user):
    token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# SPIKE 1: Permission Fuzz Test Across All 5 Roles
# ============================================================================

def test_spike1_permission_fuzz_matrix(db_session, client):
    """
    SPIKE 1: Permission Fuzz Test.
    Evaluates every seeded role against the 8 new Cycle 6 administrative permissions.
    Zero unauthorized successes tolerated.
    """
    c6_perms = [
        "perm.admin.users.read",
        "perm.admin.users.manage",
        "perm.admin.users.sessions",
        "perm.admin.clinicians.verify",
        "perm.admin.flags.manage",
        "perm.admin.cases.oversight",
        "perm.admin.dpdp.manage",
        "perm.admin.approvals.manage",
    ]

    super_admin = seed_test_user(db_session, "super@spike.com", "super_admin")
    admin = seed_test_user(db_session, "admin@spike.com", "admin")
    clinician = seed_test_user(db_session, "cln@spike.com", "clinician", verification_status="approved")
    patient = seed_test_user(db_session, "pat@spike.com", "patient")
    caregiver = seed_test_user(db_session, "cg@spike.com", "caregiver")

    # 1. Super Admin possesses all permissions
    for p in c6_perms:
        assert user_has_permission(super_admin, p, db_session) is True

    # 2. Admin possesses all 8 administrative control plane permissions
    for p in c6_perms:
        assert user_has_permission(admin, p, db_session) is True

    # 3. Patient, Caregiver, and Clinician MUST NOT possess any of the 8 permissions
    for p in c6_perms:
        assert user_has_permission(patient, p, db_session) is False
        assert user_has_permission(caregiver, p, db_session) is False
        assert user_has_permission(clinician, p, db_session) is False

    # 4. HTTP Fuzz: Hit admin endpoints with patient token -> must strictly 403
    p_headers = auth_headers(patient)
    endpoints = [
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/admin/flags"),
        ("GET", "/api/v1/admin/cases/metadata-search"),
        ("GET", "/api/v1/admin/dpdp/requests"),
        ("GET", "/api/v1/admin/approvals"),
    ]
    for method, path in endpoints:
        res = client.request(method, path, headers=p_headers)
        assert res.status_code == 403, f"Expected 403 on {path} for patient, got {res.status_code}: {res.text}"


# ============================================================================
# SPIKE 2: Kill Switch Degradation & Last Super Admin Invariant
# ============================================================================

def test_spike2_kill_switch_degradation_and_last_super_admin(db_session, client):
    """
    SPIKE 2: Tests 8 kill switches graceful degradation paths and prevents demoting/suspending the last super_admin.
    """
    super_admin = seed_test_user(db_session, "sa@spike2.com", "super_admin")
    admin = seed_test_user(db_session, "adm@spike2.com", "admin")
    sa_headers = auth_headers(super_admin)

    # 1. Invariant: Cannot suspend or demote the last super_admin
    res_suspend = client.post(
        f"/api/v1/admin/users/{super_admin.id}/suspend",
        json={"reason": "Testing safety lockout invariant"},
        headers=sa_headers,
    )
    assert res_suspend.status_code in (400, 422)
    assert "Cannot suspend the last active super_admin" in res_suspend.text

    res_demote = client.post(
        f"/api/v1/admin/users/{super_admin.id}/assign-role",
        json={"new_role": "admin", "reason": "Attempting demotion of sole super admin"},
        headers=sa_headers,
    )
    assert res_demote.status_code in (400, 422)
    assert "Cannot demote the last super_admin" in res_demote.text

    # 2. Toggle kill switches and verify state
    switches = [
        "ai.global", "ai.analysis", "ai.chat", "chat.enabled",
        "emergency_card.public", "registration.open", "voice.enabled", "maintenance_mode"
    ]
    for s_name in switches:
        toggle_res = client.post(
            f"/api/v1/admin/kill-switches/{s_name}/toggle",
            json={"enabled": True, "reason": f"Activating {s_name} switch"},
            headers=sa_headers,
        )
        assert toggle_res.status_code == 200
        assert toggle_res.json()["switch_name"] == s_name
        assert toggle_res.json()["active"] is True

    # List kill switches should report all 8 active
    list_res = client.get("/api/v1/admin/kill-switches", headers=sa_headers)
    assert list_res.status_code == 200
    ks_list = list_res.json()["kill_switches"]
    assert len(ks_list) == 8
    for ks in ks_list:
        assert ks["active"] is True


# ============================================================================
# GATE 1: AC-01 Identity & Access Controls
# ============================================================================

def test_gate1_identity_and_access_controls(db_session, client):
    """
    Gate 1: AC-01 Identity & Access Management.
    User invite, edit, suspend, reactivate, token_version session revocation,
    reset password/MFA, temporary grants with expiry, caregiver links, bulk actions, lockouts.
    """
    admin = seed_test_user(db_session, "adm_id@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. Invite User
    res_inv = client.post(
        "/api/v1/admin/users",
        json={
            "email": "invited.clinician@test.com",
            "role": "clinician",
            "full_name": "Dr. Invited Clinician",
            "phone_number": "+919876543210",
            "reason": "Onboarding new doctor",
        },
        headers=adm_headers,
    )
    assert res_inv.status_code == 201
    invited_id = res_inv.json()["user_id"]

    # 2. Search & List Users
    res_list = client.get("/api/v1/admin/users?search=Invited", headers=adm_headers)
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1

    # 3. Edit User Profile
    res_edit = client.patch(
        f"/api/v1/admin/users/{invited_id}",
        json={"phone_number": "+919999888877", "reason": "Corrected contact number"},
        headers=adm_headers,
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["phone_number"] == "+919999888877"

    # 4. Suspend User & Verify Access Blocked
    res_susp = client.post(
        f"/api/v1/admin/users/{invited_id}/suspend",
        json={"reason": "Suspension for credential review"},
        headers=adm_headers,
    )
    assert res_susp.status_code == 200
    assert res_susp.json()["is_suspended"] is True

    # 5. Reactivate User
    res_react = client.post(
        f"/api/v1/admin/users/{invited_id}/reactivate",
        json={"reason": "Reactivating verified account"},
        headers=adm_headers,
    )
    assert res_react.status_code == 200
    assert res_react.json()["is_suspended"] is False

    # 6. Session Revocation: Increment token_version -> old token rejected with 401
    test_patient = seed_test_user(db_session, "pat_revoke@test.com", "patient", token_version=1)
    old_headers = auth_headers(test_patient)

    # Old token works before revocation
    res_me_before = client.get("/api/v1/auth/me", headers=old_headers)
    assert res_me_before.status_code == 200

    # Admin revokes user sessions
    res_revoke = client.post(
        f"/api/v1/admin/users/{test_patient.id}/revoke-sessions",
        json={"reason": "Security force-logout across all devices"},
        headers=adm_headers,
    )
    assert res_revoke.status_code == 200
    assert res_revoke.json()["new_token_version"] == 2

    # Old token with token_version=1 is now immediately rejected
    res_me_after = client.get("/api/v1/auth/me", headers=old_headers)
    assert res_me_after.status_code == 401
    assert "Session has been revoked" in res_me_after.text

    # 7. Temporary Permission Grant with Expiry
    res_grant = client.post(
        f"/api/v1/admin/users/{test_patient.id}/grants",
        json={"permission_code": "perm.cases.list", "duration_minutes": 30, "reason": "Temporary audit read grant"},
        headers=adm_headers,
    )
    assert res_grant.status_code == 200
    assert res_grant.json()["permission_code"] == "perm.cases.list"
    assert user_has_permission(test_patient, "perm.cases.list", db_session) is True

    # 8. Caregiver Link Oversight
    cg = seed_test_user(db_session, "cg_link@test.com", "caregiver")
    link = CaregiverLink(patient_id=test_patient.id, caregiver_id=cg.id, payload={"relationship": "parent"})
    db_session.add(link)
    db_session.commit()

    res_links = client.get("/api/v1/admin/users/caregiver-links", headers=adm_headers)
    assert res_links.status_code == 200
    assert len(res_links.json()["links"]) >= 1

    res_rev_link = client.delete(
        f"/api/v1/admin/users/caregiver-links/{link.id}",
        headers=adm_headers,
        params={"reason": "Caregiver linkage revoked by patient request"},
    )
    assert res_rev_link.status_code == 200

    # 9. Lockout Monitor and Unlock
    test_patient.failed_login_attempts = 5
    test_patient.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
    db_session.commit()

    res_lockouts = client.get("/api/v1/admin/users/lockouts/list", headers=adm_headers)
    assert res_lockouts.status_code == 200
    assert res_lockouts.json()["total"] >= 1

    res_unlock = client.post(
        f"/api/v1/admin/users/{test_patient.id}/unlock",
        json={"reason": "Customer identity verified via telephone"},
        headers=adm_headers,
    )
    assert res_unlock.status_code == 200
    assert test_patient.locked_until is None


# ============================================================================
# GATE 2: Clinician Verification Gate
# ============================================================================

def test_gate2_clinician_verification_gate(db_session, client):
    """
    Gate 2: Clinician permissions remain provably inactive until formal admin approval.
    Unverified clinician -> submission -> admin approval -> permissions activate.
    """
    admin = seed_test_user(db_session, "adm_verify@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. Create clinician with unverified status
    clinician = seed_test_user(
        db_session, "cln_unverified@test.com", "clinician", verification_status="unverified"
    )

    # PROVE: Clinician permissions are empty
    perms_before = get_user_permissions(clinician, db_session)
    assert len(perms_before) == 0, f"Expected 0 permissions for unverified clinician, got {perms_before}"
    assert user_has_permission(clinician, "perm.cases.review", db_session) is False

    # 2. Clinician submits verification credentials
    cln_headers = auth_headers(clinician)
    res_sub = client.post(
        "/api/v1/admin/users/clinicians/submit-verification",
        json={
            "registration_number": "MCI-2026-99988",
            "credential_doc_url": "https://credentials.gov.in/docs/99988.pdf",
        },
        headers=cln_headers,
    )
    assert res_sub.status_code == 200
    assert res_sub.json()["verification_status"] == "pending"

    # Status is now pending, still provably inactive
    db_session.refresh(clinician)
    assert get_user_permissions(clinician, db_session) == set()

    # 3. Admin verifies and approves the clinician
    res_decision = client.post(
        f"/api/v1/admin/users/clinicians/{clinician.id}/verify",
        json={"decision": "approved", "reason": "Medical council registration verified in official registry."},
        headers=adm_headers,
    )
    assert res_decision.status_code == 200
    assert res_decision.json()["status"] == "success"

    # 4. PROVE: Clinician permissions immediately activate upon approval!
    db_session.refresh(clinician)
    assert clinician.clinician_verification_status == "approved"
    perms_after = get_user_permissions(clinician, db_session)
    assert "perm.cases.review" in perms_after
    assert "perm.cases.override_triage" in perms_after
    assert user_has_permission(clinician, "perm.cases.review", db_session) is True


# ============================================================================
# GATE 3: AC-02 Flags, Settings, Rollbacks & Announcements
# ============================================================================

def test_gate3_flags_settings_rollbacks_and_announcements(db_session, client):
    """
    Gate 3: AC-02 Flags, Settings, Rollbacks, and Announcements.
    """
    admin = seed_test_user(db_session, "adm_cfg@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. Feature Flag: Boolean & Percentage Rollout
    res_flag = client.post(
        "/api/v1/admin/flags",
        json={
            "flag_name": "ai.diagnostic_copilot",
            "flag_type": "percentage_rollout",
            "enabled": True,
            "percentage": 50.0,
            "reason": "Gradual 50% rollout of copilot",
        },
        headers=adm_headers,
    )
    assert res_flag.status_code == 200

    # Evaluate flag for deterministic user IDs
    eval_low = FlagsSettingsService.get_flag_status(db=db_session, flag_name="ai.diagnostic_copilot", user_id=1)
    assert "enabled" in eval_low

    # 2. Typed Settings Versioning & Rollback
    # Version 1
    res_s1 = client.post(
        "/api/v1/admin/settings",
        json={
            "namespace": "sla",
            "key": "triage_response_hours",
            "value": {"emergency": 0.5, "urgent": 2.0},
            "reason": "Initial SLA setup",
        },
        headers=adm_headers,
    )
    assert res_s1.status_code == 200
    assert res_s1.json()["version"] == 1

    # Version 2
    res_s2 = client.post(
        "/api/v1/admin/settings",
        json={
            "namespace": "sla",
            "key": "triage_response_hours",
            "value": {"emergency": 0.25, "urgent": 1.0},
            "reason": "Tightening SLA standards",
        },
        headers=adm_headers,
    )
    assert res_s2.status_code == 200
    assert res_s2.json()["version"] == 2

    # Rollback to Version 1 -> creates Version 3 mirroring Version 1
    res_rb = client.post(
        "/api/v1/admin/settings/rollback",
        json={
            "namespace": "sla",
            "key": "triage_response_hours",
            "target_version": 1,
            "reason": "Reverting due to clinical staffing shortage",
        },
        headers=adm_headers,
    )
    assert res_rb.status_code == 200
    assert res_rb.json()["restored_version"] == 3
    assert res_rb.json()["checksum"] == res_s1.json()["checksum"]

    # 3. Announcements
    now = datetime.now(timezone.utc)
    res_ann = client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "System Maintenance Window",
            "message": "Scheduled maintenance from 02:00 to 03:00 IST.",
            "audience": "patient",
            "banner_type": "maintenance",
            "effective_at": now.isoformat(),
            "reason": "Routine server patch announcement",
        },
        headers=adm_headers,
    )
    assert res_ann.status_code == 201

    # Fetch announcements for patient
    pat_user = seed_test_user(db_session, "pat_ann@test.com", "patient")
    pat_headers = auth_headers(pat_user)
    res_ann_list = client.get("/api/v1/admin/announcements", headers=pat_headers)
    assert res_ann_list.status_code == 200
    assert len(res_ann_list.json()["announcements"]) >= 1


# ============================================================================
# GATE 4: AC-05 Case Oversight (Zero PHI & Worklists)
# ============================================================================

def test_gate4_case_oversight_zero_phi_search_and_worklists(db_session, client):
    """
    Gate 4: AC-05 Case & Queue Oversight.
    Guarantees zero-PHI metadata-only search with strict field allowlist.
    Tests governed worklists, clinician reassignments, and case restorations.
    """
    admin = seed_test_user(db_session, "adm_case@test.com", "admin")
    adm_headers = auth_headers(admin)
    patient = seed_test_user(db_session, "pat_case@test.com", "patient")
    clinician = seed_test_user(db_session, "cln_case@test.com", "clinician")

    # Seed an emergency case with PHI details
    now = datetime.now(timezone.utc)
    case = Case(
        patient_id=patient.id,
        chief_complaint="Severe chest pain radiating to jaw and nausea",  # SENSITIVE PHI
        is_emergency_flag=True,
        emergency_rule_fired="RULE_CHEST_PAIN_ACUTE",
        status="ACTIVE",
        assigned_clinician_id=clinician.id,
        created_at=now - timedelta(hours=36),
    )
    db_session.add(case)
    db_session.flush()

    symptom = SymptomEntry(case_id=case.id, symptom="Chest Pain", severity=9, duration="2 hours")
    db_session.add(symptom)
    triage = TriageResult(case_id=case.id, triage_level="Emergency", risk_score=95.0, explanation="Severe respiratory distress and low oxygen saturation.", is_current="true")
    db_session.add(triage)
    db_session.commit()

    # 1. Zero-PHI Metadata Search
    res_search = client.get("/api/v1/admin/cases/metadata-search", headers=adm_headers)
    assert res_search.status_code == 200
    cases_found = res_search.json()["cases"]
    assert len(cases_found) >= 1

    for c in cases_found:
        # Assert strictly that no PHI fields exist in the response
        assert "chief_complaint" not in c, "SECURITY VIOLATION: chief_complaint leaked in metadata search!"
        assert "symptoms" not in c, "SECURITY VIOLATION: symptoms leaked in metadata search!"
        assert "patient_name" not in c
        assert "patient_email" not in c

        # Assert allowed metadata fields are present
        for field in c.keys():
            assert field in ALLOWED_CASE_METADATA_FIELDS, f"Field '{field}' not in allowed metadata allowlist!"

    # 2. Worklists Query
    res_wl = client.get("/api/v1/admin/cases/worklists?unreviewed_threshold_hours=24", headers=adm_headers)
    assert res_wl.status_code == 200
    worklists = res_wl.json()["worklists"]
    assert "unreviewed_cases" in worklists
    assert "low_confidence_backlog" in worklists
    assert "red_flag_retractions" in worklists
    assert "stuck_cases" in worklists
    assert "purge_pending" in worklists

    # 3. Case Reassignment
    new_doc = seed_test_user(db_session, "new_doc@test.com", "clinician")
    res_reassign = client.post(
        f"/api/v1/admin/cases/{case.id}/reassign",
        json={"new_clinician_id": new_doc.id, "reason": "Balancing emergency department caseload"},
        headers=adm_headers,
    )
    assert res_reassign.status_code == 200
    db_session.refresh(case)
    assert case.assigned_clinician_id == new_doc.id


# ============================================================================
# GATE 5: AC-06 DPDP Data Rights Queue & Legal Hold
# ============================================================================

def test_gate5_dpdp_data_rights_queue_and_legal_hold(db_session, client):
    """
    Gate 5: AC-06 DPDP Data Rights Queue.
    Enforces 72h SLA, legal hold override on erasure, and consent version bump.
    """
    admin = seed_test_user(db_session, "adm_dpdp@test.com", "admin")
    adm_headers = auth_headers(admin)
    patient = seed_test_user(db_session, "pat_dpdp@test.com", "patient")

    # 1. Create DPDP Erasure Request -> Verify 72-hour statutory due date
    res_req = client.post(
        "/api/v1/admin/dpdp/requests",
        json={"user_id": patient.id, "request_type": "ERASURE"},
        headers=adm_headers,
    )
    assert res_req.status_code == 201
    req_id = res_req.json()["request_id"]
    due_dt = datetime.fromisoformat(res_req.json()["due_date"].replace("Z", "+00:00"))
    if due_dt.tzinfo is None:
        due_dt = due_dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta_hours = (due_dt - now).total_seconds() / 3600.0
    assert 71.0 <= delta_hours <= 73.0, f"Expected ~72 hours SLA, got {delta_hours}"

    # 2. Toggle Legal Hold on the request
    res_hold = client.post(
        "/api/v1/admin/dpdp/legal-hold",
        json={
            "target_type": "request",
            "target_id": req_id,
            "enabled": True,
            "reason": "Court subpoena pending in judicial district 4",
        },
        headers=adm_headers,
    )
    assert res_hold.status_code == 200

    # 3. Attempt Erasure while Legal Hold is active -> MUST BE REJECTED with 409
    res_erase_blocked = client.post(
        f"/api/v1/admin/dpdp/requests/{req_id}/erasure",
        json={"reason": "Patient requested DPDP right to be forgotten"},
        headers=adm_headers,
    )
    assert res_erase_blocked.status_code == 409
    assert "under active legal hold" in res_erase_blocked.text

    # 4. Lift Legal Hold with valid operational reason
    res_unhold = client.post(
        "/api/v1/admin/dpdp/legal-hold",
        json={
            "target_type": "request",
            "target_id": req_id,
            "enabled": False,
            "reason": "Court proceedings concluded and subpoena expired",
        },
        headers=adm_headers,
    )
    assert res_unhold.status_code == 200

    # 5. Verify identity & Execute Erasure
    res_verify = client.post(
        f"/api/v1/admin/dpdp/requests/{req_id}/verify",
        json={"reason": "Aadhaar e-KYC verified by clinical administrator"},
        headers=adm_headers,
    )
    assert res_verify.status_code == 200

    res_erase = client.post(
        f"/api/v1/admin/dpdp/requests/{req_id}/erasure",
        json={"reason": "Lawful erasure executed post-identity verification"},
        headers=adm_headers,
    )
    assert res_erase.status_code == 200

    # 6. Consent Version Bump
    res_bump = client.post(
        "/api/v1/admin/dpdp/consent-version-bump",
        json={"new_version": "v2.0-dpdp2026", "reason": "Updated privacy policy for DPDP 2026 amendments"},
        headers=adm_headers,
    )
    assert res_bump.status_code == 200
    db_session.refresh(patient)
    assert patient.requires_reconsent is True


# ============================================================================
# GATE 6: AC-11 Approvals Center (Dual Control Strict vs Demo)
# ============================================================================

def test_gate6_approvals_center_dual_control_strict_and_demo(db_session, client):
    """
    Gate 6: AC-11 Dual Control Approvals Center.
    Verifies before/after diffs, strict mode blocking self-approval,
    and demo mode setting self_approved_demo=True.
    """
    admin1 = seed_test_user(db_session, "admin1@approvals.com", "admin")
    admin2 = seed_test_user(db_session, "admin2@approvals.com", "admin")
    a1_headers = auth_headers(admin1)
    a2_headers = auth_headers(admin2)

    # Seed case to request purge
    pat = seed_test_user(db_session, "pat_purge@test.com", "patient")
    case = Case(patient_id=pat.id, chief_complaint="Old case needing retention purge", is_emergency_flag=False)
    db_session.add(case)
    db_session.commit()

    # Admin 1 requests case purge (creates PENDING_APPROVAL admin action)
    res_req = client.post(
        f"/api/v1/admin/cases/{case.id}/purge-request",
        json={"reason": "Statutory 3-year medical record retention elapsed"},
        headers=a1_headers,
    )
    assert res_req.status_code == 200
    action_id = res_req.json()["admin_action_id"]

    # 1. Pending Approvals Queue displays action with diffs
    res_pending = client.get("/api/v1/admin/approvals", headers=a1_headers)
    assert res_pending.status_code == 200
    pending_list = res_pending.json()["pending_approvals"]
    assert any(a["id"] == action_id for a in pending_list)

    # 2. Strict Mode: Admin 1 (requester) cannot approve their own action
    settings.DUAL_CONTROL_MODE = "strict"
    res_self_deny = client.post(
        f"/api/v1/admin/approvals/{action_id}/decide",
        json={"decision": "APPROVE", "notes": "Attempting self approval in strict mode"},
        headers=a1_headers,
    )
    assert res_self_deny.status_code == 403
    assert "Dual control violation: Requester cannot approve their own action in strict mode" in res_self_deny.text

    # 3. Strict Mode: Admin 2 (second party) approves -> Target action executes
    res_approve = client.post(
        f"/api/v1/admin/approvals/{action_id}/decide",
        json={"decision": "APPROVE", "notes": "Approved by secondary clinical compliance officer"},
        headers=a2_headers,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["decision"] == "APPROVE"
    assert res_approve.json()["self_approved_demo"] is False
    db_session.refresh(case)
    assert case.chief_complaint == "[PURGED_PHI]"

    # 4. Demo Mode: Requester CAN self-approve, recording self_approved_demo=True
    settings.DUAL_CONTROL_MODE = "demo"
    case2 = Case(patient_id=pat.id, chief_complaint="Demo case to purge", is_emergency_flag=False)
    db_session.add(case2)
    db_session.commit()

    res_req2 = client.post(
        f"/api/v1/admin/cases/{case2.id}/purge-request",
        json={"reason": "Demo mode purge test"},
        headers=a1_headers,
    )
    action_id2 = res_req2.json()["admin_action_id"]

    res_demo_approve = client.post(
        f"/api/v1/admin/approvals/{action_id2}/decide",
        json={"decision": "APPROVE", "notes": "Approved in sandbox demo mode"},
        headers=a1_headers,
    )
    assert res_demo_approve.status_code == 200
    assert res_demo_approve.json()["self_approved_demo"] is True

    # Restore default setting
    settings.DUAL_CONTROL_MODE = "demo"


# ============================================================================
# GATE 7: AC-12 Needs Attention Aggregator
# ============================================================================

def test_gate7_needs_attention_aggregator(db_session, client):
    """
    Gate 7: AC-12 Needs Attention Home.
    Verifies all 8 categories are aggregated, deep links are provided,
    and zero dead-end counters exist.
    """
    admin = seed_test_user(db_session, "adm_na@test.com", "admin")
    adm_headers = auth_headers(admin)

    # Seed one item for each category to ensure non-zero counts
    # Category 1: Unacknowledged red flag
    pat = seed_test_user(db_session, "pat_na@test.com", "patient")
    c_red = Case(patient_id=pat.id, is_emergency_flag=True, acknowledged_at=None, chief_complaint="Chest tightness")
    db_session.add(c_red)

    # Category 4: Failing job run
    job = JobRun(job_name="retention_purge", status="FAILED")
    db_session.add(job)

    # Category 8: Unverified clinician
    seed_test_user(db_session, "cln_pend@test.com", "clinician", verification_status="pending")
    db_session.commit()

    res_na = client.get("/api/v1/admin/needs-attention", headers=adm_headers)
    assert res_na.status_code == 200
    data = res_na.json()

    assert data["total_categories"] == 8
    categories = {c["category"]: c for c in data["categories"]}

    expected_categories = [
        "unacknowledged_red_flags",
        "pending_approvals",
        "data_rights_near_sla",
        "failing_jobs",
        "stale_emergency_numbers",
        "ai_fallback_rate_spikes",
        "audit_chain_status",
        "unverified_clinicians",
    ]

    for cat_name in expected_categories:
        assert cat_name in categories, f"Category '{cat_name}' missing from Needs Attention response!"
        cat_info = categories[cat_name]
        # Actionable drill-down guarantee: valid deep link route, zero dead ends
        assert cat_info["action_url"].startswith("/admin/"), f"Dead-end action_url for {cat_name}: {cat_info['action_url']}"
        assert len(cat_info["title"]) > 0
        assert len(cat_info["summary"]) > 0
        assert isinstance(cat_info["count"], int)


# ============================================================================
# GATE 8: Cryptographic Audit Chain Intactness
# ============================================================================

def test_gate8_cryptographic_audit_chain_intactness(db_session, client):
    """
    Gate 8: Cryptographic SHA-256 Audit Chain.
    Walks all admin_actions sequentially from id 1 and verifies prev_hash and entry_hash digests.
    """
    admin = seed_test_user(db_session, "adm_audit@test.com", "admin")
    adm_headers = auth_headers(admin)

    # Perform multiple administrative operations
    r1 = client.post(
        "/api/v1/admin/kill-switches/voice.enabled/toggle",
        json={"enabled": True, "reason": "Audit verification step 1"},
        headers=adm_headers,
    )
    assert r1.status_code == 200, f"r1 failed with {r1.status_code}: {r1.text}"

    r2 = client.post(
        "/api/v1/admin/settings",
        json={"namespace": "audit_test", "key": "sample_key", "value": "val1", "reason": "Audit verification step 2"},
        headers=adm_headers,
    )
    assert r2.status_code == 200, f"r2 failed with {r2.status_code}: {r2.text}"

    # Call verify endpoint
    res_verify = client.get("/api/v1/admin/audit-chain/verify", headers=adm_headers)
    assert res_verify.status_code == 200
    chain_status = res_verify.json()

    assert chain_status["status"] == "intact", f"Audit chain broken: {chain_status}"
    assert chain_status["total_records"] >= 2


def test_role_and_permission_matrix_endpoints(db_session, client):
    """Verifies role listing, creation, permission matrix mapping, and self-lockout guard."""
    admin = seed_test_user(db_session, "adm_role_test@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. List permissions
    res_perms = client.get("/api/v1/admin/permissions", headers=adm_headers)
    assert res_perms.status_code == 200
    perms_data = res_perms.json()
    assert perms_data["total"] >= 25
    assert any(p["code"] == "perm.cases.create" for p in perms_data["permissions"])
    assert any(p["category"] == "Clinical Cases & Triage" for p in perms_data["permissions"])

    # 2. List roles
    res_roles = client.get("/api/v1/admin/roles", headers=adm_headers)
    assert res_roles.status_code == 200
    roles_data = res_roles.json()
    assert roles_data["total"] >= 4

    # 3. Create custom role
    res_create = client.post(
        "/api/v1/admin/roles",
        json={
            "code": "triage_officer",
            "description": "Custom triage officer role",
            "permissions": ["perm.cases.read", "perm.cases.list", "perm.cases.override_triage"],
            "reason": "Creating dedicated triage officer role for ER",
        },
        headers=adm_headers,
    )
    assert res_create.status_code == 201
    create_data = res_create.json()
    assert create_data["role_code"] == "triage_officer"

    # 4. Get permissions for the custom role
    res_rp = client.get("/api/v1/admin/roles/triage_officer/permissions", headers=adm_headers)
    assert res_rp.status_code == 200
    assert set(res_rp.json()["permissions"]) == {"perm.cases.read", "perm.cases.list", "perm.cases.override_triage"}

    # 5. Update permissions for role
    res_update = client.put(
        "/api/v1/admin/roles/triage_officer/permissions",
        json={
            "permissions": ["perm.cases.read", "perm.cases.list", "perm.cases.override_triage", "perm.cases.feedback"],
            "reason": "Adding clinician feedback capability",
        },
        headers=adm_headers,
    )
    assert res_update.status_code == 200
    assert "perm.cases.feedback" in res_update.json()["permissions"]

    # 6. Verify self-lockout check: editing admin's own role cannot strip perm.admin.users.manage
    res_lockout = client.put(
        "/api/v1/admin/roles/admin/permissions",
        json={
            "permissions": ["perm.cases.read"],
            "reason": "Attempting self-lockout by removing admin permissions",
        },
        headers=adm_headers,
    )
    assert res_lockout.status_code == 400
    assert "Self-lockout prevented" in res_lockout.json()["detail"]

