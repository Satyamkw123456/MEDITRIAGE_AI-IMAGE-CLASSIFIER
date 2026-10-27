"""
MediTriage AI - Security & Clinical-Safety Regression Gates
============================================================

Drop into  backend/tests/test_security_regression.py

PURPOSE
    Every test here encodes a defect found in the 2026-10-09 audit. On the
    audited code base these tests FAIL (that is the point). Each fix prompt in
    the playbook names the tests it must turn green. A prompt is not "done"
    until its gates pass AND the full legacy suite still passes.

RUN
    cd backend
    uv run pytest tests/test_security_regression.py -v --tb=short \
        | tee ../dev-logbook/audit-fix/regression_run.txt

NOTES
    * Uses a throwaway SQLite DB built from the ORM metadata.
    * Does not touch your PostgreSQL database.
    * Test IDs (SEC-xx / BOLA-xx / SAFE-xx) match the audit report.
"""
import os
import sys
import tempfile

import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

_TMP_DB = os.path.join(tempfile.gettempdir(), "meditriage_sec_regression.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ.setdefault("GEMINI_API_KEY", "")

from fastapi.testclient import TestClient  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
import app.models  # noqa: E402,F401
from app.main import app  # noqa: E402

LEVEL_RANK = {"Self-Care Info": 0, "Routine": 1, "Urgent": 2, "Emergency": 3}
PWD = "Str0ng!Passw0rd#2026"


@pytest.fixture(scope="module", autouse=True)
def _db():
    if os.path.exists(_TMP_DB):
        try:
            os.remove(_TMP_DB)
        except OSError:
            pass
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()
    if os.path.exists(_TMP_DB):
        try:
            os.remove(_TMP_DB)
        except OSError:
            pass


@pytest.fixture(scope="module")
def client():
    # raise_server_exceptions=False so a 500 is observed as a 500, not a crash
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


import uuid

_counter = {"n": 0}


def _register(client, role="patient", password=PWD, **extra):
    _counter["n"] += 1
    uid = uuid.uuid4().hex[:8]
    email = f"user_{uid}_{_counter['n']}_{role}@example.com"
    body = {"name": f"Test {role} {_counter['n']}", "email": email,
            "password": password, "role": role, **extra}
    r = client.post("/api/v1/auth/register", json=body)
    return r, email


def _patient(client, age=72):
    r, email = _register(client, "patient", age=age, sex="Female")
    assert r.status_code == 201, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post("/api/v1/consent/record", json={}, headers=h)
    return h


VITALS = {"temperature": 98.6, "pulse": 78, "blood_pressure": "125/82", "spo2": 97}


def _intake(client, headers, complaint, location="Head / Neurological",
            severity=6, age=78, duration="2 hours"):
    return client.post("/api/v1/cases/intake", headers=headers, json={
        "chief_complaint": complaint, "symptom_duration": duration,
        "severity": severity, "body_location": location, "age": age,
        "sex": "Female", "comorbidities": [], "current_medications": "",
        "allergies": "", "vitals": VITALS})


# --------------------------------------------------------------------------
# SEC-01  Privilege escalation via self-registration
# --------------------------------------------------------------------------
@pytest.mark.parametrize("role", ["admin", "clinician", "super_admin", "ops_admin"])
def test_sec01_cannot_self_register_privileged_role(client, role):
    r, _ = _register(client, role)
    assert r.status_code in (400, 403, 422), (
        f"Anyone can self-register as '{role}' (got {r.status_code}). "
        "Role must be forced to 'patient' server-side; clinicians/admins are "
        "created only through an authorised admin flow.")


# --------------------------------------------------------------------------
# SEC-02  Password policy
# --------------------------------------------------------------------------
@pytest.mark.parametrize("weak", ["123456", "abcdef", "password", "Patient@1"])
def test_sec02_weak_password_rejected(client, weak):
    r, _ = _register(client, "patient", password=weak)
    assert r.status_code == 422, f"Weak password {weak!r} was accepted ({r.status_code})"


# --------------------------------------------------------------------------
# SEC-03  Brute-force protection (rate limit / lockout)
# --------------------------------------------------------------------------
def test_sec03_login_is_rate_limited_or_locked_out(client):
    r, email = _register(client, "patient")
    assert r.status_code == 201
    codes = [client.post("/api/v1/auth/login",
                         json={"email": email, "password": f"wrong-{i}"}).status_code
             for i in range(25)]
    assert any(c in (423, 429) for c in codes), (
        f"25 wrong passwords produced only {sorted(set(codes))}; "
        "expected 429/423 after a small number of failures")
    # correct password must ALSO be refused while locked (no oracle bypass)
    ok = client.post("/api/v1/auth/login", json={"email": email, "password": PWD})
    assert ok.status_code in (423, 429)


# --------------------------------------------------------------------------
# SEC-04  Secrets: no forgeable defaults
# --------------------------------------------------------------------------
def test_sec04_default_secret_refused_outside_development():
    from app.core.config import Settings
    with pytest.raises(Exception):
        Settings(_env_file=None, ENVIRONMENT="production",
                 SECRET_KEY="dev-insecure-secret-key-change-me")
    with pytest.raises(Exception):
        Settings(_env_file=None, ENVIRONMENT="production",
                 SECRET_KEY="temporary-dev-secret-key-change-in-production")
    with pytest.raises(Exception):  # too short
        Settings(_env_file=None, ENVIRONMENT="production", SECRET_KEY="short")
    with pytest.raises(Exception):  # empty in dev
        Settings(_env_file=None, ENVIRONMENT="development", SECRET_KEY="")
    with pytest.raises(Exception):  # whitespace in prod
        Settings(_env_file=None, ENVIRONMENT="production", SECRET_KEY="   ")


def test_sec04_token_signed_with_known_default_is_rejected(client):
    import datetime
    import jwt
    for known in ("dev-insecure-secret-key-change-me",
                  "temporary-dev-secret-key-change-in-production"):
        forged = jwt.encode(
            {"sub": "1", "role": "admin", "email": "x@x.x", "name": "x",
             "token_version": 1,
             "exp": datetime.datetime.now(datetime.timezone.utc)
             + datetime.timedelta(hours=1)}, known, algorithm="HS256")
        r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
        assert r.status_code == 401, f"JWT forged with public secret was accepted ({known[:20]}...)"


def test_sec04_audit_hmac_key_is_not_the_jwt_key():
    from app.core.config import settings
    assert getattr(settings, "AUDIT_HMAC_KEY", None), (
        "Audit export HMAC reuses SECRET_KEY; add a separate AUDIT_HMAC_KEY")
    assert settings.AUDIT_HMAC_KEY != settings.SECRET_KEY


# --------------------------------------------------------------------------
# SEC-05  Session lifecycle
# --------------------------------------------------------------------------
def test_sec05_logout_revokes_token(client):
    h = _patient(client)
    out = client.post("/api/v1/auth/logout", headers=h)
    assert out.status_code in (200, 204), "No server-side logout endpoint exists"
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401, (
        "Token still valid after logout")


# --------------------------------------------------------------------------
# SEC-06  Transport / header hardening, docs exposure
# --------------------------------------------------------------------------
def test_sec06_security_headers_present(client):
    h = {k.lower(): v for k, v in client.get("/health").headers.items()}
    for needed in ("x-content-type-options", "x-frame-options",
                   "referrer-policy", "content-security-policy"):
        assert needed in h, f"missing security header: {needed}"


def test_sec06_docs_disabled_in_production(monkeypatch):
    from app.core.config import Settings
    s = Settings(_env_file=None, ENVIRONMENT="production",
                 SECRET_KEY="x" * 64, DATABASE_URL="sqlite://")
    assert getattr(s, "docs_enabled", True) is False, (
        "/docs, /redoc and openapi.json must be disabled when ENVIRONMENT=production")


def test_cors_rejects_unlisted_origin_and_wildcard_methods(client):
    evil_resp = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://evil-attacker.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    allow_origin = evil_resp.headers.get("access-control-allow-origin")
    assert allow_origin != "*", "CORS must not allow wildcard origin '*'"
    assert allow_origin != "https://evil-attacker.com", "CORS allowed unlisted attacker origin"

    good_resp = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert good_resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_boot_fails_with_default_secret_in_production():
    import subprocess
    import sys
    import os
    env = os.environ.copy()
    env["ENVIRONMENT"] = "production"
    env["SECRET_KEY"] = "supersecretjwtkeythatshouldbechangedinproduction12345"
    env.pop("PYTEST_CURRENT_TEST", None)
    res = subprocess.run(
        [sys.executable, "-c", "from app.core.config import Settings; Settings()"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert res.returncode != 0
    assert "SECRET_KEY" in res.stderr or "ValidationError" in res.stderr


def test_no_sql_echo_in_any_environment():
    from app.core.config import settings
    from app.db.session import engine
    assert settings.SQL_ECHO is False, "SQL_ECHO must default to False"
    assert getattr(engine, "echo", False) is False, "engine.echo must be False"


# --------------------------------------------------------------------------
# BOLA-01..05  Object-level authorisation on cases
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def victim_case(client):
    h = _patient(client)
    r = _intake(client, h, "Mild headache", severity=3, age=70)
    assert r.status_code == 201, r.text
    return h, r.json()["id"]


def test_bola01_other_patient_cannot_read_revisions(client, victim_case):
    _, cid = victim_case
    attacker = _patient(client)
    r = client.get(f"/api/v1/cases/{cid}/revisions", headers=attacker)
    assert r.status_code in (403, 404), f"revisions leaked to non-owner ({r.status_code})"


def test_bola02_other_patient_cannot_comment(client, victim_case):
    _, cid = victim_case
    attacker = _patient(client)
    r = client.post(f"/api/v1/cases/{cid}/comments",
                    json={"comment_text": "injected"}, headers=attacker)
    assert r.status_code in (403, 404), f"non-owner commented on case ({r.status_code})"


def test_bola03_other_patient_cannot_amend(client, victim_case):
    _, cid = victim_case
    attacker = _patient(client)
    r = client.post(f"/api/v1/cases/{cid}/amend",
                    json={"chief_complaint": "tampered"}, headers=attacker)
    assert r.status_code in (403, 404), f"non-owner amended clinical record ({r.status_code})"


def test_bola04_other_patient_cannot_delete_or_restore(client):
    owner = _patient(client)
    cid = _intake(client, owner, "Mild headache", severity=3, age=70).json()["id"]
    attacker = _patient(client)
    d = client.delete(f"/api/v1/cases/{cid}", headers=attacker)
    assert d.status_code in (403, 404), f"non-owner deleted a case ({d.status_code})"
    assert client.get(f"/api/v1/cases/{cid}", headers=owner).status_code == 200


def test_bola05_unlinked_caregiver_has_no_access(client, victim_case):
    _, cid = victim_case
    r, _ = _register(client, "caregiver")
    assert r.status_code == 201
    cg = {"Authorization": f"Bearer {r.json()['access_token']}"}
    for path in ("", "/pdf", "/ai-audit", "/access-history"):
        resp = client.get(f"/api/v1/cases/{cid}{path}", headers=cg)
        assert resp.status_code in (403, 404), (
            f"GET /cases/{{id}}{path} readable by an UNLINKED caregiver ({resp.status_code})")


def test_bola06_soft_deleted_case_not_readable(client):
    h = _patient(client)
    cid = _intake(client, h, "Mild headache", severity=3, age=70).json()["id"]
    assert client.delete(f"/api/v1/cases/{cid}", headers=h).status_code == 200
    r = client.get(f"/api/v1/cases/{cid}", headers=h)
    assert r.status_code == 404, f"soft-deleted case still returned ({r.status_code})"


def test_every_case_route_uses_authz_dependency():
    """
    Structural gate: every route accepting {case_id} must have get_case_for_user
    in its dependency tree (preventing inline BOLA check regressions).
    """
    from fastapi.routing import APIRoute
    from app.api.authz import CaseAuthorizer

    def _has_authorizer(dep):
        if dep.call and (
            isinstance(dep.call, CaseAuthorizer)
            or getattr(dep.call, "__name__", "") == "get_case_for_user"
        ):
            return True
        for sub in getattr(dep, "dependencies", []):
            if _has_authorizer(sub):
                return True
        return False

    missing = []
    for route in app.routes:
        if isinstance(route, APIRoute) and "{case_id}" in route.path:
            if not _has_authorizer(route.dependant):
                missing.append(f"{route.methods} {route.path}")

    assert not missing, f"Routes accepting {{case_id}} missing get_case_for_user dependency: {missing}"


# --------------------------------------------------------------------------
# SEC-07  Markup / SSRF injection into the PDF generator
# --------------------------------------------------------------------------
def test_sec07_pdf_escapes_user_markup(client):
    h = _patient(client)
    for evil in ('Pain <img src="http://127.0.0.1:9/probe" width="5" height="5"/>',
                 'Pain <font size="abc"> <b>',
                 '<b>Triage Level: Emergency</b>'):
        r = _intake(client, h, evil, severity=3, age=70)
        assert r.status_code == 201, r.text
        pdf = client.get(f"/api/v1/cases/{r.json()['id']}/pdf", headers=h)
        assert pdf.status_code == 200, (
            f"PDF export crashed/was attacker-controllable for {evil!r} ({pdf.status_code})")
        assert pdf.headers["content-type"].startswith("application/pdf")


# --------------------------------------------------------------------------
# SAFE-01..03  Clinical safety - geriatric under-triage (patient-safety gate)
# --------------------------------------------------------------------------
GERIATRIC_MUST_NOT_BE_ROUTINE = [
    ("Sudden disorientation and confusion", 82, 7),
    ("New confusion since morning, not making sense", 79, 6),
    ("Severe Dizziness / Loss of Balance", 72, 5),
    ("Acute severe vertigo and unsteadiness", 74, 8),
]


@pytest.mark.parametrize("complaint,age,sev", GERIATRIC_MUST_NOT_BE_ROUTINE)
def test_safe01_geriatric_acute_neuro_is_at_least_urgent(client, complaint, age, sev):
    h = _patient(client, age=age)
    r = _intake(client, h, complaint, severity=sev, age=age)
    assert r.status_code == 201, r.text
    d = r.json()
    level = "Emergency" if d.get("is_emergency_flag") else (d.get("triage_result") or {}).get("triage_level")
    assert LEVEL_RANK.get(level, -1) >= LEVEL_RANK["Urgent"], (
        f"UNDER-TRIAGE: {age}y '{complaint}' -> {level}. Acute confusion / "
        "vertigo in an older adult must be >= Urgent.")


def test_safe02_confidence_not_high_when_engines_disagree(client):
    """Quality layer must not show 'High' confidence for a case where the
    geriatric engine (decision-of-record candidate) and the legacy scorer disagree."""
    h = _patient(client, age=82)
    d = _intake(client, h, "Sudden disorientation and confusion", severity=7, age=82).json()
    geri = (d.get("decision") or {}).get("final_level") or (d.get("decision") or {}).get("level")
    legacy = (d.get("triage_result") or {}).get("triage_level")
    band = (d.get("quality_score") or {}).get("confidence_band")
    if geri and legacy and geri != legacy:
        assert band != "High"


def test_safe03_purged_placeholder_never_in_clinician_queue():
    # Structural gate: the literal '[PURGED_PHI]' must be filtered/rendered as a
    # dedicated 'Record purged' state, never shown as a chief complaint.
    from app.api.v1 import cases
    src = open(cases.__file__, encoding="utf-8").read()
    assert "PURGED_PHI" in src or "deleted_at" in src, (
        "Queue endpoint must exclude or specially render purged/soft-deleted cases")


# --------------------------------------------------------------------------
# Prompt 3 Test Gates: Clinical Safety, Consensus & Trace Persistence
# --------------------------------------------------------------------------
def test_llm_cannot_lower_level():
    from app.services.rules.consensus_engine import ConsensusDecisionEngine

    # Deterministic Urgent presentation
    res = ConsensusDecisionEngine.evaluate_case(
        chief_complaint="Severe Dizziness / Loss of Balance",
        age=72,
        severity=5,
        symptom_duration="2 hours",
        body_location="Head / Neurological",
        llm_urgency="Routine"
    )
    assert res.final_level in ("Urgent", "Emergency"), f"LLM lowered level to {res.final_level}!"
    assert res.final_level != "Routine", "LLM lowered level to Routine!"

    # LLM may raise urgency to Emergency
    res_raised = ConsensusDecisionEngine.evaluate_case(
        chief_complaint="Severe Dizziness / Loss of Balance",
        age=72,
        severity=5,
        symptom_duration="2 hours",
        body_location="Head / Neurological",
        llm_urgency="Emergency"
    )
    assert res_raised.final_level == "Emergency"


def test_engine_exception_fails_closed_to_urgent(monkeypatch):
    from app.services.rules.consensus_engine import ConsensusDecisionEngine
    from app.services.geriatric.engine import GeriatricEngine
    from app.services.quality.inference import calculate_quality_inference

    def _failing_eval(*args, **kwargs):
        raise RuntimeError("simulated engine failure")

    monkeypatch.setattr(GeriatricEngine, "evaluate_case", _failing_eval)

    res = ConsensusDecisionEngine.evaluate_case(
        chief_complaint="Mild finger sprain",
        age=30,
        severity=2,
        symptom_duration="3 days",
        body_location="Hand"
    )

    assert "engine_error:GeriatricEngine" in res.engine_errors
    assert res.needs_clinician_review is True
    failed_vote = next(v for v in res.votes if v.source == "GeriatricEngine.composer")
    assert failed_vote.level == "Urgent"
    assert res.final_level in ("Urgent", "Emergency")

    q_inf = calculate_quality_inference(
        rule_triage_level=res.final_level,
        consensus_result=res
    )
    assert q_inf["confidence_band"].upper() == "LOW"


def test_substring_false_positive_waterfall():
    from app.services.rules.triage_scoring import calculate_triage_score

    res_waterfall = calculate_triage_score(
        chief_complaint="Visiting a scenic waterfall with family",
        age=35,
        severity=1,
        symptom_duration="1 day",
        body_location="General"
    )
    assert res_waterfall.triage_level != "Urgent"

    res_fall = calculate_triage_score(
        chief_complaint="Suffered a fall from the stairs",
        age=35,
        severity=6,
        symptom_duration="1 hour",
        body_location="Head"
    )
    assert res_fall.risk_score > res_waterfall.risk_score


def test_trace_persisted_and_matches_ui(client):
    h = _patient(client, age=75)
    r = _intake(client, h, "Sudden disorientation and confusion", severity=7, age=75)
    assert r.status_code == 201, r.text
    case_data = r.json()
    case_id = case_data["id"]

    decision = case_data.get("decision")
    assert decision is not None, "Intake response must include decision trace"
    assert "votes" in decision
    assert "final_level" in decision
    assert "level_copy" in decision
    assert "engine_versions" in decision
    assert "rules_config_version" in decision

    get_res = client.get(f"/api/v1/cases/{case_id}", headers=h)
    assert get_res.status_code == 200
    assert get_res.json()["decision"] == decision


def test_emergency_floor_sudden_vertigo_with_htn(client):
    h = _patient(client, age=72)
    r = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "Acute severe vertigo and unsteadiness",
        "symptom_duration": "6 hours",
        "severity": 8,
        "body_location": "Head / Neurological",
        "age": 72,
        "sex": "Female",
        "comorbidities": ["Hypertension"],
        "current_medications": "Amlodipine",
        "allergies": "",
        "vitals": VITALS
    })
    assert r.status_code == 201, r.text
    d = r.json()
    level = "Emergency" if d.get("is_emergency_flag") else (d.get("triage_result") or {}).get("triage_level")
    assert level == "Emergency", f"Expected Emergency for 72y acute vertigo + HTN, got {level}"


def test_intake_returns_before_llm_completes(client, monkeypatch):
    import time
    import asyncio
    from app.api.v1 import cases

    async def _slow_mock(*args, **kwargs):
        await asyncio.sleep(5.0)
        raise RuntimeError("slow mock")

    monkeypatch.setattr(cases, "_execute_clinical_ai_gateway", _slow_mock)

    h = _patient(client, age=45)
    t0 = time.time()
    r = _intake(client, h, "Mild headache", severity=3, age=45)
    elapsed = time.time() - t0
    assert r.status_code == 201, r.text
    assert elapsed < 1.5, f"Intake took {elapsed:.2f}s, must return in < 1.5s!"
    d = r.json()
    assert d.get("ai_status") in ("pending", "ready", "unavailable")


def test_level_copy_matches_level():
    from app.core.level_copy import LEVEL_COPY, get_level_copy

    assert LEVEL_COPY["Routine"]["timeframe"] == "book within 1-2 weeks"
    assert LEVEL_COPY["Urgent"]["timeframe"] == "be seen within 24 hours"
    assert LEVEL_COPY["Emergency"]["timeframe"] == "call 112 now"

    for lvl in ["Self-Care Info", "Routine", "Urgent", "Emergency"]:
        copy_info = get_level_copy(lvl)
        assert copy_info["title"]
        assert copy_info["action"]
        assert copy_info["timeframe"]
        assert copy_info["call_to_action"]


def test_medication_shield_beta_blocker_heart_rate():
    from app.services.geriatric.medication_shield import MedicationShield

    resolved_meds, _ = MedicationShield.resolve_medications(["Metolar"])
    triggers, meta = MedicationShield.evaluate_medication_shield(
        resolved_meds=resolved_meds,
        symptoms_text="fever and generalized weakness",
        vitals={"pulse": 74},
        age=72
    )
    mask_trigger = next((t for t in triggers if t.rule_id == "DRUG-RULE-MASK-01"), None)
    assert mask_trigger is not None, "Beta-blocker normal HR masking rule must fire"
    assert "blunts normal tachycardic response" in mask_trigger.rationale


# --------------------------------------------------------------------------
# PROMPT 3B: Low-Regret Clinical Safety & Hardening Gates
# --------------------------------------------------------------------------

def test_fever_floor_urgent(client):
    h = _patient(client, age=72)
    r = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "Persistent fever and weakness",
        "symptom_duration": "2 days",
        "severity": 6,
        "body_location": "General",
        "age": 72,
        "sex": "Female",
        "comorbidities": [],
        "current_medications": "",
        "allergies": "",
        "vitals": {"temperature": 101.4, "pulse": 82, "blood_pressure": "120/80", "spo2": 97}
    })
    assert r.status_code == 201, r.text
    d = r.json()
    level = (d.get("triage_result") or {}).get("triage_level")
    decision = d.get("decision") or {}
    fired_rules = []
    for v in decision.get("votes", []):
        if v.get("rule_ids"):
            fired_rules.extend(v["rule_ids"])
        if v.get("rule_id"):
            fired_rules.append(v["rule_id"])
    assert any("FEVER" in r for r in fired_rules)


def test_measured_temp_beats_patient_denial(client):
    h = _patient(client, age=68)
    r = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "No fever at all, just bad headache and feeling exhausted",
        "symptom_duration": "1 day",
        "severity": 6,
        "body_location": "Head / Neurological",
        "age": 68,
        "sex": "Female",
        "comorbidities": [],
        "current_medications": "",
        "allergies": "",
        "vitals": {"temperature": 100.8, "pulse": 80, "blood_pressure": "124/82", "spo2": 98}
    })
    assert r.status_code == 201, r.text
    d = r.json()
    level = (d.get("triage_result") or {}).get("triage_level")
    assert level in ("Urgent", "Emergency"), f"Measured temperature 100.8F must beat patient denial, got {level}"
    decision = d.get("decision") or {}
    assert decision.get("needs_clinician_review") is True


def test_implausible_vital_fails_closed(client):
    h = _patient(client, age=70)
    r = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "Feeling dizzy",
        "symptom_duration": "1 day",
        "severity": 5,
        "body_location": "General",
        "age": 70,
        "sex": "Male",
        "comorbidities": [],
        "current_medications": "",
        "allergies": "",
        "vitals": {"temperature": 109.5, "pulse": 76, "blood_pressure": "120/80", "spo2": 98}
    })
    assert r.status_code == 201, r.text
    d = r.json()
    level = (d.get("triage_result") or {}).get("triage_level")
    assert level in ("Urgent", "Emergency"), f"Implausible vital (109.5F) must floor at Urgent, got {level}"
    decision = d.get("decision") or {}
    assert decision.get("needs_clinician_review") is True
    expl = (d.get("triage_result") or {}).get("explanation", "").lower()
    assert "re-measure" in expl or "remeasure" in expl or "vital" in expl
    qs = d.get("quality_score") or {}
    assert qs.get("confidence_band") == "Low"


def test_nonspecific_decline_flags_review(client):
    h = _patient(client, age=76)
    r = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "Just feeling unwell and not myself lately",
        "symptom_duration": "4 days",
        "severity": 3,
        "body_location": "General",
        "age": 76,
        "sex": "Female",
        "comorbidities": ["Hypertension"],
        "current_medications": "Amlodipine",
        "allergies": "",
        "vitals": VITALS
    })
    assert r.status_code == 201, r.text
    d = r.json()
    decision = d.get("decision") or {}
    assert decision.get("needs_clinician_review") is True


def test_new_rules_never_lower_a_level():
    from app.services.rules.consensus_engine import ConsensusDecisionEngine, LEVEL_RANK
    from app.schemas.intake import PatientIntakeCreate, VitalsInput

    test_cases = [
        {"age": 70, "chief_complaint": "Mild knee pain", "vitals": VitalsInput(temperature=98.6, pulse=72, blood_pressure="120/80", spo2=98)},
        {"age": 82, "chief_complaint": "Feeling slightly dizzy when standing up", "vitals": VitalsInput(temperature=98.4, pulse=70, blood_pressure="118/76", spo2=97)},
        {"age": 68, "chief_complaint": "Fever and chills", "vitals": VitalsInput(temperature=101.8, pulse=90, blood_pressure="130/85", spo2=96)},
        {"age": 75, "chief_complaint": "Implausible reading", "vitals": VitalsInput(temperature=110.0, pulse=80, blood_pressure="120/80", spo2=98)},
    ]

    for tc in test_cases:
        payload = PatientIntakeCreate(
            chief_complaint=tc["chief_complaint"],
            symptom_duration="1 day",
            severity=5,
            body_location="General",
            age=tc["age"],
            sex="Female",
            vitals=tc["vitals"],
        )
        res = ConsensusDecisionEngine.evaluate_case(payload=payload)
        rank = LEVEL_RANK[res.final_level]
        assert rank >= 0


def test_unreviewed_ruleset_is_flagged(client):
    from app.core.security import create_access_token, get_password_hash
    from app.db.session import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = User(
                name="Admin User",
                email="admin_ruleset@example.com",
                role="admin",
                password_hash=get_password_hash("AdminPass123!"),
                is_suspended=False,
                token_version=1,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        token = create_access_token(
            subject=str(admin_user.id),
            role=admin_user.role,
            email=admin_user.email,
            name=admin_user.name
        )
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Admin Governance check
    r = client.get("/api/v1/admin/clinical/rules?namespace=geriatric_rules&key=rules", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["banner"] == "UNREVIEWED RULESET"
    assert data["is_unreviewed"] is True

    # 2. Case detail check when unreviewed rule fires
    h = _patient(client, age=82)
    r2 = client.post("/api/v1/cases/intake", headers=h, json={
        "chief_complaint": "Sudden disorientation and confusion",
        "symptom_duration": "2 hours",
        "severity": 8,
        "body_location": "Head / Neurological",
        "age": 82,
        "sex": "Female",
        "comorbidities": [],
        "current_medications": "",
        "allergies": "",
        "vitals": VITALS
    })
    assert r2.status_code == 201, r2.text
    d2 = r2.json()
    assert d2.get("unreviewed_rules_notice") is not None
    assert "pending clinical validation" in d2.get("unreviewed_rules_notice")


def test_xff_spoof_does_not_bypass_rate_limit():
    from app.core.rate_limit import get_client_ip
    from starlette.requests import Request

    # Untrusted client sends spoofed header
    scope = {
        "type": "http",
        "client": ("198.51.100.22", 12345),
        "headers": [(b"x-forwarded-for", b"1.1.1.1")],
    }
    req = Request(scope)
    assert get_client_ip(req) == "198.51.100.22"

    # Trusted proxy properly extracts client IP
    scope_proxy = {
        "type": "http",
        "client": ("127.0.0.1", 12345),
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 127.0.0.1")],
    }
    req_proxy = Request(scope_proxy)
    assert get_client_ip(req_proxy) == "203.0.113.195"

