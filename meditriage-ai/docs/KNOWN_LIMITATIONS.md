# MediTriage AI — Known Architectural & Operational Limitations

**Last Updated**: October 2026  
**Status**: Documented Baseline for Production Hardening (Post-Prompt 3B)

---

## 1. Authentication & Session Architecture

### 1.1 Token Lifetimes (P2 Follow-up)
- **Access Tokens**: Configured with a short sliding window of **15 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES = 15`).
  - Access tokens are bearer JWTs carrying claims (`sub`, `role`, `email`, `name`, `token_version`, `jti`).
  - Short lifetime minimizes exposure window in case of client-side leakage.
- **Refresh Tokens**: Configured with a sliding window of **7 days** (`REFRESH_TOKEN_EXPIRE_DAYS = 7`).
  - Kept in HTTP-only secure cookie or protected client storage.
  - Required to obtain new access tokens via `POST /api/v1/auth/refresh`.

### 1.2 In-Memory JTI Denylist & Revocation
- **Current Implementation**: Token revocation on explicit logout (`POST /api/v1/auth/logout`) stores revoked `jti` (JWT ID) claims in an in-memory TTL set (`InMemoryTokenDenylist`).
- **Limitation**:
  - In a multi-worker ASGI deployment (e.g., Uvicorn with multiple workers or Kubernetes pods), each process maintains its own in-memory set.
  - Server restarts clear the revocation list (though expired tokens are naturally rejected by time checks).
- **Target Architecture**: In production multi-node clusters, replace `InMemoryTokenDenylist` with a centralized Redis instance (`RATE_LIMIT_BACKEND=redis` and `REDIS_URL`).

---

## 2. Rate Limiting & Proxy Forwarding

### 2.1 Sliding Window Storage
- Sliding window counters for authentication endpoints (`/login`, `/register`, `/token`) default to memory (`InMemoryStore`).
- Configurable to `RedisStore` via `RATE_LIMIT_BACKEND=redis`.

### 2.2 Client IP Resolution (`X-Forwarded-For`)
- MediTriage AI strictly resolves client IP by verifying the immediate peer against `TRUSTED_PROXIES` (defaults to `127.0.0.1,::1,localhost,testclient`).
- Untrusted upstream clients attempting to spoof `X-Forwarded-For` headers are ignored, and the immediate peer host is used as the rate limit key.
- **Limitation**: When deploying behind edge proxies (AWS ALB, Cloudflare, NGINX), `TRUSTED_PROXIES` environment variable must be explicitly populated with the CIDR ranges of trusted proxies.

---

## 3. Clinical Rules & Escalation Status

### 3.1 Unreviewed Ruleset Notice
- Geriatric escalation rules (`SEEDED_GERIATRIC_RULES`) operate under a fail-safe conservative protocol pending formal clinical board review (`reviewed_by: null`).
- Unreviewed banners are present across admin governance, clinician queue details, and PDF reports until signed off.
- Refer to `docs/CLINICAL_VALIDATION_STATUS.md` for details.

---

## Skin & Wound Photo Triage (Triage Flow module)

- **Classifier weights are not bundled.** Without `SKIN_MODEL_PATH` the module stores photos for clinician review and triages from symptoms only (confidence band *Low*, review required). The TensorFlow adapter has not been exercised against a real DermNet model in this repository's tests; the pipeline, safety rules, API and UI are covered with a fake classifier.
- **Per-class risk tiers and context red-flag rules are unreviewed by a clinician** (prototype values in `taxonomy.py` / `pipeline.py`).
- **Retrieval is lexical (TF-IDF)** over a 23-entry corpus; not a vector store.
- **Session refresh across multiple tabs:** simultaneous refresh from two tabs can trip refresh-token reuse detection and require a fresh sign-in (safe failure).
- **Migrations were validated on SQLite**; run `alembic upgrade head` on Supabase and review the smoke test before relying on it.
- **Not ported from Triage Flow:** Gemini Live voice assistant and HeyGen video avatar (external paid services / separate server).
