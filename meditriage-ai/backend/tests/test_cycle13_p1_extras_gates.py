import pytest
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.case import Case
from app.models.patient import PatientProfile
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.domain_substrate import EmergencyCard, CaregiverLink
from app.models.support_ops import EmergencyResource, AccessHistoryLog
from app.services.auth.rbac_service import seed_rbac_tables
from app.services.patient.emergency_card_service import card_rate_limiter


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
    # Reset rate limiter between tests
    card_rate_limiter.reset()
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


def seed_user(db, email, role, name=None):
    u = User(
        email=email,
        name=name or email.split("@")[0].title(),
        role=role,
        password_hash=get_password_hash("Password123!")
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def auth_header(user):
    token = create_access_token(subject=user.id, role=user.role, email=user.email, name=user.name)
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# SPIKE: Emergency Card Token Abuse & Security Suite
# =====================================================================

def test_spike_emergency_card_token_abuse_and_rate_limiting(client, db_session):
    """
    SPIKE Verification:
    1. Mint expiring emergency card with PHI-minimal allowlist payload
    2. Attempt brute-force query with bogus random token -> returns 404 (non-leaking)
    3. Attempt replay of expired token -> returns 404 (non-leaking)
    4. Attempt replay of revoked token -> returns 404 (non-leaking)
    5. Rate limiting kicks in when threshold exceeded -> returns 429
    6. Legitimate public access is recorded in patient's AccessHistoryLog
    """
    patient = seed_user(db_session, "elder_patient@pune.org", "patient", "Sunita Patil")
    headers = auth_header(patient)

    # 1. Mint Emergency Card
    mint_res = client.post(
        "/api/v1/patient/emergency-card/mint",
        json={
            "ttl_days": 15,
            "medications": ["Metformin 500mg", "Telmisartan 40mg", "Dabigatran 110mg"],
            "baseline_summary": "Hypertension, Atrial Fibrillation. High Fall Risk.",
            "allergies": ["Sulfa Drugs", "Aspirin"],
            "blood_group": "O+"
        },
        headers=headers
    )
    assert mint_res.status_code == 200, mint_res.text
    mint_data = mint_res.json()
    raw_token = mint_data["raw_token"]
    card_id = mint_data["card_id"]
    assert raw_token is not None
    assert mint_data["status"] == "ACTIVE"
    assert "token_hash" in mint_data
    # Verify raw token is NOT stored in DB, only its SHA-256 hash
    db_card = db_session.query(EmergencyCard).filter(EmergencyCard.id == card_id).first()
    assert db_card.payload["token_hash"] == hashlib.sha256(raw_token.encode()).hexdigest()

    # 2. Brute-force attempt with random fake token -> MUST return 404
    fake_token = secrets.token_urlsafe(32)
    fake_res = client.get(f"/api/v1/public/emergency-card/{fake_token}")
    assert fake_res.status_code == 404
    assert "not found or expired" in fake_res.json()["detail"].lower()

    # 3. Legitimate access works and returns PHI-minimal allowlist
    legit_res = client.get(f"/api/v1/public/emergency-card/{raw_token}")
    assert legit_res.status_code == 200
    card_info = legit_res.json()
    assert card_info["status"] == "ACTIVE"
    assert card_info["blood_group"] == "O+"
    assert "Dabigatran 110mg" in card_info["medications"]
    assert "Sunita Patil" not in str(card_info)  # Zero PHI name leakage

    # Verify access is recorded in AccessHistoryLog
    access_logs = db_session.query(AccessHistoryLog).filter(
        AccessHistoryLog.patient_id == patient.id,
        AccessHistoryLog.access_type == "EMERGENCY_CARD_ACCESS"
    ).all()
    assert len(access_logs) >= 1
    assert access_logs[0].actor_role == "EMERGENCY_RESPONDER"

    # 4. Replay of Expired Token -> MUST return 404
    # Simulate expiration by setting expires_at to 2 days ago
    expired_payload = dict(db_card.payload)
    expired_payload["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    db_card.payload = expired_payload
    db_session.commit()

    expired_res = client.get(f"/api/v1/public/emergency-card/{raw_token}")
    assert expired_res.status_code == 404
    assert "not found or expired" in expired_res.json()["detail"].lower()

    # Restore card to active for revocation test
    restored_payload = dict(db_card.payload)
    restored_payload["expires_at"] = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    db_card.payload = restored_payload
    db_session.commit()

    # 5. Revocation & Replay of Revoked Token -> MUST return 404
    revoke_res = client.post("/api/v1/patient/emergency-card/revoke", json={}, headers=headers)
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "REVOKED"

    revoked_res = client.get(f"/api/v1/public/emergency-card/{raw_token}")
    assert revoked_res.status_code == 404
    assert "not found or expired" in revoked_res.json()["detail"].lower()

    # 6. Rate Limiting Test (Sliding Window 10 requests / min)
    card_rate_limiter.reset()
    # Issue fresh card
    fresh_mint = client.post("/api/v1/patient/emergency-card/mint", json={"ttl_days": 7}, headers=headers).json()
    fresh_token = fresh_mint["raw_token"]

    # Fire 10 allowed requests
    for i in range(10):
        r = client.get(f"/api/v1/public/emergency-card/{fresh_token}", headers={"x-forwarded-for": "192.168.1.100"})
        assert r.status_code == 200

    # 11th request must trigger HTTP 429
    limited_res = client.get(f"/api/v1/public/emergency-card/{fresh_token}", headers={"x-forwarded-for": "192.168.1.100"})
    assert limited_res.status_code == 429
    assert "too many" in limited_res.json()["detail"].lower()


# =====================================================================
# Caregiver Linking & Permission Scoping Gates
# =====================================================================

def test_caregiver_linking_and_permission_scoping(client, db_session):
    """
    Verifies:
    1. Patient invites/links caregiver with scoped permissions: 'view' only
    2. Caregiver cannot amend patient's case (HTTP 403 Forbidden)
    3. Patient updates caregiver permissions to include 'amend'
    4. Caregiver successfully amends patient's case (HTTP 200)
    5. Patient revokes caregiver link
    """
    patient = seed_user(db_session, "elder_ramesh@pune.org", "patient", "Ramesh Joshi")
    caregiver = seed_user(db_session, "caregiver_anita@pune.org", "caregiver", "Anita Joshi")
    p_headers = auth_header(patient)
    cg_headers = auth_header(caregiver)

    # Create patient case
    profile = PatientProfile(user_id=patient.id, age=78, sex="Male", medical_history="Hypertension")
    db_session.add(profile)
    db_session.commit()

    case = Case(
        patient_id=patient.id,
        chief_complaint="Dizziness and mild fatigue",
        status="open",
        is_emergency_flag=False,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)

    # Add initial symptom and vital
    db_session.add(SymptomEntry(case_id=case.id, symptom="Dizziness", duration="2 hours", severity=4, body_location="Head"))
    db_session.add(Vitals(case_id=case.id, temperature=98.4, pulse=74, blood_pressure="128/82", spo2=97))
    db_session.commit()

    # 1. Patient links caregiver with VIEW-ONLY permission
    invite_res = client.post(
        "/api/v1/patient/caregivers/invite",
        json={
            "caregiver_email": caregiver.email,
            "relationship": "Daughter",
            "permissions": ["view"],
            "can_amend": False
        },
        headers=p_headers
    )
    assert invite_res.status_code == 200
    assert invite_res.json()["can_amend"] is False
    assert invite_res.json()["permissions"] == ["view"]

    # 2. Caregiver attempts to amend case -> MUST BE REJECTED (HTTP 403)
    amend_payload = {
        "chief_complaint": "Severe sudden vertigo and nausea",
        "symptoms": [{"symptom": "Severe vertigo", "duration": "30 mins", "severity": 7, "body_location": "Head"}],
        "vitals": {"temperature": 99.0, "pulse": 88, "blood_pressure": "145/95", "spo2": 96},
        "reason": "Caregiver observed acute symptom escalation"
    }

    denied_res = client.post(f"/api/v1/cases/{case.id}/amend", json=amend_payload, headers=cg_headers)
    assert denied_res.status_code == 403
    assert "view-only" in denied_res.json()["detail"].lower()

    # 3. Patient updates permissions to include AMEND
    update_res = client.post(
        "/api/v1/patient/caregivers/invite",
        json={
            "caregiver_email": caregiver.email,
            "relationship": "Daughter",
            "permissions": ["view", "amend"],
            "can_amend": True
        },
        headers=p_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["can_amend"] is True

    # 4. Caregiver amends case again -> MUST SUCCEED (HTTP 200)
    allowed_res = client.post(f"/api/v1/cases/{case.id}/amend", json=amend_payload, headers=cg_headers)
    assert allowed_res.status_code == 200, allowed_res.text
    updated_case = allowed_res.json()
    assert updated_case["chief_complaint"] == "Severe sudden vertigo and nausea"

    # 5. Patient revokes caregiver link
    cg_links = client.get("/api/v1/patient/caregivers", headers=p_headers).json()
    assert len(cg_links) == 1
    link_id = cg_links[0]["link_id"]

    revoke_res = client.delete(f"/api/v1/patient/caregivers/{link_id}", headers=p_headers)
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "REVOKED"

    # Subsequent amend attempt fails with 403 or 404 (anti-enumeration)
    post_revoke_res = client.post(f"/api/v1/cases/{case.id}/amend", json=amend_payload, headers=cg_headers)
    assert post_revoke_res.status_code in (403, 404)


# =====================================================================
# Public Resource Directory (Pune-First Ordering)
# =====================================================================

def test_public_resource_directory_pune_priority(client, db_session):
    """
    Verifies that the consumer-facing emergency directory returns active resources
    with Pune/PCMC facilities sorted first, followed by national helplines,
    and includes 'last_verified_at' timestamps.
    """
    res = client.get("/api/v1/public/resources")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 3

    # Check Pune priority
    pune_items = [i for i in items if i.get("is_pune_local")]
    assert len(pune_items) > 0
    # First item should be a Pune facility
    assert items[0]["is_pune_local"] is True
    assert "Pune" in items[0]["city_region"] or "PCMC" in items[0]["city_region"]

    # Verify fields
    for item in items:
        assert "name" in item
        assert "phone_number" in item
        assert "category" in item
        assert "last_verified_at" in item
        assert item["is_active"] is True
