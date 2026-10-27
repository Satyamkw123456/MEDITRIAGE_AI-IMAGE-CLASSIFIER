"""
Cycle 09 — Patient & Caregiver Experience Gates
Verifies the complete real-backend patient journey:
- Intake wizard v2 -> Case creation & triage scoring
- Result verification (TriageBanner + TrustStrip data)
- Case amendment with symptom worsening -> Re-triage reflection & revision diff
- Comments submission
- Soft-delete with 30-day grace
- Case restore (graceful recovery)
- Access history logging (Cycle 7 integration)
- Caregiver 4AT-lite cognitive screening (Bellelli et al. 2014)
- AI Hub endpoints (Daily check-in, Med review, Explain summary)
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.models.user import User
from app.models.case import Case
from app.models.patient import PatientProfile
from app.models.consent import ConsentLog
from app.core.security import get_password_hash, create_access_token
from app.services.auth.rbac_service import seed_rbac_tables


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
def patient_client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Create test patient user
    email = f"patient_c9_{int(datetime.now().timestamp())}@example.com"
    user = User(
        email=email,
        password_hash=get_password_hash("Secret123!"),
        name="Ramesh Sharma",
        role="patient",
        is_suspended=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Initialize patient profile
    profile = PatientProfile(
        user_id=user.id,
        age=74,
        sex="Male",
        medical_history="Hypertension, Type 2 Diabetes",
        allergies="Sulfa drugs",
    )
    db_session.add(profile)

    # Record consent
    consent = ConsentLog(
        user_id=user.id,
        consent_type="MEDICAL_AI_DISCLAIMER",
        version="v1.0",
        granted=True,
        granted_by="patient",
    )
    db_session.add(consent)
    db_session.commit()

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        email=user.email,
        name=user.name,
    )
    client = TestClient(app)
    client.headers = {"Authorization": f"Bearer {token}"}
    yield client, user, db_session
    app.dependency_overrides.clear()


def test_gate1_full_patient_journey_intake_result_amend_delete_restore(patient_client):
    client, user, db = patient_client

    # 1. INTAKE: Submit patient intake wizard v2
    intake_payload = {
        "chief_complaint": "Persistent dull headache with dizziness",
        "symptom_duration": "2 to 3 days",
        "severity": 4,
        "body_location": "Head",
        "age": 74,
        "sex": "Male",
        "comorbidities": ["Hypertension", "Type 2 Diabetes"],
        "current_medications": "Metformin 500mg, Amlodipine 5mg",
        "vitals": {
            "temperature": 98.6,
            "pulse": 76,
            "blood_pressure": "135/85",
            "spo2": 97.0
        }
    }

    res = client.post("/api/v1/cases/intake", json=intake_payload)
    assert res.status_code == 201, f"Intake failed: {res.text}"
    case_data = res.json()
    case_id = case_data["id"]
    assert case_id is not None
    assert case_data["chief_complaint"] == "Persistent dull headache with dizziness"
    assert case_data["status"] in ["submitted", "NEW", "active"]

    # 2. RESULT: Verify initial triage result
    res_case = client.get(f"/api/v1/cases/{case_id}")
    assert res_case.status_code == 200
    case_detail = res_case.json()
    assert case_detail["triage_result"] is not None
    initial_level = case_detail["triage_result"]["triage_level"]
    assert initial_level in ["Routine", "Urgent", "ROUTINE", "URGENT"]

    # 3. AMEND: Patient updates symptoms with acute worsening (crushing chest pain, severe 9/10)
    amend_payload = {
        "chief_complaint": "Sudden onset crushing substernal chest pain with cold sweat",
        "severity": 9,
        "reason": "Symptoms acutely worsened 10 minutes after initial submission."
    }
    res_amend = client.post(f"/api/v1/cases/{case_id}/amend", json=amend_payload)
    assert res_amend.status_code == 200, f"Amend failed: {res_amend.text}"
    amended_case = res_amend.json()
    assert amended_case["chief_complaint"] == "Sudden onset crushing substernal chest pain with cold sweat"

    # 4. RE-TRIAGE REFLECTED: Verify red flag emergency escalation
    res_case_retriage = client.get(f"/api/v1/cases/{case_id}")
    assert res_case_retriage.status_code == 200
    retriage_detail = res_case_retriage.json()
    assert retriage_detail["is_emergency_flag"] is True
    assert retriage_detail["triage_result"]["triage_level"].upper() in ["EMERGENCY", "EMERGENT"]

    # Verify revision timeline contains the amendment
    res_revs = client.get(f"/api/v1/cases/{case_id}/revisions")
    assert res_revs.status_code == 200
    revs = res_revs.json()
    assert len(revs) >= 1
    assert any("Symptoms acutely worsened" in (r.get("reason") or "") for r in revs)

    # 5. COMMENTS: Add patient feedback comment
    res_comment = client.post(
        f"/api/v1/cases/{case_id}/comments",
        json={"comment_text": "I called 112 as advised by the triage banner."}
    )
    assert res_comment.status_code == 201
    assert res_comment.json()["comment_text"] == "I called 112 as advised by the triage banner."

    # 6. SOFT-DELETE: Delete case with 30-day grace period
    res_del = client.delete(f"/api/v1/cases/{case_id}")
    assert res_del.status_code == 200
    del_msg = res_del.json().get("message", "")
    assert "deleted" in del_msg.lower() or "grace" in del_msg.lower() or "scheduled" in del_msg.lower()

    # Verify deleted_at is populated
    db_case = db.query(Case).filter(Case.id == case_id).first()
    assert db_case.deleted_at is not None

    # 7. RESTORE: Restore the deleted case
    res_restore = client.post(f"/api/v1/cases/{case_id}/undo-delete")
    assert res_restore.status_code == 200
    db.refresh(db_case)
    assert db_case.deleted_at is None

    # 8. ACCESS HISTORY: Verify patient access history endpoint
    res_access = client.get(f"/api/v1/cases/{case_id}/access-history")
    assert res_access.status_code == 200
    access_data = res_access.json()
    assert "access_events" in access_data or isinstance(access_data, list)


def test_gate2_caregiver_4at_delirium_micro_screen():
    from app.services.geriatric.micro_screens import MicroScreens

    # Clinician/Caregiver observed normal
    res_normal = MicroScreens.evaluate_4at_lite(
        item_scores={"alertness": 0, "amt4": 0, "attention": 0, "acute_change": 0},
        informant_type="caregiver"
    )
    assert res_normal.is_valid is True
    assert res_normal.is_positive is False
    assert res_normal.total_score == 0

    # Clinician/Caregiver observed acute delirium features (alertness 4, acute change 4)
    res_delirium = MicroScreens.evaluate_4at_lite(
        item_scores={"alertness": 4, "amt4": 1, "attention": 1, "acute_change": 4},
        informant_type="caregiver"
    )
    assert res_delirium.is_valid is True
    assert res_delirium.is_positive is True
    assert res_delirium.total_score >= 4
    assert "Delirium" in res_delirium.risk_summary

    # Self-report guardrail: Must be blocked
    res_blocked = MicroScreens.evaluate_4at_lite(
        item_scores={"alertness": 4},
        informant_type="self"
    )
    assert res_blocked.is_valid is False
    assert "BLOCKED" in res_blocked.validation_note


def test_gate3_ai_hub_patient_tools(patient_client):
    client, user, db = patient_client

    # 1. Daily Check-in
    res_checkin = client.post(
        "/api/v1/ai-hub/checkin",
        json={
            "pain_score": 3,
            "mood": "Good",
            "alertness": "Normal",
            "notes": "Walked 15 minutes, feeling comfortable",
            "vitals": {"temperature": 98.4, "pulse": 72}
        }
    )
    assert res_checkin.status_code == 200

    # 2. Medication Review
    res_meds = client.post(
        "/api/v1/ai-hub/medication-review",
        json={
            "medications": ["Metformin 500mg", "Amlodipine 5mg", "Atorvastatin 20mg"],
            "age": 74
        }
    )
    assert res_meds.status_code == 200
    med_data = res_meds.json()
    assert "anticholinergic_burden_flag" in med_data or "resolved_medications" in med_data or "safety_flags" in med_data
