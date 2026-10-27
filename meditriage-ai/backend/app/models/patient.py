from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age = Column(Integer, nullable=True)
    sex = Column(String(50), nullable=True)
    medical_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    is_synthetic = Column(String(10), default="true", nullable=False)

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    cases = relationship("Case", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<PatientProfile(id={self.id}, user_id={self.user_id}, age={self.age}, sex='{self.sex}')>"
