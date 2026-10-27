import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.consent import ConsentLog
from app.core.security import get_password_hash, create_access_token


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


def create_test_patient_user(db_session, email="elderly_patient@example.com", name="Dharampal Singh", age=74, sex="Male"):
    user = User(
        name=name,
        email=email,
        password_hash=get_password_hash("ValidPass123!"),
        role="patient"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    user_id = user.id
    user_email = user.email
    user_role = user.role
    user_name = user.name

    profile = PatientProfile(
        user_id=user_id,
        age=age,
        sex=sex,
        medical_history="Hypertension, Type 2 Diabetes",
        allergies="Sulfa drugs"
    )
    db_session.add(profile)
    db_session.commit()

    token = create_access_token(
        subject=str(user_id),
        role=user_role,
        email=user_email,
        name=user_name
    )
    return user_id, token


def record_consent_for_user(db_session, user_id: int):
    consent = ConsentLog(
        user_id=user_id,
        consent_type="triage_evaluation",
        version="v1.0-dpdp2023",
        granted=True,
        granted_by="patient",
        ip_address="127.0.0.1"
    )
    db_session.add(consent)
    db_session.commit()


def test_intake_without_auth_returns_401(client):
    payload = {
        "chief_complaint": "Acute sudden dizziness and shortness of breath",
        "symptom_duration": "2 hours",
        "severity": 8,
        "body_location": "Chest & Head",
        "age": 72,
        "sex": "Female"
    }
    response = client.post("/api/v1/cases/intake", json=payload)
    assert response.status_code == 401


def test_intake_without_consent_returns_403(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="no_consent@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "chief_complaint": "Persistent fatigue and left ankle edema",
        "symptom_duration": "4 days",
        "severity": 5,
        "body_location": "Lower Limbs",
        "age": 74,
        "sex": "Male"
    }
    response = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert response.status_code == 403
    assert "consent" in response.json()["detail"].lower()


def test_intake_valid_submission_stores_across_tables(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="valid_case@example.com")
    record_consent_for_user(db_session, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "chief_complaint": "Substernal chest tightness radiating to jaw",
        "symptom_duration": "45 minutes",
        "severity": 9,
        "body_location": "Chest",
        "age": 75,
        "sex": "Male",
        "comorbidities": ["Hypertension", "Coronary Artery Disease"],
        "current_medications": "Aspirin 75mg OD, Atorvastatin 20mg",
        "allergies": "Penicillin",
        "vitals": {
            "temperature": 98.4,
            "pulse": 88,
            "blood_pressure": "145/92",
            "spo2": 96.5
        },
        "additional_symptoms": [
            {
                "symptom": "Diaphoresis (cold sweats)",
                "duration": "30 minutes",
                "severity": 7,
                "body_location": "Generalized"
            }
        ]
    }

    response = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    assert data["chief_complaint"] == "Substernal chest tightness radiating to jaw"
    assert data["status"] == "submitted"
    assert len(data["symptoms"]) == 2
    assert len(data["vitals"]) == 1

    case_id = data["id"]

    # Verify directly in SQLite test database tables & foreign keys
    db_case = db_session.query(Case).filter(Case.id == case_id).first()
    assert db_case is not None
    assert db_case.patient.user_id == user_id

    # Verify symptoms table
    db_symptoms = db_session.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).all()
    assert len(db_symptoms) == 2
    symptom_names = [s.symptom for s in db_symptoms]
    assert "Substernal chest tightness radiating to jaw" in symptom_names
    assert "Diaphoresis (cold sweats)" in symptom_names

    # Verify vitals table
    db_vitals = db_session.query(Vitals).filter(Vitals.case_id == case_id).first()
    assert db_vitals is not None
    assert db_vitals.temperature == 98.4
    assert db_vitals.pulse == 88
    assert db_vitals.blood_pressure == "145/92"
    assert db_vitals.spo2 == 96.5

    # Verify patient profile was synchronized
    profile = db_session.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
    assert profile.age == 75
    assert profile.sex == "Male"
    assert "Coronary Artery Disease" in profile.medical_history
    assert "Aspirin" in profile.medical_history
    assert profile.allergies == "Penicillin"


def test_intake_rejects_missing_severity(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="missing_sev@example.com")
    record_consent_for_user(db_session, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Missing severity
    payload = {
        "chief_complaint": "Persistent cough and fever",
        "symptom_duration": "3 days",
        "body_location": "Chest",
        "age": 68,
        "sex": "Female"
    }
    response = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert response.status_code == 422


def test_intake_rejects_impossible_vitals(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="impossible_vitals@example.com")
    record_consent_for_user(db_session, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    base_payload = {
        "chief_complaint": "General weakness and headache",
        "symptom_duration": "1 day",
        "severity": 4,
        "body_location": "Head",
        "age": 70,
        "sex": "Female"
    }

    # 1. Impossible temperature (125 F)
    p1 = {**base_payload, "vitals": {"temperature": 125.0}}
    assert client.post("/api/v1/cases/intake", json=p1, headers=headers).status_code == 422

    # 2. Impossible pulse (15 bpm)
    p2 = {**base_payload, "vitals": {"pulse": 15}}
    assert client.post("/api/v1/cases/intake", json=p2, headers=headers).status_code == 422

    # 3. Impossible SpO2 (40%)
    p3 = {**base_payload, "vitals": {"spo2": 40.0}}
    assert client.post("/api/v1/cases/intake", json=p3, headers=headers).status_code == 422

    # 4. Inverted blood pressure (systolic < diastolic e.g. 70/110)
    p4 = {**base_payload, "vitals": {"blood_pressure": "70/110"}}
    assert client.post("/api/v1/cases/intake", json=p4, headers=headers).status_code == 422

    # 5. Invalid format blood pressure ("normal")
    p5 = {**base_payload, "vitals": {"blood_pressure": "normal"}}
    assert client.post("/api/v1/cases/intake", json=p5, headers=headers).status_code == 422


def test_intake_rejects_male_pregnancy_status(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="male_preg@example.com", sex="Male")
    record_consent_for_user(db_session, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "chief_complaint": "Abdominal discomfort",
        "symptom_duration": "2 days",
        "severity": 3,
        "body_location": "Abdomen",
        "age": 65,
        "sex": "Male",
        "pregnancy_status": "Pregnant"
    }
    response = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert response.status_code == 422


def test_get_my_cases_retrieves_history(client, db_session):
    user_id, token = create_test_patient_user(db_session, email="history_patient@example.com")
    record_consent_for_user(db_session, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "chief_complaint": "Acute lower back pain after fall",
        "symptom_duration": "1 hour",
        "severity": 8,
        "body_location": "Lumbar spine",
        "age": 81,
        "sex": "Female",
        "vitals": {
            "temperature": 97.9,
            "pulse": 92,
            "blood_pressure": "130/85",
            "spo2": 97.0
        }
    }
    client.post("/api/v1/cases/intake", json=payload, headers=headers)

    res = client.get("/api/v1/cases/my", headers=headers)
    assert res.status_code == 200
    cases = res.json()
    assert len(cases) == 1
    assert cases[0]["chief_complaint"] == "Acute lower back pain after fall"
    assert len(cases[0]["symptoms"]) == 1
    assert len(cases[0]["vitals"]) == 1
