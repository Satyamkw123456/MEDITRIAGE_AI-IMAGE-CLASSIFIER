from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), nullable=False)
    prompt_version = Column(String(50), nullable=False)
    raw_prompt = Column(Text, nullable=False)
    raw_response = Column(Text, nullable=False)
    output_summary = Column(Text, nullable=True)
    retrieved_chunks = Column(Text, nullable=True)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    scrub_report = Column(JSON, nullable=True)
    block_reason = Column(String(255), nullable=True)
    fallback_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="ai_audit_logs")

    def __repr__(self) -> str:
        return f"<AIAuditLog(id={self.id}, case_id={self.case_id}, model='{self.model_name}', version='{self.prompt_version}')>"
