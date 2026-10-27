"""
Fix 8 Verification Test Suite
Tests AI Hub endpoints:
- GET /api/v1/ai-hub/trends/{user_id}
- GET /api/v1/ai-hub/visit-prep/{case_id}
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.case import Case
from app.models.case_revision import CaseRevision
from app.models.domain_substrate import PatientBaseline, DailyCheckin
from app.core.security import get_password_hash, create_access_token
from app.services.auth.rbac_service import seed_rbac_tables


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
def patient_client(db_session):
    user = User(
        name="Test Patient Fix8",
        email="patient_fix8@meditriage.test",
        role="patient",
        password_hash=get_password_hash("Secret123!"),
        is_suspended=False,
        token_version=1,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    profile = PatientProfile(
        user_id=user.id,
        age=72,
        sex="Female",
        is_synthetic="true",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        email=user.email,
        name=user.name,
    )

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})

    yield client, user, profile, db_session

    app.dependency_overrides.clear()


def test_fix8_ai_hub_trends_endpoint(patient_client):
    client, user, profile, db = patient_client

    # 1. Establish baseline
    baseline = PatientBaseline(
        user_id=user.id,
        payload={"vitals": {"pulse": 72, "systolic_bp": 120}, "typical_pain_score": 1},
    )
    db.add(baseline)
    db.commit()

    # 2. Add daily check-in
    now = get_utc_now()
    checkin = DailyCheckin(
        user_id=user.id,
        payload={
            "pain_score": 3,
            "mood": "Good",
            "alertness": "Normal",
            "notes": "Feeling fine",
            "vitals": {"pulse": 80, "systolic_bp": 125, "temperature": 98.4},
            "drift_flags": [],
        },
        created_at=now,
    )
    db.add(checkin)
    db.commit()

    # 3. Call GET /api/v1/ai-hub/trends/{user_id}
    res = client.get(f"/api/v1/ai-hub/trends/{user.id}?limit=7")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == user.id
    assert data["is_deterministic"] is True
    assert "trends" in data
    assert "pulse" in data["trends"]
    assert "systolic_bp" in data["trends"]
    assert "pain_score" in data["trends"]
    assert data["trends"]["pulse"]["baseline"] == 72
    assert data["trends"]["pulse"]["current"] == 80
    assert data["trends"]["pulse"]["delta_from_baseline"] == 8


def test_fix8_ai_hub_visit_prep_endpoint(patient_client):
    client, user, profile, db = patient_client

    # 1. Create a case for this patient
    case = Case(
        patient_id=profile.id,
        chief_complaint="Persistent dry cough and mild shortness of breath",
        status="submitted",
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # 2. Add two case revisions showing vitals / symptom change
    now = get_utc_now()
    rev1 = CaseRevision(
        case_id=case.id,
        revision_no=1,
        actor_id=user.id,
        actor_role="patient",
        change_type="CREATED",
        before_state={},
        after_state={
            "symptoms": [{"symptom": "Dry cough"}],
            "vitals": {"pulse": 75, "systolic_bp": 120},
            "medications": "Amlodipine 5mg",
        },
        created_at=now,
    )
    rev2 = CaseRevision(
        case_id=case.id,
        revision_no=2,
        actor_id=user.id,
        actor_role="patient",
        change_type="EDITED",
        before_state={
            "symptoms": [{"symptom": "Dry cough"}],
            "vitals": {"pulse": 75, "systolic_bp": 120},
            "medications": "Amlodipine 5mg",
        },
        after_state={
            "symptoms": [{"symptom": "Dry cough"}, {"symptom": "Mild dyspnea"}],
            "vitals": {"pulse": 88, "systolic_bp": 135},
            "medications": "Amlodipine 5mg, Cough syrup",
        },
        created_at=now,
    )
    db.add_all([rev1, rev2])
    db.commit()

    # 3. Call GET /api/v1/ai-hub/visit-prep/{case_id}
    res = client.get(f"/api/v1/ai-hub/visit-prep/{case.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == case.id
    assert data["revision_count"] == 2
    assert "changes_since_last_visit" in data
    assert any("Mild dyspnea" in c for c in data["changes_since_last_visit"])
    assert "questions_for_doctor" in data
    assert len(data["questions_for_doctor"]) > 0
    assert data["is_computed_from_revisions"] is True
