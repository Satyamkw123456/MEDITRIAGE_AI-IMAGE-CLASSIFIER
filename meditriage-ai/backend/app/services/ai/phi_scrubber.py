from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.services.geriatric.medication_shield import MedicationShield


@dataclass
class ScrubReport:
    """Structured report of PHI scrubbing actions, strictly omitting actual PHI text."""
    redactions_count: int = 0
    redacted_categories: Dict[str, int] = field(default_factory=dict)
    brand_names_genericized: int = 0
    dropped_unallowlisted_fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "redactions_count": self.redactions_count,
            "redacted_categories": self.redacted_categories,
            "brand_names_genericized": self.brand_names_genericized,
            "dropped_unallowlisted_fields": self.dropped_unallowlisted_fields,
        }


class PHIScrubber:
    """
    Allowlist-only payload builder and defense-in-depth regex scrubber.
    Guarantees no patient identifiers (name, phone, Aadhaar, MRN, email, address)
    or commercial brand names leak to the LLM or structured logs.
    """

    # Defense-in-depth regex patterns
    REGEX_AADHAAR_OR_12DIGIT = re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b|\b\d{12}\b")
    REGEX_PHONE = re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b")
    REGEX_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
    REGEX_SSN_OR_ID = re.compile(r"\b(id|mrn|ssn|uid|aadhaar)[:#\s]*[A-Za-z0-9-]{4,20}\b", re.IGNORECASE)

    REGEX_PATIENT_NAME = re.compile(
        r"\b(patient|pt|mr|mrs|ms|dr|master|smt|shri)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b",
        re.IGNORECASE,
    )

    def __init__(self, med_shield: Optional[MedicationShield] = None):
        self.med_shield = med_shield or MedicationShield()

    def _redact_text(
        self,
        text: str,
        report: ScrubReport,
        known_identifiers: Optional[List[str]] = None,
    ) -> str:
        """Applies regex redaction passes to any free-text string."""
        if not text:
            return ""

        redacted = text

        # 0. Known identifiers (e.g. patient name, address from intake metadata)
        if known_identifiers:
            for ident in known_identifiers:
                if ident and len(ident.strip()) >= 3:
                    ident_clean = ident.strip()
                    if ident_clean.lower() in redacted.lower():
                        # Case insensitive replacement
                        pattern = re.compile(re.escape(ident_clean), re.IGNORECASE)
                        redacted = pattern.sub("[REDACTED_IDENTIFIER]", redacted)
                        report.redactions_count += 1
                        report.redacted_categories["known_identifier"] = (
                            report.redacted_categories.get("known_identifier", 0) + 1
                        )

        # 1. 12-digit numbers / Aadhaar
        matches = list(self.REGEX_AADHAAR_OR_12DIGIT.finditer(redacted))
        if matches:
            report.redactions_count += len(matches)
            report.redacted_categories["national_id_or_12digit"] = (
                report.redacted_categories.get("national_id_or_12digit", 0) + len(matches)
            )
            redacted = self.REGEX_AADHAAR_OR_12DIGIT.sub("[REDACTED_ID]", redacted)

        # 2. Email addresses
        matches = list(self.REGEX_EMAIL.finditer(redacted))
        if matches:
            report.redactions_count += len(matches)
            report.redacted_categories["email"] = (
                report.redacted_categories.get("email", 0) + len(matches)
            )
            redacted = self.REGEX_EMAIL.sub("[REDACTED_EMAIL]", redacted)

        # 3. Phone numbers
        matches = list(self.REGEX_PHONE.finditer(redacted))
        if matches:
            report.redactions_count += len(matches)
            report.redacted_categories["phone"] = (
                report.redacted_categories.get("phone", 0) + len(matches)
            )
            redacted = self.REGEX_PHONE.sub("[REDACTED_PHONE]", redacted)

        # 4. Explicit ID tags (MRN, UID, etc.)
        matches = list(self.REGEX_SSN_OR_ID.finditer(redacted))
        if matches:
            report.redactions_count += len(matches)
            report.redacted_categories["medical_record_id"] = (
                report.redacted_categories.get("medical_record_id", 0) + len(matches)
            )
            redacted = self.REGEX_SSN_OR_ID.sub("[REDACTED_RECORD_ID]", redacted)

        # 5. Patient name references with honorifics
        matches = list(self.REGEX_PATIENT_NAME.finditer(redacted))
        if matches:
            report.redactions_count += len(matches)
            report.redacted_categories["patient_name"] = (
                report.redacted_categories.get("patient_name", 0) + len(matches)
            )
            redacted = self.REGEX_PATIENT_NAME.sub("[REDACTED_NAME]", redacted)

        return redacted

    def _get_age_band(self, age: Optional[int]) -> str:
        """Converts raw age to standardized age band for demographic minimisation."""
        if age is None:
            return "Adult (Unspecified)"
        if age < 18:
            return "Pediatric (<18)"
        if age < 40:
            return "18-39"
        if age < 65:
            return "40-64"
        if age < 75:
            return "65-74"
        if age < 85:
            return "75-84"
        return "85+"

    def sanitize_medications(self, raw_meds: Any, report: ScrubReport) -> List[str]:
        """
        Extracts generic names only.
        Indian brand names (e.g. Ecosprin) are converted to generic (aspirin).
        Commercial brand names are NEVER forwarded to LLM.
        """
        if not raw_meds:
            return []

        med_list: List[str] = []
        if isinstance(raw_meds, str):
            med_list = [m.strip() for m in raw_meds.split(",") if m.strip()]
        elif isinstance(raw_meds, list):
            for m in raw_meds:
                if isinstance(m, dict):
                    name = m.get("name") or m.get("generic_name") or ""
                    if name:
                        med_list.append(name)
                elif isinstance(m, str):
                    med_list.append(m)

        generic_meds: List[str] = []
        for m in med_list:
            resolved = self.med_shield.resolve_medication(m)
            # If resolved generic differs from raw brand input, record genericization
            if resolved.raw_input.strip().lower() != resolved.generic_name.strip().lower():
                report.brand_names_genericized += 1
            
            # Apply defense-in-depth redaction to generic name just in case
            sanitized_generic = self._redact_text(resolved.generic_name, report)
            generic_meds.append(sanitized_generic)

        return generic_meds

    def build_safe_payload(
        self,
        raw_case_data: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], ScrubReport]:
        """
        Builds an allowlist-only payload while scrubbing any free text for PHI.
        Returns (scrubbed_payload, scrub_report).
        """
        report = ScrubReport()

        # Track any unallowlisted keys dropped
        ALLOWLISTED_KEYS = {
            "age", "sex", "gender", "chief_complaint", "symptoms", "vitals",
            "medications", "current_medications", "allergies", "comorbidities",
            "medical_history", "caregiver_observations", "notes", "triage_level",
            "triage_score", "rule_rationale"
        }
        for k in raw_case_data.keys():
            if k not in ALLOWLISTED_KEYS:
                report.dropped_unallowlisted_fields.append(k)

        # Collect known identifiers from raw_case_data for cross-field defense-in-depth
        known_identifiers: List[str] = []
        for ident_key in ["name", "patient_name", "phone", "email", "address", "mrn", "aadhaar"]:
            val = raw_case_data.get(ident_key)
            if val and isinstance(val, str):
                known_identifiers.append(val)
                if ident_key in ["name", "patient_name"]:
                    # Also include multi-character name parts
                    known_identifiers.extend([w for w in val.split() if len(w) >= 3])

        # 1. Demographics (Age band + Sex)
        raw_age = raw_case_data.get("age")
        age_band = self._get_age_band(raw_age)
        raw_sex = str(raw_case_data.get("sex") or raw_case_data.get("gender") or "Unknown").lower()
        safe_sex = "female" if "female" in raw_sex else ("male" if "male" in raw_sex else "other")

        # 2. Chief Complaint
        raw_cc = str(raw_case_data.get("chief_complaint") or "")
        safe_cc = self._redact_text(raw_cc, report, known_identifiers=known_identifiers)

        # 3. Symptoms (allowlist: symptom, duration, severity, location)
        raw_symptoms = raw_case_data.get("symptoms") or []
        safe_symptoms: List[Dict[str, Any]] = []
        if isinstance(raw_symptoms, list):
            for s in raw_symptoms:
                if isinstance(s, dict):
                    sym_name = self._redact_text(str(s.get("symptom") or s.get("name") or ""), report, known_identifiers=known_identifiers)
                    duration = self._redact_text(str(s.get("duration") or ""), report, known_identifiers=known_identifiers)
                    location = self._redact_text(str(s.get("body_location") or ""), report, known_identifiers=known_identifiers)
                    sev = s.get("severity")
                    safe_symptoms.append({
                        "symptom": sym_name,
                        "duration": duration,
                        "severity": sev if isinstance(sev, (int, float)) else None,
                        "body_location": location,
                    })
                elif isinstance(s, str):
                    safe_symptoms.append({"symptom": self._redact_text(s, report, known_identifiers=known_identifiers)})

        # 4. Vitals (strictly numerical/standard vital fields)
        raw_vitals = raw_case_data.get("vitals") or {}
        safe_vitals: Dict[str, Any] = {}
        if isinstance(raw_vitals, dict):
            for vital_key in ["blood_pressure", "systolic_bp", "diastolic_bp", "temperature", "pulse", "spo2", "respiratory_rate"]:
                if vital_key in raw_vitals and raw_vitals[vital_key] is not None:
                    val = raw_vitals[vital_key]
                    if isinstance(val, str):
                        safe_vitals[vital_key] = self._redact_text(val, report, known_identifiers=known_identifiers)
                    else:
                        safe_vitals[vital_key] = val

        # 5. Medications (GENERIC ONLY)
        raw_meds = raw_case_data.get("medications") or raw_case_data.get("current_medications")
        safe_meds = self.sanitize_medications(raw_meds, report)

        # 6. Comorbidities / Medical History
        raw_comorb = raw_case_data.get("comorbidities") or raw_case_data.get("medical_history") or []
        safe_comorb: List[str] = []
        if isinstance(raw_comorb, list):
            for c in raw_comorb:
                safe_comorb.append(self._redact_text(str(c), report, known_identifiers=known_identifiers))
        elif isinstance(raw_comorb, str):
            safe_comorb = [self._redact_text(c.strip(), report, known_identifiers=known_identifiers) for c in raw_comorb.split(",") if c.strip()]

        # 7. Allergies
        raw_allergies = raw_case_data.get("allergies") or []
        safe_allergies: List[str] = []
        if isinstance(raw_allergies, list):
            for a in raw_allergies:
                safe_allergies.append(self._redact_text(str(a), report, known_identifiers=known_identifiers))
        elif isinstance(raw_allergies, str):
            safe_allergies = [self._redact_text(a.strip(), report, known_identifiers=known_identifiers) for a in raw_allergies.split(",") if a.strip()]

        # 8. Caregiver Observations / Notes (free text)
        raw_caregiver = str(raw_case_data.get("caregiver_observations") or raw_case_data.get("notes") or "")
        safe_caregiver = self._redact_text(raw_caregiver, report, known_identifiers=known_identifiers)

        payload = {
            "age_band": age_band,
            "age_years": raw_age if isinstance(raw_age, int) else None,
            "sex": safe_sex,
            "chief_complaint": safe_cc,
            "symptoms": safe_symptoms,
            "vitals": safe_vitals,
            "medications_generic": safe_meds,
            "comorbidities": safe_comorb,
            "allergies": safe_allergies,
            "caregiver_observations": safe_caregiver,
            "rule_triage_level": raw_case_data.get("triage_level") or "Unknown",
            "rule_risk_score": raw_case_data.get("triage_score"),
            "rule_rationale": self._redact_text(str(raw_case_data.get("rule_rationale") or ""), report, known_identifiers=known_identifiers),
        }

        return payload, report
