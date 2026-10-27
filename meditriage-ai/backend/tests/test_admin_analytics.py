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
    profile = db_session.query(PatientProfile).filter_by(user_id=user_id).first()
    
    # Emergency case
    case1 = Case(patient_id=profile.id, chief_complaint="Chest pain", status="submitted", is_emergency_flag=True)
    db_session.add(case1)
    
    # Urgent case
    case2 = Case(patient_id=profile.id, chief_complaint="Chest pain", status="submitted", is_emergency_flag=False)
    db_session.add(case2)
    db_session.flush()
    triage2 = TriageResult(case_id=case2.id, triage_level="Urgent", risk_score=75.0, explanation="Urgent")
    db_session.add(triage2)

    # Routine case
    case3 = Case(patient_id=profile.id, chief_complaint="Headache", status="submitted", is_emergency_flag=False)
    db_session.add(case3)
    db_session.flush()
    triage3 = TriageResult(case_id=case3.id, triage_level="Routine", risk_score=35.0, explanation="Routine")
    db_session.add(triage3)

    db_session.commit()


def test_admin_analytics_rbac(client, db_session):
    # Patient
    patient_headers = create_user_and_login(client, "patient@example.com", "patient")
    res = client.get("/api/v1/admin/analytics", headers=patient_headers)
    assert res.status_code == 403

    # Clinician
    clinician_headers = create_user_and_login(client, "clinician@example.com", "clinician")
    res = client.get("/api/v1/admin/analytics", headers=clinician_headers)
    assert res.status_code == 403

    # Admin
    admin_headers = create_user_and_login(client, "admin@example.com", "admin")
    res = client.get("/api/v1/admin/analytics", headers=admin_headers)
    assert res.status_code == 200


def test_admin_analytics_data(client, db_session):
    # Setup
    patient_headers = create_user_and_login(client, "patient@example.com", "patient")
    patient_user = db_session.query(User).filter_by(email="patient@example.com").first()
    seed_test_cases(db_session, patient_user.id)

    admin_headers = create_user_and_login(client, "admin@example.com", "admin")
    res = client.get("/api/v1/admin/analytics", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_cases"] == 3
    
    symptoms = {s["name"]: s["count"] for s in data["symptoms"]}
    assert symptoms.get("Chest Pain") == 2
    assert symptoms.get("Headache") == 1

    triage = {t["level"]: t["count"] for t in data["triage_distribution"]}
    assert triage.get("Emergency") == 1
    assert triage.get("Urgent") == 1
    assert triage.get("Routine") == 1
    assert triage.get("Self-Care Info") == 0
