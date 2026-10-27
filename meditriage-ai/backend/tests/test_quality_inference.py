from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base
from app.api.deps import get_db
from app.schemas.ai import AIClinicalInferenceOutput, DiagnosisItem

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

def register_and_login_patient(client, email="patient@example.com"):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "name": "Test Patient",
            "role": "patient",
            "age": 70,
            "sex": "female",
            "medical_history": "None",
            "allergies": "None"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/v1/consent/record",
        json={
            "consent_type": "triage_and_data_processing",
            "version": "v1.0-dpdp2023",
            "granted": True,
            "granted_by": "patient"
        },
        headers=headers
    )
    return headers

class MockAIResult:
    def __init__(self, inference_output, model_name, prompt_version, raw_prompt, raw_response, output_summary, suggested_urgency, retrieved_chunks=None):
        self.inference_output = inference_output
        self.model_name = model_name
        self.prompt_version = prompt_version
        self.raw_prompt = raw_prompt
        self.raw_response = raw_response
        self.output_summary = output_summary
        self.suggested_urgency = suggested_urgency
        self.retrieved_chunks = retrieved_chunks
        self.tokens_in = 100
        self.tokens_out = 50
        self.latency_ms = 120
        self.scrub_report = None
        self.block_reason = None
        self.fallback_used = False

def mock_ai_result(suggested_urgency="Routine", evidence="Age, Knee pain."):
    return MockAIResult(
        inference_output=AIClinicalInferenceOutput(
            patient_summary="Test summary",
            suggested_urgency=suggested_urgency,
            urgency_rationale="Rationale",
            differential_diagnoses=[
                DiagnosisItem(
                    condition_name="Condition A",
                    probability_score=0.8,
                    evidence=evidence
                )
            ]
        ),
        model_name="mock-model",
        prompt_version="v1.0",
        raw_prompt="mock prompt",
        raw_response="mock response",
        output_summary="summary",
        suggested_urgency=suggested_urgency
    )

@patch("app.api.v1.cases._execute_clinical_ai_gateway", new_callable=AsyncMock)
def test_quality_inference_rich_vs_sparse(mock_ai, client, db_session):
    headers = register_and_login_patient(client)
    
    # 1. Sparse Case
    mock_ai.return_value = mock_ai_result(suggested_urgency="Routine", evidence="Unknown details, not recorded.")
    sparse_payload = {
        "chief_complaint": "knee pain",
        "symptom_duration": "unknown",
        "severity": 4,
        "body_location": "knee",
        "age": 70,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "vitals": None
    }
    res_sparse = client.post("/api/v1/cases/intake", json=sparse_payload, headers=headers)
    assert res_sparse.status_code == 201
    data_sparse = res_sparse.json()
    qs_sparse = data_sparse["quality_score"]
    band_sparse = qs_sparse["confidence_band"]
    
    print("\n--- ACTUAL SCORES FOR SPARSE CASE ---")
    print(f"Agreement: {qs_sparse['agreement_score']}, Evidence Density: {qs_sparse['evidence_density_score']}")
    print(f"Composite: {qs_sparse['composite_quality_score']}, Band: {qs_sparse['confidence_band']}")
    
    # 2. Rich Case
    mock_ai.return_value = mock_ai_result(suggested_urgency="Routine", evidence="Right knee pain for 2 weeks, vitals show blood pressure 120/80.")
    rich_payload = {
        "chief_complaint": "Right knee stiffness and aching pain",
        "symptom_duration": "2 weeks",
        "severity": 4,
        "body_location": "Right Knee",
        "age": 70,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "comorbidities": ["Osteoarthritis"],
        "current_medications": "Acetaminophen",
        "allergies": "None",
        "vitals": {
            "temperature": 98.2,
            "pulse": 72,
            "blood_pressure": "120/80",
            "spo2": 98.0
        }
    }
    res_rich = client.post("/api/v1/cases/intake", json=rich_payload, headers=headers)
    assert res_rich.status_code == 201
    data_rich = res_rich.json()
    qs_rich = data_rich["quality_score"]
    band_rich = qs_rich["confidence_band"]
    
    print("\n--- ACTUAL SCORES FOR RICH CASE ---")
    print(f"Agreement: {qs_rich['agreement_score']}, Evidence Density: {qs_rich['evidence_density_score']}")
    print(f"Composite: {qs_rich['composite_quality_score']}, Band: {qs_rich['confidence_band']}")
    
    # Assertions
    assert data_sparse["triage_result"]["triage_level"] == data_rich["triage_result"]["triage_level"]
    assert qs_rich["composite_quality_score"] > qs_sparse["composite_quality_score"]
    
@patch("app.api.v1.cases._execute_clinical_ai_gateway", new_callable=AsyncMock)
def test_quality_inference_rule_llm_disagreement(mock_ai, client, db_session):
    headers = register_and_login_patient(client, email="disagree@example.com")
    
    # Force disagreement: Rule is "Routine", LLM says "Emergency"
    mock_ai.return_value = mock_ai_result(suggested_urgency="Emergency")
    payload = {
        "chief_complaint": "mild headache",
        "symptom_duration": "1 day",
        "severity": 2,
        "body_location": "head",
        "age": 70,
        "sex": "female",
        "pregnancy_status": "not_applicable"
    }
    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    data = res.json()
    
    qs = data["quality_score"]
    print("\n--- ACTUAL SCORES FOR DISAGREEMENT CASE ---")
    print(f"Agreement: {qs['agreement_score']}, Composite: {qs['composite_quality_score']}, Band: {qs['confidence_band']}")
    assert qs["agreement_score"] == 0.0
    # Because agreement is 0, composite score should drop, likely leading to Low or Medium band
    assert qs["confidence_band"] in ["Low", "Medium"]

def test_quality_inference_emergency_bypass(client, db_session):
    headers = register_and_login_patient(client, email="emergency@example.com")
    
    payload = {
        "chief_complaint": "Crushing chest pain radiating to jaw",
        "symptom_duration": "30 mins",
        "severity": 10,
        "body_location": "Chest",
        "age": 70,
        "sex": "female",
        "pregnancy_status": "not_applicable",
        "vitals": {
            "temperature": 98.6,
            "pulse": 110,
            "blood_pressure": "90/50",  # Hypotensive
            "spo2": 92.0
        }
    }
    res = client.post("/api/v1/cases/intake", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    
    assert data["is_emergency_flag"] is True
    qs = data["quality_score"]
    assert qs["confidence_band"] is None
    assert qs["composite_quality_score"] is None
