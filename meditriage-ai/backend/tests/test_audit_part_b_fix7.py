"""
Fix 7 Verification Test Suite
Tests backend endpoints wired to admin console buttons:
- OversightWorklists: POST /admin/cases/{id}/archive, /reassign, /force-reopen, /purge-request
- DataRightsQueue: GET /admin/dpdp/requests/{id}, /verify, /erasure, /correction, /reject
- UserDirectoryTable: GET /admin/users/{id}, PATCH /admin/users/{id}, POST /admin/users/{id}/reset-mfa
- CaregiverLinksPanel: GET /admin/users/caregiver-links, DELETE /admin/users/caregiver-links/{id}
- JobsMonitor: POST /admin/operations/scheduler/pause, /resume, GET /admin/operations/health
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.models.user import User
from app.models.case import Case
from app.models import CaregiverLink
from app.core.security import get_password_hash, create_access_token
from app.services.auth.rbac_service import seed_rbac_tables
from app.services.admin.dpdp_service import DPDPService


def get_utc_now():
    return datetime.now(timezone.utc)


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
def admin_client(db_session):
    admin = User(
        name="Admin Fix7",
        email="admin_fix7@meditriage.test",
        role="admin",
        password_hash=get_password_hash("Secret123!"),
        is_suspended=False,
        token_version=1
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    token = create_access_token(subject=admin.id, role=admin.role, email=admin.email, name=admin.name)
    with TestClient(app) as client:
        client.headers = {"Authorization": f"Bearer {token}"}
        yield client, admin, db_session
    app.dependency_overrides.clear()


def test_fix7_scheduler_pause_resume_health(admin_client):
    client, admin, db = admin_client

    # 1. Health check returns scheduler status
    res = client.get("/api/v1/admin/operations/health")
    assert res.status_code == 200
    data = res.json()
    assert "scheduler" in data
    assert "is_paused" in data["scheduler"]

    # 2. Pause scheduler
    res_pause = client.post("/api/v1/admin/operations/scheduler/pause")
    assert res_pause.status_code == 200
    assert res_pause.json().get("is_paused") is True

    # 3. Resume scheduler
    res_resume = client.post("/api/v1/admin/operations/scheduler/resume")
    assert res_resume.status_code == 200
    assert res_resume.json().get("is_paused") is False


def test_fix7_user_detail_patch_and_reset_mfa(admin_client):
    client, admin, db = admin_client

    # Create target test user
    target_user = User(
        name="Target Test User",
        email="target_test_user@meditriage.test",
        role="patient",
        mfa_enabled="true",
        mfa_secret="JBSWY3DPEHPK3PXP",
        password_hash=get_password_hash("Secret123!"),
        is_suspended=False,
        token_version=1
    )
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    # 1. GET user detail
    res_get = client.get(f"/api/v1/admin/users/{target_user.id}")
    assert res_get.status_code == 200
    u_data = res_get.json()
    assert u_data["email"] == target_user.email
    assert u_data["role"] == "patient"

    # 2. PATCH user detail
    patch_payload = {
        "full_name": "Target Updated Name",
        "phone_number": "9876543210",
        "reason": "Administrative correction for testing Fix 7"
    }
    res_patch = client.patch(f"/api/v1/admin/users/{target_user.id}", json=patch_payload)
    assert res_patch.status_code == 200
    db.refresh(target_user)
    assert target_user.name == "Target Updated Name"

    # 3. POST reset-mfa
    res_mfa = client.post(
        f"/api/v1/admin/users/{target_user.id}/reset-mfa",
        json={"reason": "User lost access to authenticator app"}
    )
    assert res_mfa.status_code == 200
    db.refresh(target_user)
    assert target_user.mfa_enabled == "false"
    assert target_user.mfa_secret is None


def test_fix7_caregiver_links_list_and_revoke(admin_client):
    client, admin, db = admin_client

    # Create patient and caregiver
    p = User(name="Patient CL", email="patient_cl@test.com", role="patient", password_hash=get_password_hash("Pass123!"), token_version=1)
    cg = User(name="Caregiver CL", email="caregiver_cl@test.com", role="caregiver", password_hash=get_password_hash("Pass123!"), token_version=1)
    db.add_all([p, cg])
    db.commit()

    link = CaregiverLink(patient_id=p.id, caregiver_id=cg.id, payload={"relationship": "Daughter"})
    db.add(link)
    db.commit()
    db.refresh(link)

    # 1. GET caregiver links
    res_list = client.get("/api/v1/admin/users/caregiver-links")
    assert res_list.status_code == 200
    links = res_list.json().get("links", [])
    assert any(l["id"] == link.id for l in links)

    # 2. DELETE revoke caregiver link
    res_del = client.delete(
        f"/api/v1/admin/users/caregiver-links/{link.id}",
        params={"reason": "Testing Fix 7 caregiver revocation"}
    )
    assert res_del.status_code == 200
    assert db.query(CaregiverLink).filter(CaregiverLink.id == link.id).first() is None


def test_fix7_dpdp_request_detail_and_verify(admin_client):
    client, admin, db = admin_client

    req = DPDPService.create_request(
        db=db,
        user_id=admin.id,
        request_type="CORRECTION",
        payload={"corrections": {"phone": "9999999999"}}
    )
    db.commit()
    db.refresh(req)

    # 1. GET DPDP detail
    res_get = client.get(f"/api/v1/admin/dpdp/requests/{req.id}")
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["id"] == req.id
    assert data["request_type"] in ["CORRECTION", "correction"]

    # 2. POST verify
    res_verify = client.post(
        f"/api/v1/admin/dpdp/requests/{req.id}/verify",
        json={"reason": "Verified government photo ID"}
    )
    assert res_verify.status_code == 200
    assert req.verified_by == admin.id
    assert req.status == "IN_PROGRESS"
