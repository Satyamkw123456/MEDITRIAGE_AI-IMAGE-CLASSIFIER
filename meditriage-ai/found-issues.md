# Found Issues & Cleanup Candidates

## Audit Remediation Part A Candidates

### 1. `backend/app/services/ai/orchestrator.py`
- **Issue**: Previously, `backend/app/api/v1/cases.py` directly called `orchestrate_clinical_ai` from `orchestrator.py`, completely bypassing the AI Gateway (`services/ai/gateway.py`), skipping PHI scrubbing, grounding verification, circuit breaker, and audit logging.
- **Remediation in Part A**: Routed all clinical intake and clarification calls in `cases.py` through `AIGateway` (`_execute_clinical_ai_gateway()`), ensuring full PHI scrubbing and gateway guardrails.
- **Future Cleanup Candidate**:
  - `orchestrator.py` is no longer called in production execution paths by `cases.py`.
  - It is currently still referenced in `app/services/ai/__init__.py`, `tests/test_ai_orchestrator.py`, and `tests/test_cycle7_admin_gates.py`.
  - Once unit tests are migrated to target `AIGateway` directly, `orchestrator.py` should be safely removed.
