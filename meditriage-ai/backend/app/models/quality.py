from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class QualityScore(Base):
    __tablename__ = "quality_scores"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(
        Integer,
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Core Quality Interpretation Scores
    completeness_score = Column(Float, nullable=False, default=0.0)
    consistency_score = Column(Float, nullable=False, default=1.0)
    flags = Column(JSON, nullable=False, default=list)
    
    # Clarification and Blocking Logic
    requires_clarification = Column(Boolean, nullable=False, default=False, index=True)
    clarifying_question = Column(Text, nullable=True)
    follow_up_questions = Column(JSON, nullable=False, default=list)

    # Future Tier Placeholders (Nullable for now)
    agreement_score = Column(Float, nullable=True)
    evidence_density_score = Column(Float, nullable=True)
    composite_quality_score = Column(Float, nullable=True)
    confidence_band = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationship
    case = relationship("Case", back_populates="quality_score")

    def __repr__(self) -> str:
        return (
            f"<QualityScore(id={self.id}, case_id={self.case_id}, "
            f"completeness={self.completeness_score:.2f}, consistency={self.consistency_score:.2f}, "
            f"requires_clarification={self.requires_clarification})>"
        )
