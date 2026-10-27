from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    chief_complaint = Column(Text, nullable=False)
    status = Column(String(50), default="submitted", nullable=False)
    
    # Red-flag emergency indicators
    is_emergency_flag = Column(Boolean, default=False, nullable=False, index=True)
    emergency_rule_fired = Column(String(500), nullable=True)
    red_flag_retracted = Column(Boolean, default=False, nullable=False)
    ai_status = Column(String(50), default="ready", nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    
    # Soft Delete Columns (INV-05)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    purge_after = Column(DateTime(timezone=True), nullable=True)

    # Admin Control Plane & Oversight
    legal_hold = Column(Boolean, default=False, nullable=False)
    legal_hold_reason = Column(Text, nullable=True)
    assigned_clinician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    patient = relationship("PatientProfile", back_populates="cases")
    symptoms = relationship("SymptomEntry", back_populates="case", cascade="all, delete-orphan")
    vitals = relationship("Vitals", back_populates="case", cascade="all, delete-orphan")
    triage_result = relationship("TriageResult", primaryjoin="and_(Case.id == TriageResult.case_id, TriageResult.is_current == 'true')", uselist=False, viewonly=True)
    triage_results = relationship("TriageResult", back_populates="case", cascade="all, delete-orphan")
    quality_score = relationship("QualityScore", back_populates="case", uselist=False, cascade="all, delete-orphan")
    differential_diagnoses = relationship("DifferentialDiagnosis", back_populates="case", cascade="all, delete-orphan")
    ai_audit_logs = relationship("AIAuditLog", back_populates="case", cascade="all, delete-orphan")
    clinician_feedback = relationship("ClinicianFeedback", back_populates="case", cascade="all, delete-orphan")
    comments = relationship("CaseComment", back_populates="case", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Case(id={self.id}, patient_id={self.patient_id}, status='{self.status}', emergency={self.is_emergency_flag})>"
