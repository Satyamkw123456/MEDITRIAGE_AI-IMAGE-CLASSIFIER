from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base


class ConsentLog(Base):
    __tablename__ = "consent_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type = Column(String(100), default="triage_evaluation", nullable=False)
    version = Column(String(50), default="v1.0-dpdp2023", nullable=False)
    granted = Column(Boolean, default=True, nullable=False)
    granted_by = Column(String(50), default="patient", nullable=False)  # "patient" or "caregiver"
    caregiver_name = Column(String(255), nullable=True)
    caregiver_relationship = Column(String(100), nullable=True)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="consent_logs")
