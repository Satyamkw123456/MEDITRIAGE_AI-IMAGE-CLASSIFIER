from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.feedback import ClinicianFeedbackOut


class DiagnosisItem(BaseModel):
    condition_name: str = Field(..., description="Name of the possible clinical condition/diagnosis")
    probability_score: float = Field(..., ge=0.0, le=1.0, description="Ranked relative clinical probability score between 0.0 and 1.0")
    evidence: str = Field(..., description="Brief clinical evidence from patient presentation, vitals, history, or demographics")


class AIClinicalInferenceOutput(BaseModel):
    patient_summary: str = Field(..., description="Concise structured geriatric clinical summary")
    suggested_urgency: Literal["Urgent", "Routine", "Self-Care Info", "Emergency"] = Field(
        ..., description="LLM's independently suggested urgency level for future agreement check"
    )
    urgency_rationale: str = Field(..., description="Clinical reasoning explaining the suggested urgency level")
    differential_diagnoses: List[DiagnosisItem] = Field(
        ..., min_length=1, max_length=5, description="Ranked list of top differential diagnoses"
    )


class DifferentialDiagnosisOut(BaseModel):
    id: int
    case_id: int
    condition_name: str
    probability_score: float
    evidence: str
    created_at: datetime
    feedback: Optional['ClinicianFeedbackOut'] = None

    model_config = ConfigDict(from_attributes=True)


class AIAuditLogOut(BaseModel):
    id: int
    case_id: int
    model_name: str
    prompt_version: str
    raw_prompt: Optional[str] = None
    raw_response: Optional[str] = None
    output_summary: Optional[str] = None
    retrieved_chunks: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

