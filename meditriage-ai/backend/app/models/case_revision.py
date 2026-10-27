from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, JSON
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class CaseRevision(Base):
    __tablename__ = "case_revisions"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    revision_no = Column(Integer, nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(50), nullable=False)
    change_type = Column(String(50), nullable=False)  # CREATED, EDITED, OVERRIDDEN, SOFT_DELETED
    field_path = Column(String(255), nullable=True)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("case_id", "revision_no", name="uq_case_revision_no"),
    )

    @property
    def revision_number(self) -> int:
        return self.revision_no

    @property
    def snapshot_data(self):
        return self.after_state or self.before_state or {}

    def __repr__(self) -> str:
        return f"<CaseRevision(id={self.id}, case_id={self.case_id}, rev={self.revision_no}, type='{self.change_type}')>"
