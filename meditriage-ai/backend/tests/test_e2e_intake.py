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


def test_full_patient_journey_from_registration_to_case_intake(client, db_session):
    """
    End-to-End Test:
    1. Register new patient (Mohanlal Verma, age 78).
    2. Login to obtain JWT bearer token.
    3. Grant DPDP Act 2023 Digital Consent.
    4. Submit complete Geriatric Intake Form with vitals and comorbidities.
    5. Verify relational integrity across cases, symptom_entries, vitals, and patient_profiles.
    """
    # 1. Register Patient
    reg_payload = {
        "name": "Mohanlal Verma",
        "email": "mohanlal.verma@example.com",
        "password": "SecurePassword123!",
        "role": "patient",
        "age": 78,
        "sex": "Male",
        "medical_history": "Hypertension, Prior Myocardial Infarction (2018)",
        "allergies": "Aspirin (mild gastritis)"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    auth_data = reg_res.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify Consent Status (Initially False)
    status_res = client.get("/api/v1/consent/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["has_consent"] is False

    # 3. Attempt intake before consent -> Expect 403 Forbidden
    intake_payload = {
        "chief_complaint": "Acute epigastric discomfort, diaphoresis, and progressive dyspnea",
        "symptom_duration": "1.5 hours",
        "severity": 8,
        "body_location": "Chest / Thorax",
        "age": 78,
        "sex": "Male",
        "comorbidities": ["Hypertension (High BP)", "Coronary Artery Disease (CAD)", "Type 2 Diabetes Mellitus"],
        "current_medications": "Metoprolol 50mg, Clopidogrel 75mg, Metformin 500mg",
        "allergies": "Aspirin",
        "vitals": {
            "temperature": 98.2,
            "pulse": 104,
            "blood_pressure": "158/96",
            "spo2": 93.5
        }
    }
    blocked_intake = client.post("/api/v1/cases/intake", json=intake_payload, headers=headers)
    assert blocked_intake.status_code == 403

    # 4. Grant Consent under DPDP Act 2023
    consent_payload = {
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "patient"
    }
    consent_res = client.post("/api/v1/consent/record", json=consent_payload, headers=headers)
    assert consent_res.status_code == 201

    # 5. Submit Intake with Consent Granted -> Expect 201 Created
    intake_res = client.post("/api/v1/cases/intake", json=intake_payload, headers=headers)
    assert intake_res.status_code == 201
    case_data = intake_res.json()

    assert case_data["id"] > 0
    assert case_data["chief_complaint"] == intake_payload["chief_complaint"]
    assert case_data["status"] == "submitted"
    assert case_data["patient_age"] == 78
    assert case_data["patient_sex"] == "Male"

    # Verify Symptoms in response
    assert len(case_data["symptoms"]) == 1
    assert case_data["symptoms"][0]["symptom"] == intake_payload["chief_complaint"]
    assert case_data["symptoms"][0]["severity"] == 8
    assert case_data["symptoms"][0]["duration"] == "1.5 hours"
    assert case_data["symptoms"][0]["body_location"] == "Chest / Thorax"

    # Verify Vitals in response
    assert len(case_data["vitals"]) == 1
    assert case_data["vitals"][0]["temperature"] == 98.2
    assert case_data["vitals"][0]["pulse"] == 104
    assert case_data["vitals"][0]["blood_pressure"] == "158/96"
    assert case_data["vitals"][0]["spo2"] == 93.5

    # 6. Low-Level Database Integrity Verification
    case_id = case_data["id"]
    db_case = db_session.query(Case).filter(Case.id == case_id).first()
    assert db_case is not None

    # Check Patient profile linkage
    db_profile = db_session.query(PatientProfile).filter(PatientProfile.id == db_case.patient_id).first()
    assert db_profile is not None
    assert db_profile.age == 78
    assert "Coronary Artery Disease" in db_profile.medical_history
    assert "Metoprolol" in db_profile.medical_history

    # Check SymptomEntry foreign key
    db_symptom = db_session.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).first()
    assert db_symptom is not None
    assert db_symptom.case.id == case_id
    assert db_symptom.severity == 8

    # Check Vitals foreign key
    db_vital = db_session.query(Vitals).filter(Vitals.case_id == case_id).first()
    assert db_vital is not None
    assert db_vital.case.id == case_id
    assert db_vital.blood_pressure == "158/96"

    # 7. Check Patient Case Retrieval (/cases/my)
    my_cases_res = client.get("/api/v1/cases/my", headers=headers)
    assert my_cases_res.status_code == 200
    my_cases = my_cases_res.json()
    assert len(my_cases) == 1
    assert my_cases[0]["id"] == case_id
