"""Skin & wound image triage (Triage Flow module): unit + API tests."""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.skin_analysis import SkinImageAnalysis
from app.models.triage import TriageResult
from app.services.skin_triage import classifier as clf_mod
from app.services.skin_triage.classifier import Prediction, UnavailableClassifier
from app.services.skin_triage.image_utils import ImageRejected, sanitize_image
from app.services.skin_triage.knowledge import get_knowledge_base
from app.services.skin_triage.pipeline import (DescriptorOutput, SkinContext, run_pipeline,
                                               run_severity)
from app.services.skin_triage.taxonomy import CLASS_BY_INDEX, NUM_CLASSES, class_for_label


# ------------------------------------------------------------------ helpers
def make_image(fmt="JPEG", size=(64, 48), color=(200, 120, 110), exif=False) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    kwargs = {}
    if exif and fmt == "JPEG":
        ex = Image.Exif()
        ex[0x010F] = "TestCam"
        ex[0x8825] = {1: "N", 2: (18.0, 31.0, 0.0)}  # GPS IFD
        kwargs["exif"] = ex
    img.save(buf, format=fmt, **kwargs)
    return buf.getvalue()


class FakeClassifier:
    name = "fake-derm"
    available = True
    reason = None

    def __init__(self, *pairs):
        self.pairs = pairs

    def predict(self, jpeg_bytes, top_k=5):
        out = []
        for idx, conf in self.pairs[:top_k]:
            out.append(Prediction(CLASS_BY_INDEX[idx].name, conf, idx))
        return out


def desc_from(*pairs, available=True) -> DescriptorOutput:
    preds = [{"label": CLASS_BY_INDEX[i].name, "confidence": c, "class_index": i} for i, c in pairs]
    return DescriptorOutput("fake", available, None, preds, [], "", 1)


@pytest.fixture(autouse=True)
def reset_override():
    yield
    clf_mod.set_classifier_override(None)


# ------------------------------------------------------------------ taxonomy / knowledge
def test_taxonomy_complete_and_kb_maps_every_class():
    assert NUM_CLASSES == 23 and sorted(CLASS_BY_INDEX) == list(range(23))
    kb = get_knowledge_base()
    assert len(kb.entries) == 23
    for e in kb.entries:
        assert class_for_label(e["id"]) is not None, e["id"]
    assert kb.get("Acne and Rosacea Photos") is not None
    assert kb.get("Acne and Rosacea") is not None


def test_knowledge_search_finds_relevant_condition():
    hits = get_knowledge_base().search("itchy red scaly plaques silvery scale on elbows and knees", top_k=3)
    assert hits and any("Psoriasis" in h["id"] for h in hits)


# ------------------------------------------------------------------ image sanitization
def test_sanitize_strips_exif_and_gps():
    raw = make_image(exif=True)
    assert Image.open(io.BytesIO(raw)).getexif()  # sanity: source has EXIF
    clean = sanitize_image(raw)
    assert clean.mime == "image/jpeg"
    assert len(Image.open(io.BytesIO(clean.data)).getexif()) == 0
    assert b"TestCam" not in clean.data


def test_sanitize_converts_png_and_downsizes():
    clean = sanitize_image(make_image("PNG", size=(3000, 2000)))
    assert max(clean.width, clean.height) <= 1024
    assert Image.open(io.BytesIO(clean.data)).format == "JPEG"


@pytest.mark.parametrize("raw", [b"", b"not an image at all", b"GIF89a" + b"\x00" * 40,
                                 b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"])
def test_sanitize_rejects_non_images(raw):
    with pytest.raises(ImageRejected):
        sanitize_image(raw)


def test_sanitize_rejects_gif_even_if_valid():
    with pytest.raises(ImageRejected):
        sanitize_image(make_image("GIF"))


def test_sanitize_rejects_pixel_bomb():
    with pytest.raises(ImageRejected):
        sanitize_image(make_image("PNG", size=(6000, 6000)))


# ------------------------------------------------------------------ severity agent
def test_image_alone_never_reaches_emergency():
    for tier4 in (1, 3, 11, 21):  # malignant, bullous, melanoma, vasculitis
        sev = run_severity(desc_from((tier4, 0.99)), SkinContext())
        assert sev.severity_score <= 4 and sev.emergency_rule is None


def test_high_confidence_benign_is_not_inflated_by_confidence():
    """Original prototype used int(conf*5); a 98%-confident acne must stay self-care."""
    sev = run_severity(desc_from((0, 0.98), (5, 0.01)), SkinContext())
    assert sev.severity_score == 1 and sev.triage_level == "Self-Care Info"
    assert sev.confidence_band == "High" and not sev.requires_clinician_review


def test_low_confidence_never_self_care_and_requires_review():
    sev = run_severity(desc_from((0, 0.22), (5, 0.20), (9, 0.10)), SkinContext())
    assert sev.severity_score >= 2 and sev.requires_clinician_review and sev.confidence_band == "Low"


def test_unavailable_classifier_degrades_to_context_only():
    sev = run_severity(desc_from(available=False), SkinContext(symptom_text="mild rash"))
    assert sev.confidence_band == "Low" and sev.requires_clinician_review
    assert any("not analysed" in r for r in sev.reasons)
    assert sev.severity_score >= 2


def test_anaphylaxis_text_is_emergency():
    ctx = SkinContext(symptom_text="hives all over and my tongue is swelling, hard to breathe")
    sev = run_severity(desc_from((19, 0.9)), ctx)
    assert sev.severity_score == 5 and sev.triage_level == "Emergency" and sev.emergency_rule == "SKIN-EM-01"


def test_breathlessness_without_skin_signs_is_not_a_skin_emergency():
    ctx = SkinContext(symptom_text="chest pain with shortness of breath and sweating")
    assert run_severity(desc_from((0, 0.9)), ctx).emergency_rule is None


def test_nonblanching_rash_with_fever_is_emergency_without_fever_is_not():
    txt = "purple spots that do not fade, non-blanching rash"
    assert run_severity(desc_from((6, 0.5)), SkinContext(symptom_text=txt, temperature_c=39.2)).severity_score == 5
    assert run_severity(desc_from((6, 0.5)), SkinContext(symptom_text=txt)).severity_score < 5


def test_cellulitis_with_fever_diabetes_age_escalates_but_caps_at_4():
    ctx = SkinContext(age=72, symptom_text="red warm swollen leg, spreading, pus", temperature_c=38.9,
                      history_text="Type 2 diabetes", max_symptom_severity=8)
    sev = run_severity(desc_from((4, 0.8)), ctx)
    assert sev.severity_score == 4 and sev.triage_level == "Urgent"
    assert {"SKIN-ESC-FEVER", "SKIN-ESC-PAIN", "SKIN-ESC-COMORBID"} <= set(sev.rules_fired)


def test_pipeline_trace_shape():
    res = run_pipeline(b"x", FakeClassifier((11, 0.7)), get_knowledge_base(), SkinContext(symptom_text="mole changing"),
                       {"width": 10, "height": 10})
    ids = [n["id"] for n in res.trace["nodes"]]
    assert ids[0] == "input" and ids[-1] == "output" and "agent1" in ids and "agent2" in ids
    assert all(e["from"] in ids and e["to"] in ids for e in res.trace["edges"])


# ------------------------------------------------------------------ API
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override():
        yield db_session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client, email, age=40):
    r = client.post("/api/v1/auth/register", json={
        "name": "Test Patient", "email": email, "password": "SecurePassword123!", "role": "patient",
        "age": age, "sex": "Female", "medical_history": "", "allergies": ""})
    assert r.status_code == 201, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    c = client.post("/api/v1/consent/record", headers=h, json={
        "consent_type": "triage_evaluation", "version": "v1.0-dpdp2023", "granted": True, "granted_by": "patient"})
    assert c.status_code == 201, c.text
    return h


MILD = {"chief_complaint": "small itchy patch on forearm", "symptom_duration": "3 days", "severity": 2,
        "body_location": "Arm", "age": 40, "sex": "Female", "comorbidities": [], "current_medications": "None",
        "allergies": "None", "vitals": {"temperature": 98.4, "pulse": 74, "blood_pressure": "118/76", "spo2": 98}}
EMERGENCY = {"chief_complaint": "Acute chest pain radiating to left arm with sweating and shortness of breath",
             "symptom_duration": "1 hour", "severity": 9, "body_location": "Chest / Thorax", "age": 70,
             "sex": "Male", "comorbidities": ["Hypertension (High BP)"], "current_medications": "None",
             "allergies": "None", "vitals": {"temperature": 98.2, "pulse": 110, "blood_pressure": "160/100", "spo2": 92}}


def make_case(client, h, payload):
    r = client.post("/api/v1/cases/intake", json=payload, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def upload(client, h, case_id, raw=None, **extra):
    return client.post(f"/api/v1/cases/{case_id}/skin-analysis", headers=h,
                       files={"image": ("photo.jpg", raw or make_image(), "image/jpeg")}, data=extra)


def current_level(db, case_id):
    db.expire_all()
    t = db.query(TriageResult).filter(TriageResult.case_id == case_id, TriageResult.is_current == "true").first()
    return t.triage_level, t.version, t.source


def test_requires_authentication(client):
    assert client.get("/api/v1/skin-triage/status").status_code == 401
    assert client.post("/api/v1/cases/1/skin-analysis",
                       files={"image": ("a.jpg", make_image(), "image/jpeg")}).status_code == 401
    assert client.get("/api/v1/cases/1/skin-analysis").status_code == 401


def test_status_reports_graceful_degradation(client):
    h = register(client, "status@example.com")
    clf_mod.set_classifier_override(UnavailableClassifier("SKIN_MODEL_PATH is not configured"))
    s = client.get("/api/v1/skin-triage/status", headers=h).json()
    assert s["classifier_available"] is False and s["knowledge_entries"] == 23
    assert "jpeg" in s["allowed_types"]


def test_upload_without_model_still_stores_and_flags_review(client, db_session):
    h = register(client, "nomodel@example.com")
    clf_mod.set_classifier_override(UnavailableClassifier("not configured"))
    cid = make_case(client, h, MILD)
    r = upload(client, h, cid, body_part="Forearm")
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["classifier_available"] is False and d["predictions"] == []
    assert d["requires_clinician_review"] is True and d["confidence_band"] == "Low"
    assert d["trace"]["nodes"][-1]["id"] == "output"
    assert db_session.query(SkinImageAnalysis).count() == 1


def test_image_served_only_to_authorized_users_no_store(client):
    h1, h2 = register(client, "p1@example.com"), register(client, "p2@example.com")
    clf_mod.set_classifier_override(FakeClassifier((0, 0.9)))
    cid = make_case(client, h1, MILD)
    aid = upload(client, h1, cid).json()["id"]
    ok = client.get(f"/api/v1/cases/{cid}/skin-analysis/{aid}/image", headers=h1)
    assert ok.status_code == 200 and ok.headers["content-type"] == "image/jpeg"
    assert "no-store" in ok.headers["cache-control"]
    assert Image.open(io.BytesIO(ok.content)).format == "JPEG"
    # IDOR: another patient gets 404 on read, list and write
    assert client.get(f"/api/v1/cases/{cid}/skin-analysis/{aid}/image", headers=h2).status_code == 404
    assert client.get(f"/api/v1/cases/{cid}/skin-analysis", headers=h2).status_code == 404
    assert upload(client, h2, cid).status_code == 404


def test_invalid_oversize_and_cap_rejected(client, monkeypatch):
    h = register(client, "limits@example.com")
    clf_mod.set_classifier_override(FakeClassifier((0, 0.9)))
    cid = make_case(client, h, MILD)
    assert upload(client, h, cid, raw=b"definitely not an image").status_code == 422
    monkeypatch.setattr(settings, "SKIN_MAX_UPLOAD_BYTES", 500)
    assert upload(client, h, cid, raw=make_image(size=(600, 600), color=(1, 2, 3)) + b"\x00" * 5000).status_code == 413
    monkeypatch.setattr(settings, "SKIN_MAX_UPLOAD_BYTES", 5_000_000)
    monkeypatch.setattr(settings, "SKIN_MAX_ANALYSES_PER_CASE", 2)
    assert upload(client, h, cid).status_code == 201
    assert upload(client, h, cid).status_code == 201
    assert upload(client, h, cid).status_code == 409
    assert len(client.get(f"/api/v1/cases/{cid}/skin-analysis", headers=h).json()) == 2


def test_high_risk_image_escalates_triage_and_is_versioned(client, db_session):
    h = register(client, "escalate@example.com")
    cid = make_case(client, h, MILD)
    before = current_level(db_session, cid)
    assert before[0] in ("Self-Care Info", "Routine"), before
    clf_mod.set_classifier_override(FakeClassifier((11, 0.82), (16, 0.10)))  # melanoma-like
    r = upload(client, h, cid)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["severity_score"] == 4 and d["suggested_triage_level"] == "Urgent" and d["escalation_applied"] is True
    after = current_level(db_session, cid)
    assert after[0] == "Urgent" and after[1] == before[1] + 1 and after[2] == "IMAGE_ESCALATION"
    assert db_session.query(TriageResult).filter(TriageResult.case_id == cid,
                                                 TriageResult.is_current == "true").count() == 1


def test_image_never_lowers_an_emergency(client, db_session):
    h = register(client, "never-lower@example.com", age=70)
    cid = make_case(client, h, EMERGENCY)
    before = current_level(db_session, cid)
    assert before[0] == "Emergency", before
    clf_mod.set_classifier_override(FakeClassifier((0, 0.97)))  # benign acne
    d = upload(client, h, cid).json()
    assert d["suggested_triage_level"] != "Emergency" and d["escalation_applied"] is False
    assert current_level(db_session, cid) == before  # level, version and source all unchanged
