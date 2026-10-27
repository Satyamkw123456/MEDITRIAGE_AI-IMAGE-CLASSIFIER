from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, PrimaryKeyConstraint
from app.db.session import Base


def get_utc_now():
    return datetime.now(timezone.utc)


class Permission(Base):
    __tablename__ = "permissions"

    code = Column(String(100), primary_key=True)
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, default=False, nullable=False)
    requires_stepup = Column(Boolean, default=False, nullable=False)
    requires_dual_control = Column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<Permission(code='{self.code}')>"


class Role(Base):
    __tablename__ = "roles"

    code = Column(String(50), primary_key=True)
    description = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Role(code='{self.code}')>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_code = Column(String(50), ForeignKey("roles.code", ondelete="CASCADE"), nullable=False)
    permission_code = Column(String(100), ForeignKey("permissions.code", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("role_code", "permission_code"),
    )


class UserPermissionGrant(Base):
    __tablename__ = "user_permission_grants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_code = Column(String(100), ForeignKey("permissions.code", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
