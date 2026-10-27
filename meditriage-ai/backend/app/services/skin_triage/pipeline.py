"""Two-stage skin triage pipeline.

Agent 1 - DescriptorAgent : classify image -> retrieve knowledge -> patient-friendly description.
Agent 2 - SeverityAgent   : clinical-rule severity 1..5 with reasons, rules fired and confidence band.

Deliberate departures from the original Triage Flow prototype:
  * severity is NOT `int(classifier_confidence * 5)` (model confidence is not clinical severity);
  * an image alone can never produce Emergency (5) - only a context red flag can;
  * low-confidence / unavailable image analysis never lowers urgency and forces clinician review.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.skin_triage.classifier import Prediction, SkinClassifier
from app.services.skin_triage.knowledge import KnowledgeBase
from app.services.skin_triage.taxonomy import class_for_label

PIPELINE_VERSION = "skin-triage-v1"
LEVEL_BY_SEVERITY = {1: "Self-Care Info", 2: "Routine", 3: "Urgent", 4: "Urgent", 5: "Emergency"}
LEVEL_RANK = {"Self-Care Info": 0, "Self-Care": 0, "Routine": 1, "Urgent": 2, "Emergency": 3}

CONSIDERED_CONFIDENCE = 0.15   # a class counts toward the risk floor above this
LOW_CONFIDENCE = 0.35
HIGH_CONFIDENCE = 0.60


@dataclass
class SkinContext:
    age: Optional[int] = None
    symptom_text: str = ""
    max_symptom_severity: Optional[int] = None  # 0-10 pain/severity as entered
    temperature_c: Optional[float] = None
    history_text: str = ""
    body_part: Optional[str] = None

    @property
    def fever(self) -> bool:
        return self.temperature_c is not None and self.temperature_c >= 38.0 or bool(
            re.search(r"\bfever|feverish|chills\b", self.symptom_text.lower())
        )


def to_celsius(temp: Optional[float]) -> Optional[float]:
    if temp is None:
        return None
    return round((temp - 32) * 5 / 9, 1) if temp > 45 else float(temp)


# (rule_id, label, regex over lower-cased symptom text, requires_fever)
# SKIN-EM-01 additionally needs a skin sign (SKIN_SIGN) so a cardiac/respiratory
# complaint with breathlessness does not masquerade as a skin emergency.
SKIN_SIGN = re.compile(r"hives|rash|itch|welts?|urticaria|skin|swell|bite|sting")
EMERGENCY_PATTERNS = [
    ("SKIN-EM-01", "Possible severe allergic reaction (airway/face involvement with skin signs)",
     re.compile(r"(trouble|difficulty|hard to) breath|short(ness)? of breath|throat (is )?(tight|closing|swell)|"
                r"(tongue|lips?|face) (is |are )?swell|swelling of (the )?(tongue|lips?|face|throat)"), False),
    ("SKIN-EM-02", "Possible non-blanching (purpuric) rash with fever",
     re.compile(r"non[- ]?blanch|purpur|petechia|purple (spots|rash|marks)|rash (that )?(does ?n.t|doesn.t|won.t) fade"), True),
    ("SKIN-EM-03", "Possible severe blistering/peeling reaction with mucosal involvement",
     re.compile(r"(peeling|sloughing|skin (is )?coming off|blister\w*).{0,60}(mouth|eyes?|lips?|genital)|"
                r"(mouth|eyes?|lips?|genital).{0,60}(peeling|sloughing|blister\w*)"), True),
    ("SKIN-EM-04", "Possible rapidly progressive / necrotizing soft-tissue infection",
     re.compile(r"turn(ing|ed)? black|black(ened)? (skin|area)|necrot|crepitus|crackling|"
                r"pain (is )?(out of proportion|much worse than)|spreading (very )?(fast|rapidly)|rapidly spreading"), True),
    ("SKIN-EM-05", "Uncontrolled bleeding",
     re.compile(r"won.?t stop bleeding|bleeding (heavily|profusely|a lot)|spurting|soaking through"), False),
]

IMMUNOCOMPROMISE = re.compile(r"diabet|hiv|immuno|chemo|steroid|transplant|cancer|dialysis|cirrhosis|anticoag|warfarin")
SPREAD_SIGNS = re.compile(r"spread|redness (is )?(growing|expanding)|red streak|pus|warm|swollen|swelling|oozing|discharge")
ABCDE_SIGNS = re.compile(r"chang|grow|bigger|irregular|asymmetr|bleed|ulcer|itch|new mole|darker|multiple colou?rs")


# ---------------------------------------------------------------- Agent 1
@dataclass
class DescriptorOutput:
    classifier_name: str
    classifier_available: bool
    classifier_reason: Optional[str]
    predictions: List[Dict[str, Any]]
    relevant_conditions: List[Dict[str, Any]]
    summary: str
    latency_ms: int


def _first_sentences(text: str, n: int = 2, limit: int = 420) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out = " ".join(parts[:n])
    return out if len(out) <= limit else out[: limit - 1].rstrip() + "…"


def run_descriptor(jpeg: bytes, clf: SkinClassifier, kb: KnowledgeBase, ctx: SkinContext) -> DescriptorOutput:
    t0 = time.perf_counter()
    preds: List[Prediction] = []
    if clf.available:
        try:
            preds = clf.predict(jpeg, top_k=5)
        except Exception:  # model runtime failure must never break triage
            preds = []
    pred_dicts = [
        {"label": p.label, "confidence": round(p.confidence, 4), "class_index": p.class_index} for p in preds
    ]

    conditions: List[Dict[str, Any]] = []
    seen = set()
    for p in preds[:3]:
        entry = kb.get(p.label)
        if entry and p.label not in seen:
            seen.add(p.label)
            conditions.append({"id": p.label, "data": _first_sentences(entry["data"]), "score": round(p.confidence, 4),
                               "source": "image_match"})
    if ctx.symptom_text.strip():
        for hit in kb.search(ctx.symptom_text, top_k=2):
            if hit["id"] not in seen:
                seen.add(hit["id"])
                conditions.append({"id": hit["id"], "data": _first_sentences(str(hit["data"])),
                                   "score": hit["score"], "source": "symptom_text_match"})

    if preds:
        top = ", ".join(f"{p['label']} ({p['confidence']:.0%})" for p in pred_dicts[:3])
        summary = (f"The image model's closest matches are: {top}. These are screening suggestions to help a "
                   f"clinician, not a diagnosis.")
    elif not clf.available:
        summary = ("Automated image analysis is not available on this server, so the photo was stored for clinician "
                   "review only. Triage uses your described symptoms.")
    else:
        summary = "The image model could not produce a usable result for this photo."
    if conditions:
        summary += f" Background: {conditions[0]['data']}"
    return DescriptorOutput(clf.name, clf.available, clf.reason, pred_dicts, conditions, summary,
                            int((time.perf_counter() - t0) * 1000))


# ---------------------------------------------------------------- Agent 2
@dataclass
class SeverityOutput:
    severity_score: int
    triage_level: str
    reasons: List[str]
    rules_fired: List[str]
    confidence_band: str
    requires_clinician_review: bool
    emergency_rule: Optional[str]
    recommendation: str


RECOMMENDATIONS = {
    5: "Seek emergency care immediately (go to the nearest emergency department or call emergency services).",
    4: "Arrange an urgent clinician review within 24 hours.",
    3: "Arrange an urgent clinician review within 24 hours.",
    2: "Book a routine doctor appointment and monitor for changes.",
    1: "Self-care information is appropriate; see a doctor if it worsens or does not improve.",
}


def run_severity(desc: DescriptorOutput, ctx: SkinContext) -> SeverityOutput:
    text = ctx.symptom_text.lower()
    hist = ctx.history_text.lower()
    reasons: List[str] = []
    fired: List[str] = []

    # 1. Image-derived risk floor (conservative: max tier among plausible classes)
    floor = 1
    considered = [p for p in desc.predictions[:3] if p["confidence"] >= CONSIDERED_CONFIDENCE]
    classes = [class_for_label(p["label"]) for p in considered]
    classes = [c for c in classes if c]
    if classes:
        floor = max(c.tier for c in classes)
        worst = max(classes, key=lambda c: c.tier)
        reasons.append(f"Image suggests possible '{worst.name}' (risk tier {worst.tier}/4).")
    elif not desc.classifier_available:
        reasons.append("Image was not analysed automatically; severity is based on symptoms and history only.")

    score = floor

    # 2. Context emergency red flags (only route to 5)
    emergency_rule = None
    for rid, label, rx, needs_fever in EMERGENCY_PATTERNS:
        if rid == "SKIN-EM-01" and not SKIN_SIGN.search(text):
            continue
        if rx.search(text) and (not needs_fever or ctx.fever or (ctx.max_symptom_severity or 0) >= 8):
            emergency_rule = emergency_rule or rid
            fired.append(rid)
            reasons.append(label + ".")
    if emergency_rule:
        score = 5

    # 3. Escalators (never lower)
    infectious = any(c.infectious for c in classes)
    malignant = any(c.malignancy_concern for c in classes)

    if score < 5:
        if ctx.fever and (infectious or score >= 3):
            score += 1; fired.append("SKIN-ESC-FEVER"); reasons.append("Fever alongside a skin problem raises urgency.")
        if (ctx.max_symptom_severity or 0) >= 8:
            score += 1; fired.append("SKIN-ESC-PAIN"); reasons.append("Severe pain/severity reported.")
        if ctx.age is not None and ctx.age >= 65 and score >= 3:
            score += 1; fired.append("SKIN-ESC-GERIATRIC"); reasons.append("Age 65+ with a higher-risk skin finding.")
        if IMMUNOCOMPROMISE.search(hist) and (infectious or score >= 3):
            score += 1; fired.append("SKIN-ESC-COMORBID"); reasons.append("Diabetes/immune-compromising condition with infection risk.")
        if infectious and SPREAD_SIGNS.search(text):
            score += 1; fired.append("SKIN-ESC-SPREAD"); reasons.append("Spreading, swelling or discharge described.")
        if malignant and ABCDE_SIGNS.search(text):
            fired.append("SKIN-ESC-ABCDE"); reasons.append("Changing/bleeding lesion keeps this at urgent referral.")
        score = min(score, 4)  # image/context escalators cap at 4; only red flags reach 5

    # 4. Confidence band + review requirement
    top_conf = desc.predictions[0]["confidence"] if desc.predictions else 0.0
    gap = top_conf - (desc.predictions[1]["confidence"] if len(desc.predictions) > 1 else 0.0)
    if not desc.predictions:
        band, review = "Low", True
        score = max(score, 2)  # an unanalysed photo is never treated as self-care
    elif top_conf >= HIGH_CONFIDENCE and gap >= 0.20:
        band, review = "High", False
    elif top_conf >= LOW_CONFIDENCE:
        band, review = "Medium", False
    else:
        band, review = "Low", True
        reasons.append("Image model confidence is low; urgency is not reduced and clinician review is required.")
        score = max(score, 2)  # never self-care on an uncertain image
    if score >= 4 or emergency_rule:
        review = True

    score = max(1, min(5, int(score)))
    return SeverityOutput(score, LEVEL_BY_SEVERITY[score], reasons, fired, band, review, emergency_rule,
                          RECOMMENDATIONS[score])


# ---------------------------------------------------------------- orchestration
@dataclass
class PipelineResult:
    descriptor: DescriptorOutput
    severity: SeverityOutput
    trace: Dict[str, Any] = field(default_factory=dict)


def build_trace(desc: DescriptorOutput, sev: SeverityOutput, ctx: SkinContext, image_meta: Dict[str, Any]) -> Dict[str, Any]:
    nodes = [
        {"id": "input", "type": "input", "label": "Patient input", "status": "ok",
         "detail": f"Symptoms{' + context' if ctx.history_text else ''}, photo {image_meta.get('width')}x{image_meta.get('height')}px"},
        {"id": "sanitize", "type": "process", "label": "Image sanitization", "status": "ok",
         "detail": "Type verified, EXIF/GPS stripped, resized"},
        {"id": "classifier", "type": "ml", "label": "Image classifier (DermNet)",
         "status": "ok" if desc.classifier_available and desc.predictions else "skipped",
         "detail": (f"Top: {desc.predictions[0]['label']} ({desc.predictions[0]['confidence']:.0%})"
                    if desc.predictions else (desc.classifier_reason or "No prediction"))},
        {"id": "knowledge", "type": "knowledge", "label": "Knowledge retrieval (RAG)",
         "status": "ok" if desc.relevant_conditions else "warn",
         "detail": f"{len(desc.relevant_conditions)} condition passage(s) retrieved"},
        {"id": "agent1", "type": "agent", "label": "Agent 1 - Descriptor", "status": "ok",
         "detail": f"{desc.latency_ms} ms"},
        {"id": "agent2", "type": "agent", "label": "Agent 2 - Severity (rules)", "status": "ok",
         "detail": f"Severity {sev.severity_score}/5, {len(sev.rules_fired)} rule(s) fired"},
        {"id": "safety", "type": "process", "label": "Escalation-only safety gate", "status": "ok",
         "detail": "Image findings can raise, never lower, case urgency"},
        {"id": "output", "type": "output", "label": "Triage suggestion", "status": "warn" if sev.requires_clinician_review else "ok",
         "detail": f"{sev.triage_level} - confidence {sev.confidence_band}"},
    ]
    edges = [("input", "sanitize"), ("sanitize", "classifier"), ("classifier", "knowledge"), ("input", "knowledge"),
             ("knowledge", "agent1"), ("classifier", "agent1"), ("agent1", "agent2"), ("input", "agent2"),
             ("agent2", "safety"), ("safety", "output")]
    return {"pipeline_version": PIPELINE_VERSION, "nodes": nodes, "edges": [{"from": a, "to": b} for a, b in edges]}


def run_pipeline(jpeg: bytes, clf: SkinClassifier, kb: KnowledgeBase, ctx: SkinContext,
                 image_meta: Dict[str, Any]) -> PipelineResult:
    desc = run_descriptor(jpeg, clf, kb, ctx)
    sev = run_severity(desc, ctx)
    return PipelineResult(desc, sev, build_trace(desc, sev, ctx, image_meta))
