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
from app.models.diagnosis import DifferentialDiagnosis
from app.models.audit import AIAuditLog
from app.models.triage import TriageResult
from app.core.security import get_password_hash


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


def register_and_login_patient(client, email="patient@example.com", name="Arthur Pendelton", age=72, sex="male"):
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "name": name,
            "role": "patient",
            "age": age,
            "sex": sex,
            "medical_history": "COPD, Hypertension",
            "allergies": "Penicillin"
        }
    )
    assert reg_res.status_code in (200, 201), reg_res.text

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"}
    )
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Log required consent
    consent_res = client.post(
        "/api/v1/consent/record",
        json={
            "consent_type": "triage_and_data_processing",
            "version": "v1.0-dpdp2023",
            "granted": True,
            "granted_by": "patient"
        },
        headers=headers
    )
    assert consent_res.status_code in (200, 201), consent_res.text
    return headers


def test_copd_case_generates_differential_and_audit_log(client, db_session):
    """
    T3-TEST-01: Confirms that a non-emergency geriatric COPD intake case generates
    structured differential diagnoses and an AI audit log, while preserving the rule triage level.
    """
    headers = register_and_login_patient(client, email="copd.patient@example.com", name="Arthur Pendelton", age=72, sex="male")

    payload = {
        "chief_complaint": "Worsening shortness of breath and productive yellowish cough for 3 days",
        "symptom_duration": "3 days",
        "severity": 6,
        "body_location": "Chest",
        "age": 72,
        "sex": "male",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["COPD", "Hypertension"],
        "current_medications": "Albuterol inhaler, Tiotropium, Lisinopril",
        "allergies": "Penicillin",
        "vitals": {
            "temperature": 99.4,
            "pulse": 88,
            "blood_pressure": "138/84",
            "spo2": 92.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()

    # Rule checks
    assert data["is_emergency_flag"] is False
    assert data["status"] == "submitted"
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Urgent"

    # AI Orchestrator Output checks
    assert len(data["differential_diagnoses"]) >= 2
    top_diag = data["differential_diagnoses"][0]
    assert "condition_name" in top_diag
    assert top_diag["probability_score"] > 0.0
    assert len(top_diag["evidence"]) > 10

    # AI Audit Logs checks
    assert len(data["ai_audit_logs"]) == 1
    audit = data["ai_audit_logs"][0]
    assert audit["model_name"] is not None
    assert audit["prompt_version"] is not None
    assert "Worsening shortness of breath" in audit["raw_prompt"]
    assert "COPD" in audit["raw_response"]
    assert audit["output_summary"] != ""

    # Verify database persistence directly
    db_diags = db_session.query(DifferentialDiagnosis).filter(DifferentialDiagnosis.case_id == data["id"]).all()
    assert len(db_diags) == len(data["differential_diagnoses"])

    db_audits = db_session.query(AIAuditLog).filter(AIAuditLog.case_id == data["id"]).all()
    assert len(db_audits) == 1


def test_osteoarthritis_routine_case(client, db_session):
    """
    T3-TEST-02: Routine non-emergency knee discomfort produces differential diagnoses
    with rule-based triage level 'Routine'.
    """
    headers = register_and_login_patient(client, email="eleanor@example.com", name="Eleanor Vance", age=68, sex="female")

    payload = {
        "chief_complaint": "Right knee stiffness and aching pain after morning walks for 2 weeks",
        "symptom_duration": "2 weeks",
        "severity": 4,
        "body_location": "Right Knee",
        "age": 68,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["Osteoarthritis", "Osteopenia"],
        "current_medications": "Acetaminophen PRN, Vitamin D",
        "allergies": "None",
        "vitals": {
            "temperature": 98.2,
            "pulse": 68,
            "blood_pressure": "122/76",
            "spo2": 98.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["is_emergency_flag"] is False
    assert data["triage_result"]["triage_level"] == "Routine"
    assert len(data["differential_diagnoses"]) >= 2
    assert any("Osteoarthritis" in d["condition_name"] or "Joint" in d["condition_name"] for d in data["differential_diagnoses"])
    assert len(data["ai_audit_logs"]) == 1


def test_red_flag_emergency_bypasses_ai_orchestrator(client, db_session):
    """
    T3-TEST-04: Emergency chest pain triggers Tier 1 Red Flag and must NEVER invoke
    AI Orchestration or create differential diagnoses.
    """
    headers = register_and_login_patient(client, email="harold@example.com", name="Harold Stone", age=70, sex="male")

    payload = {
        "chief_complaint": "Crushing central chest pain radiating to left jaw with cold sweats for 45 minutes",
        "symptom_duration": "45 minutes",
        "severity": 9,
        "body_location": "Chest",
        "age": 70,
        "sex": "male",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["Coronary Artery Disease"],
        "current_medications": "Aspirin",
        "allergies": "None",
        "vitals": {
            "temperature": 98.4,
            "pulse": 110,
            "blood_pressure": "165/100",
            "spo2": 93.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["is_emergency_flag"] is True
    assert "RED_FLAG_CHEST_PAIN_OVER_40" in data["emergency_rule_fired"]
    assert data["triage_result"] is not None
    assert data["triage_result"]["triage_level"] == "Emergency"
    assert len(data["differential_diagnoses"]) == 0
    assert len(data["ai_audit_logs"]) == 0

    # Direct database verification
    db_diags = db_session.query(DifferentialDiagnosis).filter(DifferentialDiagnosis.case_id == data["id"]).all()
    assert len(db_diags) == 0

    db_audits = db_session.query(AIAuditLog).filter(AIAuditLog.case_id == data["id"]).all()
    assert len(db_audits) == 0


def test_clarification_flow_executes_ai_orchestrator(client, db_session):
    """
    Verifies that a case blocked due to quality contradictions is unblocked on clarification,
    which then triggers red-flag check, triage scoring, and AI Orchestrator execution.
    """
    headers = register_and_login_patient(client, email="clarify.test@example.com", name="George Miller", age=74, sex="male")

    # Contradictory intake: 'Normal breathing with no shortness of breath' vs SpO2 86.0% (Critical)
    contradictory_payload = {
        "chief_complaint": "Normal breathing with no shortness of breath at all",
        "symptom_duration": "2 hours",
        "severity": 6,
        "body_location": "Chest",
        "age": 74,
        "sex": "male",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["COPD"],
        "current_medications": "Albuterol",
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 88,
            "blood_pressure": "130/80",
            "spo2": 86.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=contradictory_payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "needs_clarification"
    assert len(data["differential_diagnoses"]) == 0
    assert len(data["ai_audit_logs"]) == 0

    # Submit clarification resolving the contradiction
    case_id = data["id"]
    clarify_payload = {
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

    clarify_res = client.post(f"/api/v1/cases/{case_id}/clarify", json=clarify_payload, headers=headers)
    assert clarify_res.status_code == 200, clarify_res.text
    clarified_data = clarify_res.json()

    assert clarified_data["status"] == "submitted"
    assert clarified_data["is_emergency_flag"] is False
    assert clarified_data["triage_result"] is not None
    assert len(clarified_data["differential_diagnoses"]) >= 2
    assert len(clarified_data["ai_audit_logs"]) == 1


def test_get_case_ai_audit_endpoint(client, db_session):
    """
    Tests the GET /cases/{case_id}/ai-audit endpoint.
    """
    headers = register_and_login_patient(client, email="audit.test@example.com", name="Margaret Thorne", age=81, sex="female")

    payload = {
        "chief_complaint": "Burning sensation during urination for 2 days",
        "symptom_duration": "2 days",
        "severity": 5,
        "body_location": "Pelvis",
        "age": 81,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["Type 2 Diabetes"],
        "current_medications": "Metformin",
        "allergies": "Sulfa drugs",
        "vitals": {
            "temperature": 99.1,
            "pulse": 76,
            "blood_pressure": "128/80",
            "spo2": 96.0
        }
    }

    intake_res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    case_id = intake_res.json()["id"]

    audit_res = client.get(f"/api/v1/cases/{case_id}/ai-audit", headers=headers)
    assert audit_res.status_code == 200
    audits = audit_res.json()
    assert len(audits) == 1
    assert audits[0]["case_id"] == case_id
    assert "Burning sensation during urination" in audits[0]["raw_prompt"]


def test_real_intake_routes_through_ai_gateway_and_scrubs_phi(client, db_session):
    """
    Confirms that real intake path routes through AIGateway:
    Patient-reported free-text symptom string with PHI (name, phone) is scrubbed
    and does NOT appear verbatim in the stored AIAuditLog entry.
    """
    raw_symptom_with_phi = "Patient Arthur Pendelton reports acute cough and shortness of breath, reach at 9876543210"
    headers = register_and_login_patient(client, email="scrub.test@example.com", name="Arthur Pendelton", age=74, sex="male")
    payload = {
        "chief_complaint": raw_symptom_with_phi,
        "symptom_duration": "3 days",
        "severity": 6,
        "body_location": "Chest",
        "age": 74,
        "sex": "male",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["COPD"],
        "current_medications": "Albuterol",
        "allergies": "None",
        "vitals": {
            "temperature": 99.1,
            "pulse": 84,
            "blood_pressure": "130/80",
            "spo2": 93.0
        }
    }
    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert len(data["ai_audit_logs"]) == 1
    audit = data["ai_audit_logs"][0]
    
    # Assert raw patient-reported free-text symptom string does NOT appear verbatim in stored audit log
    assert raw_symptom_with_phi not in audit["raw_prompt"]
    assert "9876543210" not in audit["raw_prompt"]
    assert "Arthur Pendelton" not in audit["raw_prompt"]


def test_gemini_unavailable_triggers_fallback_used_in_triage_result(client, db_session, monkeypatch):
    """
    Forces Gemini / LLM provider to be unavailable (FakeProvider with should_fail_unavailable=True),
    submits an intake case, and asserts triage_result.fallback_used is True in the API response and DB.
    """
    from app.services.ai.fake_provider import FakeProvider
    from app.services.ai.gateway import AIGateway

    orig_init = AIGateway.__init__
    def failing_gateway_init(self, *args, **kwargs):
        kwargs["provider"] = FakeProvider(should_fail_unavailable=True)
        orig_init(self, *args, **kwargs)

    monkeypatch.setattr(AIGateway, "__init__", failing_gateway_init)

    headers = register_and_login_patient(client, email="fallback.test@example.com", name="Fallback Patient", age=68, sex="female")
    payload = {
        "chief_complaint": "Persistent joint stiffness in both knees for two months",
        "symptom_duration": "2 months",
        "severity": 4,
        "body_location": "Knees",
        "age": 68,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["Hypertension"],
        "current_medications": "Amlodipine",
        "allergies": "None",
        "vitals": {
            "temperature": 98.6,
            "pulse": 72,
            "blood_pressure": "120/80",
            "spo2": 98.0
        }
    }
    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["triage_result"] is not None
    assert data["triage_result"]["fallback_used"] is True

    # Direct database verification
    case_db = db_session.query(Case).filter(Case.id == data["id"]).first()
    assert case_db.triage_result is not None
    assert case_db.triage_result.fallback_used is True


