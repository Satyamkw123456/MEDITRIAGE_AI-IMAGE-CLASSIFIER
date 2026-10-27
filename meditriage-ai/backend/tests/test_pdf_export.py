import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.session import Base
from app.models.case import Case
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


def seed_test_case(db_session, user_id):
    profile = db_session.query(PatientProfile).filter_by(user_id=user_id).first()
    case = Case(patient_id=profile.id, chief_complaint="Chest pain", status="submitted", is_emergency_flag=True)
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case.id


def test_pdf_export_access(client, db_session):
    # Setup Patient 1 and Case
    p1_headers = create_user_and_login(client, "patient1@example.com", "patient")
    p1 = db_session.query(User).filter_by(email="patient1@example.com").first()
    case_id = seed_test_case(db_session, p1.id)

    # Patient 1 can access their own PDF
    res = client.get(f"/api/v1/cases/{case_id}/pdf", headers=p1_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")

    # Patient 2 cannot access Patient 1's PDF (returns 404 or 403 anti-enumeration)
    p2_headers = create_user_and_login(client, "patient2@example.com", "patient")
    res = client.get(f"/api/v1/cases/{case_id}/pdf", headers=p2_headers)
    assert res.status_code in (403, 404)

    # Clinician can access Patient 1's PDF
    clinician_headers = create_user_and_login(client, "clinician@example.com", "clinician")
    res = client.get(f"/api/v1/cases/{case_id}/pdf", headers=clinician_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"

    # Admin can access Patient 1's PDF
    admin_headers = create_user_and_login(client, "admin@example.com", "admin")
    res = client.get(f"/api/v1/cases/{case_id}/pdf", headers=admin_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
