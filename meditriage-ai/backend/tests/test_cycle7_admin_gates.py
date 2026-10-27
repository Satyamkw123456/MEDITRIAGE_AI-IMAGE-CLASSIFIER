import pytest
import os
import sys
import json
import copy
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.deps import get_db
from app.db.session import Base
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.case import Case
from app.models.patient import PatientProfile
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.config_version import ConfigVersion, compute_payload_checksum
from app.models.support_ops import ImpersonationSession, BreakGlassReveal, EmergencyResource, SecurityIncident
from app.models.admin_action import AdminAction
from app.services.auth.rbac_service import seed_rbac_tables
from app.services.admin.clinical_governance_service import ClinicalGovernanceService
from app.services.admin.ai_control_service import AIControlService
from app.services.admin.support_tools_service import SupportToolsService
from app.services.admin.content_resources_service import ContentResourcesService
from app.services.admin.operations_service import OperationsService, MinimalScheduler
from app.services.admin.audit_compliance_service import AuditComplianceService
from app.services.admin.needs_attention_service import NeedsAttentionService
from app.services.geriatric.rules_engine import SEEDED_GERIATRIC_RULES
from app.services.geriatric.composer import Level
from app.services.audit.audit_service import AuditService


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
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


def seed_test_user(db, email: str, role: str, name: str = "Test User", token_version: int = 1) -> User:
    user = User(
        email=email.lower().strip(),
        name=name,
        password_hash=get_password_hash("SecretPassword123!"),
        role=role,
        is_suspended=False,
        token_version=token_version,
        clinician_verification_status="approved",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user, is_impersonation: bool = False, impersonated_by: int = None, ticket_ref: str = None):
    token = create_access_token(
        subject=user.id,
        role=user.role,
        email=user.email,
        name=user.name,
        token_version=user.token_version,
        is_impersonation=is_impersonation,
        impersonated_by=impersonated_by,
        ticket_ref=ticket_ref,
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# SPIKE 1 & GATE 1: Unsafe Rule Publish Blocked by Regression Gate
# ============================================================================

def test_spike1_and_gate1_unsafe_rule_publish_blocked_by_regression_suite(db_session, client):
    """
    SPIKE 1 & GATE 1:
    1. Draft a deliberately unsafe rule that downgrades high-risk fall on anticoagulants to ROUTINE.
    2. Run Impact Preview -> proves red-flag sensitivity drops below 100% and flags regressions.
    3. Attempt publish -> MUST be strictly blocked with HTTP 422.
    4. Then draft a safe rule and publish with mandatory validated_by reviewer -> succeeds!
    """
    admin = seed_test_user(db_session, "admin_gov@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. Prepare DELIBERATELY unsafe rule set
    unsafe_rules = copy.deepcopy(SEEDED_GERIATRIC_RULES)
    for r in unsafe_rules:
        if r["id"] == "GERI-RULE-02-FALL-ANTICOAG":
            r["escalate_to"] = "ROUTINE"  # Deliberate dangerous downgrade!
            r["forbid_levels"] = []

    # Create draft
    res_draft = client.post(
        "/api/v1/admin/clinical/rules/draft",
        json={"namespace": "geriatric_rules", "key": "rules", "payload": unsafe_rules, "note": "Unsafe test draft"},
        headers=adm_headers,
    )
    assert res_draft.status_code == 201
    draft_v = res_draft.json()["version"]

    # 2. Impact Preview identifies the drop in sensitivity
    res_preview = client.post(
        "/api/v1/admin/clinical/rules/impact-preview",
        json={"payload": unsafe_rules},
        headers=adm_headers,
    )
    assert res_preview.status_code == 200
    preview_data = res_preview.json()
    assert preview_data["suite_status"] == "FAILED"
    assert preview_data["complete_twin_sensitivity"] < 1.0
    assert preview_data["regressions_count"] > 0
    assert any("fall" in r.get("case_name", "").lower() or "fall" in r.get("case_id", "").lower() for r in preview_data["regressions"])

    # 3. Attempt publish -> MUST BE BLOCKED with HTTP 422!
    res_pub_blocked = client.post(
        "/api/v1/admin/clinical/rules/publish",
        json={
            "namespace": "geriatric_rules",
            "key": "rules",
            "version": draft_v,
            "validated_by": "Dr. Compliance Officer",
            "reason": "Attempting to publish unsafe rule",
        },
        headers=adm_headers,
    )
    assert res_pub_blocked.status_code == 422
    assert "Clinical governance publish blocked" in res_pub_blocked.text

    # Missing validated_by field also strictly blocked
    res_no_reviewer = client.post(
        "/api/v1/admin/clinical/rules/publish",
        json={"namespace": "geriatric_rules", "key": "rules", "version": draft_v, "validated_by": ""},
        headers=adm_headers,
    )
    assert res_no_reviewer.status_code in (422, 400)

    # 4. Safe rule publish succeeds
    safe_rules = copy.deepcopy(SEEDED_GERIATRIC_RULES)
    res_safe_draft = client.post(
        "/api/v1/admin/clinical/rules/draft",
        json={"namespace": "geriatric_rules", "key": "rules", "payload": safe_rules, "note": "Safe rule draft"},
        headers=adm_headers,
    )
    safe_v = res_safe_draft.json()["version"]

    res_safe_pub = client.post(
        "/api/v1/admin/clinical/rules/publish",
        json={
            "namespace": "geriatric_rules",
            "key": "rules",
            "version": safe_v,
            "validated_by": "Dr. Verified Reviewer (MD)",
            "reason": "Approved clinical update",
        },
        headers=adm_headers,
    )
    assert res_safe_pub.status_code == 200
    assert res_safe_pub.json()["status"] == "published"


# ============================================================================
# SPIKE 2 & GATE 3: Impersonation Hard Read-Only Enforcement
# ============================================================================

def test_spike2_and_gate3_impersonation_hard_read_only_enforcement(db_session, client):
    """
    SPIKE 2 & GATE 3:
    1. Start impersonation session (TTL <= 15m) -> generates impersonation bearer token.
    2. Attempt ANY mutating request (POST, PUT, PATCH, DELETE) -> strictly rejected with 403 IMPERSONATION_READ_ONLY.
    3. Read-only GET requests succeed and are tagged with impersonated_by.
    4. End impersonation session -> succeeds.
    """
    admin = seed_test_user(db_session, "admin_supp@test.com", "admin")
    patient = seed_test_user(db_session, "pat_target@test.com", "patient")
    adm_headers = auth_headers(admin)

    # 1. Start impersonation session
    res_start = client.post(
        "/api/v1/admin/support/impersonate",
        json={
            "target_user_id": patient.id,
            "reason": "Investigating patient billing and appointment history",
            "ticket_ref": "TICK-8842",
            "duration_minutes": 15,
        },
        headers=adm_headers,
    )
    assert res_start.status_code == 200
    session_data = res_start.json()
    assert session_data["is_read_only"] is True
    session_id = session_data["session_id"]
    imp_token = session_data["token"]
    imp_headers = {"Authorization": f"Bearer {imp_token}"}

    # 2. Spike: Attempt mutating requests across categories -> MUST return 403 IMPERSONATION_READ_ONLY
    # Category A: POST (Create Case Intake)
    res_post = client.post(
        "/api/v1/cases/intake",
        json={"chief_complaint": "Attempting write during impersonation", "age": 70},
        headers=imp_headers,
    )
    assert res_post.status_code == 403
    assert "IMPERSONATION_READ_ONLY" in res_post.text

    # Category B: PATCH (Update User)
    res_patch = client.patch(
        f"/api/v1/admin/users/{patient.id}",
        json={"phone_number": "+919988776655", "reason": "Edit attempt"},
        headers=imp_headers,
    )
    assert res_patch.status_code == 403
    assert "IMPERSONATION_READ_ONLY" in res_patch.text

    # Category C: DELETE (Delete Case)
    res_delete = client.delete(
        "/api/v1/cases/999",
        headers=imp_headers,
    )
    assert res_delete.status_code == 403
    assert "IMPERSONATION_READ_ONLY" in res_delete.text

    # 3. Read-only GET request succeeds
    res_get = client.get("/api/v1/auth/me", headers=imp_headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == patient.id

    # 4. Stop session
    res_stop = client.post(f"/api/v1/admin/support/impersonate/{session_id}/stop", headers=adm_headers)
    assert res_stop.status_code == 200
    assert res_stop.json()["is_active"] is False


# ============================================================================
# GATE 2: Rollback Restores Byte-Identical Payload
# ============================================================================

def test_gate2_rollback_restores_byte_identical_payload(db_session, client):
    """
    Gate 2: Modifying configuration (v1 -> v2) and rolling back to v1 creates v3
    with a byte-identical payload and matching SHA-256 checksum.
    """
    admin = seed_test_user(db_session, "admin_rb@test.com", "admin")
    adm_headers = auth_headers(admin)

    # Initial Version 1
    rules_v1 = copy.deepcopy(SEEDED_GERIATRIC_RULES)
    res_d1 = client.post(
        "/api/v1/admin/clinical/rules/draft",
        json={"namespace": "geriatric_rules", "key": "rules", "payload": rules_v1, "note": "V1 baseline"},
        headers=adm_headers,
    )
    assert res_d1.status_code == 201
    v1_id = res_d1.json()["id"]
    v1_checksum = res_d1.json()["checksum"]

    # Publish V1
    client.post(
        "/api/v1/admin/clinical/rules/publish",
        json={"namespace": "geriatric_rules", "key": "rules", "version": 1, "validated_by": "Dr. V1 Reviewer"},
        headers=adm_headers,
    )

    # Version 2 with non-critical text change
    rules_v2 = copy.deepcopy(rules_v1)
    rules_v2[0]["name"] = "Acute Cognitive Decline / Delirium (Updated Guideline Reference)"
    res_d2 = client.post(
        "/api/v1/admin/clinical/rules/draft",
        json={"namespace": "geriatric_rules", "key": "rules", "payload": rules_v2, "note": "V2 update"},
        headers=adm_headers,
    )
    client.post(
        "/api/v1/admin/clinical/rules/publish",
        json={"namespace": "geriatric_rules", "key": "rules", "version": 2, "validated_by": "Dr. V2 Reviewer"},
        headers=adm_headers,
    )

    # Rollback to Version 1
    res_rb = client.post(
        "/api/v1/admin/clinical/rules/rollback",
        json={
            "namespace": "geriatric_rules",
            "key": "rules",
            "target_version": 1,
            "reason": "Reverting back to proven baseline",
        },
        headers=adm_headers,
    )
    assert res_rb.status_code == 200
    v3_data = res_rb.json()
    assert v3_data["version"] == 3
    # PROVE: Byte-identical checksum equality!
    assert v3_data["checksum"] == v1_checksum, "Rollback failed byte-identical payload verification!"


# ============================================================================
# GATE 4: Break-Glass PHI Reveal with TTL Expiration
# ============================================================================

def test_gate4_break_glass_reveal_expires_after_ttl_and_audited(db_session, client):
    """
    Gate 4: Break-glass PHI reveal requires justification, has TTL <= 10m,
    appears in auditor list, and expires after the TTL (tested with time travel).
    """
    admin = seed_test_user(db_session, "admin_bg@test.com", "admin")
    patient = seed_test_user(db_session, "pat_bg@test.com", "patient")
    adm_headers = auth_headers(admin)

    case = Case(
        patient_id=patient.id,
        chief_complaint="Severe acute chest pain with diaphoresis",
        is_emergency_flag=True,
    )
    db_session.add(case)
    db_session.commit()

    # 1. Execute break-glass reveal
    res_reveal = client.post(
        f"/api/v1/admin/support/cases/{case.id}/break-glass",
        json={
            "reason": "Emergency department resuscitation; patient unconscious and unidentified",
            "duration_minutes": 10,
        },
        headers=adm_headers,
    )
    assert res_reveal.status_code == 200
    reveal_data = res_reveal.json()
    assert reveal_data["is_active"] is True
    assert reveal_data["chief_complaint"] == "Severe acute chest pain with diaphoresis"

    # 2. Appears in auditor-visible list
    res_auditor = client.get("/api/v1/admin/support/break-glass/list", headers=adm_headers)
    assert res_auditor.status_code == 200
    reveals = res_auditor.json()["reveals"]
    assert any(r["case_id"] == case.id and r["is_active"] is True for r in reveals)

    # 3. Time travel check: After TTL elapsed, authorization expires
    future_time = datetime.now(timezone.utc) + timedelta(minutes=15)
    is_active_later = SupportToolsService.is_break_glass_active(
        case_id=case.id,
        user_id=admin.id,
        db=db_session,
        current_time=future_time,
    )
    assert is_active_later is False, "Break-glass did not expire after TTL!"


# ============================================================================
# GATE 5: RAG Source Disable Takes Effect Immediately on Next Retrieval
# ============================================================================

def test_gate5_rag_source_disable_takes_effect_immediately(db_session, client):
    """
    Gate 5: Disabling a RAG source immediately excludes its chunks on the very next query.
    """
    admin = seed_test_user(db_session, "admin_rag@test.com", "admin")
    adm_headers = auth_headers(admin)

    # 1. List sources
    res_sources = client.get("/api/v1/admin/operations/rag/sources", headers=adm_headers)
    assert res_sources.status_code == 200
    sources = res_sources.json()["sources"]
    assert len(sources) >= 1
    target_source = sources[0]["source_name"]

    # 2. Disable source
    res_disable = client.post(
        "/api/v1/admin/operations/rag/sources/disable",
        json={"source_identifier": target_source, "reason": "Temporarily excluding for guideline review"},
        headers=adm_headers,
    )
    assert res_disable.status_code == 200
    assert res_disable.json()["is_disabled"] is True
    assert target_source in OperationsService.get_disabled_sources()

    # 3. Simulate orchestrator retrieval filtering
    class MockChromaCollection:
        def query(self, query_texts, n_results=3):
            return {
                "ids": [["chunk_1", "chunk_2"]],
                "metadatas": [[
                    {"source_name": target_source, "source_url": "https://target.com", "license_note": "CC-BY"},
                    {"source_name": "Active Source B", "source_url": "https://active.com", "license_note": "Public Domain"}
                ]],
                "documents": [["Target document text", "Active document text"]]
            }

    mock_collection = MockChromaCollection()
    # Query through production retrieval path with injected collection
    retrieved_chunks = OperationsService.retrieve_rag_chunks(query_text="chest pain", collection=mock_collection)
    retrieved_sources = [c["source_name"] for c in retrieved_chunks]

    # Target source MUST be excluded immediately by production retrieval filter!
    assert target_source not in retrieved_sources
    assert "Active Source B" in retrieved_sources

    # 4. Re-enable source
    res_enable = client.post(
        "/api/v1/admin/operations/rag/sources/enable",
        json={"source_identifier": target_source},
        headers=adm_headers,
    )
    assert res_enable.status_code == 200
    assert target_source not in OperationsService.get_disabled_sources()

    # Re-enabled source MUST now be returned by production retrieval
    re_enabled_chunks = OperationsService.retrieve_rag_chunks(query_text="chest pain", collection=mock_collection)
    re_enabled_sources = [c["source_name"] for c in re_enabled_chunks]
    assert target_source in re_enabled_sources


# ============================================================================
# GATE 6: Signed Export Verifies & Detects Post-Export Tampering
# ============================================================================

def test_gate6_signed_export_verifies_and_detects_tampering(db_session, client):
    """
    Gate 6: Cryptographic HMAC signed export verifies integrity; tampering fails verification.
    """
    admin = seed_test_user(db_session, "admin_exp@test.com", "admin")
    adm_headers = auth_headers(admin)

    # Create administrative actions
    AuditService.write_admin_action(
        actor_id=admin.id,
        action_code="SAMPLE_ACTION_1",
        target_type="system",
        target_id="system",
        reason="Testing signed export",
        db=db_session,
    )
    AuditService.write_admin_action(
        actor_id=admin.id,
        action_code="SAMPLE_ACTION_2",
        target_type="system",
        target_id="system",
        reason="Testing signed export step 2",
        db=db_session,
    )

    # 1. Generate signed JSON export
    res_exp = client.get("/api/v1/admin/audit/export?format_type=json", headers=adm_headers)
    assert res_exp.status_code == 200
    export_payload = res_exp.json()
    assert "signature" in export_payload
    assert len(export_payload["data"]) >= 2

    # 2. Verify authentic export -> PASSES
    res_ver_clean = client.post(
        "/api/v1/admin/audit/export/verify",
        json=export_payload,
        headers=adm_headers,
    )
    assert res_ver_clean.status_code == 200
    assert res_ver_clean.json()["is_valid"] is True
    assert res_ver_clean.json()["tampered"] is False

    # 3. Tamper with a single field in the exported payload -> MUST FAIL VERIFICATION!
    tampered_payload = copy.deepcopy(export_payload)
    tampered_payload["data"][0]["reason"] = "Tampered reason post-export"

    res_ver_tampered = client.post(
        "/api/v1/admin/audit/export/verify",
        json=tampered_payload,
        headers=adm_headers,
    )
    assert res_ver_tampered.status_code == 200
    assert res_ver_tampered.json()["is_valid"] is False
    assert res_ver_tampered.json()["tampered"] is True


# ============================================================================
# GATE 7: Stale Emergency Directory Resources in Needs Attention
# ============================================================================

def test_gate7_stale_emergency_directory_resources_in_needs_attention(db_session, client):
    """
    Gate 7: Emergency directory resources unverified for > 90 days correctly feed
    into the Needs Attention aggregator from Cycle 6.
    """
    admin = seed_test_user(db_session, "admin_na2@test.com", "admin")
    adm_headers = auth_headers(admin)

    # Seed an emergency resource verified 100 days ago
    stale_date = datetime.now(timezone.utc) - timedelta(days=100)
    stale_res = EmergencyResource(
        name="District General Hospital Trauma Helpline",
        category="hospital",
        phone_number="022-26543210",
        city_region="Mumbai Metro",
        last_verified_at=stale_date,
        is_active=True,
    )
    db_session.add(stale_res)
    db_session.commit()

    # Query Needs Attention
    res_na = client.get("/api/v1/admin/needs-attention", headers=adm_headers)
    assert res_na.status_code == 200
    data = res_na.json()

    categories = {c["category"]: c for c in data["categories"]}
    assert "stale_emergency_numbers" in categories
    stale_cat = categories["stale_emergency_numbers"]
    assert stale_cat["count"] >= 1
    assert stale_cat["action_url"].startswith("/admin/")


# ============================================================================
# GATE 8: Quality Layer Parameter Unlock Dual-Control & Regression Gate
# ============================================================================

def test_gate8_quality_layer_parameter_unlock_requires_both(db_session, client):
    """
    Gate 8: Quality Layer parameter unlock requires BOTH dual-control AND a passing regression run.
    Either alone is strictly insufficient.
    """
    admin = seed_test_user(db_session, "admin_ql@test.com", "admin")
    adm_headers = auth_headers(admin)

    payload = {
        "completeness_weight": 0.40,
        "consistency_weight": 0.20,
        "rule_llm_agreement_weight": 0.20,
        "evidence_density_weight": 0.20,
    }

    # 1. Neither dual-control nor regression -> 403
    r1 = client.post(
        "/api/v1/admin/clinical/quality-parameters/unlock",
        json={"payload": payload, "dual_control_approved": False, "regression_passed": False, "reason": "Test 1"},
        headers=adm_headers,
    )
    assert r1.status_code == 403

    # 2. Dual control approved but regression failed -> 422
    r2 = client.post(
        "/api/v1/admin/clinical/quality-parameters/unlock",
        json={"payload": payload, "dual_control_approved": True, "regression_passed": False, "reason": "Test 2"},
        headers=adm_headers,
    )
    assert r2.status_code == 422

    # 3. Regression passed but dual control missing -> 403
    r3 = client.post(
        "/api/v1/admin/clinical/quality-parameters/unlock",
        json={"payload": payload, "dual_control_approved": False, "regression_passed": True, "reason": "Test 3"},
        headers=adm_headers,
    )
    assert r3.status_code == 403

    # 4. BOTH present -> 200 SUCCESS
    r4 = client.post(
        "/api/v1/admin/clinical/quality-parameters/unlock",
        json={"payload": payload, "dual_control_approved": True, "regression_passed": True, "reason": "Approved tuning"},
        headers=adm_headers,
    )
    assert r4.status_code == 200
    assert r4.json()["status"] == "success"


# ============================================================================
# GATE 9: PHI-Free Structured Log Viewer Canary Test
# ============================================================================

def test_gate9_phi_free_log_viewer_canary_test(db_session, client):
    """
    Gate 9: Canary test verifies zero PHI in any log line surfaced in the viewer.
    """
    admin = seed_test_user(db_session, "admin_logs@test.com", "admin")
    adm_headers = auth_headers(admin)

    res_logs = client.get("/api/v1/admin/operations/logs", headers=adm_headers)
    assert res_logs.status_code == 200
    logs = res_logs.json()["logs"]
    assert len(logs) >= 1

    phi_canaries = ["Suresh", "Ramesh", "Patil", "9876543210", "patient_name", "chest pain radiating to jaw"]
    for line in logs:
        msg = line.get("message", "")
        for canary in phi_canaries:
            assert canary.lower() not in msg.lower(), f"PHI LEAK DETECTED: Canary '{canary}' found in log: {msg}"
        assert line.get("phi_free") is True


# ============================================================================
# ADDITIONAL CYCLE 7 VERIFICATIONS: AI Control Center & Questionnaire i18n
# ============================================================================

def test_ai_control_center_endpoints_and_questionnaire_translations(db_session, client):
    """
    Verifies AI control center quotas, models allowlists, prompt sandboxing,
    and questionnaire translation checks (EN/HI/MR).
    """
    admin = seed_test_user(db_session, "admin_extra@test.com", "admin")
    adm_headers = auth_headers(admin)

    # AI Models allowlist
    res_models = client.get("/api/v1/admin/ai/models", headers=adm_headers)
    assert res_models.status_code == 200

    # AI Budgets & Quotas
    res_budgets = client.get("/api/v1/admin/ai/budgets", headers=adm_headers)
    assert res_budgets.status_code == 200
    assert "current_day_tokens_used" in res_budgets.json()

    # AI Prompt Sandbox run
    res_sandbox = client.post(
        "/api/v1/admin/ai/prompts/sandbox-run",
        json={
            "system_template": "System prompt test",
            "user_template": "User prompt test",
            "test_case_payload": {"chief_complaint": "General weakness", "age": 75},
            "is_live": False,
        },
        headers=adm_headers,
    )
    assert res_sandbox.status_code == 200
    assert res_sandbox.json()["status"] == "success"

    # Questionnaire translations check
    res_q = client.get("/api/v1/admin/clinical/questionnaires", headers=adm_headers)
    assert res_q.status_code == 200
    q_data = res_q.json()
    assert len(q_data["sections"]) >= 1
    # Check that questions have translation status
    first_q = q_data["sections"][0]["questions"][0]
    assert "has_missing_translations" in first_q
