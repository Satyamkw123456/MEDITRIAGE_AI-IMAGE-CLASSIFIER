from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="patient", nullable=False)
    mfa_secret = Column(String(255), nullable=True)
    mfa_enabled = Column(String(10), default="false", nullable=False)

    # Admin Control Plane & Account State
    is_suspended = Column(Boolean, default=False, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    clinician_verification_status = Column(String(50), default="approved", nullable=False)  # unverified, pending, approved, rejected
    clinician_registration_number = Column(String(100), nullable=True)
    clinician_credential_doc = Column(JSON, nullable=True)
    requires_reconsent = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # 1-to-1 relationship with PatientProfile (if user is a patient)
    patient_profile = relationship(
        "PatientProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    feedback_given = relationship("ClinicianFeedback", back_populates="clinician")

    @property
    def profile(self):
        return self.patient_profile

    @property
    def is_active(self) -> bool:
        return not self.is_suspended

    @property
    def full_name(self) -> str:
        return self.name

    @full_name.setter
    def full_name(self, val: str):
        self.name = val

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
