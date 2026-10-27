import time
import uuid
import secrets
import hashlib
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union, Tuple
import bcrypt
import jwt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.refresh_token import RefreshToken

# In-memory JTI denylist for revoked access tokens
_denylisted_jtis: Dict[str, float] = {}
_jti_lock = threading.Lock()


def denylist_jti(jti: str, exp_timestamp: float) -> None:
    """Add a token JTI to the denylist until its expiration."""
    with _jti_lock:
        _denylisted_jtis[jti] = exp_timestamp


def is_jti_denylisted(jti: Optional[str]) -> bool:
    """Check if a JTI has been revoked."""
    if not jti:
        return False
    now = time.time()
    with _jti_lock:
        exp = _denylisted_jtis.get(jti)
        if exp is None:
            return False
        if exp < now:
            _denylisted_jtis.pop(jti, None)
            return False
        return True


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a stored bcrypt hash string."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate a secure bcrypt hash for the provided password."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(
    subject: Union[str, Any],
    role: str,
    email: str,
    name: str,
    expires_delta: Optional[timedelta] = None,
    token_version: int = 1,
    is_impersonation: bool = False,
    impersonated_by: Optional[int] = None,
    ticket_ref: Optional[str] = None,
) -> str:
    """Generate a signed JWT token containing subject user ID, role claims, token version, jti, iss, and aud."""
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(subject),
        "email": email,
        "name": name,
        "role": role,
        "token_version": token_version,
        "jti": str(uuid.uuid4()),
        "iss": "meditriage",
        "aud": "meditriage-client",
        "exp": expire,
        "iat": now_utc,
    }
    if is_impersonation:
        to_encode["is_impersonation"] = True
        to_encode["impersonated_by"] = impersonated_by
        if ticket_ref:
            to_encode["ticket_ref"] = ticket_ref

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token with required claims and denylist check."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience="meditriage-client",
            issuer="meditriage",
            options={"require": ["exp", "iat", "sub", "jti"]},
        )
        jti = payload.get("jti")
        if is_jti_denylisted(jti):
            return None
        return payload
    except jwt.PyJWTError:
        return None


def create_mfa_pending_token(user_id: int) -> str:
    """Generate a short-lived single-purpose token for pending MFA verification."""
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + timedelta(minutes=5)
    to_encode = {
        "sub": str(user_id),
        "type": "mfa_pending",
        "jti": str(uuid.uuid4()),
        "iss": "meditriage",
        "aud": "meditriage-client",
        "exp": expire,
        "iat": now_utc,
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_mfa_token(token: str) -> Optional[int]:
    """Validate MFA pending token and return user ID."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience="meditriage-client",
            issuer="meditriage",
            options={"require": ["exp", "iat", "sub", "jti"]},
        )
        if payload.get("type") != "mfa_pending":
            return None
        return int(payload.get("sub"))
    except Exception:
        return None


def generate_refresh_token() -> str:
    """Generate an opaque 256-bit random refresh token string."""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """SHA-256 hash representation for storing opaque tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_refresh_token_record(
    db: Session, user_id: int, family_id: Optional[str] = None
) -> Tuple[str, RefreshToken]:
    """Create a new hashed refresh token record in the database."""
    raw_token = generate_refresh_token()
    token_hash = hash_token(raw_token)
    family = family_id or str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    rec = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=family,
        expires_at=expires_at,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return raw_token, rec


def rotate_refresh_token_record(db: Session, raw_token: str) -> Tuple[str, RefreshToken]:
    """
    Rotates a refresh token.
    If the presented token is already revoked, revokes the entire token family (reuse detection).
    """
    h = hash_token(raw_token)
    token = db.query(RefreshToken).filter(RefreshToken.token_hash == h).first()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    now_utc = datetime.now(timezone.utc)
    if token.revoked_at is not None:
        # Reuse detected! Revoke the entire family
        db.query(RefreshToken).filter(RefreshToken.family_id == token.family_id).update(
            {"revoked_at": now_utc}, synchronize_session=False
        )
        db.commit()
        raise HTTPException(
            status_code=401, detail="Refresh token reuse detected. Family revoked."
        )

    exp = token.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc:
        raise HTTPException(status_code=401, detail="Refresh token expired.")

    # Rotate
    token.revoked_at = now_utc
    new_raw, new_rec = create_refresh_token_record(db, token.user_id, family_id=token.family_id)
    token.replaced_by = new_rec.id
    db.commit()
    return new_raw, new_rec


def revoke_refresh_token_family(db: Session, family_id: str) -> None:
    """Revoke all tokens in a family."""
    db.query(RefreshToken).filter(RefreshToken.family_id == family_id).update(
        {"revoked_at": datetime.now(timezone.utc)}, synchronize_session=False
    )
    db.commit()


def revoke_all_user_refresh_tokens(db: Session, user_id: int) -> None:
    """Revoke all refresh tokens for a given user."""
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).update(
        {"revoked_at": datetime.now(timezone.utc)}, synchronize_session=False
    )
    db.commit()
