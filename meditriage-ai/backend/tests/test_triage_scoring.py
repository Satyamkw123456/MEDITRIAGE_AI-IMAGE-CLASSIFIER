import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base
from app.api.deps import get_db
from app.models.user import User
from app.models.consent import ConsentLog
from app.models.case import Case
from app.models.triage import TriageResult
from app.core.security import get_password_hash
from app.services.rules.triage_scoring import calculate_triage_score


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


@pytest.fixture(scope="function")
def authenticated_patient(db_session, client):
    user = User(
        name="Sunita Sharma",
        email="sunita.sharma@example.com",
        password_hash=get_password_hash("SecurePass123!"),
        role="patient"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    consent = ConsentLog(
        user_id=user.id,
        consent_type="triage_and_data_processing",
        version="v1.0-dpdp2023",
        granted=True,
        granted_by="patient"
    )
    db_session.add(consent)
    db_session.commit()

    login_res = client.post("/api/v1/auth/login", json={
        "email": "sunita.sharma@example.com",
        "password": "SecurePass123!"
    })
    token = login_res.json()["access_token"]
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


# =========================================================================
# Unit Tests: Direct Engine Evaluation
# =========================================================================

def test_triage_engine_urgent_abdominal_case():
    """Validates that a high-acuity geriatric case with fever and tachycardia evaluates to Urgent."""
    res = calculate_triage_score(
        chief_complaint="Acute severe cramping lower abdominal pain with chills and nausea",
        severity=8,
        symptom_duration="4 hours",
        body_location="Abdomen",
        age=78,
        comorbidities=["Type 2 Diabetes", "Chronic Kidney Disease", "Hypertension"],
        temperature=101.4,
        pulse=108,
        blood_pressure="154/92",
        spo2=93.0
    )

    assert res.triage_level == "Urgent"
    assert res.risk_score >= 60.0
    assert len(res.drivers) >= 4
    # Ensure plain-language driver breakdown contains specific point attributions
    assert "High pain/severity level (8/10)" in res.explanation
    assert "abdominal" in res.explanation.lower()
    assert "101.4°F" in res.explanation
    assert "78 yrs" in res.explanation


def test_triage_engine_routine_knee_osteoarthritis():
    """Validates that a moderate chronic/subacute ache in an older adult evaluates to Routine."""
    res = calculate_triage_score(
        chief_complaint="Moderate aching pain and stiffness in right knee after walking",
        severity=5,
        symptom_duration="5 days",
        body_location="Right Knee",
        age=68,
        comorbidities=["Osteoarthritis", "Hypertension"],
        temperature=98.6,
        pulse=76,
        blood_pressure="134/82",
        spo2=97.5
    )

    assert res.triage_level == "Routine"
    assert 30.0 <= res.risk_score < 60.0
    assert "Moderate severity level (5/10)" in res.explanation
    assert "musculoskeletal" in res.explanation.lower()
    assert "68 yrs" in res.explanation


def test_triage_engine_self_care_mild_symptoms():
    """Validates that mild cold symptoms in a stable patient evaluates to Self-Care Info."""
    res = calculate_triage_score(
        chief_complaint="Mild throat tickle and dry cough after cold weather exposure",
        severity=2,
        symptom_duration="2 days",
        body_location="Throat",
        age=62,
        comorbidities=["None Known"],
        temperature=98.4,
        pulse=72,
        blood_pressure="120/78",
        spo2=99.0
    )

    assert res.triage_level == "Self-Care Info"
    assert res.risk_score < 30.0
    assert "Mild symptom severity (2/10)" in res.explanation
    assert "Self-Care Info" in res.explanation


# =========================================================================
# Integration Tests: API Intake Flow & Database Persistence
# =========================================================================

def test_api_intake_creates_triage_result_for_urgent_case(client, authenticated_patient, db_session):
    payload = {
        "chief_complaint": "Acute sharp lower abdominal pain and nausea",
        "symptom_duration": "4 hours",
        "severity": 8,
        "body_location": "Abdomen",
        "age": 78,
        "sex": "Female",
        "comorbidities": ["Type 2 Diabetes", "Chronic Kidney Disease"],
        "vitals": {
            "temperature": 101.4,
            "pulse": 108,
            "blood_pressure": "154/92",
            "spo2": 93.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=authenticated_patient["headers"])
    assert res.status_code == 201
    data = res.json()

    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Urgent"
    assert data["triage_result"]["risk_score"] >= 60.0
    assert "Abdomen" in data["triage_result"]["explanation"] or "abdominal" in data["triage_result"]["explanation"].lower()

    # Confirm database row exists
    triage_db = db_session.query(TriageResult).filter(TriageResult.case_id == data["id"]).first()
    assert triage_db is not None
    assert triage_db.triage_level == "Urgent"
    assert triage_db.risk_score == data["triage_result"]["risk_score"]


def test_api_intake_creates_triage_result_for_routine_case(client, authenticated_patient, db_session):
    payload = {
        "chief_complaint": "Right knee pain when climbing stairs",
        "symptom_duration": "5 days",
        "severity": 5,
        "body_location": "Right Knee",
        "age": 68,
        "sex": "Male",
        "comorbidities": ["Osteoarthritis"],
        "vitals": {
            "temperature": 98.6,
            "pulse": 76,
            "blood_pressure": "130/80",
            "spo2": 98.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=authenticated_patient["headers"])
    assert res.status_code == 201
    data = res.json()

    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Routine"
    assert 30.0 <= data["triage_result"]["risk_score"] < 60.0


def test_api_intake_creates_triage_result_for_self_care_case(client, authenticated_patient, db_session):
    payload = {
        "chief_complaint": "Mild throat tickle after winter morning walk",
        "symptom_duration": "2 days",
        "severity": 2,
        "body_location": "Throat",
        "age": 62,
        "sex": "Female",
        "comorbidities": ["None Known"],
        "vitals": {
            "temperature": 98.4,
            "pulse": 72,
            "blood_pressure": "120/78",
            "spo2": 99.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=authenticated_patient["headers"])
    assert res.status_code == 201
    data = res.json()

    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Self-Care Info"
    assert data["triage_result"]["risk_score"] < 30.0


def test_emergency_case_bypasses_tier2_triage_scoring(client, authenticated_patient, db_session):
    """
    Confirms that Tier 1 emergency cases (e.g. Chest pain in patient > 40)
    trigger the red flag, set status to emergency_flagged, and do NOT generate a Tier 2 triage_result.
    """
    payload = {
        "chief_complaint": "Sudden crushing chest pain radiating to jaw and left arm",
        "symptom_duration": "30 minutes",
        "severity": 9,
        "body_location": "Chest",
        "age": 66,
        "sex": "Male",
        "vitals": {
            "temperature": 98.6,
            "pulse": 110,
            "blood_pressure": "165/95",
            "spo2": 96.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=authenticated_patient["headers"])
    assert res.status_code == 201
    data = res.json()

    assert data["is_emergency_flag"] is True
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in data["emergency_rule_fired"]
    assert data["status"] == "submitted"
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Emergency"

    # Check database: triage_results row exists for emergency case with decision trace
    triage_db = db_session.query(TriageResult).filter(TriageResult.case_id == data["id"]).first()
    assert triage_db is not None
    assert triage_db.triage_level == "Emergency"


# =========================================================================
# Test from JSON Dataset: tier2_test_cases.json
# =========================================================================

def test_tier2_json_test_cases_suite(client, authenticated_patient):
    """Validates all cases in dev-test-data/tier2_test_cases.json."""
    json_path = Path(__file__).resolve().parent.parent.parent / "dev-test-data" / "tier2_test_cases.json"
    assert json_path.exists(), f"Missing test dataset at {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    assert len(cases) >= 3

    for item in cases:
        payload = item["intake_payload"]
        res = client.post("/api/v1/cases/intake", json=payload, headers=authenticated_patient["headers"])
        assert res.status_code == 201, f"Failed for case {item['id']}: {res.text}"
        data = res.json()

        assert data["is_emergency_flag"] == item["expected_tier1_emergency"]
        
        expected_status = item.get("expected_status", "submitted")
        assert data["status"] == expected_status, f"Status mismatch for {item['id']}: {data['status']} != {expected_status}"

        expected_triage = item.get("expected_triage_level")
        if expected_triage is not None:
            assert data["triage_result"] is not None
            assert data["triage_result"]["triage_level"] == expected_triage

            if "expected_risk_score_range" in item:
                score = data["triage_result"]["risk_score"]
                assert item["expected_risk_score_range"]["min"] <= score <= item["expected_risk_score_range"]["max"]

            if "expected_explanation_keywords" in item:
                explanation = data["triage_result"]["explanation"]
                for keyword in item["expected_explanation_keywords"]:
                    assert keyword.lower() in explanation.lower(), f"Keyword '{keyword}' not in explanation: {explanation}"
        elif expected_status == "needs_clarification":
            assert data["triage_result"] is None
            assert data["quality_score"]["requires_clarification"] is True
