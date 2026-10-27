from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class DifferentialDiagnosis(Base):
    __tablename__ = "differential_diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    condition_name = Column(String(255), nullable=False)
    probability_score = Column(Float, nullable=False)
    evidence = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="differential_diagnoses")
    feedback = relationship("ClinicianFeedback", back_populates="differential_diagnosis", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DifferentialDiagnosis(id={self.id}, case_id={self.case_id}, condition='{self.condition_name}', prob={self.probability_score})>"
