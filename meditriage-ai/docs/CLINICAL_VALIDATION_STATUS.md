# Clinical Validation Status: Rule Engine & Decision Safeguards

**Document Status**: Active / Unvalidated Draft Baseline  
**Last Updated**: October 2026  
**Clinical Reviewer Attestation**: `None` (`reviewed_by: null`)  
**Overall Validation Status**: `PENDING_CLINICIAN_REVIEW`

---

## 1. Executive Summary
MediTriage AI implements a deterministic, multi-engine consensus triage architecture designed to fail safely in older adults and vulnerable patient cohorts. While all rules in `SEEDED_GERIATRIC_RULES` are cross-referenced against authoritative clinical practice guidelines (NICE, AHA/ASA, IDSA, BGS), **no formal clinical sign-off has occurred yet**.

To prevent clinical automation bias and maintain strict regulatory compliance, the application operates under an explicit **Fail-Safe Unreviewed Notice Protocol**.

---

## 2. Unreviewed Ruleset Surface Protections

When running with unvalidated or pending rules (`reviewed_by is null`):

1. **Admin Clinical Governance Portal (`/admin/clinical/rules`)**:
   - Displays a prominent red warning banner:  
     `UNREVIEWED RULESET`
   - Explicit flag: `is_unreviewed: true`
   - All rule modifications, publishing, or draft promotions require double-entry dual-control sign-off.

2. **Clinician Queue & Case Detail View (`/cases/{id}`)**:
   - Whenever any unreviewed floor rule (`GERI-FLOOR-01-DELIRIUM`, `GERI-FLOOR-02-STROKE-ICH`, `GERI-FLOOR-03-FEVER`, `GERI-GUARD-04-IMPLAUSIBLE-VITAL`, `GERI-GUARD-05-NONSPECIFIC-DECLINE`) fires, the case payload includes:
     `unreviewed_rules_notice: "Clinical review pending — rules active under conservative fail-safe protocol"`
   - Displays a visual disclaimer reminding attending clinicians that escalation levels are automated conservative floors and do not substitute for formal clinical diagnosis.

3. **PDF Clinical Case Summary (`/cases/{id}/pdf`)**:
   - Every generated patient report includes a standardized document footer:  
     *“Geriatric escalation rules pending clinical validation”*

---

## 3. Registered Rules Status Matrix

| Rule Identifier | Status | Clinician Reviewer | Citation Reference |
|---|---|---|---|
| `GERI-FLOOR-01-DELIRIUM` | `PENDING_CLINICIAN_REVIEW` | `null` | NICE CG103 |
| `GERI-FLOOR-02-STROKE-ICH` | `PENDING_CLINICIAN_REVIEW` | `null` | NICE NG128 / AHA-ASA 2019 |
| `GERI-FLOOR-03-FEVER` | `PENDING_CLINICIAN_REVIEW` | `null` | IDSA 2009 / BGS Silver Book II |
| `GERI-GUARD-04-IMPLAUSIBLE-VITAL` | `PENDING_CLINICIAN_REVIEW` | `null` | Physiological Range Safety Standard |
| `GERI-GUARD-05-NONSPECIFIC-DECLINE` | `PENDING_CLINICIAN_REVIEW` | `null` | BGS Silver Book II |
| `GERI-RULE-01-ACUTE-CONFUSION` | `PENDING_CLINICIAN_REVIEW` | `null` | NICE CG103 |
| `GERI-RULE-02-FALL-ANTICOAG` | `PENDING_CLINICIAN_REVIEW` | `null` | NICE NG232 |
| `GERI-RULE-03-CHEST-PAIN-DIABETES` | `PENDING_CLINICIAN_REVIEW` | `null` | ESC ACS 2023 / AHA Chest Pain |
| `GERI-RULE-04-DYSPNEA-CHRONIC` | `PENDING_CLINICIAN_REVIEW` | `null` | GOLD 2024 / ESC HF 2021 |
| `GERI-RULE-05-SYNCOPE` | `PENDING_CLINICIAN_REVIEW` | `null` | ESC Syncope 2018 |
| `GERI-RULE-06-SEVERE-DIZZINESS` | `PENDING_CLINICIAN_REVIEW` | `null` | AHA Stroke / HINTS |
| `GERI-RULE-07-MILD-ISOLATED` | `PENDING_CLINICIAN_REVIEW` | `null` | NICE CG177 |

---

## 4. Path to Validation & Promotion
To clear the `UNREVIEWED RULESET` banner:
1. Licensed clinician (MD / Geriatrician / Emergency Medicine Specialist) must review the rule logic, threshold definitions, and replay test cases.
2. Sign-off must be recorded via the Admin Clinical Governance API:
   `POST /api/v1/admin/clinical/rules/publish` with verified `validated_by` clinician credentials.
3. Once all active rules have verified `reviewed_by` signatures, the banner is automatically removed.
