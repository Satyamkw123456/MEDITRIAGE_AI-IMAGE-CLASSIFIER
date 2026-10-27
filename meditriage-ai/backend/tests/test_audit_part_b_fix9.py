"""
Fix 9 Verification Test Suite:
Verifies Consent Status Gating on Intake Entry
Contract:
1. Intake entry checks GET /api/v1/consent/status. Unconsented user receives has_consent=False.
2. Granting consent via POST /api/v1/consent/record logs consent under DPDP Act 2023.
3. GET /api/v1/consent/status now returns has_consent=True, enabling clinical intake.
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.models.user import User
from app.core.security import get_password_hash, create_access_token
from app.services.auth.rbac_service import seed_rbac_tables


def get_utc_now():
    return datetime.now(timezone.utc)


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_rbac_tables(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_client(db_session):
    user = User(
        name="Intake Consent Patient",
        email="intake_consent@meditriage.test",
        role="patient",
        password_hash=get_password_hash("Secret123!"),
        is_suspended=False,
        token_version=1,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        email=user.email,
        name=user.name,
    )

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})

    yield client, user, db_session

    app.dependency_overrides.clear()


def test_fix9_intake_entry_consent_gating_flow(test_client):
    client, user, db = test_client

    # Step 1: User enters intake -> Frontend checks consent status
    status_res = client.get("/api/v1/consent/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    # Confirms user does NOT yet have active consent -> Gate blocks symptom form
    assert status_data["has_consent"] is False
    assert status_data["latest_consent"] is None

    # Step 2: User grants informed consent on the intake consent gate
    record_payload = {
        "consent_type": "triage_evaluation",
        "version": "v1.0-dpdp2023",
        "granted": True,
        "granted_by": "patient",
    }
    record_res = client.post("/api/v1/consent/record", json=record_payload)
    assert record_res.status_code == 201
    record_data = record_res.json()
    assert record_data["granted"] is True
    assert record_data["version"] == "v1.0-dpdp2023"

    # Step 3: Re-checking consent status now returns active consent -> Intake unlocked
    recheck_res = client.get("/api/v1/consent/status")
    assert recheck_res.status_code == 200
    recheck_data = recheck_res.json()
    assert recheck_data["has_consent"] is True
    assert recheck_data["latest_consent"]["granted"] is True
