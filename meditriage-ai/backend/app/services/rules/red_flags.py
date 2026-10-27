"""
Deterministic Red-Flag Rule Engine for Geriatric & Acute Clinical Triage.

Under clinical safety directives (agent.md), emergency red flags MUST be evaluated
using deterministic, explainable Python code prior to and independent of any LLM
inference or downstream clinical decision support.

Deterministic Rules:
1. RED_FLAG_CHEST_PAIN_OVER_40: Chest pain / cardiac symptoms in patients > 40 years old.
2. RED_FLAG_SEVERE_BREATHLESSNESS: Acute severe respiratory distress or critical hypoxemia (SpO2 < 90%).
3. RED_FLAG_STROKE_SIGNS: Acute focal neurological deficits (one-sided weakness, facial droop, slurred speech).
4. RED_FLAG_SEVERE_BLEEDING: Severe, profuse, or uncontrolled active hemorrhage / hematemesis.
5. RED_FLAG_ACTIVE_SEIZURE: Active, prolonged, or recurrent seizure / convulsion activity.
6. RED_FLAG_SEVERE_ALLERGIC_REACTION: Anaphylaxis signs (airway/throat/tongue swelling, acute angioedema).
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class RedFlagEvaluation:
    is_emergency: bool = False
    primary_rule: Optional[str] = None
    fired_rules: List[str] = field(default_factory=list)
    clinical_rationale: Optional[str] = None

    def get_summary_rule_string(self) -> Optional[str]:
        if not self.is_emergency or not self.fired_rules:
            return None
        return " ; ".join(self.fired_rules)


RedFlagResult = RedFlagEvaluation


def _contains_any(text: str, phrases: List[str]) -> bool:
    """Checks if any phrase or regex-safe keyword appears as a substring/word in text."""
    lowered = text.lower()
    for phrase in phrases:
        p_clean = phrase.lower().strip()
        if p_clean in lowered:
            return True
    return False


def evaluate_red_flags(
    chief_complaint: str,
    age: int,
    severity: int = 5,
    body_location: Optional[str] = None,
    additional_symptoms: Optional[List[str]] = None,
    spo2: Optional[float] = None,
    pulse: Optional[int] = None,
    blood_pressure: Optional[str] = None,
    temperature: Optional[float] = None,
) -> RedFlagEvaluation:
    """
    Evaluates intake data against deterministic red-flag emergency criteria.
    Executes synchronously on every case creation.
    """
    fired_rules: List[str] = []
    rationales: List[str] = []

    # Aggregate all symptom text descriptors
    all_texts = [chief_complaint or ""]
    if body_location:
        all_texts.append(body_location)
    if additional_symptoms:
        all_texts.extend(additional_symptoms)

    combined_text = " ".join(all_texts).lower()
    loc_lower = (body_location or "").lower()

    # -------------------------------------------------------------------------
    # RULE 1: Chest pain in patients over 40 years of age (Cardiac Emergency)
    # -------------------------------------------------------------------------
    chest_pain_keywords = [
        "chest pain", "chest tightness", "chest pressure", "pressure in chest",
        "pain in chest", "tightness in chest", "crushing chest", "angina",
        "substernal", "retrosternal", "cardiac pain", "heart pain", "heaviness in chest",
        "squeezing chest", "chest discomfort", "pain radiating to left arm",
        "left arm and chest", "jaw and chest pain"
    ]
    is_chest_location = any(k in loc_lower for k in ["chest", "thorax", "cardiac"])
    has_pain_in_chest_loc = is_chest_location and any(
        w in combined_text for w in ["pain", "pressure", "tightness", "heaviness", "burning", "discomfort", "crushing", "squeezing", "ache"]
    )
    has_chest_pain_symptom = _contains_any(combined_text, chest_pain_keywords) or has_pain_in_chest_loc

    if age > 40 and has_chest_pain_symptom:
        rule_desc = "RED_FLAG_CHEST_PAIN_OVER_40: Acute chest pain or ischemic discomfort in patient aged > 40"
        fired_rules.append(rule_desc)
        rationales.append(f"Patient age is {age} (>40) presenting with acute chest discomfort indicative of potential Acute Coronary Syndrome (ACS).")

    # -------------------------------------------------------------------------
    # RULE 2: Severe Breathlessness (Respiratory Distress / Hypoxemia)
    # -------------------------------------------------------------------------
    severe_breathless_keywords = [
        "severe breathlessness", "severe shortness of breath", "acute shortness of breath",
        "cannot breathe", "can't breathe", "unable to breathe", "gasping for air",
        "gasping", "suffocating", "stridor", "acute respiratory distress",
        "severe dyspnea", "extreme breathlessness", "choking", "respiratory distress",
        "gasping breathing", "severe breathing difficulty"
    ]
    general_dyspnea_keywords = [
        "shortness of breath", "breathless", "breathlessness", "difficulty breathing",
        "dyspnea", "labored breathing", "struggling to breathe", "wheezing"
    ]

    has_severe_dyspnea_text = _contains_any(combined_text, severe_breathless_keywords)
    has_critical_spo2 = spo2 is not None and spo2 < 90.0
    has_high_severity_dyspnea = severity >= 7 and _contains_any(combined_text, general_dyspnea_keywords)

    if has_severe_dyspnea_text or has_critical_spo2 or has_high_severity_dyspnea:
        reasons = []
        if has_severe_dyspnea_text:
            reasons.append("acute severe breathlessness / gasping symptoms")
        if has_critical_spo2:
            reasons.append(f"critically low SpO2 measurement ({spo2}%)")
        if has_high_severity_dyspnea:
            reasons.append(f"high severity score ({severity}/10) with respiratory difficulty")

        rule_desc = "RED_FLAG_SEVERE_BREATHLESSNESS: Severe acute breathlessness, respiratory distress, or severe hypoxemia"
        fired_rules.append(rule_desc)
        rationales.append(f"Severe respiratory compromise identified: {', '.join(reasons)}.")

    # -------------------------------------------------------------------------
    # RULE 3: One-sided Weakness or Slurred Speech (Acute Stroke / CVA Signs)
    # -------------------------------------------------------------------------
    stroke_keywords = [
        "one-sided weakness", "one sided weakness", "onesided weakness",
        "weakness on one side", "weakness in right side", "weakness in left side",
        "weakness of right side", "weakness of left side", "facial droop",
        "face drooping", "face droop", "slurred speech", "slurring speech",
        "difficulty speaking", "inability to speak", "loss of speech", "aphasia",
        "dysarthria", "hemiparesis", "hemiplegia", "arm drift", "stroke",
        "sudden paralysis", "numbness on one side", "one side of face",
        "mouth drooping", "sudden loss of balance and speech"
    ]
    if _contains_any(combined_text, stroke_keywords):
        rule_desc = "RED_FLAG_STROKE_SIGNS: Acute focal neurological deficits (one-sided weakness, facial droop, or slurred speech)"
        fired_rules.append(rule_desc)
        rationales.append("Focal neurological findings indicative of acute cerebrovascular accident (Stroke / TIA).")

    # -------------------------------------------------------------------------
    # RULE 4: Severe Uncontrolled Bleeding (Active Hemorrhage)
    # -------------------------------------------------------------------------
    bleeding_keywords = [
        "severe uncontrolled bleeding", "uncontrolled bleeding", "massive bleeding",
        "profuse bleeding", "heavy bleeding", "bleeding heavily", "severe hemorrhage",
        "massive hemorrhage", "vomiting blood", "hematemesis", "coughing blood",
        "coughing up blood", "hemoptysis", "bleeding will not stop", "bleeding won't stop",
        "arterial bleeding", "gushing blood", "blood loss severe", "profuse blood"
    ]
    if _contains_any(combined_text, bleeding_keywords):
        rule_desc = "RED_FLAG_SEVERE_BLEEDING: Severe, massive, or uncontrolled active hemorrhage"
        fired_rules.append(rule_desc)
        rationales.append("Acute uncontrolled hemorrhage posing immediate risk of hypovolemic shock.")

    # -------------------------------------------------------------------------
    # RULE 5: Active Seizure (Status Epilepticus / Convulsions)
    # -------------------------------------------------------------------------
    seizure_keywords = [
        "active seizure", "seizure", "seizures", "convulsion", "convulsions",
        "status epilepticus", "grand mal", "tonic-clonic", "fits", "epileptic fit",
        "having a fit", "shaking uncontrollably and unresponsive", "continuous seizure"
    ]
    if _contains_any(combined_text, seizure_keywords):
        rule_desc = "RED_FLAG_ACTIVE_SEIZURE: Active, prolonged, or recurrent seizure / convulsive episode"
        fired_rules.append(rule_desc)
        rationales.append("Active or recent seizure activity requiring immediate airway protection and medical stabilization.")

    # -------------------------------------------------------------------------
    # RULE 6: Severe Allergic Reaction Signs (Anaphylaxis / Angioedema)
    # -------------------------------------------------------------------------
    allergy_keywords = [
        "severe allergic reaction", "anaphylaxis", "anaphylactic", "throat swelling",
        "swelling of throat", "swollen throat", "swelling in throat", "tongue swelling",
        "swollen tongue", "lip swelling", "swollen lips", "angioedema",
        "closing of airway", "airway closing", "airway swelling",
        "allergic reaction with breathing difficulty", "hives and cannot breathe",
        "hives and unable to breathe", "severe allergy"
    ]
    if _contains_any(combined_text, allergy_keywords):
        rule_desc = "RED_FLAG_SEVERE_ALLERGIC_REACTION: Severe allergic reaction / anaphylaxis symptoms"
        fired_rules.append(rule_desc)
        rationales.append("Anaphylactic airway compromise or acute angioedema with high risk of asphyxiation.")

    # -------------------------------------------------------------------------
    # Final Result Construction
    # -------------------------------------------------------------------------
    if fired_rules:
        return RedFlagEvaluation(
            is_emergency=True,
            primary_rule=fired_rules[0],
            fired_rules=fired_rules,
            clinical_rationale=" ".join(rationales)
        )
    else:
        return RedFlagEvaluation(
            is_emergency=False,
            primary_rule=None,
            fired_rules=[],
            clinical_rationale="No critical Tier 1 emergency red flags detected in deterministic rule evaluation."
        )
