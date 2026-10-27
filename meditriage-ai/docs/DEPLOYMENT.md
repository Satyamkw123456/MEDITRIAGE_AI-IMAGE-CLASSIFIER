# MediTriage AI: Deployment Runbook

Target: **Supabase (Postgres) + Render (API) + Vercel (web)**. Order matters: database → API → web → smoke test.

## 1. Database (Supabase)
1. Create a project; copy the **Session pooler / direct** connection string.
2. Use the `postgresql://user:pass@host:5432/postgres` form (the app uses psycopg2).

## 2. API (Render)
1. Push the repo to GitHub; in Render choose **New → Blueprint** and select the repo (uses `render.yaml`).
2. Fill the prompted variables: `DATABASE_URL`, `BACKEND_CORS_ORIGINS` (your Vercel URL, no trailing slash), `GEMINI_API_KEY`, `TRUSTED_PROXIES`.
   `SECRET_KEY` and `AUDIT_HMAC_KEY` are auto-generated and **must differ**; never reuse the dev defaults (the app refuses to start in production with weak/empty keys or SQLite).
3. First boot runs `alembic upgrade head` (creates all tables including `skin_image_analyses`).
4. Seed once from the Render shell: `python seed_permissions.py` (required: RBAC), then `python seed_data.py` **only** if you want demo accounts.
5. Check `https://<api>/health` returns OK.
6. Optional image model: upload nothing to git; mount weights on a Render disk, set `SKIN_MODEL_PATH`, and add `tensorflow` to the build. Without it the skin module degrades safely.

## 3. Web (Vercel)
1. Import the repo, **Root Directory: `frontend`**.
2. Environment variable `BACKEND_URL=https://<api>.onrender.com` must be set **before the first build** (Next rewrites read it at build time). Keep the browser API base URL empty so cookies stay same-origin through the rewrites.
3. Deploy; update `BACKEND_CORS_ORIGINS` on Render with the final Vercel URL if it changed.

## 4. Pre-deploy gate (run locally)
```
python scripts/predeploy_check.py
```
Fails on any `.db`, `.env*`, or secret-looking string.

## 5. Smoke test (≈10 min, in a private window)
1. Register a **Patient** (password ≥ 10 chars) → sign in → accept consent.
2. Submit intake for a mild complaint → case page shows triage + trust strip.
3. Skin panel: upload a JPEG → result card, flow diagram opens, "classifier unavailable" notice shown if no model.
4. Submit an **emergency** intake (chest pain + breathlessness) → Emergency banner, no downgrade after a photo upload.
5. Wait 16 min on the case page and click around → silently refreshes (no 401 bounce); sign out → refresh then fails.
6. Clinician (seeded) → queue sorted by urgency → open case, add feedback, export PDF.
7. Admin → Audit → **Verify chain** reports intact.
8. Other patient account cannot open the first patient's case (404).

## 6. Verification commands
```
# backend
cd backend && pip install -e . pytest hypothesis && python -m pytest tests -q
# frontend
cd frontend && npm ci && npx tsc --noEmit && npx next lint && node scripts/lint-tokens.mjs && npx next build
```

## 7. Rollback
Render: redeploy previous deploy. Database: `alembic downgrade -1` (the skin migration drops only its own table).

## 8. Honest limitations at submission
See `docs/KNOWN_LIMITATIONS.md`. Key points: single API worker (in-memory limiter/denylist), access token in `localStorage`, clinical rules and per-class risk tiers unreviewed by a clinician, migrations validated on SQLite only (not run against a live Postgres in this environment), skin classifier weights not bundled.
