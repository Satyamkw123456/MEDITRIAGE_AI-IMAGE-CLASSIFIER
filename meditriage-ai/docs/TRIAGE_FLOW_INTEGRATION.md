# Triage Flow → MediTriage AI: Integration Report

MediTriage AI now includes the **Triage Flow** capability: *photo + symptoms → AI screening pipeline → severity 1–5 with an explainable agent flow*. It is built into MediTriage's existing safety architecture instead of being bolted on beside it.

## 1. Feature matrix

| Triage Flow feature | Status in MediTriage | Notes |
|---|---|---|
| Multimodal input (photo + symptom text) | **Ported** | `POST /api/v1/cases/{id}/skin-analysis`; UI panel on patient and clinician case pages |
| DermNet ResNet image classifier (23 classes) | **Ported (adapter), weights not bundled** | Set `SKIN_MODEL_PATH`. Without it the system degrades honestly (see §4). TensorFlow is an *optional* dependency |
| RAG knowledge base (FAISS + MiniLM) | **Re-implemented** | Same 23-entry corpus (`app/data/skin_rag.json`), pure-python TF-IDF retrieval: no TensorFlow/FAISS/torch required, deterministic, testable. Interface is swap-ready for Chroma/pgvector |
| Agent 1 (Descriptor) | **Ported** | Classify → retrieve → patient-friendly summary |
| Agent 2 (Severity 1–5) | **Redesigned (safety)** | Rule-based, see §3. Original used `int(model_confidence × 5)` |
| Agent-flow viewer | **Ported** | Pure-SVG `AgentFlowViewer` + screen-reader step list; data comes from the stored pipeline trace |
| Triage history / dashboard / profile | **Already present** | MediTriage patient + clinician dashboards, case history, revisions, audit |
| Auth (Supabase) | **Not ported — intentionally** | MediTriage has stronger auth (JWT + refresh rotation + CSRF + RBAC + MFA backend). Replacing it would regress security |
| Voice assistant (Gemini Live) | **Not ported** | Needs a separate WebSocket server repo (`gemini-live-server`) not included in the zip. MediTriage already has speech-to-text symptom dictation in English/Hindi/Marathi (`VoiceInputButton`) |
| Video assistant (HeyGen avatar) | **Not ported** | Requires a paid HeyGen API key and account; no safe offline equivalent. Can be added behind a feature flag later |
| Supabase DB / storage | **Replaced** | PostgreSQL via SQLAlchemy/Alembic; images stored in-DB (survive ephemeral hosts, erased with the case) |

## 2. Architecture

```
Photo ─► sanitize (type sniff, bomb guard, EXIF/GPS strip, resize, re-encode JPEG)
      ─► Classifier port ──► Agent 1 Descriptor (top-5 + RAG passages + summary)
Case symptoms, vitals, age, history ───────────────► Agent 2 Severity (rules) ─► 1..5
      ─► Escalation-only gate ─► new versioned TriageResult (source=IMAGE_ESCALATION) + audit revision
```

Backend files: `app/services/skin_triage/{taxonomy,knowledge,classifier,image_utils,pipeline,service}.py`, `app/api/v1/skin_triage.py`, `app/models/skin_analysis.py`, migration `a7b8c9d0e1f2`.
Frontend files: `src/components/skin/{SkinImagePanel,AgentFlowViewer}.tsx`, `Skin` namespace in `messages/{en,hi,mr}.json`, typed client helpers `apiClient.skin.*`.

## 3. Safety invariants (enforced by tests in `tests/test_skin_triage.py`)

1. **Image alone can never produce Emergency.** Max from image is severity 4 (Urgent). Severity 5 requires a context red flag (`SKIN-EM-01…05`: airway/face swelling with skin signs, non-blanching rash + fever, mucosal blistering/peeling + fever, necrotizing signs + fever/severe pain, uncontrolled bleeding).
2. **Severity is clinical, not model confidence.** A 98%-confident acne photo stays Self-Care.
3. **Escalation-only.** The photo can raise a case's urgency (new `TriageResult` version, audited) but never lower it, including never lowering an Emergency.
4. **Uncertainty never reduces urgency.** Low confidence or no classifier ⇒ floor of severity 2, confidence band *Low*, clinician review required.
5. **LLM is not involved in the decision.** Retrieval + rules only; the clinician remains the final decision-maker.
6. **Privacy.** Authenticated + case-ownership authorization on every route (other users get 404); EXIF/GPS stripped; `Cache-Control: private, no-store`; max 5 MB, 5 images/case; photos cascade-delete with the case (DPDP erasure).

Severity → level map: 1 Self-Care Info · 2 Routine · 3–4 Urgent · 5 Emergency. Risk tiers per DermNet class are in `taxonomy.py` and are **unreviewed by a clinician** — treat as prototype values.

## 4. Running with and without the image model

- **Without weights (default, works everywhere):** `GET /api/v1/skin-triage/status` reports `classifier_available:false`; uploads are stored, the UI shows an explanatory notice, severity uses symptoms/history only, review is flagged.
- **With weights:** `pip install tensorflow` (CPU is fine), place the Keras file (23-class head, `resnet.preprocess_input`, 224×224), set `SKIN_MODEL_PATH=/path/to/model.h5`, restart. The loader validates the output size and falls back safely on any load error.

## 5. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/skin-triage/status` | Classifier availability, KB size, limits |
| POST | `/api/v1/cases/{case_id}/skin-analysis` | Multipart `image` (+ optional `body_part`) → analysis |
| GET | `/api/v1/cases/{case_id}/skin-analysis` | List analyses (newest first) |
| GET | `/api/v1/cases/{case_id}/skin-analysis/{id}/image` | Sanitized image bytes |

## 6. Other fixes made during this integration

- Frontend now **refreshes sessions** and revokes on logout (earlier round); CSRF cookie readable by JS.
- `schema.d.ts` was stale versus the backend; regenerated. This exposed that the **register page offered Clinician/Admin sign-up (rejected by the backend) and pre-filled fake health data** (age 72, hypertension, diabetes, penicillin allergy) into real accounts. The page now offers Patient/Caregiver only, starts empty, and uses design tokens (light theme).
- Pipeline false-positive found by tests and fixed: breathlessness in a chest-pain case no longer triggers the skin anaphylaxis rule.

## 7. Verification

See `docs/DEPLOYMENT.md` §6 for the exact commands. Last recorded run: backend pytest, `tsc`, `next lint`, token lint, `next build` — all green (details in the delivery notes).
