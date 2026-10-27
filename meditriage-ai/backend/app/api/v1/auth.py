import time
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Dict
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_db,
    get_current_user,
    require_patient,
    require_clinician,
    require_admin,
)
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    create_mfa_pending_token,
    decode_mfa_token,
    denylist_jti,
    create_refresh_token_record,
    rotate_refresh_token_record,
    revoke_refresh_token_family,
    revoke_all_user_refresh_tokens,
)
from app.models.user import User
from app.models.patient import PatientProfile
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    Token,
    UserOut,
    MfaEnrollOut,
    MfaVerifyInput,
    MfaChallengeInput,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Roles"])

# Constant-time dummy hash for nonexistent users to prevent enumeration timing attacks
_DUMMY_HASH = get_password_hash("ConstantTimeDummyPassword#2026")


def _set_auth_cookies(response: Response, raw_refresh_token: str) -> str:
    """Set HttpOnly refresh cookie and double-submit non-HttpOnly CSRF cookie."""
    is_prod = settings.ENVIRONMENT.lower() not in ("development", "test")
    csrf_token = secrets.token_hex(16)

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/api/v1/auth",
        max_age=7 * 24 * 3600,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_prod,
        samesite="strict",
        path="/",
        max_age=7 * 24 * 3600,
    )
    return csrf_token


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    response.delete_cookie(key="csrf_token", path="/")


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("register", limit=5, window_seconds=3600))],
)
def register(
    user_in: UserRegister,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    """
    Register a new user with role ('patient' or 'caregiver').
    Privileged roles ('clinician', 'admin') are blocked from public registration.
    """
    norm_email = user_in.email.strip().lower()

    # 1. Check if email already exists -> return 409 Conflict
    existing_user = db.query(User).filter(User.email == norm_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address is already registered.",
        )

    # 2. Create User record
    db_user = User(
        name=user_in.name.strip(),
        email=norm_email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
    )
    db.add(db_user)
    db.flush()

    # 3. If patient, create linked patient profile
    if user_in.role == "patient":
        profile = PatientProfile(
            user_id=db_user.id,
            age=user_in.age,
            sex=user_in.sex,
            medical_history=user_in.medical_history,
            allergies=user_in.allergies,
        )
        db.add(profile)
        db_user.patient_profile = profile

    db.commit()
    db.refresh(db_user)

    # 4. Generate JWT access token & Refresh token
    access_token = create_access_token(
        subject=db_user.id,
        role=db_user.role,
        email=db_user.email,
        name=db_user.name,
    )
    raw_refresh, _ = create_refresh_token_record(db, db_user.id)
    _set_auth_cookies(response, raw_refresh)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(db_user),
    )


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(rate_limit("login", limit=10, window_seconds=60))],
)
def login(
    login_data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    """
    Authenticate user with email and password with lockout protection, MFA challenge, and token issuance.
    """
    norm_email = login_data.email.strip().lower()
    user = (
        db.query(User)
        .options(joinedload(User.patient_profile))
        .filter(User.email == norm_email)
        .first()
    )

    now_utc = datetime.now(timezone.utc)

    # Constant-time dummy verification if user does not exist
    if not user:
        verify_password(login_data.password, _DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if account is currently locked
    if user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now_utc:
            retry_after = max(1, int((locked_until - now_utc).total_seconds()) + 1)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account is temporarily locked due to multiple failed login attempts.",
                headers={"Retry-After": str(retry_after)},
            )
        else:
            user.locked_until = None

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            attempts = user.failed_login_attempts
            lockout_mins = 15 if attempts == 5 else (30 if attempts == 6 else 60)
            user.locked_until = now_utc + timedelta(minutes=lockout_mins)
            retry_after = lockout_mins * 60
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account locked due to consecutive failed login attempts.",
                headers={"Retry-After": str(retry_after)},
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reset lockout on successful authentication
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    # Check MFA requirement for privileged accounts (admin / clinician)
    if user.mfa_enabled == "true":
        mfa_token = create_mfa_pending_token(user.id)
        return Token(
            access_token="",
            token_type="bearer",
            user=UserOut.model_validate(user),
            mfa_required=True,
            mfa_token=mfa_token,
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
    )
    raw_refresh, _ = create_refresh_token_record(db, user.id)
    _set_auth_cookies(response, raw_refresh)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post(
    "/token",
    response_model=Token,
    dependencies=[Depends(rate_limit("token", limit=10, window_seconds=60))],
)
def login_oauth2(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Any:
    """
    OAuth2 compatible token login for Swagger UI Authorize modal.
    """
    norm_email = form_data.username.strip().lower()
    user = (
        db.query(User)
        .options(joinedload(User.patient_profile))
        .filter(User.email == norm_email)
        .first()
    )

    now_utc = datetime.now(timezone.utc)
    if not user:
        verify_password(form_data.password, _DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now_utc:
            retry_after = max(1, int((locked_until - now_utc).total_seconds()) + 1)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account is temporarily locked due to multiple failed login attempts.",
                headers={"Retry-After": str(retry_after)},
            )
        else:
            user.locked_until = None

    if not verify_password(form_data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            attempts = user.failed_login_attempts
            lockout_mins = 15 if attempts == 5 else (30 if attempts == 6 else 60)
            user.locked_until = now_utc + timedelta(minutes=lockout_mins)
            retry_after = lockout_mins * 60
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account locked due to consecutive failed login attempts.",
                headers={"Retry-After": str(retry_after)},
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
    )
    raw_refresh, _ = create_refresh_token_record(db, user.id)
    _set_auth_cookies(response, raw_refresh)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=Token)
def refresh_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    """
    Rotates refresh token from HttpOnly cookie and returns fresh access token.
    Requires CSRF double-submit check when cookies are present.
    """
    csrf_cookie = request.cookies.get("csrf_token")
    if csrf_cookie:
        csrf_header = request.headers.get("X-CSRF-Token")
        if not csrf_header or csrf_header != csrf_cookie:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed.",
            )

    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided.",
        )

    new_raw, new_rec = rotate_refresh_token_record(db, raw_token)
    user = (
        db.query(User)
        .options(joinedload(User.patient_profile))
        .filter(User.id == new_rec.user_id)
        .first()
    )
    if not user or user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account invalid or suspended.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
    )
    _set_auth_cookies(response, new_raw)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    """
    Server-side logout: revokes current access token JTI, revokes refresh token family, clears cookies.
    """
    csrf_cookie = request.cookies.get("csrf_token")
    if csrf_cookie:
        csrf_header = request.headers.get("X-CSRF-Token")
        if csrf_header and csrf_header != csrf_cookie:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed.",
            )

    # Denylist bearer token JTI if present
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header[7:].strip()
        payload = decode_access_token(token_str)
        if payload and payload.get("jti"):
            exp = payload.get("exp", time.time() + 900)
            denylist_jti(payload["jti"], float(exp))

    # Revoke refresh token if cookie present
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh:
        try:
            from app.core.security import hash_token
            from app.models.refresh_token import RefreshToken

            h = hash_token(raw_refresh)
            rt = db.query(RefreshToken).filter(RefreshToken.token_hash == h).first()
            if rt:
                revoke_refresh_token_family(db, rt.family_id)
        except Exception:
            pass

    _clear_auth_cookies(response)
    return {"message": "Logged out successfully."}


@router.post("/logout-all", status_code=status.HTTP_200_OK)
def logout_all_sessions(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Revokes all active sessions for current user by bumping token_version and revoking all refresh tokens.
    """
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()

    revoke_all_user_refresh_tokens(db, current_user.id)

    # Also denylist current access token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header[7:].strip()
        payload = decode_access_token(token_str)
        if payload and payload.get("jti"):
            denylist_jti(payload["jti"], float(payload.get("exp", time.time() + 900)))

    _clear_auth_cookies(response)
    return {"message": "All sessions revoked successfully."}


# ---------------------------------------------------------------------
# Multi-Factor Authentication (MFA)
# ---------------------------------------------------------------------
@router.post("/mfa/enroll", response_model=MfaEnrollOut)
def enroll_mfa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Generates a TOTP secret and otpauth provisioning URI for authenticator apps.
    """
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="MediTriage AI",
    )
    current_user.mfa_secret = secret
    db.commit()
    return MfaEnrollOut(secret=secret, otpauth_uri=uri)


@router.post("/mfa/verify")
def verify_mfa_enrollment(
    payload: MfaVerifyInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Verifies user's TOTP code to activate MFA on their account and returns recovery codes.
    """
    secret = payload.secret or current_user.mfa_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA secret not found. Please initiate enrollment first.",
        )

    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA verification code.",
        )

    current_user.mfa_secret = secret
    current_user.mfa_enabled = "true"
    db.commit()

    recovery_codes = [secrets.token_hex(4) for _ in range(10)]
    return {
        "message": "MFA enabled successfully.",
        "recovery_codes": recovery_codes,
    }


@router.post("/mfa/challenge", response_model=Token)
def mfa_challenge(
    payload: MfaChallengeInput,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    """
    Exchanges a valid mfa_token and TOTP code for full access and refresh tokens.
    """
    user_id = decode_mfa_token(payload.mfa_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA token.",
        )

    user = (
        db.query(User)
        .options(joinedload(User.patient_profile))
        .filter(User.id == user_id)
        .first()
    )
    if not user or not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User MFA not configured.",
        )

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA verification code.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
    )
    raw_refresh, _ = create_refresh_token_record(db, user.id)
    _set_auth_cookies(response, raw_refresh)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Fetch profile, role, and permission data for the currently authenticated user.
    """
    from app.services.auth.rbac_service import get_user_permissions

    perms = list(get_user_permissions(current_user, db))
    out = UserOut.model_validate(current_user)
    out.permissions = sorted(perms)
    return out


# Role-protected test routes for RBAC verification
@router.get("/patient-only", response_model=Dict[str, str])
def patient_access_test(current_user: User = Depends(require_patient)) -> Any:
    """Accessible only by users with 'patient' or 'admin' role."""
    return {
        "status": "success",
        "message": f"Welcome patient {current_user.name}",
        "role": current_user.role,
    }


@router.get("/clinician-only", response_model=Dict[str, str])
def clinician_access_test(current_user: User = Depends(require_clinician)) -> Any:
    """Accessible only by users with 'clinician' or 'admin' role."""
    return {
        "status": "success",
        "message": f"Welcome clinician Dr. {current_user.name}",
        "role": current_user.role,
    }


@router.get("/admin-only", response_model=Dict[str, str])
def admin_access_test(current_user: User = Depends(require_admin)) -> Any:
    """Accessible strictly by 'admin' role."""
    return {
        "status": "success",
        "message": f"Welcome administrator {current_user.name}",
        "role": current_user.role,
    }
