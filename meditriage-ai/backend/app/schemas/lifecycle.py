from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.intake import SymptomInput, VitalsInput


class CaseAmendInput(BaseModel):
    expected_revision_no: Optional[int] = Field(None, description="Expected current revision number for optimistic concurrency")
    chief_complaint: Optional[str] = Field(None, min_length=3, max_length=2000)
    symptoms: Optional[List[SymptomInput]] = None
    vitals: Optional[VitalsInput] = None
    reason: Optional[str] = Field(None, max_length=1000)


class CaseCommentInput(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=2000, description="Patient or caregiver comment text")


class ClinicianSummaryEditInput(BaseModel):
    summary_text: str = Field(..., min_length=3, max_length=4000, description="Updated clinician summary text")
    reason: Optional[str] = Field(None, max_length=1000)


class TriageOverrideInput(BaseModel):
    new_triage_level: str = Field(..., description="Target triage level: 'Emergency', 'Urgent', 'Routine', or 'Self-Care Info'")
    reason: str = Field(..., min_length=1, description="Clinical rationale for override")
    confirm_emergency_downgrade: bool = Field(False, description="Second explicit confirmation required to downgrade an Emergency level")


class RevisionDiffItem(BaseModel):
    field: str
    old_value: Any
    new_value: Any
    description: str


class CaseRevisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    revision_no: int
    actor_id: Optional[int] = None
    actor_role: str
    change_type: str
    field_path: Optional[str] = None
    reason: Optional[str] = None
    diffs: List[RevisionDiffItem] = []
    created_at: datetime


class CaseCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    user_id: Optional[int] = None
    author_role: str
    comment_text: str
    created_at: datetime
