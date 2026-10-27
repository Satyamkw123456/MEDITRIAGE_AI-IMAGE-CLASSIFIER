from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary,
                        String, Text)
from sqlalchemy.orm import backref, relationship

from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class SkinImageAnalysis(Base):
    """A sanitized skin/wound photo and its pipeline output, owned by a case.

    The image is stored in the database (not on the web host's disk) so it survives
    ephemeral-filesystem deployments and is erased with the case under DPDP rules.
    """

    __tablename__ = "skin_image_analyses"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    image_data = Column(LargeBinary, nullable=False)
    image_mime = Column(String(50), nullable=False, default="image/jpeg")
    image_sha256 = Column(String(64), nullable=False, index=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    body_part = Column(String(100), nullable=True)

    classifier_name = Column(String(100), nullable=False)
    classifier_available = Column(Boolean, nullable=False, default=False)
    predictions = Column(JSON, nullable=True)
    relevant_conditions = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)

    severity_score = Column(Integer, nullable=False)
    suggested_triage_level = Column(String(50), nullable=False)
    severity_reasons = Column(JSON, nullable=True)
    rules_fired = Column(JSON, nullable=True)
    confidence_band = Column(String(20), nullable=False)
    requires_clinician_review = Column(Boolean, nullable=False, default=True)
    recommendation = Column(Text, nullable=True)
    escalation_applied = Column(Boolean, nullable=False, default=False)
    trace = Column(JSON, nullable=True)
    pipeline_version = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    case = relationship(
        "Case", backref=backref("skin_analyses", cascade="all, delete-orphan", passive_deletes=True)
    )
