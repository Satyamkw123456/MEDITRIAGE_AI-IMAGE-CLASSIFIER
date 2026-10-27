from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class SkinPredictionOut(BaseModel):
    label: str
    confidence: float
    class_index: int


class SkinConditionOut(BaseModel):
    id: str
    data: str
    score: float
    source: str


class SkinFlowNodeOut(BaseModel):
    id: str
    type: str
    label: str
    status: str
    detail: str


class SkinFlowEdgeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: str
    to: str


class SkinFlowTraceOut(BaseModel):
    pipeline_version: str
    nodes: List[SkinFlowNodeOut]
    edges: List[Dict[str, str]]


class SkinAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    body_part: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    classifier_name: str
    classifier_available: bool
    predictions: List[SkinPredictionOut] = []
    relevant_conditions: List[SkinConditionOut] = []
    description: Optional[str] = None
    severity_score: int
    suggested_triage_level: str
    severity_reasons: List[str] = []
    rules_fired: List[str] = []
    confidence_band: str
    requires_clinician_review: bool
    recommendation: Optional[str] = None
    escalation_applied: bool
    trace: Optional[SkinFlowTraceOut] = None
    pipeline_version: str
    created_at: datetime


class SkinStatusOut(BaseModel):
    classifier_available: bool
    classifier_name: str
    classifier_reason: Optional[str] = None
    knowledge_entries: int
    max_upload_bytes: int
    allowed_types: List[str]
    pipeline_version: str
