import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.models.user import User
from app.models.case import Case
from app.models.consent import ConsentLog
from app.models.patient import PatientProfile
from app.core.security import create_access_token, get_password_hash
from app.schemas.intake import (
    PatientIntakeCreate,
    VitalsInput,
    SymptomInput
)
from app.services.quality.interpreter import evaluate_intake_quality


# In-memory isolated test database
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


def _create_consented_patient(db: Session, email: str = "quality_patient@example.com", age: int = 72) -> str:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name="Ananya Sharma",
            email=email,
            password_hash=get_password_hash("SecurePassword123!"),
            role="patient"
        )
        db.add(user)
        db.flush()

    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile:
        profile = PatientProfile(
            user_id=user.id,
            age=age,
            sex="Female",
            medical_history="Hypertension, Mild Osteoarthritis",
            allergies="Penicillin"
        )
        db.add(profile)
        db.flush()

    consent = db.query(ConsentLog).filter(ConsentLog.user_id == user.id).first()
    if not consent:
        consent = ConsentLog(
            user_id=user.id,
            granted=True,
            consent_type="triage_evaluation",
            version="1.0-dpdp-2023"
        )
        db.add(consent)
        db.flush()

    db.commit()
    return create_access_token(subject=str(user.id), role=user.role, email=user.email, name=user.name)


# ============================================================================
# 1. UNIT TESTS: Quality Interpreter Module Logic
# ============================================================================

def test_quality_complete_and_consistent_case():
    """Validates high completeness and perfect consistency on comprehensive input."""
    payload = PatientIntakeCreate(
        chief_complaint="Persistent throbbing right knee pain with localized swelling and joint stiffness",
        symptom_duration="5 days",
        severity=6,
        body_location="Right Knee",
        age=71,
        sex="Female",
        comorbidities=["Mild Osteoarthritis", "Hypertension"],
        current_medications="Amlodipine 5mg, Paracetamol as needed",
        allergies="Sulfa antibiotics",
        vitals=VitalsInput(
            temperature=98.6,
            pulse=74,
            blood_pressure="128/82",
            spo2=97.0
        ),
        additional_symptoms=[
            SymptomInput(symptom="Difficulty walking down stairs", duration="3 days", severity=5, body_location="Right Knee")
        ]
    )

    result = evaluate_intake_quality(payload)
    assert result.completeness_score >= 0.85
    assert result.consistency_score == 1.0
    assert result.requires_clarification is False
    assert result.clarifying_question is None
    assert result.structured_category == "MUSCULOSKELETAL"
    assert result.specificity_status == "SPECIFIC"
    assert "MISSING_VITALS" not in result.flags


def test_quality_incomplete_case():
    """Validates low completeness score and detection of missing required clinical dimensions."""
    payload = PatientIntakeCreate(
        chief_complaint="Knee",  # Very short/brief
        symptom_duration="1 day",
        severity=4,
        body_location="Knee",
        age=68,
        sex="Male",
        comorbidities=[],
        current_medications="",
        allergies="",
        vitals=None  # No vitals
    )

    result = evaluate_intake_quality(payload)
    assert result.completeness_score < 0.65
    assert "CHIEF_COMPLAINT_TOO_BRIEF" in result.flags
    assert "MISSING_VITALS" in result.flags
    assert "MISSING_COMORBIDITIES" in result.flags
    assert "MISSING_MEDICATIONS" in result.flags
    assert "MISSING_ALLERGIES" in result.flags


def test_quality_hard_red_flag_contradiction_hypoxia():
    """
    Validates hard contradiction blocking when patient claims 'normal breathing'
    while recording severe hypoxemia (SpO2 86%).
    """
    payload = PatientIntakeCreate(
        chief_complaint="Feeling slightly tired, lungs clear and normal breathing with no shortness of breath",
        symptom_duration="2 hours",
        severity=5,
        body_location="General",
        age=75,
        sex="Male",
        comorbidities=["COPD"],
        current_medications="Tiotropium inhaler",
        allergies="None known",
        vitals=VitalsInput(
            temperature=98.4,
            pulse=88,
            blood_pressure="130/85",
            spo2=86.0  # Critical SpO2 < 90%
        )
    )

    result = evaluate_intake_quality(payload)
    assert result.requires_clarification is True
    assert result.consistency_score < 0.70
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in result.flags
    assert result.clarifying_question is not None
    assert "SpO2" in result.clarifying_question or "oxygen" in result.clarifying_question.lower()


def test_quality_hard_red_flag_contradiction_chest_pain():
    """
    Validates hard contradiction blocking when patient reports primary location 'Chest'
    with severity 8/10 but claims 'no chest pain, chest feels fine'.
    """
    payload = PatientIntakeCreate(
        chief_complaint="Discomfort in upper body, but no chest pain and chest feels fine",
        symptom_duration="1 hour",
        severity=8,
        body_location="Chest",
        age=65,
        sex="Male",
        comorbidities=["Coronary Artery Disease"],
        current_medications="Aspirin, Atorvastatin",
        allergies="None",
        vitals=VitalsInput(
            temperature=98.6,
            pulse=92,
            blood_pressure="145/90",
            spo2=96.0
        )
    )

    result = evaluate_intake_quality(payload)
    assert result.requires_clarification is True
    assert "HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN" in result.flags
    assert result.clarifying_question is not None
    assert "chest" in result.clarifying_question.lower()


def test_quality_non_red_flag_fever_contradiction():
    """
    Validates consistency deduction for non-red-flag contradiction:
    Stating 'no fever' while temperature is 101.8°F.
    """
    payload = PatientIntakeCreate(
        chief_complaint="Mild sore throat, feeling afebrile with no fever",
        symptom_duration="2 days",
        severity=3,
        body_location="Throat",
        age=30,
        sex="Female",
        pregnancy_status="Not pregnant",
        comorbidities=["None"],
        current_medications="None",
        allergies="None",
        vitals=VitalsInput(
            temperature=101.8,  # Febrile
            pulse=80,
            blood_pressure="118/76",
            spo2=99.0
        )
    )

    result = evaluate_intake_quality(payload)
    assert result.consistency_score <= 0.75
    assert "CONTRADICTION_FEVER_VS_TEMPERATURE" in result.flags
    assert result.requires_clarification is False


def test_quality_vague_symptom_specificity():
    """Validates detection of overly vague, uninformative symptom descriptions."""
    payload = PatientIntakeCreate(
        chief_complaint="Not feeling well, just unwell",
        symptom_duration="1 day",
        severity=4,
        body_location="Body",
        age=50,
        sex="Male",
        comorbidities=["None"],
        current_medications="None",
        allergies="None",
        vitals=VitalsInput(
            temperature=98.6,
            pulse=72,
            blood_pressure="120/80",
            spo2=98.0
        )
    )

    result = evaluate_intake_quality(payload)
    assert result.specificity_status == "VAGUE"
    assert "VAGUE_SYMPTOM_DESCRIPTION" in result.flags


def test_quality_implausible_vitals():
    """Validates penalty and flags when physiological vitals are outside plausibility thresholds."""
    payload = PatientIntakeCreate(
        chief_complaint="General mild fatigue",
        symptom_duration="minus 3 days",  # Implausible duration
        severity=2,
        body_location="General",
        age=45,
        sex="Male",
        comorbidities=["None"],
        current_medications="None",
        allergies="None",
        vitals=VitalsInput(
            temperature=87.5,  # Implausibly low temperature
            pulse=235,        # Implausibly high pulse
            blood_pressure="120/80",
            spo2=52.0         # Implausibly low SpO2
        )
    )

    result = evaluate_intake_quality(payload)
    assert result.consistency_score < 0.60
    assert "IMPLAUSIBLE_TEMPERATURE" in result.flags
    assert "IMPLAUSIBLE_PULSE" in result.flags
    assert "IMPLAUSIBLE_DURATION" in result.flags


# ============================================================================
# 2. INTEGRATION TESTS: End-to-End API Persistence & Blocking
# ============================================================================

def test_api_intake_with_quality_score_complete(client, db_session: Session):
    """Verifies complete intake returns quality score and proceeds to normal triage scoring."""
    token = _create_consented_patient(db_session, "ananya_complete@example.com", age=72)
    payload = {
        "chief_complaint": "Severe swelling and pain in right knee joint after morning walk",
        "symptom_duration": "4 hours",
        "severity": 6,
        "body_location": "Right Knee",
        "age": 72,
        "sex": "Female",
        "comorbidities": ["Osteoarthritis", "Hypertension"],
        "current_medications": "Amlodipine 5mg",
        "allergies": "None known",
        "vitals": {
            "temperature": 98.6,
            "pulse": 76,
            "blood_pressure": "130/84",
            "spo2": 98.0
        }
    }

    resp = client.post("/api/v1/cases/intake", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "submitted"
    assert data["is_emergency_flag"] is False
    assert data["quality_score"] is not None
    assert data["quality_score"]["completeness_score"] >= 0.85
    assert data["quality_score"]["consistency_score"] == 1.0
    assert data["quality_score"]["requires_clarification"] is False
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] in ["Urgent", "Routine", "Self-Care Info"]


def test_api_intake_blocked_by_hard_red_flag_contradiction(client, db_session: Session):
    """
    Verifies that an intake with a hard red-flag contradiction (SpO2 87% + 'no shortness of breath')
    is BLOCKED from silent progression:
    - Status is 'needs_clarification'
    - quality_score.requires_clarification is True
    - clarifying_question is present
    - Triage scoring is bypassed (triage_result is None)
    """
    token = _create_consented_patient(db_session, "ananya_blocked@example.com", age=74)
    payload = {
        "chief_complaint": "Tiredness, but breathing normally and no shortness of breath",
        "symptom_duration": "1 hour",
        "severity": 5,
        "body_location": "General",
        "age": 74,
        "sex": "Female",
        "comorbidities": ["Asthma"],
        "current_medications": "Salbutamol inhaler",
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 84,
            "blood_pressure": "125/80",
            "spo2": 87.0  # Hypoxemia contradiction
        }
    }

    resp = client.post("/api/v1/cases/intake", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "needs_clarification"
    assert data["is_emergency_flag"] is False
    assert data["emergency_rule_fired"] == "BLOCKED_AWAITING_CLARIFICATION"
    assert data["triage_result"] is None  # Triage engine bypassed

    qs = data["quality_score"]
    assert qs is not None
    assert qs["requires_clarification"] is True
    assert qs["clarifying_question"] is not None
    assert "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2" in qs["flags"]
