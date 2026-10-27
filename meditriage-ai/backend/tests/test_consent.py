import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User


# In-memory SQLite database specifically for consent tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
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


@pytest.fixture
def patient_user(db_session):
    user = User(
        name="Sunita Sharma",
        email="sunita@example.com",
        password_hash=get_password_hash("SecurePass123!"),
        role="patient",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def patient_token(patient_user):
    return create_access_token(
        subject=patient_user.id,
        role=patient_user.role,
        email=patient_user.email,
        name=patient_user.name,
    )


def test_get_consent_status_initially_empty(client, patient_token):
    response = client.get(
        "/api/v1/consent/status",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["has_consent"] is False
    assert data["latest_consent"] is None


def test_record_consent_patient_direct(client, patient_token, patient_user):
    payload = {
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "patient",
    }
    response = client.post(
        "/api/v1/consent/record",
        json=payload,
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == patient_user.id
    assert data["granted"] is True
    assert data["granted_by"] == "patient"
    assert data["version"] == "v1.0-dpdp2023"

    # Now verify status endpoint reflects consent
    status_resp = client.get(
        "/api/v1/consent/status",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["has_consent"] is True
    assert status_data["latest_consent"]["granted"] is True


def test_record_consent_caregiver_valid(client, patient_token, patient_user):
    payload = {
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "caregiver",
        "caregiver_name": "Amit Sharma",
        "caregiver_relationship": "Son",
    }
    response = client.post(
        "/api/v1/consent/record",
        json=payload,
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["granted_by"] == "caregiver"
    assert data["caregiver_name"] == "Amit Sharma"
    assert data["caregiver_relationship"] == "Son"


def test_record_consent_caregiver_missing_name_fails(client, patient_token):
    payload = {
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "caregiver",
        # missing caregiver_name
    }
    response = client.post(
        "/api/v1/consent/record",
        json=payload,
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert response.status_code == 400
    assert "Caregiver name is required" in response.json()["detail"]


def test_consent_history(client, patient_token):
    # Record first consent
    client.post(
        "/api/v1/consent/record",
        json={"consent_type": "triage_v1", "version": "v1.0", "granted": True, "granted_by": "patient"},
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    # Record second updated consent
    client.post(
        "/api/v1/consent/record",
        json={"consent_type": "triage_v2", "version": "v1.1", "granted": True, "granted_by": "patient"},
        headers={"Authorization": f"Bearer {patient_token}"},
    )

    history_resp = client.get(
        "/api/v1/consent/history",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert history_resp.status_code == 200
    logs = history_resp.json()
    assert len(logs) == 2


def test_unauthenticated_consent_access(client):
    response = client.get("/api/v1/consent/status")
    assert response.status_code == 401
