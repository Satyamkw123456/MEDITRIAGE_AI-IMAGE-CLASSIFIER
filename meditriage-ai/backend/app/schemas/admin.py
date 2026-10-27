from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.ai import AIAuditLogOut
from app.schemas.intake import QualityScoreOut, TriageResultOut

class SymptomCountOut(BaseModel):
    name: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class TriageCountOut(BaseModel):
    level: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class AdminAnalyticsOut(BaseModel):
    total_cases: int
    symptoms: List[SymptomCountOut]
    triage_distribution: List[TriageCountOut]

    model_config = ConfigDict(from_attributes=True)


class UnifiedAuditTrailOut(BaseModel):
    case_id: int
    created_at: datetime
    rule_triage: Optional[TriageResultOut] = None
    quality_score: Optional[QualityScoreOut] = None
    ai_logs: List[AIAuditLogOut] = []

    model_config = ConfigDict(from_attributes=True)
