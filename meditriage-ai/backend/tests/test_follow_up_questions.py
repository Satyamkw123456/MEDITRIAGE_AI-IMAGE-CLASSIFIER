import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.services.quality.follow_up import (
    generate_follow_up_questions,
    FollowUpQuestion,
    FLAG_CATEGORIES,
    BLOCKING_FLAGS
)
from app.services.quality.interpreter import evaluate_intake_quality
from app.schemas.intake import PatientIntakeCreate, VitalsInput


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


# ==========================================
# 1. UNIT TESTS: FOLLOW-UP QUESTION REGISTRY & GENERATOR
# ==========================================

def test_follow_up_categories_and_blocking_flags():
    """Verify category mapping and blocking flag definitions."""
    assert "CONTRADICTION_FEVER_VS_TEMPERATURE" in FLAG_CATEGORIES
    assert "CONTRADICTION_DURATION_VS_CHRONICITY" in FLAG_CATEGORIES
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in FLAG_CATEGORIES
    assert "IMPLAUSIBLE_TEMPERATURE" in FLAG_CATEGORIES
    assert "IMPLAUSIBLE_SPO2" in FLAG_CATEGORIES
    assert "VAGUE_SYMPTOM_DESCRIPTION" in FLAG_CATEGORIES
    assert "MISSING_CHIEF_COMPLAINT" in FLAG_CATEGORIES
    assert "MISSING_PREGNANCY_STATUS_APPLICABLE" in FLAG_CATEGORIES

    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in BLOCKING_FLAGS
    assert "HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN" in BLOCKING_FLAGS


def test_generate_follow_up_for_fever_contradiction():
    payload = PatientIntakeCreate(
        chief_complaint="No fever at all, just feeling tired",
        symptom_duration="1 day",
        severity=4,
        body_location="General",
        age=72,
        sex="Male",
        vitals=VitalsInput(temperature=102.4, pulse=80, spo2=98.0)
    )
    flags = ["CONTRADICTION_FEVER_VS_TEMPERATURE"]
    questions = generate_follow_up_questions(flags, payload)
    assert len(questions) == 1
    q = questions[0]
    assert q.flag == "CONTRADICTION_FEVER_VS_TEMPERATURE"
    assert q.category == "CONTRADICTION"
    assert q.is_blocking is False
    assert "102.4" in q.question
    assert "no fever" in q.question.lower()
    assert q.options is not None
    assert len(q.options) >= 2


def test_generate_follow_up_for_duration_contradiction():
    payload = PatientIntakeCreate(
        chief_complaint="Severe chronic condition for decades",
        symptom_duration="2 hours",
        severity=7,
        body_location="Right Knee",
        age=75,
        sex="Female"
    )
    flags = ["CONTRADICTION_DURATION_VS_CHRONICITY"]
    questions = generate_follow_up_questions(flags, payload)
    assert len(questions) == 1
    q = questions[0]
    assert q.flag == "CONTRADICTION_DURATION_VS_CHRONICITY"
    assert q.category == "CONTRADICTION"
    assert "2 hours" in q.question
    assert q.options is not None


def test_generate_follow_up_for_vague_symptom():
    payload = PatientIntakeCreate(
        chief_complaint="feeling sick and uneasy",
        symptom_duration="2 days",
        severity=4,
        body_location="Full Body",
        age=68,
        sex="Male"
    )
    flags = ["VAGUE_SYMPTOM_DESCRIPTION"]
    questions = generate_follow_up_questions(flags, payload)
    assert len(questions) == 1
    q = questions[0]
    assert q.flag == "VAGUE_SYMPTOM_DESCRIPTION"
    assert q.category == "VAGUE_SYMPTOM"
    assert "feeling sick and uneasy" in q.question
    assert q.target_field == "chief_complaint"


def test_generate_follow_up_for_implausible_vitals():
    payload = PatientIntakeCreate(
        chief_complaint="High fever and severe lethargy",
        symptom_duration="1 day",
        severity=8,
        body_location="General",
        age=70,
        sex="Female",
        vitals=VitalsInput(temperature=109.5, pulse=235, spo2=95.0)
    )
    flags = ["IMPLAUSIBLE_TEMPERATURE", "IMPLAUSIBLE_PULSE"]
    questions = generate_follow_up_questions(flags, payload)
    assert len(questions) == 2
    temp_q = next(q for q in questions if q.flag == "IMPLAUSIBLE_TEMPERATURE")
    pulse_q = next(q for q in questions if q.flag == "IMPLAUSIBLE_PULSE")
    assert "109.5" in temp_q.question
    assert "235" in pulse_q.question
    assert temp_q.category == "IMPLAUSIBLE_VITAL"
    assert pulse_q.category == "IMPLAUSIBLE_VITAL"


def test_generate_follow_up_for_missing_risk_factors():
    payload = PatientIntakeCreate(
        chief_complaint="Abdominal cramps",
        symptom_duration="1 day",
        severity=5,
        body_location="Abdomen",
        age=28,
        sex="Female",
        comorbidities=None,
        current_medications=None,
        allergies=None
    )
    flags = ["MISSING_PREGNANCY_STATUS_APPLICABLE", "MISSING_COMORBIDITIES"]
    questions = generate_follow_up_questions(flags, payload)
    assert len(questions) == 2
    preg_q = next(q for q in questions if q.flag == "MISSING_PREGNANCY_STATUS_APPLICABLE")
    assert "pregnancy" in preg_q.question.lower()
    assert preg_q.options is not None


# ==========================================
# 2. INTEGRATION TESTS: QUALITY INTERPRETER SERVICE
# ==========================================

def test_quality_interpreter_integrates_follow_ups():
    payload = PatientIntakeCreate(
        chief_complaint="Breathing normally and lungs clear with no shortness of breath",
        symptom_duration="1 day",
        severity=7,
        body_location="Chest",
        age=68,
        sex="Female",
        vitals=VitalsInput(temperature=98.6, pulse=88, spo2=87.0)
    )
    result = evaluate_intake_quality(payload)
    assert result.requires_clarification is True
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in result.flags
    assert len(result.follow_up_questions) >= 1
    resp_q = next(q for q in result.follow_up_questions if q.flag == "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2")
    assert "87.0" in resp_q.question


# ==========================================
# 3. END-TO-END TESTS: INTAKE & CLARIFICATION API FLOW
# ==========================================

def _create_authenticated_patient(client, email="ramesh.gupta@example.com", name="Ramesh Gupta", age=72):
    reg_payload = {
        "name": name,
        "email": email,
        "password": "Password123!",
        "role": "patient",
        "age": age,
        "sex": "Male",
        "medical_history": "Hypertension, Osteoarthritis",
        "allergies": "None"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Record consent
    client.post("/api/v1/consent/record", json={
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "patient"
    }, headers=headers)

    return headers


def test_e2e_intake_blocks_on_fever_contradiction_and_generates_follow_ups(client):
    """
    Submitting an intake with a hard contradiction (normal breathing with low SpO2):
    - Status should be 'needs_clarification'
    - quality_score.requires_clarification should be True
    - follow_up_questions should contain the specific contradiction question
    - Triage scoring should be deferred
    """
    headers = _create_authenticated_patient(client, email="contradiction.test@example.com")

    payload = {
        "chief_complaint": "Normal breathing with no shortness of breath at all",
        "symptom_duration": "2 hours",
        "severity": 6,
        "body_location": "Chest",
        "age": 72,
        "sex": "Male",
        "comorbidities": ["COPD"],
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 88,
            "blood_pressure": "130/80",
            "spo2": 86.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["status"] == "needs_clarification"
    assert data["emergency_rule_fired"] == "BLOCKED_AWAITING_CLARIFICATION"
    assert data["quality_score"] is not None
    assert data["quality_score"]["requires_clarification"] is True
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in data["quality_score"]["flags"]

    follow_ups = data["quality_score"]["follow_up_questions"]
    assert len(follow_ups) > 0
    resp_q = next(q for q in follow_ups if q["flag"] == "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2")
    assert "86.0" in resp_q["question"]
    assert resp_q["is_blocking"] is True
    assert data["triage_result"] is None


def test_e2e_clarification_resolution_unblocks_case(client, db_session):
    """
    1. Submit intake with contradiction -> blocked in 'needs_clarification'.
    2. Submit clarification via POST /api/v1/cases/{case_id}/clarify resolving the contradiction.
    3. Verify case transitions to 'submitted', quality score is clean, and triage scoring runs.
    """
    headers = _create_authenticated_patient(client, email="clarify.test@example.com")

    # Step 1: Submit contradictory intake
    payload = {
        "chief_complaint": "Normal breathing with no shortness of breath at all",
        "symptom_duration": "2 hours",
        "severity": 6,
        "body_location": "Chest",
        "age": 72,
        "sex": "Male",
        "comorbidities": ["COPD"],
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 88,
            "blood_pressure": "130/80",
            "spo2": 86.0
        }
    }
    intake_res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    case_id = intake_res.json()["id"]
    assert intake_res.json()["status"] == "needs_clarification"

    # Step 2: Submit Clarification
    # Patient clarifies that their breathing is stable and SpO2 re-measured at 96%
    clarification_payload = {
        "chief_complaint": "Mild wheezing and stable cough after using regular inhaler",
        "symptom_duration": "2 hours",
        "severity": 4,
        "body_location": "Chest",
        "vitals": {
            "temperature": 98.6,
            "pulse": 82,
            "blood_pressure": "130/80",
            "spo2": 96.0
        },
        "clarification_response": "I re-checked my pulse oximeter after resting. My SpO2 is 96% and breathing is stable."
    }

    clarify_res = client.post(f"/api/v1/cases/{case_id}/clarify", json=clarification_payload, headers=headers)
    assert clarify_res.status_code == 200
    clarified_data = clarify_res.json()

    # Step 3: Verify Case is unblocked and triaged
    assert clarified_data["status"] == "submitted"
    assert clarified_data["quality_score"]["requires_clarification"] is False
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" not in clarified_data["quality_score"]["flags"]

    # Verify Triage Result computed
    assert clarified_data["triage_result"] is not None
    assert clarified_data["triage_result"]["triage_level"] in ["Urgent", "Routine", "Self-Care Info"]
    assert clarified_data["triage_result"]["risk_score"] > 0
    assert len(clarified_data["triage_result"]["explanation"]) > 0


def test_e2e_clarification_with_vague_symptom(client):
    """
    1. Submit intake with vague symptom 'not feeling well' -> follow-up generated.
    2. Clarify with specific geriatric complaint 'persistent dizziness upon standing'.
    3. Verify unblocked and triaged.
    """
    headers = _create_authenticated_patient(client, email="vague.test@example.com")

    payload = {
        "chief_complaint": "not feeling well",
        "symptom_duration": "3 days",
        "severity": 4,
        "body_location": "General",
        "age": 75,
        "sex": "Male",
        "comorbidities": ["Hypertension"],
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 72,
            "blood_pressure": "120/80",
            "spo2": 98.0
        }
    }
    intake_res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert intake_res.status_code == 201
    data = intake_res.json()
    case_id = data["id"]

    # Should have follow-up question for vague symptom
    follow_ups = data["quality_score"]["follow_up_questions"]
    vague_q = next((q for q in follow_ups if q["flag"] == "VAGUE_SYMPTOM_DESCRIPTION"), None)
    assert vague_q is not None
    assert "not feeling well" in vague_q["question"]

    # Clarify symptom
    clarify_res = client.post(f"/api/v1/cases/{case_id}/clarify", json={
        "chief_complaint": "Postural dizziness and lightheadedness when standing up",
        "clarification_response": "The dizziness happens mostly in the morning or after sitting for a long time"
    }, headers=headers)

    assert clarify_res.status_code == 200
    clarified = clarify_res.json()
    assert clarified["status"] == "submitted"
    assert "Postural dizziness" in clarified["chief_complaint"]
    assert clarified["triage_result"] is not None
