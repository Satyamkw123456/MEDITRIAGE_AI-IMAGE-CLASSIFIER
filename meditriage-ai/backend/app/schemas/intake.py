import re
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class VitalsInput(BaseModel):
    temperature: Optional[float] = Field(
        None,
        ge=85.0,
        le=110.0,
        description="Body temperature in Fahrenheit (85.0 - 110.0 °F)"
    )
    pulse: Optional[int] = Field(
        None,
        ge=30,
        le=240,
        description="Heart rate in beats per minute (30 - 240 bpm)"
    )
    blood_pressure: Optional[str] = Field(
        None,
        description="Blood pressure formatted as 'systolic/diastolic' e.g. '120/80'"
    )
    spo2: Optional[float] = Field(
        None,
        ge=50.0,
        le=100.0,
        description="Blood oxygen saturation percentage (50.0 - 100.0 %)"
    )

    @field_validator("blood_pressure")
    @classmethod
    def validate_blood_pressure(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip()
        match = re.match(r"^(\d{2,3})/(\d{2,3})$", v)
        if not match:
            raise ValueError("Blood pressure must be in 'systolic/diastolic' format (e.g., '120/80')")
        
        systolic, diastolic = int(match.group(1)), int(match.group(2))
        if not (50 <= systolic <= 300):
            raise ValueError(f"Systolic blood pressure ({systolic}) must be between 50 and 300 mmHg")
        if not (30 <= diastolic <= 200):
            raise ValueError(f"Diastolic blood pressure ({diastolic}) must be between 30 and 200 mmHg")
        if systolic <= diastolic:
            raise ValueError(f"Systolic ({systolic}) must be strictly greater than diastolic ({diastolic})")
        
        return f"{systolic}/{diastolic}"


class SymptomInput(BaseModel):
    symptom: str = Field(..., min_length=2, max_length=255, description="Specific symptom descriptor")
    duration: Optional[str] = Field(None, max_length=100, description="Duration (e.g. '2 hours', '3 days')")
    severity: int = Field(..., ge=1, le=10, description="Severity score from 1 to 10")
    body_location: Optional[str] = Field(None, max_length=255, description="Anatomical body location")


class PatientIntakeCreate(BaseModel):
    chief_complaint: str = Field(..., min_length=3, max_length=2000, description="Primary chief complaint")
    symptom_duration: str = Field(..., min_length=1, max_length=100, description="Duration of the primary symptom")
    severity: int = Field(..., ge=1, le=10, description="Primary severity score from 1 to 10")
    body_location: str = Field(..., min_length=2, max_length=255, description="Primary anatomical body location")
    age: int = Field(..., ge=1, le=125, description="Patient age in years")
    sex: str = Field(..., description="Biological sex ('Female', 'Male', or 'Other')")
    pregnancy_status: Optional[str] = Field(None, max_length=50, description="Pregnancy status (conditional on female)")
    comorbidities: Optional[Union[List[str], str]] = Field(None, description="Pre-existing comorbidities")
    current_medications: Optional[str] = Field(None, max_length=2000, description="Current prescription / OTC medications")
    allergies: Optional[str] = Field(None, max_length=2000, description="Known drug / environmental allergies")
    vitals: Optional[VitalsInput] = None
    additional_symptoms: Optional[List[SymptomInput]] = None

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, v: str) -> str:
        v_norm = v.strip().capitalize()
        if v_norm not in ["Female", "Male", "Other"]:
            raise ValueError("Sex must be 'Female', 'Male', or 'Other'")
        return v_norm

    @model_validator(mode="after")
    def check_pregnancy_validity(self) -> "PatientIntakeCreate":
        if self.sex == "Male" and self.pregnancy_status and self.pregnancy_status.lower() in ["pregnant", "trimester 1", "trimester 2", "trimester 3"]:
            raise ValueError("Pregnancy status 'Pregnant' is clinically incompatible with biological sex 'Male'")
        return self


class VitalsOut(BaseModel):
    id: int
    case_id: int
    temperature: Optional[float] = None
    pulse: Optional[int] = None
    blood_pressure: Optional[str] = None
    spo2: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class SymptomEntryOut(BaseModel):
    id: int
    case_id: int
    symptom: str
    duration: Optional[str] = None
    severity: Optional[int] = None
    body_location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TriageResultOut(BaseModel):
    id: int
    case_id: int
    triage_level: str
    risk_score: float
    explanation: str
    fallback_used: bool = False
    decision_trace: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FollowUpQuestionOut(BaseModel):
    flag: str
    category: str
    question: str
    target_field: Optional[str] = None
    options: Optional[List[str]] = None
    is_blocking: bool = False

    model_config = ConfigDict(from_attributes=True)


class QualityScoreOut(BaseModel):
    id: int
    case_id: int
    completeness_score: float
    consistency_score: float
    flags: List[str] = []
    requires_clarification: bool = False
    clarifying_question: Optional[str] = None
    follow_up_questions: List[FollowUpQuestionOut] = []
    agreement_score: Optional[float] = None
    evidence_density_score: Optional[float] = None
    composite_quality_score: Optional[float] = None
    confidence_band: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseClarificationInput(BaseModel):
    clarification_response: Optional[str] = Field(None, description="Free-text narrative clarification response")
    chief_complaint: Optional[str] = Field(None, min_length=3, max_length=2000, description="Updated or clarified chief complaint")
    symptom_duration: Optional[str] = Field(None, min_length=1, max_length=100, description="Updated duration")
    severity: Optional[int] = Field(None, ge=1, le=10, description="Updated severity score")
    body_location: Optional[str] = Field(None, min_length=2, max_length=255, description="Updated body location")
    vitals: Optional[VitalsInput] = None
    pregnancy_status: Optional[str] = None
    comorbidities: Optional[Union[List[str], str]] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None


from app.schemas.ai import DifferentialDiagnosisOut, AIAuditLogOut


class CaseDetailOut(BaseModel):
    id: int
    patient_id: int
    chief_complaint: str
    status: str
    is_emergency_flag: bool = False
    emergency_rule_fired: Optional[str] = None
    created_at: datetime
    symptoms: List[SymptomEntryOut] = []
    vitals: List[VitalsOut] = []
    triage_result: Optional[TriageResultOut] = None
    quality_score: Optional[QualityScoreOut] = None
    differential_diagnoses: List[DifferentialDiagnosisOut] = []
    ai_audit_logs: List[AIAuditLogOut] = []
    patient_age: Optional[int] = None
    patient_sex: Optional[str] = None
    decision: Optional[Dict[str, Any]] = None
    unreviewed_rules_notice: Optional[str] = None
    ai_status: Optional[str] = "ready"

    model_config = ConfigDict(from_attributes=True)


class ClinicianQueueItemOut(BaseModel):
    id: int
    patient_name: str
    patient_age: int
    patient_sex: str
    chief_complaint: str
    triage_level: str
    status: str
    is_emergency_flag: bool
    confidence_band: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseStatusUpdate(BaseModel):
    status: str = Field(..., description="The new status of the case, e.g. 'reviewed'")
