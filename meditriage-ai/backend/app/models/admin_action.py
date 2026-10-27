from datetime import datetime, timezone
import hashlib
import json
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


def compute_canonical_json(data: dict) -> str:
    """Serializes a dictionary into canonical deterministic JSON format."""
    if data is None:
        return ""
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def compute_admin_action_hash(
    prev_hash: str | None,
    actor_id: int,
    action_code: str,
    target_type: str,
    target_id: str,
    before_state: dict | None,
    after_state: dict | None,
    reason: str | None,
    status: str,
    timestamp_str: str,
) -> str:
    """Calculates SHA-256 cryptographic hash-chain digest for admin_actions (INV-06)."""
    ph = prev_hash or "0" * 64
    b_json = compute_canonical_json(before_state)
    a_json = compute_canonical_json(after_state)
    payload = f"{ph}|{actor_id}|{action_code}|{target_type}|{target_id}|{b_json}|{a_json}|{reason or ''}|{status}|{timestamp_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action_code = Column(String(100), nullable=False, index=True)
    target_type = Column(String(100), nullable=False)
    target_id = Column(String(100), nullable=False)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    ticket_ref = Column(String(100), nullable=True)
    status = Column(String(50), default="APPLIED", nullable=False)  # APPLIED, PENDING_APPROVAL, REJECTED, ROLLED_BACK
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
    request_id = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    prev_hash = Column(String(64), nullable=True)  # SHA-256 hex string of previous entry
    entry_hash = Column(String(64), nullable=True)  # SHA-256 hex string of current entry
    self_approved_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    def calculate_hash(self, prev_entry_hash: str | None = None) -> str:
        ts = self.created_at.isoformat() if self.created_at else get_utc_now().isoformat()
        return compute_admin_action_hash(
            prev_hash=prev_entry_hash or self.prev_hash,
            actor_id=self.actor_id,
            action_code=self.action_code,
            target_type=self.target_type,
            target_id=str(self.target_id),
            before_state=self.before_state,
            after_state=self.after_state,
            reason=self.reason,
            status=self.status,
            timestamp_str=ts,
        )

    def __repr__(self) -> str:
        return f"<AdminAction(id={self.id}, action='{self.action_code}', actor={self.actor_id}, status='{self.status}')>"
