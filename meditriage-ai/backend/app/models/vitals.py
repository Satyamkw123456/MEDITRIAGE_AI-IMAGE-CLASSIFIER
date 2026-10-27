from sqlalchemy import Column, Integer, Float, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Vitals(Base):
    __tablename__ = "vitals"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    temperature = Column(Float, nullable=True)  # in Fahrenheit or Celsius
    pulse = Column(Integer, nullable=True)        # heart rate in bpm
    blood_pressure = Column(String(50), nullable=True)  # e.g., "120/80"
    spo2 = Column(Float, nullable=True)           # blood oxygen saturation percentage

    # Relationship
    case = relationship("Case", back_populates="vitals")

    def __repr__(self) -> str:
        return (
            f"<Vitals(id={self.id}, case_id={self.case_id}, temp={self.temperature}, "
            f"pulse={self.pulse}, bp='{self.blood_pressure}', spo2={self.spo2})>"
        )
