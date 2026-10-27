from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def get_current_user(
    request: Request = None,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """Validate Bearer JWT token and return the current authenticated User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # Hard read-only enforcement during active impersonation
    is_impersonation = payload.get("is_impersonation", False)
    impersonated_by = payload.get("impersonated_by")
    if is_impersonation or impersonated_by:
        if request is not None and request.method.upper() in ("POST", "PUT", "PATCH", "DELETE"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="IMPERSONATION_READ_ONLY: Mutating actions are strictly forbidden during impersonation sessions.",
            )

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    user = (
        db.query(User)
        .options(joinedload(User.patient_profile))
        .filter(User.id == user_id_int)
        .first()
    )
    if user is None:
        raise credentials_exception

    if getattr(user, "is_suspended", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended. Please contact administrator.",
        )

    token_ver = payload.get("token_version", 1)
    user_ver = getattr(user, "token_version", 1)
    if token_ver < user_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if is_impersonation or impersonated_by:
        setattr(user, "_impersonated_by", impersonated_by)
        if request is not None:
            request.state.impersonated_by = impersonated_by

    return user


from app.services.auth.rbac_service import user_has_permission


class PermissionChecker:
    """Dependency enforcing permission-based access control via single perm code (INV-14)."""
    def __init__(self, perm_code: str):
        self.perm_code = perm_code

    def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        if not user_has_permission(current_user, self.perm_code, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: missing required permission '{self.perm_code}' for user role '{current_user.role}'."
            )
        return current_user


def require_permission(perm_code: str) -> PermissionChecker:
    """Factory helper returning a PermissionChecker instance for a given permission code (INV-14)."""
    return PermissionChecker(perm_code)


class RoleChecker:
    """Dependency for enforcing Role-Based Access Control (RBAC)."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {self.allowed_roles}. Current role is '{current_user.role}'."
            )
        return current_user


# Pre-configured role dependencies (backward-compatible shims)
require_patient = RoleChecker(["patient", "admin", "super_admin"])
require_clinician = RoleChecker(["clinician", "admin", "super_admin"])
require_admin = RoleChecker(["admin", "super_admin"])

from app.api.authz import get_case_for_user as get_case_for_user

