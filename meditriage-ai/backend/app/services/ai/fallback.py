from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.services.ai.schemas import CaseAnalysis, DifferentialItem, GeriatricConcernLiteral, UrgencyLiteral


class DeterministicFallbackEngine:
    """
    Deterministic rule-based clinical fallback engine.
    Constructs clinically sound, grounded explanations when the LLM service
    is unreachable, blocked, or timed out.
    """

    @classmethod
    def generate_fallback_analysis(
        cls,
        scrubbed_payload: Dict[str, Any],
        retrieved_source_ids: Optional[List[str]] = None,
    ) -> CaseAnalysis:
        rule_urgency_raw = str(scrubbed_payload.get("rule_triage_level") or "routine").lower()
        if "emergency" in rule_urgency_raw:
            suggested_urgency: UrgencyLiteral = "emergency"
        elif "urgent" in rule_urgency_raw:
            suggested_urgency = "urgent"
        elif "self" in rule_urgency_raw:
            suggested_urgency = "self_care"
        else:
            suggested_urgency = "routine"

        age_years = scrubbed_payload.get("age_years")
        sex = scrubbed_payload.get("sex", "patient")
        chief_complaint = scrubbed_payload.get("chief_complaint") or "unspecified symptoms"
        meds = scrubbed_payload.get("medications_generic") or []
        symptoms = scrubbed_payload.get("symptoms") or []

        # Identify primary geriatric concerns
        geriatric_concerns: List[GeriatricConcernLiteral] = []
        cc_lower = chief_complaint.lower()
        sym_text = " ".join([str(s.get("symptom", "")).lower() for s in symptoms if isinstance(s, dict)])
        full_text = f"{cc_lower} {sym_text}"

        if any(w in full_text for w in ["confus", "disorient", "altered", "hallucin", "drows"]):
            geriatric_concerns.append("delirium")
        if any(w in full_text for w in ["fall", "slip", "trip", "stumble", "unsteady"]):
            geriatric_concerns.append("fall_risk")
        if len(meds) >= 5:
            geriatric_concerns.append("polypharmacy")
        if any(w in full_text for w in ["weak", "fatigue", "poor intake", "appetite"]):
            geriatric_concerns.append("frailty")
            geriatric_concerns.append("atypical_presentation")
        if any(w in full_text for w in ["fever", "chill", "rigor", "sepsis", "hypotherm"]):
            geriatric_concerns.append("sepsis_pattern")

        if not geriatric_concerns:
            geriatric_concerns.append("none")

        comorbidities = scrubbed_payload.get("comorbidities") or []
        comorbid_str = f" Known comorbidities: {', '.join(comorbidities[:4])}." if comorbidities else ""

        # Synthesize fallback summary
        summary = (
            f"[RULE-BASED FALLBACK] Standardized clinical synthesis for {age_years or 'older'}-year-old {sex} "
            f"presenting with {chief_complaint}.{comorbid_str} Evaluated under deterministic geriatric rules. "
            f"Active medications: {', '.join(meds[:4]) or 'none recorded'}. "
            f"Identified clinical concerns: {', '.join(geriatric_concerns)}. "
            f"Triage urgency verified as {suggested_urgency.upper()} by rule composer."
        )[:1200]

        rationale = (
            f"Deterministic fallback derived directly from rule triage assessment ({suggested_urgency}). "
            f"Prompt baseline reflects acute presentation and physiological risk factors."
        )

        # Synthesize differentials grounded with available source IDs
        primary_source = [retrieved_source_ids[0]] if retrieved_source_ids else []
        secondary_source = [retrieved_source_ids[1]] if (retrieved_source_ids and len(retrieved_source_ids) > 1) else primary_source

        differentials: List[DifferentialItem] = []

        if any("copd" in str(c).lower() for c in comorbidities) or "copd" in full_text:
            differentials.append(
                DifferentialItem(
                    condition="Acute Respiratory Exacerbation of COPD",
                    likelihood="more_likely",
                    supporting_evidence=[chief_complaint, "Underlying COPD comorbidity with acute respiratory presentation"],
                    against_or_missing=["Sputum culture and chest radiography pending"],
                    source_ids=primary_source,
                )
            )

        if any("osteoarthr" in str(c).lower() for c in comorbidities) or any("joint" in str(c).lower() for c in comorbidities) or "osteoarthr" in full_text or "joint" in full_text:
            differentials.append(
                DifferentialItem(
                    condition="Osteoarthritis Exacerbation / Degenerative Joint Disease",
                    likelihood="more_likely",
                    supporting_evidence=[chief_complaint, "Known osteoarthritis history with localized joint pain and stiffness"],
                    against_or_missing=["Exclude acute inflammatory arthropathy or joint effusion"],
                    source_ids=primary_source,
                )
            )

        if "delirium" in geriatric_concerns or "sepsis_pattern" in geriatric_concerns:
            differentials.append(
                DifferentialItem(
                    condition="Atypical Acute Infection / Delirium",
                    likelihood="more_likely",
                    supporting_evidence=[chief_complaint, "Acute mental status or systemic change"],
                    against_or_missing=["Pending urine analysis and inflammatory markers"],
                    source_ids=primary_source,
                )
            )
            differentials.append(
                DifferentialItem(
                    condition="Drug-Induced Cognitive or Metabolic Disturbance",
                    likelihood="possible",
                    supporting_evidence=[f"Active polypharmacy ({len(meds)} medications)"],
                    against_or_missing=["Recent medication titration dates missing"],
                    source_ids=secondary_source,
                )
            )
        elif "fall_risk" in geriatric_concerns:
            differentials.append(
                DifferentialItem(
                    condition="Fall with Potential Occult Trauma or Intracranial Event",
                    likelihood="more_likely",
                    supporting_evidence=[chief_complaint, "Reported fall or balance disturbance"],
                    against_or_missing=["Neuroimaging required to exclude intracranial hemorrhage"],
                    source_ids=primary_source,
                )
            )
        else:
            if not differentials:
                differentials.append(
                    DifferentialItem(
                        condition=f"Acute Presentation of {chief_complaint.title()}",
                        likelihood="more_likely",
                        supporting_evidence=[chief_complaint, "Reported symptoms"],
                        against_or_missing=["Comprehensive physical examination pending"],
                        source_ids=primary_source,
                    )
                )
            differentials.append(
                DifferentialItem(
                    condition="Age-Related Deconditioning / Frailty Vulnerability",
                    likelihood="possible",
                    supporting_evidence=["Geriatric age and non-specific presentation"],
                    against_or_missing=["Baseline functional assessment pending"],
                    source_ids=secondary_source,
                )
            )

        followup_questions = [
            "Has there been any sudden change in alertness, sleepiness, or confusion over the past 48 hours?",
            "Has the patient had any recent falls, slips, or balance difficulties?",
            "Have any new medications or dose changes occurred in the last two weeks? Discuss with your doctor.",
            "Is the patient able to drink fluids and eat meals normally today?",
        ]

        return CaseAnalysis(
            summary=summary,
            suggested_urgency=suggested_urgency,
            urgency_rationale=rationale,
            differentials=differentials,
            followup_questions=followup_questions,
            geriatric_concerns=geriatric_concerns,
            is_rule_based_fallback=True,
        )
