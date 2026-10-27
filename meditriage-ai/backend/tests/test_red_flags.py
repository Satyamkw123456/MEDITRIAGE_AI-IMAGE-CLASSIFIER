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
from app.services.rules.red_flags import evaluate_red_flags


# In-memory test database
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


# -----------------------------------------------------------------------------
# Unit Tests for Deterministic Rule Logic (evaluate_red_flags)
# -----------------------------------------------------------------------------

def test_rule_1_chest_pain_over_40_triggers():
    """Rule 1: Chest pain + age > 40 triggers emergency flag."""
    res = evaluate_red_flags(
        chief_complaint="Severe crushing retrosternal chest pain radiating to left jaw",
        age=62,
        severity=8,
        body_location="Chest / Thorax"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in res.get_summary_rule_string()


def test_rule_1_chest_pain_under_40_does_not_trigger_cardiac_rule():
    """Rule 1: Chest pain in patient <= 40 does NOT trigger cardiac rule 1."""
    res = evaluate_red_flags(
        chief_complaint="Mild sharp chest wall pain after workout",
        age=24,
        severity=4,
        body_location="Chest / Thorax"
    )
    assert res.is_emergency is False
    assert res.get_summary_rule_string() is None


def test_rule_2_severe_breathlessness_keywords_triggers():
    """Rule 2: Phrasing indicative of acute severe breathlessness triggers emergency."""
    res = evaluate_red_flags(
        chief_complaint="Sudden severe breathlessness and unable to breathe",
        age=70,
        severity=9,
        body_location="Throat / Neck"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_SEVERE_BREATHLESSNESS" in res.get_summary_rule_string()


def test_rule_2_severe_breathlessness_critical_spo2_triggers():
    """Rule 2: SpO2 < 90% triggers emergency flag regardless of mild phrasing."""
    res = evaluate_red_flags(
        chief_complaint="Mild cough and general fatigue",
        age=78,
        severity=4,
        body_location="Chest / Thorax",
        spo2=86.5
    )
    assert res.is_emergency is True
    assert "RED_FLAG_SEVERE_BREATHLESSNESS" in res.get_summary_rule_string()


def test_rule_3_stroke_signs_one_sided_weakness_triggers():
    """Rule 3: One-sided weakness or facial droop triggers stroke red flag."""
    res = evaluate_red_flags(
        chief_complaint="Sudden one-sided weakness in right arm and leg with facial droop",
        age=65,
        severity=8,
        body_location="Head / Neurological"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_STROKE_SIGNS" in res.get_summary_rule_string()


def test_rule_3_stroke_signs_slurred_speech_triggers():
    """Rule 3: Acute slurred speech triggers stroke red flag."""
    res = evaluate_red_flags(
        chief_complaint="Sudden confusion and slurred speech when trying to talk",
        age=73,
        severity=7,
        body_location="Head / Neurological"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_STROKE_SIGNS" in res.get_summary_rule_string()


def test_rule_4_severe_uncontrolled_bleeding_triggers():
    """Rule 4: Severe uncontrolled bleeding or hematemesis triggers emergency flag."""
    res = evaluate_red_flags(
        chief_complaint="Severe uncontrolled bleeding from deep laceration, will not stop",
        age=55,
        severity=9,
        body_location="Arms / Upper Extremities"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_SEVERE_BLEEDING" in res.get_summary_rule_string()


def test_rule_5_active_seizure_triggers():
    """Rule 5: Active or recent seizure / convulsion activity triggers emergency flag."""
    res = evaluate_red_flags(
        chief_complaint="Patient having active seizure and continuous convulsion episodes",
        age=80,
        severity=10,
        body_location="Head / Neurological"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_ACTIVE_SEIZURE" in res.get_summary_rule_string()


def test_rule_6_severe_allergic_reaction_triggers():
    """Rule 6: Anaphylaxis signs with throat swelling / angioedema trigger emergency flag."""
    res = evaluate_red_flags(
        chief_complaint="Severe allergic reaction after medication with rapid throat swelling",
        age=50,
        severity=9,
        body_location="Throat / Neck"
    )
    assert res.is_emergency is True
    assert "RED_FLAG_SEVERE_ALLERGIC_REACTION" in res.get_summary_rule_string()


def test_multiple_red_flags_fire_simultaneously():
    """Multiple concurrent red flags are all captured in fired_rules."""
    res = evaluate_red_flags(
        chief_complaint="Acute crushing chest pain, severe breathlessness, and slurred speech",
        age=68,
        severity=9,
        body_location="Chest / Thorax",
        spo2=87.0
    )
    assert res.is_emergency is True
    rule_str = res.get_summary_rule_string()
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in rule_str
    assert "RED_FLAG_SEVERE_BREATHLESSNESS" in rule_str
    assert "RED_FLAG_STROKE_SIGNS" in rule_str


def test_non_emergency_cases_pass_cleanly():
    """Non-emergency complaints evaluate to False with None rule string."""
    # Case A: Elderly knee osteoarthritis
    res_knee = evaluate_red_flags(
        chief_complaint="Chronic knee pain and morning joint stiffness when walking",
        age=74,
        severity=4,
        body_location="Legs / Lower Extremities",
        spo2=98.0
    )
    assert res_knee.is_emergency is False
    assert res_knee.get_summary_rule_string() is None

    # Case B: Routine lumbar strain
    res_back = evaluate_red_flags(
        chief_complaint="Low back muscle ache after lifting a box yesterday",
        age=42,
        severity=5,
        body_location="Back / Spine",
        spo2=99.0
    )
    assert res_back.is_emergency is False
    assert res_back.get_summary_rule_string() is None

    # Case C: Mild viral upper respiratory cold
    res_cold = evaluate_red_flags(
        chief_complaint="Mild runny nose and dry tickly throat for 2 days",
        age=66,
        severity=3,
        body_location="Throat / Neck",
        spo2=97.0
    )
    assert res_cold.is_emergency is False
    assert res_cold.get_summary_rule_string() is None


# -----------------------------------------------------------------------------
# End-to-End API and Database Persistence Tests
# -----------------------------------------------------------------------------

def _create_consented_patient(db: Session, email: str, age: int = 65) -> str:
    """Helper to seed a user with active DPDP consent and return auth token."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name="Test RedFlag Patient",
            email=email,
            password_hash=get_password_hash("Password123!"),
            role="patient"
        )
        db.add(user)
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


def test_api_intake_emergency_case_1_chest_pain_over_40(client, db_session: Session):
    """
    Submits emergency case: 67yo male with acute retrosternal chest pressure.
    Verifies is_emergency_flag=True and fired rule stored in DB.
    """
    token = _create_consented_patient(db_session, "chest_emergency@test.com", age=67)
    
    payload = {
        "chief_complaint": "Acute retrosternal chest pressure and tightness radiating to jaw",
        "symptom_duration": "45 minutes",
        "severity": 8,
        "body_location": "Chest / Thorax",
        "age": 67,
        "sex": "Male",
        "comorbidities": ["Hypertension (High BP)", "Coronary Artery Disease (CAD)"],
        "vitals": {
            "temperature": 98.4,
            "pulse": 98,
            "blood_pressure": "160/95",
            "spo2": 95.0
        }
    }

    response = client.post(
        "/api/v1/cases/intake",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_emergency_flag"] is True
    assert data["status"] == "submitted"
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in data["emergency_rule_fired"]

    # Verify direct database persistence
    case_db = db_session.query(Case).filter(Case.id == data["id"]).first()
    assert case_db is not None
    assert case_db.is_emergency_flag is True
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in case_db.emergency_rule_fired


def test_api_intake_emergency_case_2_stroke_signs(client, db_session: Session):
    """
    Submits emergency case: 72yo female with sudden facial droop and slurred speech.
    Verifies is_emergency_flag=True and fired rule stored in DB.
    """
    token = _create_consented_patient(db_session, "stroke_emergency@test.com", age=72)

    payload = {
        "chief_complaint": "Sudden onset of one-sided weakness in left arm with slurred speech",
        "symptom_duration": "30 minutes",
        "severity": 9,
        "body_location": "Head / Neurological",
        "age": 72,
        "sex": "Female",
        "comorbidities": ["Atrial Fibrillation / Arrhythmia", "Hypertension (High BP)"],
        "vitals": {
            "temperature": 98.6,
            "pulse": 88,
            "blood_pressure": "175/100",
            "spo2": 96.0
        }
    }

    response = client.post(
        "/api/v1/cases/intake",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_emergency_flag"] is True
    assert data["status"] == "submitted"
    assert "RED_FLAG_STROKE_SIGNS" in data["emergency_rule_fired"]

    # Direct database verification
    case_db = db_session.query(Case).filter(Case.id == data["id"]).first()
    assert case_db is not None
    assert case_db.is_emergency_flag is True
    assert "RED_FLAG_STROKE_SIGNS" in case_db.emergency_rule_fired


def test_api_intake_non_emergency_case_1_knee_osteoarthritis(client, db_session: Session):
    """
    Submits non-emergency case: 70yo male with chronic knee joint pain.
    Verifies is_emergency_flag=False and emergency_rule_fired=None in DB.
    """
    token = _create_consented_patient(db_session, "knee_routine@test.com", age=70)

    payload = {
        "chief_complaint": "Chronic bilateral knee aching and stiffness, worse when climbing stairs",
        "symptom_duration": "3 weeks",
        "severity": 4,
        "body_location": "Legs / Lower Extremities",
        "age": 70,
        "sex": "Male",
        "comorbidities": ["Osteoporosis / Prior Falls"],
        "vitals": {
            "temperature": 98.2,
            "pulse": 72,
            "blood_pressure": "128/82",
            "spo2": 98.0
        }
    }

    response = client.post(
        "/api/v1/cases/intake",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["emergency_rule_fired"] is None

    # Direct database verification
    case_db = db_session.query(Case).filter(Case.id == data["id"]).first()
    assert case_db is not None
    assert case_db.is_emergency_flag is False
    assert case_db.emergency_rule_fired is None


def test_api_intake_non_emergency_case_2_lumbar_strain(client, db_session: Session):
    """
    Submits non-emergency case: 38yo female with minor lumbar back strain.
    Verifies is_emergency_flag=False and emergency_rule_fired=None in DB.
    """
    token = _create_consented_patient(db_session, "back_routine@test.com", age=38)

    payload = {
        "chief_complaint": "Lower back soreness after gardening",
        "symptom_duration": "1 day",
        "severity": 4,
        "body_location": "Back / Spine",
        "age": 38,
        "sex": "Female",
        "comorbidities": [],
        "vitals": {
            "temperature": 98.6,
            "pulse": 74,
            "blood_pressure": "118/76",
            "spo2": 99.0
        }
    }

    response = client.post(
        "/api/v1/cases/intake",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["emergency_rule_fired"] is None

    # Direct database verification
    case_db = db_session.query(Case).filter(Case.id == data["id"]).first()
    assert case_db is not None
    assert case_db.is_emergency_flag is False
    assert case_db.emergency_rule_fired is None
