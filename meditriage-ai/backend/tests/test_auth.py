import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from alembic import command
from alembic.config import Config

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app.main import app
from app.api.deps import get_db as api_get_db
from app.db.session import get_db as session_get_db

TEST_DB_PATH = os.path.join(BASE_DIR, "test_auth_meditriage.db")
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_auth_database():
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass

    # Run migrations on test DB
    alembic_cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    alembic_cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
    command.upgrade(alembic_cfg, "head")

    # Ensure clean tables even if file was locked
    try:
        from app.models import Base
        with engine.begin() as conn:
            for tbl in reversed(Base.metadata.sorted_tables):
                try:
                    conn.execute(tbl.delete())
                except Exception:
                    pass
    except Exception:
        pass

    yield

    engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass


@pytest.fixture
def client():
    app.dependency_overrides[api_get_db] = override_get_db
    app.dependency_overrides[session_get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_patient_registration(client):
    """Test patient registration with profile auto-creation."""
    payload = {
        "name": "Kamla Devi",
        "email": "kamla.devi@example.com",
        "password": "SecurePassword123!",
        "role": "patient",
        "age": 78,
        "sex": "Female",
        "medical_history": "Osteoarthritis, Mild cognitive decline",
        "allergies": "Sulfa drugs"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "kamla.devi@example.com"
    assert data["user"]["role"] == "patient"
    assert data["user"]["profile"] is not None
    assert data["user"]["profile"]["age"] == 78


def test_clinician_registration(client):
    """Test clinician registration is rejected on public endpoint."""
    payload = {
        "name": "Dr. Ananya Roy",
        "email": "dr.ananya@hospital.org",
        "password": "ClinicianPass2026!",
        "role": "clinician"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code in (403, 422), response.text


def test_admin_registration(client):
    """Test admin registration is rejected on public endpoint."""
    payload = {
        "name": "System Admin",
        "email": "admin@meditriage.internal",
        "password": "MasterAdminKey99!",
        "role": "admin"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code in (403, 422), response.text


def test_duplicate_registration_rejected(client):
    """Test that duplicate email registration returns 409 Conflict."""
    payload = {
        "name": "Kamla Clone",
        "email": "kamla.devi@example.com",
        "password": "AnotherPassword456!",
        "role": "patient"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


def test_login_success(client):
    """Test successful user login."""
    response = client.post("/api/v1/auth/login", json={
        "email": "kamla.devi@example.com",
        "password": "SecurePassword123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "kamla.devi@example.com"


def test_login_invalid_password(client):
    """Test login failure with wrong password."""
    response = client.post("/api/v1/auth/login", json={
        "email": "kamla.devi@example.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_login_nonexistent_user(client):
    """Test login failure with nonexistent email."""
    response = client.post("/api/v1/auth/login", json={
        "email": "ghost.user@example.com",
        "password": "SomePassword!"
    })
    assert response.status_code == 401


def test_get_me_authenticated(client):
    """Test /api/v1/auth/me with valid Bearer token."""
    login_res = client.post("/api/v1/auth/login", json={
        "email": "kamla.devi@example.com",
        "password": "SecurePassword123!"
    })
    token = login_res.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    user = response.json()
    assert user["email"] == "kamla.devi@example.com"
    assert user["name"] == "Kamla Devi"
    assert user["profile"]["age"] == 78


def test_get_me_unauthorized(client):
    """Test /api/v1/auth/me without authorization header."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_role_based_access_control(client):
    """Test role checking guards across patient, clinician, and admin endpoints."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Provision clinician and admin accounts in test DB
    with TestingSessionLocal() as db:
        if not db.query(User).filter(User.email == "dr.ananya@hospital.org").first():
            clin = User(
                name="Dr. Ananya Roy",
                email="dr.ananya@hospital.org",
                password_hash=get_password_hash("ClinicianPass2026!"),
                role="clinician",
            )
            db.add(clin)
        if not db.query(User).filter(User.email == "admin@meditriage.internal").first():
            adm = User(
                name="System Admin",
                email="admin@meditriage.internal",
                password_hash=get_password_hash("MasterAdminKey99!"),
                role="admin",
            )
            db.add(adm)
        db.commit()

    # Obtain tokens for each role
    patient_token = client.post("/api/v1/auth/login", json={
        "email": "kamla.devi@example.com",
        "password": "SecurePassword123!"
    }).json()["access_token"]

    clinician_token = client.post("/api/v1/auth/login", json={
        "email": "dr.ananya@hospital.org",
        "password": "ClinicianPass2026!"
    }).json()["access_token"]

    admin_token = client.post("/api/v1/auth/login", json={
        "email": "admin@meditriage.internal",
        "password": "MasterAdminKey99!"
    }).json()["access_token"]

    # 1. Patient testing
    res_pat_to_pat = client.get("/api/v1/auth/patient-only", headers={"Authorization": f"Bearer {patient_token}"})
    assert res_pat_to_pat.status_code == 200

    res_pat_to_clin = client.get("/api/v1/auth/clinician-only", headers={"Authorization": f"Bearer {patient_token}"})
    assert res_pat_to_clin.status_code == 403

    res_pat_to_admin = client.get("/api/v1/auth/admin-only", headers={"Authorization": f"Bearer {patient_token}"})
    assert res_pat_to_admin.status_code == 403

    # 2. Clinician testing
    res_clin_to_clin = client.get("/api/v1/auth/clinician-only", headers={"Authorization": f"Bearer {clinician_token}"})
    assert res_clin_to_clin.status_code == 200

    res_clin_to_admin = client.get("/api/v1/auth/admin-only", headers={"Authorization": f"Bearer {clinician_token}"})
    assert res_clin_to_admin.status_code == 403

    # 3. Admin testing (has access to all)
    res_adm_to_admin = client.get("/api/v1/auth/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm_to_admin.status_code == 200

    res_adm_to_clin = client.get("/api/v1/auth/clinician-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm_to_clin.status_code == 200

    res_adm_to_pat = client.get("/api/v1/auth/patient-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm_to_pat.status_code == 200


def test_admin_login_with_mfa(client):
    """Test that an admin created via internal flow can authenticate with MFA challenge."""
    import pyotp
    from app.core.security import get_password_hash
    from app.models.user import User

    secret = pyotp.random_base32()
    admin_email = "mfa_admin@meditriage.internal"
    admin_pwd = "MfaAdminPass!2026"

    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            user = User(
                name="MFA Admin",
                email=admin_email,
                password_hash=get_password_hash(admin_pwd),
                role="admin",
                mfa_secret=secret,
                mfa_enabled="true",
            )
            db.add(user)
            db.commit()

    # Step 1: Initial login returns mfa_required=True and mfa_token
    login_res = client.post("/api/v1/auth/login", json={
        "email": admin_email,
        "password": admin_pwd,
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["mfa_required"] is True
    assert "mfa_token" in data
    mfa_token = data["mfa_token"]

    # Step 2: Submit valid TOTP challenge
    totp = pyotp.TOTP(secret)
    challenge_res = client.post("/api/v1/auth/mfa/challenge", json={
        "mfa_token": mfa_token,
        "code": totp.now(),
    })
    assert challenge_res.status_code == 200, challenge_res.text
    token_data = challenge_res.json()
    assert "access_token" in token_data
    assert token_data["user"]["email"] == admin_email


def test_csrf_cookie_refresh_flow(client):
    """
    Test CSRF cookie refresh and logout flow:
    login -> client reads csrf_token cookie -> POST /auth/refresh with X-CSRF-Token header == 200
    and a new access token; without the header == 403; after logout, refresh == 401.
    """
    from app.core.security import get_password_hash
    from app.models.user import User

    test_email = "csrf.test@example.com"
    test_password = "SecurePassword123!"

    with TestingSessionLocal() as db:
        if not db.query(User).filter(User.email == test_email).first():
            db.add(User(
                name="CSRF Test User",
                email=test_email,
                password_hash=get_password_hash(test_password),
                role="patient",
            ))
            db.commit()

    # 1. Login to obtain session cookies
    login_res = client.post("/api/v1/auth/login", json={
        "email": test_email,
        "password": test_password,
    })
    assert login_res.status_code == 200
    initial_access_token = login_res.json()["access_token"]

    # Client reads csrf_token cookie
    csrf_token = client.cookies.get("csrf_token")
    assert csrf_token is not None, "csrf_token cookie should be present"

    # Verify csrf_token cookie was set with Path=/
    set_cookie_headers = login_res.headers.get_list("set-cookie")
    csrf_cookie_header = next((h for h in set_cookie_headers if h.startswith("csrf_token=")), None)
    assert csrf_cookie_header is not None
    assert "Path=/" in csrf_cookie_header or "path=/" in csrf_cookie_header

    # 2. Without X-CSRF-Token header == 403 Forbidden
    res_no_header = client.post("/api/v1/auth/refresh")
    assert res_no_header.status_code == 403
    assert "CSRF token validation failed" in res_no_header.json().get("detail", "")

    # 3. With X-CSRF-Token header == 200 OK and a new access token
    res_with_header = client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf_token}
    )
    assert res_with_header.status_code == 200
    refresh_data = res_with_header.json()
    assert "access_token" in refresh_data
    new_access_token = refresh_data["access_token"]
    assert new_access_token
    assert new_access_token != initial_access_token

    # 4. Logout to clear session cookies
    current_csrf = client.cookies.get("csrf_token") or csrf_token
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": current_csrf}
    )
    assert logout_res.status_code == 200

    # 5. After logout, refresh == 401 Unauthorized
    res_after_logout = client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": current_csrf}
    )
    assert res_after_logout.status_code == 401

