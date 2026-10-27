import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.session import Base
from app.models.case import Case
from app.models.triage import TriageResult
from app.models.patient import PatientProfile
from app.models.user import User

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
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


def create_user_and_login(client, email, role):
    from app.core.security import get_password_hash
    if role not in ("patient", "caregiver"):
        with TestingSessionLocal() as db:
            u = db.query(User).filter_by(email=email).first()
            if not u:
                u = User(name=f"Test {role}", email=email, password_hash=get_password_hash("Password123!"), role=role)
                db.add(u)
                db.commit()
    else:
        reg_res = client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Password123!",
                "name": f"Test {role}",
                "role": role,
                "age": 40,
                "sex": "female",
                "medical_history": "None",
                "allergies": "None"
            }
        )
        assert reg_res.status_code in (200, 201)

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def seed_test_cases(db_session, user_id):
    # Patient profile must exist for the test user_id (created via registration)
    profile = db_session.query(PatientProfile).filter_by(user_id=user_id).first()
    
    case1 = Case(
        patient_id=profile.id,
        chief_complaint="Chest pain",
        status="submitted",
        is_emergency_flag=True,
        emergency_rule_fired="RED_FLAG_CHEST_PAIN"
    )
    db_session.add(case1)
    
    case2 = Case(
        patient_id=profile.id,
        chief_complaint="Mild headache",
        status="submitted",
        is_emergency_flag=False
    )
    db_session.add(case2)
    db_session.flush()

    triage2 = TriageResult(
        case_id=case2.id,
        triage_level="Routine",
        risk_score=35.0,
        explanation="Routine due to mild headache"
    )
    db_session.add(triage2)
    db_session.commit()


def test_queue_access_denied_for_unauthenticated(client):
    res = client.get("/api/v1/cases/queue")
    assert res.status_code == 401


def test_queue_access_denied_for_patient(client, db_session):
    headers = create_user_and_login(client, "patient@example.com", "patient")
    res = client.get("/api/v1/cases/queue", headers=headers)
    assert res.status_code == 403, res.text
    assert "Access forbidden" in res.text


def test_queue_access_success_for_clinician(client, db_session):
    # Setup some cases with a patient
    patient_headers = create_user_and_login(client, "patient@example.com", "patient")
    patient = db_session.query(User).filter_by(email="patient@example.com").first()
    seed_test_cases(db_session, patient.id)

    # Login as clinician
    clinician_headers = create_user_and_login(client, "clinician@example.com", "clinician")
    
    res = client.get("/api/v1/cases/queue", headers=clinician_headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert len(data) == 2
    
    # We seeded 2 cases. Due to order_by desc on created_at, they might come back in reverse seed order or same time.
    # Check that one is Emergency, one is Routine
    triage_levels = [item["triage_level"] for item in data]
    assert "Emergency" in triage_levels
    assert "Routine" in triage_levels

    for item in data:
        assert item["patient_name"] == "Test patient"
        assert item["chief_complaint"] in ["Chest pain", "Mild headache"]
        if item["is_emergency_flag"]:
            assert item["triage_level"] == "Emergency"
        else:
            assert item["triage_level"] == "Routine"


def test_update_case_status(client, db_session):
    # Setup
    patient_headers = create_user_and_login(client, "patient2@example.com", "patient")
    patient = db_session.query(User).filter_by(email="patient2@example.com").first()
    seed_test_cases(db_session, patient.id)

    # Get a case ID to update
    case = db_session.query(Case).filter_by(patient_id=patient.patient_profile.id).first()
    
    # 1. Test patient cannot update status
    res = client.patch(f"/api/v1/cases/{case.id}/status", json={"status": "reviewed"}, headers=patient_headers)
    assert res.status_code == 403

    # 2. Test clinician can update status
    clinician_headers = create_user_and_login(client, "clinician2@example.com", "clinician")
    res = client.patch(f"/api/v1/cases/{case.id}/status", json={"status": "reviewed"}, headers=clinician_headers)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "reviewed"

    # Verify DB update
    db_session.refresh(case)
    assert case.status == "reviewed"
