from datetime import datetime, timezone
import hashlib
import json
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


def compute_payload_checksum(payload: dict) -> str:
    """Computes SHA-256 checksum of payload dictionary."""
    canonical_str = json.dumps(payload, sort_keys=True, separators=(",", ":")) if payload else ""
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


class ConfigVersion(Base):
    __tablename__ = "config_versions"

    id = Column(Integer, primary_key=True, index=True)
    namespace = Column(String(100), nullable=False, index=True)  # e.g., 'flags', 'settings-non-sensitive', 'rules', 'prompts'
    key = Column(String(100), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, pending_approval, published, archived
    payload = Column(JSON, nullable=False)
    checksum = Column(String(64), nullable=False)
    parent_version = Column(Integer, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    def calculate_checksum(self) -> str:
        return compute_payload_checksum(self.payload)

    def __repr__(self) -> str:
        return f"<ConfigVersion(namespace='{self.namespace}', key='{self.key}', v={self.version}, status='{self.status}')>"
