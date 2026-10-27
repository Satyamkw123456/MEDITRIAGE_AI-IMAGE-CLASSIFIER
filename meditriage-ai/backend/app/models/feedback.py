from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class ClinicianFeedback(Base):
    __tablename__ = "clinician_feedback"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    differential_diagnosis_id = Column(Integer, ForeignKey("differential_diagnoses.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feedback_status = Column(String(50), nullable=False) # e.g. Accepted, Modified, Rejected
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="clinician_feedback")
    differential_diagnosis = relationship("DifferentialDiagnosis", back_populates="feedback")
    clinician = relationship("User", back_populates="feedback_given")

    def __repr__(self) -> str:
        return f"<ClinicianFeedback(id={self.id}, diff_id={self.differential_diagnosis_id}, status='{self.feedback_status}')>"
