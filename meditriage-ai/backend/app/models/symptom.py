from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    symptom = Column(String(255), nullable=False)
    duration = Column(String(100), nullable=True)
    severity = Column(Integer, nullable=True)
    body_location = Column(String(255), nullable=True)

    # Relationship
    case = relationship("Case", back_populates="symptoms")

    def __repr__(self) -> str:
        return f"<SymptomEntry(id={self.id}, case_id={self.case_id}, symptom='{self.symptom}', severity={self.severity})>"
