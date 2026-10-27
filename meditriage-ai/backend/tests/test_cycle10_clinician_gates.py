"""
Cycle 10 — Clinician Workspace Gates
Verifies the complete backend support for the clinician experience:
- Priority queue sorting (Emergency first, Low-confidence bump within tier)
- Full explainability via Composer Decision object votes
- Emergency downgrade double confirmation and length safeguard (server-side backstop)
- Clinician feedback submission (Accept, Modify, Reject)
- Shift digest telemetry aggregation
- Review status updates
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.models.user import User
from app.models.patient import PatientProfile
from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.quality import QualityScore
from app.models.diagnosis import DifferentialDiagnosis
from app.models.feedback import ClinicianFeedback
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
def clinician_client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Create test clinician
    c_user = User(
        email="clinician_c10@hospital.org",
        password_hash=get_password_hash("DocSecret123!"),
        name="Dr. Ananya Roy",
        role="clinician",
        is_suspended=False,
    )
    db_session.add(c_user)
    db_session.commit()
    db_session.refresh(c_user)

    token = create_access_token(
        subject=str(c_user.id),
        role=c_user.role,
        email=c_user.email,
        name=c_user.name,
    )
    client = TestClient(app)
    client.headers = {"Authorization": f"Bearer {token}"}
    yield client, c_user, db_session
    app.dependency_overrides.clear()


def seed_workspace_case(db: Session, clinician_user: User):
    # Patient user & profile
    p_user = User(
        email="elder_c10@example.com",
        password_hash=get_password_hash("Patient123!"),
        name="Shri Dinanath",
        role="patient",
    )
    db.add(p_user)
    db.commit()
    db.refresh(p_user)

    profile = PatientProfile(
        user_id=p_user.id,
        age=78,
        sex="Male",
        medical_history="COPD, Chronic Kidney Disease Stage 3",
        allergies="Penicillin",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # Emergency Case
    case_em = Case(
        patient_id=profile.id,
        chief_complaint="Severe acute chest pressure radiating to left arm",
        status="submitted",
        is_emergency_flag=True,
        emergency_rule_fired="RED_FLAG_ACUTE_CORONARY_SYNDROME",
    )
    db.add(case_em)
    db.commit()
    db.refresh(case_em)

    triage_em = TriageResult(
        case_id=case_em.id,
        triage_level="Emergency",
        risk_score=99.0,
        explanation="Red-flag chest pain indicates acute cardiac evaluation.",
        version=1,
        is_current="true",
        source="ENGINE",
    )
    db.add(triage_em)

    symptom_em = SymptomEntry(
        case_id=case_em.id,
        symptom="Severe crushing chest pain",
        severity=9,
        duration="45 minutes",
        body_location="Substernal",
    )
    db.add(symptom_em)

    vitals_em = Vitals(
        case_id=case_em.id,
        temperature=98.6,
        pulse=110,
        blood_pressure="160/95",
        spo2=91.0,
    )
    db.add(vitals_em)

    diag_em = DifferentialDiagnosis(
        case_id=case_em.id,
        condition_name="Acute Coronary Syndrome",
        probability_score=0.88,
        evidence="Substernal chest pressure in 78yo male with tachycardia.",
    )
    db.add(diag_em)

    # Routine Case with Low Confidence (should be bumped)
    case_low = Case(
        patient_id=profile.id,
        chief_complaint="Mild intermittent joint stiffness",
        status="submitted",
        is_emergency_flag=False,
    )
    db.add(case_low)
    db.commit()
    db.refresh(case_low)

    triage_low = TriageResult(
        case_id=case_low.id,
        triage_level="Routine",
        risk_score=40.0,
        explanation="Routine assessment with sparse clinical details.",
        version=1,
        is_current="true",
        source="ENGINE",
    )
    db.add(triage_low)

    quality_low = QualityScore(
        case_id=case_low.id,
        completeness_score=0.45,
        consistency_score=0.60,
        confidence_band="Low",
    )
    db.add(quality_low)

    # Routine Case with High Confidence (standard)
    case_std = Case(
        patient_id=profile.id,
        chief_complaint="Annual routine medication review",
        status="submitted",
        is_emergency_flag=False,
    )
    db.add(case_std)
    db.commit()
    db.refresh(case_std)

    triage_std = TriageResult(
        case_id=case_std.id,
        triage_level="Routine",
        risk_score=25.0,
        explanation="Standard annual visit.",
        version=1,
        is_current="true",
        source="ENGINE",
    )
    db.add(triage_std)

    quality_std = QualityScore(
        case_id=case_std.id,
        completeness_score=0.95,
        consistency_score=0.98,
        confidence_band="High",
    )
    db.add(quality_std)

    db.commit()
    return case_em, case_low, case_std, diag_em


def test_gate1_priority_queue_sorting_and_low_confidence_bump(clinician_client):
    """Gate 1: Priority Queue sorts Emergency first, then Low-confidence bumped up within tier."""
    client, user, db = clinician_client
    case_em, case_low, case_std, _ = seed_workspace_case(db, user)

    res = client.get("/api/v1/cases/queue")
    assert res.status_code == 200
    queue = res.json()
    assert len(queue) >= 3

    # Emergency must be strictly #1
    assert queue[0]["id"] == case_em.id
    assert queue[0]["triage_level"] == "Emergency"

    # Between the two Routine cases, Low Confidence must be bumped ahead of High Confidence!
    queue_ids = [q["id"] for q in queue]
    idx_low = queue_ids.index(case_low.id)
    idx_std = queue_ids.index(case_std.id)
    assert idx_low < idx_std, f"Low confidence case #{case_low.id} (index {idx_low}) was not bumped ahead of standard case #{case_std.id} (index {idx_std})!"


def test_gate2_composer_decision_votes_explainability(clinician_client):
    """Gate 2: Case detail exposes complete Decision object and individual votes with rationales."""
    client, user, db = clinician_client
    case_em, _, _, _ = seed_workspace_case(db, user)

    # 1. Inspect on CaseDetailOut
    res = client.get(f"/api/v1/cases/{case_em.id}")
    assert res.status_code == 200
    detail = res.json()
    assert "decision" in detail
    assert detail["decision"] is not None
    assert "votes" in detail["decision"]
    votes = detail["decision"]["votes"]
    assert len(votes) >= 1
    # Verify every vote carries source, level, and rationale
    for v in votes:
        assert "source" in v and len(v["source"]) > 0
        assert "level" in v
        assert "rationale" in v and len(v["rationale"]) > 0

    # 2. Inspect dedicated decision endpoint
    res_dec = client.get(f"/api/v1/cases/{case_em.id}/decision")
    assert res_dec.status_code == 200
    decision_obj = res_dec.json()
    assert "votes" in decision_obj
    assert len(decision_obj["votes"]) >= 1


def test_gate3_emergency_downgrade_double_confirmation_safeguard(clinician_client):
    """Gate 3: Emergency downgrade requires double confirmation checkbox and reason >= 20 chars."""
    client, user, db = clinician_client
    case_em, _, _, _ = seed_workspace_case(db, user)

    # A. Downgrading without confirmation checkbox -> 400 Bad Request
    res_bad1 = client.post(
        f"/api/v1/cases/{case_em.id}/override-triage",
        json={
            "new_triage_level": "Routine",
            "reason": "Vital signs normalized and chest pain resolved completely upon examination.",
            "confirm_emergency_downgrade": False,
        },
    )
    assert res_bad1.status_code == 400
    assert "confirm_emergency_downgrade=True" in res_bad1.text

    # B. Downgrading with confirmation but reason too short (< 20 chars) -> 400 Bad Request
    res_bad2 = client.post(
        f"/api/v1/cases/{case_em.id}/override-triage",
        json={
            "new_triage_level": "Routine",
            "reason": "Pain stopped.",
            "confirm_emergency_downgrade": True,
        },
    )
    assert res_bad2.status_code == 400
    assert "at least 20 characters" in res_bad2.text

    # C. Downgrading with confirmation and reason >= 20 chars -> 200 OK
    res_ok = client.post(
        f"/api/v1/cases/{case_em.id}/override-triage",
        json={
            "new_triage_level": "Urgent",
            "reason": "Patient observed for 60 minutes with stable ECG and no acute ischemic features.",
            "confirm_emergency_downgrade": True,
        },
    )
    assert res_ok.status_code == 200
    new_triage = res_ok.json()
    assert new_triage["triage_level"] == "Urgent"

    # Verify case state updated
    db.refresh(case_em)
    assert case_em.is_emergency_flag is False


def test_gate4_clinician_feedback_submission(clinician_client):
    """Gate 4: Submitting differential diagnosis feedback (Accept, Modify, Reject)."""
    client, user, db = clinician_client
    case_em, _, _, diag = seed_workspace_case(db, user)

    feedback_payload = {
        "feedbacks": [
            {
                "differential_diagnosis_id": diag.id,
                "feedback_status": "Accepted",
                "notes": "Agreed with ACS differential; cardiology consult dispatched.",
            }
        ]
    }
    res = client.post(f"/api/v1/cases/{case_em.id}/feedback", json=feedback_payload)
    assert res.status_code == 200

    # Verify persisted in database
    fb_row = db.query(ClinicianFeedback).filter(ClinicianFeedback.differential_diagnosis_id == diag.id).first()
    assert fb_row is not None
    assert fb_row.feedback_status == "Accepted"
    assert fb_row.clinician_id == user.id


def test_gate5_shift_digest_telemetry(clinician_client):
    """Gate 5: Overnight clinician digest returns SQL-computed metrics."""
    client, user, db = clinician_client
    seed_workspace_case(db, user)

    res = client.get("/api/v1/ai-hub/clinician-digest?hours_window=24")
    assert res.status_code == 200
    digest = res.json()
    assert "metrics" in digest
    assert digest["metrics"]["recent_admissions_count"] >= 1
    assert "recent_admissions" in digest
    assert digest["computed_via_sql"] is True


def test_gate6_case_status_update_and_summary_edit(clinician_client):
    """Gate 6: Updating case status to reviewed and modifying summary."""
    client, user, db = clinician_client
    case_em, _, _, _ = seed_workspace_case(db, user)

    # 1. Update status
    res_status = client.patch(f"/api/v1/cases/{case_em.id}/status", json={"status": "reviewed"})
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "reviewed"

    # 2. Override summary
    res_summary = client.post(
        f"/api/v1/cases/{case_em.id}/override-summary",
        json={
            "summary_text": "Updated clinical summary: patient stable under telemetry observation.",
            "reason": "Bedside clinical examination findings added.",
        },
    )
    assert res_summary.status_code == 200
    assert "patient stable" in res_summary.json()["explanation"]
