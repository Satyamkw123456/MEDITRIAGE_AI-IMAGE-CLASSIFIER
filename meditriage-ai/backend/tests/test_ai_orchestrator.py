import asyncio
import json
import pytest
from pydantic import ValidationError

from app.services.ai.schemas import CaseAnalysis, DifferentialItem
from app.services.ai.prompt_registry import PromptRegistryService
from app.services.ai.fallback import DeterministicFallbackEngine
from app.services.ai.gateway import AIGateway, GatewayResult


def test_build_prompt_contains_all_demographics_and_rule_triage():
    payload = {
        "age_years": 75,
        "age_band": "70-79",
        "sex": "female",
        "chief_complaint": "Productive cough and mild fever for 3 days",
        "symptoms": [
            {"symptom": "Productive cough", "duration": "3 days", "severity": 6, "body_location": "Chest"},
            {"symptom": "Fatigue", "duration": "2 days", "severity": 5, "body_location": "General"}
        ],
        "vitals": {"temperature": 100.8, "pulse": 86, "blood_pressure": "130/82", "spo2": 95.0},
        "comorbidities": ["COPD", "Osteoarthritis"],
        "medications_generic": ["Albuterol", "Lisinopril"],
        "allergies": ["Aspirin"],
        "rule_triage_level": "Urgent",
        "rule_risk_score": 68.5,
        "rule_rationale": "Elevated risk due to COPD history, age 75, temperature 100.8°F, and SpO2 95%."
    }

    prompt = PromptRegistryService.render_user_prompt(payload, retrieved_chunks=None)

    assert "75 years" in prompt
    assert "Biological Sex: female" in prompt
    assert "Productive cough" in prompt
    assert "Blood Pressure: 130/82" in prompt
    assert "Temp: 100.8" in prompt
    assert "COPD, Osteoarthritis" in prompt
    assert "Albuterol, Lisinopril" in prompt
    assert "Aspirin" in prompt
    assert "Baseline Rule Urgency: Urgent" in prompt
    assert "Calculated Risk Score: 68.5" in prompt
    assert "<patient_free_text>" in prompt


def test_parse_llm_response_valid_json():
    raw_json = json.dumps({
        "summary": "72-year-old male with COPD presenting with acute worsening of cough and wheezing.",
        "suggested_urgency": "urgent",
        "urgency_rationale": "High risk of acute respiratory decompensation given underlying COPD.",
        "differentials": [
            {
                "condition": "Acute Exacerbation of COPD",
                "likelihood": "more_likely",
                "supporting_evidence": ["Productive sputum", "history of moderate COPD"],
                "against_or_missing": [],
                "source_chunk_ids": ["chunk_1"]
            },
            {
                "condition": "Community-Acquired Pneumonia",
                "likelihood": "possible",
                "supporting_evidence": ["Low-grade fever and localized chest congestion."],
                "against_or_missing": [],
                "source_chunk_ids": []
            }
        ],
        "geriatric_concerns": ["frailty"],
        "follow_up_questions": ["How long have you had increased sputum?"],
        "escalation_triggers": ["Worsening breathlessness at rest"]
    })

    result = CaseAnalysis.model_validate_json(raw_json)
    assert isinstance(result, CaseAnalysis)
    assert result.suggested_urgency == "urgent"
    assert len(result.differentials) == 2
    assert result.differentials[0].condition == "Acute Exacerbation of COPD"
    assert result.differentials[0].likelihood == "more_likely"


def test_parse_llm_response_invalid_structure_raises():
    invalid_json = json.dumps({"incomplete": "data"})
    with pytest.raises(ValidationError):
        CaseAnalysis.model_validate_json(invalid_json)


def test_deterministic_clinical_fallback_geriatric_copd():
    payload = {
        "age_years": 72,
        "sex": "male",
        "chief_complaint": "Worsening cough and shortness of breath",
        "symptoms": [{"symptom": "Cough", "duration": "3 days", "severity": 7}],
        "vitals": {"temperature": 99.2, "spo2": 92.0, "pulse": 88},
        "comorbidities": ["COPD", "Hypertension"],
        "medications_generic": ["Albuterol"],
        "rule_triage_level": "urgent",
        "rule_risk_score": 72.0,
    }

    fallback = DeterministicFallbackEngine.generate_fallback_analysis(payload)
    assert fallback.suggested_urgency == "urgent"
    assert len(fallback.differentials) >= 1
    top_diag = fallback.differentials[0]
    assert "Cough" in top_diag.condition or "Breath" in top_diag.condition or "Respiratory" in top_diag.condition


def test_deterministic_clinical_fallback_geriatric_osteoarthritis():
    payload = {
        "age_years": 68,
        "sex": "female",
        "chief_complaint": "Right knee aching pain for 2 weeks",
        "symptoms": [{"symptom": "Knee pain", "duration": "2 weeks", "severity": 4}],
        "vitals": {"temperature": 98.2, "spo2": 98.0, "pulse": 68},
        "comorbidities": ["Osteoarthritis"],
        "medications_generic": ["Acetaminophen"],
        "rule_triage_level": "routine",
        "rule_risk_score": 32.0,
    }

    fallback = DeterministicFallbackEngine.generate_fallback_analysis(payload)
    assert fallback.suggested_urgency == "routine"
    assert len(fallback.differentials) >= 1


@pytest.mark.asyncio
async def test_ai_gateway_complete_orchestration_pipeline():
    gateway = AIGateway()
    case_data = {
        "name": "Synthetic Patient",
        "email": "synthetic@example.com",
        "age": 81,
        "sex": "female",
        "chief_complaint": "Burning urination and mild fatigue for 2 days",
        "symptoms": [{"symptom": "Dysuria", "duration": "2 days", "severity": 5}],
        "vitals": {"temperature": 99.1, "spo2": 96.0, "pulse": 76},
        "comorbidities": ["Type 2 Diabetes"],
        "medications": "Metformin",
        "allergies": "Sulfa drugs",
        "triage_level": "Routine",
        "triage_score": 45.0,
        "rule_rationale": "Routine evaluation indicated for isolated dysuria with stable vitals.",
    }

    result = await gateway.analyze_case(
        case_data=case_data,
        retrieved_chunks=[{
            "id": "chunk_uti",
            "source_name": "Geriatric Urology Guidelines",
            "content": "Dysuria and fatigue in elderly diabetics often signal acute cystitis or urinary tract infection."
        }],
        user_id="synthetic_tester",
        is_synthetic_patient=True
    )

    assert isinstance(result, GatewayResult)
    assert result.model_name is not None
    assert result.prompt_version is not None
    assert "Burning urination" in result.raw_prompt
    assert result.analysis is not None
    assert result.analysis.summary != ""
    assert len(result.analysis.differentials) >= 1
