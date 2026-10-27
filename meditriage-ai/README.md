# MediTriage AI (Geriatric Clinical Decision-Support & Triage Platform)

> **Important Clinical Safety Disclaimer:**
> **MediTriage AI is a clinical decision-support and emergency resource optimization platform. It does not replace doctors, hospitals, or emergency services. It is STRICTLY NOT a diagnostic replacement and NOT a substitute for professional medical advice, clinical diagnosis, or emergency healthcare services.** All recommendations, risk stratifications, and triage scores function solely as decision-support aids under clinician supremacy — a human clinician always has the final word.

---

## 📌 Project Overview
MediTriage AI is tailored specifically for **geriatric patient triage** (elderly care), addressing unique clinical challenges such as:
- **Atypical presentations:** e.g., acute confusion or delirium replacing classic pain symptoms.
- **Polypharmacy & vital masking:** e.g., beta-blockers blunting physiological tachycardia during septic/hypovolemic shock.
- **Comorbidity overload & frailty:** integration of geriatric assessment factors (e.g., ISAR concepts).
- **Mandatory Quality Check Layer (No-Bypass Rule):** A strict evaluation layer ensuring completeness, consistency, rule-LLM agreement, and evidence density before any non-emergency recommendation reaches a clinician.
- **Indian Demographic Context & DPDP Act 2023 Compliance:** Designed for local comorbidity prevalence and strict digital personal data protection principles.

---

## 🏗️ Repository Architecture (Monorepo)

```
meditriage-ai/
├── backend/                  # FastAPI (Python 3.12, uv, SQLAlchemy, Alembic)
│   ├── app/
│   │   ├── core/            # Configuration, security, settings
│   │   ├── db/              # SQLAlchemy session & base
│   │   └── main.py          # FastAPI application entry point
│   ├── pyproject.toml       # Python package configuration (uv)
│   └── .env.example         # Environment variable template
├── frontend/                 # Next.js 14 (React, TypeScript, Tailwind CSS, App Router)
│   ├── src/
│   │   └── app/             # Next.js App Router pages and layouts
│   ├── package.json         # Node dependencies and scripts
│   ├── tsconfig.json        # TypeScript configuration
│   └── tailwind.config.ts   # Tailwind CSS styling config
├── agent.md                  # Complete agent directives, quality layers, and safety guardrails
├── .gitignore               # Multi-language Git ignore configuration
└── README.md                # Project documentation and setup guide
```

---

## 🚀 Quickstart & Setup

### Prerequisites
- Python 3.12+ and [`uv`](https://github.com/astral-sh/uv) (or `pip`)
- Node.js 18+ and `npm` / `pnpm`

### 1. Backend Setup
```bash
cd backend
# With uv:
uv venv
# Activate virtual environment:
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
uv pip install -e .

# Run development server:
uvicorn app.main:app --reload --port 8000
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend web interface will be accessible at: `http://localhost:3000`

---

## 🛡️ Compliance & Safety Guardrails
- **Clinician Supremacy:** The system cannot override a clinician's verdict.
- **Deterministic Red-Flag Overrides:** High-urgency physiological red flags trigger immediate escalation independent of LLM inference.
- **Regulatory Framework:** Compliant with India's **Digital Personal Data Protection (DPDP) Act, 2023** and aligned with **WHO guidance on Ethics & Governance of AI for Health**.
