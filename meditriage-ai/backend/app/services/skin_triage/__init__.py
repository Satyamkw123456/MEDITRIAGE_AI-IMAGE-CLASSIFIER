"""Skin & wound image triage (ported from the Triage Flow project).

Pipeline: sanitized image -> classifier -> knowledge retrieval (Agent 1, "Descriptor")
-> rule-based severity 1-5 (Agent 2, "Severity") -> escalation-only link to case triage.

Safety invariants (see agent.md): the image model is advisory only, never the
sole decision-maker; severity is derived from clinical rules and context, NOT from
classifier confidence; image findings can only RAISE a case's urgency, never lower it.
"""
