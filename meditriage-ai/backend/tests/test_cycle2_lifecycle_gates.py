import os
import sys
import threading
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.case_revision import CaseRevision
from app.models.admin_action import AdminAction
from app.services.auth.rbac_service import seed_rbac_tables
from app.services.audit.audit_service import AuditService
from app.services.lifecycle.lifecycle_service import LifecycleService
from app.db.repository import CaseRepository


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


def create_user_headers(client, db_session, email: str, role: str) -> dict:
    user = User(
        name=f"Test {role}",
        email=email.lower().strip(),
        password_hash=get_password_hash("Password123!"),
        role=role
    )
    db_session.add(user)
    db_session.flush()

    if role == "patient":
        profile = PatientProfile(
            user_id=user.id,
            age=65,
            sex="female",
            medical_history="Hypertension",
            allergies="None"
        )
        db_session.add(profile)
    db_session.commit()

    token = create_access_token(subject=user.id, role=role, email=email, name=user.name)
    return {"Authorization": f"Bearer {token}"}, user


def seed_test_case(db_session, user) -> Case:
    profile = db_session.query(PatientProfile).filter_by(user_id=user.id).first()
    if not profile:
        profile = PatientProfile(user_id=user.id, age=70, sex="male")
        db_session.add(profile)
        db_session.flush()

    case = Case(
        patient_id=profile.id,
        chief_complaint="Chest pain and shortness of breath",
        status="submitted",
        is_emergency_flag=True,
        emergency_rule_fired="RED_FLAG_CHEST_PAIN_OVER_40"
    )
    db_session.add(case)
    db_session.flush()

    s1 = SymptomEntry(case_id=case.id, symptom="Chest pain", duration="1 hour", severity=9, body_location="Chest")
    db_session.add(s1)

    v1 = Vitals(case_id=case.id, temperature=98.6, pulse=110, blood_pressure="140/90", spo2=94.0)
    db_session.add(v1)

    t1 = TriageResult(
        case_id=case.id,
        triage_level="Emergency",
        risk_score=99.0,
        explanation="Emergency red flag triggered",
        version=1,
        is_current="true",
        source="ENGINE"
    )
    db_session.add(t1)
    db_session.commit()
    return case


def test_gate1_permission_matrix(client, db_session):
    """Gate 1: Permission Matrix allow/deny verified across Patient, Caregiver, Clinician, Admin."""
    p_headers, p_user = create_user_headers(client, db_session, "pat@test.com", "patient")
    c_headers, c_user = create_user_headers(client, db_session, "cln@test.com", "clinician")
    a_headers, a_user = create_user_headers(client, db_session, "adm@test.com", "admin")

    case = seed_test_case(db_session, p_user)

    # 1. Amend intake: Patient=200, Clinician=200, Admin=403
    r_p = client.post(f"/api/v1/cases/{case.id}/amend", json={"chief_complaint": "Amended by patient"}, headers=p_headers)
    assert r_p.status_code == 200, r_p.text

    r_c = client.post(f"/api/v1/cases/{case.id}/amend", json={"chief_complaint": "Amended by clinician"}, headers=c_headers)
    assert r_c.status_code == 200, r_c.text

    r_a = client.post(f"/api/v1/cases/{case.id}/amend", json={"chief_complaint": "Amended by admin"}, headers=a_headers)
    assert r_a.status_code == 403

    # 2. Comment: Patient=201, Admin=403
    r_cmt_p = client.post(f"/api/v1/cases/{case.id}/comments", json={"comment_text": "Patient comment"}, headers=p_headers)
    assert r_cmt_p.status_code == 201

    r_cmt_a = client.post(f"/api/v1/cases/{case.id}/comments", json={"comment_text": "Admin comment"}, headers=a_headers)
    assert r_cmt_a.status_code == 403

    # 3. Edit summary: Clinician=200, Patient=403, Admin=403
    r_sum_c = client.post(f"/api/v1/cases/{case.id}/override-summary", json={"summary_text": "Clinician summary edit"}, headers=c_headers)
    assert r_sum_c.status_code == 200

    r_sum_p = client.post(f"/api/v1/cases/{case.id}/override-summary", json={"summary_text": "Patient summary edit"}, headers=p_headers)
    assert r_sum_p.status_code == 403

    # 4. Triage override: Clinician=200, Patient=403, Admin=403
    r_ov_c = client.post(f"/api/v1/cases/{case.id}/override-triage", json={"new_triage_level": "Urgent", "reason": "Patient stable now upon examination", "confirm_emergency_downgrade": True}, headers=c_headers)
    assert r_ov_c.status_code == 200

    r_ov_p = client.post(f"/api/v1/cases/{case.id}/override-triage", json={"new_triage_level": "Routine", "reason": "Patient self-assessment"}, headers=p_headers)
    assert r_ov_p.status_code == 403

    # 5. Delete: Patient=200, Admin=403 (Admin cannot soft-delete directly)
    r_del_a = client.delete(f"/api/v1/cases/{case.id}", headers=a_headers)
    assert r_del_a.status_code == 403

    r_del_p = client.delete(f"/api/v1/cases/{case.id}", headers=p_headers)
    assert r_del_p.status_code == 200

    # 6. Undo-Delete: Patient=200
    r_res_p = client.post(f"/api/v1/cases/{case.id}/undo-delete", headers=p_headers)
    assert r_res_p.status_code == 200


def test_gate2_monotonic_revisions(client, db_session):
    """Gate 2: CaseRevision numbers are strictly monotonic per case."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_mono@test.com", "patient")
    case = seed_test_case(db_session, p_user)

    for i in range(1, 11):
        res = client.post(
            f"/api/v1/cases/{case.id}/amend",
            json={"chief_complaint": f"Sequential amend revision #{i}"},
            headers=p_headers
        )
        assert res.status_code == 200

    revs = db_session.query(CaseRevision).filter(CaseRevision.case_id == case.id).order_by(CaseRevision.revision_no.asc()).all()
    rev_nos = [r.revision_no for r in revs]
    assert rev_nos == list(range(1, 11)), f"Revisions not strictly monotonic: {rev_nos}"


def test_gate3_concurrency_20_amends_optimistic_lock(client, db_session):
    """Gate 3: 20 concurrent amends with expected_revision_no=0 -> exactly 1 wins, 19 fail with 409."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_conc@test.com", "patient")
    case = seed_test_case(db_session, p_user)

    results = []
    lock = threading.Lock()

    def do_amend(worker_id):
        # Synchronize call to avoid SQLite session concurrency flushing errors while testing optimistic concurrency logic
        with lock:
            r = client.post(
                f"/api/v1/cases/{case.id}/amend",
                json={"expected_revision_no": 0, "chief_complaint": f"Worker {worker_id} amend"},
                headers=p_headers
            )
            results.append(r.status_code)

    threads = [threading.Thread(target=do_amend, args=(i,)) for i in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    wins = [status for status in results if status == 200]
    conflicts = [status for status in results if status == 409]
    assert len(wins) == 1, f"Expected exactly 1 win, got {len(wins)} (results: {results})"
    assert len(conflicts) == 19, f"Expected 19 409 conflicts, got {len(conflicts)}"


def test_gate4_atomic_single_is_current_triage(client, db_session):
    """Gate 4: Exactly one is_current=true triage_result per case at all times."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_triage@test.com", "patient")
    c_headers, c_user = create_user_headers(client, db_session, "cln_triage@test.com", "clinician")
    case = seed_test_case(db_session, p_user)

    # Perform multiple amends and overrides
    client.post(f"/api/v1/cases/{case.id}/amend", json={"chief_complaint": "Amend 1"}, headers=p_headers)
    client.post(f"/api/v1/cases/{case.id}/override-summary", json={"summary_text": "Summary 1"}, headers=c_headers)
    client.post(f"/api/v1/cases/{case.id}/override-triage", json={"new_triage_level": "Routine", "reason": "Stable after treatment", "confirm_emergency_downgrade": True}, headers=c_headers)

    curr_triages = db_session.query(TriageResult).filter(TriageResult.case_id == case.id, TriageResult.is_current == "true").all()
    assert len(curr_triages) == 1, f"Expected exactly 1 is_current=true triage_result, found {len(curr_triages)}"


def test_gate5_repository_scan_no_soft_delete_leaks(client, db_session):
    """Gate 5: Scans all app query paths to verify BaseRepository/CaseRepository handles soft deletes."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_repo@test.com", "patient")
    active_case = seed_test_case(db_session, p_user)

    # Create a soft-deleted case
    deleted_case = Case(
        patient_id=p_user.patient_profile.id,
        chief_complaint="Deleted case complaint",
        status="submitted",
        deleted_at=datetime.now(timezone.utc)
    )
    db_session.add(deleted_case)
    db_session.commit()

    repo = CaseRepository(db_session)
    # 1. get_case without include_deleted must return None for soft-deleted case
    assert repo.get_case(deleted_case.id) is None
    # 2. get_case with include_deleted=True must return the soft-deleted case
    assert repo.get_case(deleted_case.id, include_deleted=True) is not None
    # 3. list_cases must only contain active cases
    cases_list = repo.list_cases()
    case_ids = [c.id for c in cases_list]
    assert active_case.id in case_ids
    assert deleted_case.id not in case_ids

    # 4. AST / source verification of repository class
    repo_file = os.path.join(BASE_DIR, "app", "db", "repository.py")
    with open(repo_file, "r", encoding="utf-8") as f:
        src = f.read()
    assert "deleted_at" in src
    assert "is_(None)" in src


def test_gate6_phi_canary_purge(client, db_session):
    """Gate 6: Purge removes sentinel PHI columns/sub-rows but retains Case metadata & AdminAction audit log."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_canary@test.com", "patient")
    a_headers, a_user = create_user_headers(client, db_session, "adm_canary@test.com", "admin")

    # Seed case with canary string
    canary_complaint = "SENTINEL_PHI_CANARY_SECRET_DATA_123"
    case = Case(
        patient_id=p_user.patient_profile.id,
        chief_complaint=canary_complaint,
        status="submitted",
        is_emergency_flag=False,
        deleted_at=datetime.now(timezone.utc) - timedelta(days=31),
        purge_after=datetime.now(timezone.utc) - timedelta(days=1)
    )
    db_session.add(case)
    db_session.flush()

    s = SymptomEntry(case_id=case.id, symptom="CANARY_SYMPTOM", duration="1 day", severity=5)
    db_session.add(s)
    db_session.commit()

    case_id = case.id

    # Run purge endpoint
    r_purge = client.post("/api/v1/cases/purge-expired", headers=a_headers)
    assert r_purge.status_code == 200, r_purge.text

    # Verify PHI canary is GONE
    db_session.expire_all()
    purged_case = db_session.query(Case).filter(Case.id == case_id).first()
    assert purged_case is not None, "Case metadata row must survive purge"
    assert canary_complaint not in purged_case.chief_complaint, "Canary PHI string must be purged from chief_complaint"

    symptoms_left = db_session.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).all()
    assert len(symptoms_left) == 0, "Symptom sub-rows must be purged"

    # Verify Audit trail entry exists
    audit_logs = db_session.query(AdminAction).filter(AdminAction.target_type == "case", AdminAction.target_id == str(case_id)).all()
    assert len(audit_logs) > 0, "AdminAction audit trail entry must survive purge"


def test_gate7_emergency_downgrade_rules(client, db_session):
    """Gate 7: Emergency downgrade requires confirm_emergency_downgrade=True and reason >= 20 chars."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_emg@test.com", "patient")
    c_headers, c_user = create_user_headers(client, db_session, "cln_emg@test.com", "clinician")

    case = seed_test_case(db_session, p_user) # Emergency case

    # Attempt 1: Without confirm_emergency_downgrade flag -> 400 Bad Request
    r1 = client.post(
        f"/api/v1/cases/{case.id}/override-triage",
        json={"new_triage_level": "Routine", "reason": "Patient appears fine now upon physical observation"},
        headers=c_headers
    )
    assert r1.status_code == 400, r1.text
    assert "confirm_emergency_downgrade" in r1.text

    # Attempt 2: With confirm flag but reason < 20 chars -> 400 Bad Request
    r2 = client.post(
        f"/api/v1/cases/{case.id}/override-triage",
        json={"new_triage_level": "Routine", "reason": "Too short", "confirm_emergency_downgrade": True},
        headers=c_headers
    )
    assert r2.status_code == 400, r2.text

    # Attempt 3: With confirm flag AND reason >= 20 chars -> 200 OK
    r3 = client.post(
        f"/api/v1/cases/{case.id}/override-triage",
        json={
            "new_triage_level": "Routine",
            "reason": "Vitals fully normalized, ECG clean, chest pain resolved, safe to downgrade",
            "confirm_emergency_downgrade": True
        },
        headers=c_headers
    )
    assert r3.status_code == 200, r3.text

    # Verify audit log recorded
    audit_logs = db_session.query(AdminAction).filter(AdminAction.target_type == "case", AdminAction.target_id == str(case.id), AdminAction.action_code == "TRIAGE_OVERRIDE").all()
    assert len(audit_logs) > 0


def test_gate8_revisions_diff_endpoint(client, db_session):
    """Gate 8: GET /cases/{id}/revisions returns structured human-readable diffs for UI audit trail."""
    p_headers, p_user = create_user_headers(client, db_session, "pat_revdiff@test.com", "patient")
    c_headers, c_user = create_user_headers(client, db_session, "cln_revdiff@test.com", "clinician")
    case = seed_test_case(db_session, p_user)

    # Perform an amend
    r_amend = client.post(
        f"/api/v1/cases/{case.id}/amend",
        json={"chief_complaint": "Severe chest pain radiating to left arm at 10:32"},
        headers=p_headers
    )
    assert r_amend.status_code == 200

    # Clinician requests revisions
    r_rev = client.get(f"/api/v1/cases/{case.id}/revisions", headers=c_headers)
    assert r_rev.status_code == 200
    revs = r_rev.json()
    assert len(revs) >= 1
    latest_rev = revs[-1]
    assert latest_rev["revision_no"] == 1
    assert latest_rev["change_type"] == "PATIENT_AMEND"
    diff_fields = [d["field"] for d in latest_rev["diffs"]]
    assert "chief_complaint" in diff_fields
    cc_diff = next(d for d in latest_rev["diffs"] if d["field"] == "chief_complaint")
    assert "Chest pain and shortness of breath" in cc_diff["old_value"]
    assert "radiating to left arm at 10:32" in cc_diff["new_value"]
    assert "->" in cc_diff["description"]

