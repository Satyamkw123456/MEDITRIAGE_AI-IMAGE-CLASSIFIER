from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class TriageResult(Base):
    __tablename__ = "triage_results"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    triage_level = Column(String(50), nullable=False, index=True)  # 'Urgent', 'Routine', 'Self-Care Info'
    risk_score = Column(Float, nullable=False)
    explanation = Column(Text, nullable=False)
    fallback_used = Column(Boolean, default=False, nullable=False)
    decision_trace = Column(JSON, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    is_current = Column(String(10), default="true", nullable=False, index=True)
    source = Column(String(50), default="ENGINE", nullable=False)  # 'ENGINE' or 'CLINICIAN_OVERRIDE'
    supersedes_id = Column(Integer, ForeignKey("triage_results.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="triage_result")

    def __repr__(self) -> str:
        return f"<TriageResult(id={self.id}, case_id={self.case_id}, level='{self.triage_level}', score={self.risk_score})>"
