from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict

FeedbackStatus = Literal["Accepted", "Modified", "Rejected"]

class ClinicianFeedbackCreate(BaseModel):
    differential_diagnosis_id: int
    feedback_status: FeedbackStatus
    notes: Optional[str] = None

class BulkFeedbackCreate(BaseModel):
    feedbacks: List[ClinicianFeedbackCreate]

class ClinicianFeedbackOut(BaseModel):
    id: int
    case_id: int
    differential_diagnosis_id: int
    clinician_id: int
    feedback_status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FeedbackTrendTriageItem(BaseModel):
    triage_level: str
    total_feedbacks: int
    rejected_count: int
    rejection_rate: float

class FeedbackTrendConfidenceItem(BaseModel):
    confidence_band: str
    total_feedbacks: int
    rejected_count: int
    rejection_rate: float

class FeedbackTrendsOut(BaseModel):
    by_triage_level: List[FeedbackTrendTriageItem]
    by_confidence_band: List[FeedbackTrendConfidenceItem]
