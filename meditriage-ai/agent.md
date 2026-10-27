# Agent Directives: Geriatric-Focused AI Triage System (`agent.md`)

## Persona and Objectives

- **Role:** Act as an expert technical AI collaborator for building and developing a geriatric-focused AI triage and emergency resource optimization system.
- **Goal:** Design, architect, and implement a scalable backend and clinical decision-support layer tailored for elderly patient care.

## Development Methodology

- **Base structure**: Incremental sequential model across tiers, delivering complete, demoable slices before moving forward.
- **Validation**: Spiral-style risk-first approach, tackling the riskiest unknowns early via minimal builds and mandatory test-and-validate checks before proceeding.
- **Execution rhythm**: Agile/scrum-style short iterations where each prompt is a small, scoped unit of work that is built, immediately tested, and logged in `dev-logbook/logbook.md` without formal ceremonies.

## Technical Preferences & Technology Stack

- **Languages:** Python (Primary), TypeScript for Frontend.
- **Frameworks & Architecture:** FastAPI for backend architecture and API design; Next.js 14 App Router for decoupled frontend; SQLAlchemy ORM; uv for dependency management.
- **Tools & Environment:** Antigravity IDE (agent-first, Gemini/Claude-integrated editor), Git, and Python package managers (`uv`).
- **Knowledge Retrieval:** RAG pipeline integrated with a vector database (ChromaDB/pgvector) to ground AI outputs in verified clinical guidelines rather than raw model knowledge.

## Medical Field Knowledge & AI Procedures

- **Geriatric Focus:** Account for atypical presentations of symptoms in older adults (e.g., delirium or confusion instead of classic pain), polypharmacy and vital-sign-masking drugs (e.g., beta-blockers blunting tachycardia), and multi-comorbidity overload. Use frameworks like ISAR where relevant.
- **WHO Guidelines:** Align medical AI procedures and decision-support logic with WHO guidance on ethics, human rights, transparency, safety, responsibility, and inclusion in AI for health.
- **Indian Demographic Context:** Design intake fields, risk factors, and reasoning to account for locally relevant comorbidity patterns and care-access realities.

## Mandatory Quality Check Layer (No-Bypass Rule)

**Every single case, without exception, must pass through the Quality Interpretation & Inference Layer before any triage result or differential diagnosis is shown to a clinician.** There is no code path — hardcoded, cached, fallback, or error-recovery — that is allowed to skip this check. If the quality layer itself fails to run (timeout, exception, missing data), the case must be automatically flagged **"Low confidence — clinician review required"** rather than silently defaulting to an unscored or unreviewed state. A patient must never fall through a gap where no quality assessment occurred.

**Input-side checks (run immediately after intake, before red-flag/triage logic):**

- Completeness — required fields present (chief complaint, duration, severity, ≥1 vital, relevant history).
- Specificity — free-text mapped to structured symptom vocabulary vs. left vague.
- Consistency — cross-field contradictions (e.g., "no fever" vs. 101°F reading).
- Plausibility — vitals/durations outside physiologically plausible ranges.
- Risk-Factor Coverage — age, sex, pregnancy status where applicable, comorbidities, medications, allergies present or explicitly marked "none."

Any hard contradiction involving a red-flag symptom **blocks silent triage** and forces a follow-up question before proceeding.

**Output-side checks (run after rule engine + LLM both produce results, before clinician sees anything):**

- Rule–LLM Agreement Check — disagreement forces a "needs clinician review" flag regardless of assigned urgency.
- Evidence Density — how much of the top differential rests on specific data vs. defaults/absence of data.
- Composite Inference Confidence Score:
  ```
  QualityScore = (0.35 × Completeness) + (0.20 × Consistency)
               + (0.25 × Rule–LLM Agreement) + (0.20 × Evidence Density)
  ```
- Confidence Bands: **High ≥0.75** (shown normally) · **Medium 0.50–0.74** ("Moderate confidence — review recommended") · **Low <0.50** ("Low confidence — clinician review required," auto-bumped up the review queue).

**Emergency red-flag results always bypass banding for speed** — they go straight to high-priority clinician notification immediately. The quality layer never delays an emergency escalation; it only annotates non-emergency reasoning afterward, retroactively, for audit purposes.

## Safety Guardrails & Clinical Authority

- **Clinician Supremacy:** The AI system functions strictly as a decision-support and screening layer. System guardrails and AI outputs must never override a clinician's professional medical advice, diagnosis, or final intervention decision.
- **LLM Is Never the Sole Decision-Maker — Under Any Circumstance.** The LLM may only summarize, explain, generate differentials from structured data, and propose follow-up questions. It must never be the only component that determines a triage level, and it must never run without: (1) the deterministic red-flag rule layer having run first, and (2) its own output passing through the Quality Interpretation & Inference Layer above before reaching a clinician. If the rule engine and the LLM disagree, the system defers to the more conservative (higher-urgency) of the two pending clinician review — it never lets the LLM's judgment silently win.
- **Deterministic Overrides:** Hard-coded rules always run first and flag critical red flags (severe acute vital sign drops, altered mental status, chest pain, stroke signs, severe bleeding, seizure, pregnancy emergencies) for immediate high-priority human escalation, independent of anything the LLM or quality layer decides.

## Regulatory & Compliance Framework

- **Primary Legal Basis:** India's Digital Personal Data Protection Act (DPDP), 2023 — governs consent, purpose limitation, data minimization, and security for identifiable health data collected from Indian citizens. This is the applicable law for this project, not a secondary consideration.
- **Design-Pattern Inspiration Only:** HIPAA and GDPR are referenced purely as architectural inspiration (e.g., least-privilege data access, breach-notification patterns, right-to-access design) — they are foreign legal frameworks and are not directly applicable, and should not be cited as the compliance basis in project documentation.
- **Auditability:** Every AI call, every quality score, and every rule-engine result must be logged (model/version, prompt version, output, safety-check results) and queryable — no exceptions, including for low-stakes or self-care-tier cases. the case sense is the one use it
