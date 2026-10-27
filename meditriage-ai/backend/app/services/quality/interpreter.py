import re
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass, field
from app.schemas.intake import PatientIntakeCreate
from app.services.quality.follow_up import generate_follow_up_questions, FollowUpQuestion


@dataclass
class QualityEvaluationResult:
    completeness_score: float
    consistency_score: float
    flags: List[str] = field(default_factory=list)
    requires_clarification: bool = False
    clarifying_question: Optional[str] = None
    structured_category: Optional[str] = None
    specificity_status: str = "SPECIFIC"  # "SPECIFIC" | "VAGUE" | "UNCLASSIFIED"
    follow_up_questions: List[FollowUpQuestion] = field(default_factory=list)


# Standard Clinical Vocabulary / Anatomical Categories
CLINICAL_CATEGORIES: Dict[str, List[str]] = {
    "CARDIOVASCULAR": [
        "chest pain", "angina", "chest pressure", "chest tightness", "palpitations",
        "heart racing", "irregular heartbeat", "radiating pain", "cardiac"
    ],
    "RESPIRATORY": [
        "shortness of breath", "breathlessness", "difficulty breathing", "dyspnea",
        "wheezing", "cough", "coughing", "choking", "stridor", "rapid breathing"
    ],
    "NEUROLOGICAL": [
        "stroke", "slurred speech", "facial droop", "arm weakness", "leg weakness",
        "one-sided weakness", "hemiparesis", "numbness", "dizziness", "vertigo",
        "confusion", "altered mental state", "seizure", "convulsions", "fainting",
        "syncope", "headache", "migraine", "loss of consciousness"
    ],
    "GASTROINTESTINAL": [
        "abdominal pain", "stomach pain", "belly pain", "nausea", "vomiting",
        "diarrhea", "constipation", "blood in stool", "hematemesis", "melena",
        "cramping", "acid reflux", "heartburn", "jaundice"
    ],
    "MUSCULOSKELETAL": [
        "joint pain", "knee pain", "hip pain", "shoulder pain", "back pain",
        "neck pain", "stiffness", "swelling", "arthritis", "sprain", "fracture",
        "muscle ache", "difficulty walking"
    ],
    "SYSTEMIC_INFECTIOUS": [
        "fever", "high fever", "chills", "rigors", "sweats", "night sweats",
        "fatigue", "body ache", "malaise", "sepsis", "lethargy"
    ],
    "ENT_OPHTHALMOLOGY": [
        "sore throat", "throat pain", "ear pain", "earache", "hearing loss",
        "vision loss", "blurred vision", "eye pain", "runny nose", "congestion"
    ],
    "DERMATOLOGICAL": [
        "rash", "hives", "urticaria", "itching", "pruritus", "skin lesion",
        "swelling", "angioedema", "redness", "erythema"
    ],
    "UROLOGICAL": [
        "burning urination", "dysuria", "blood in urine", "hematuria",
        "frequent urination", "urinary retention", "flank pain"
    ]
}

# Overly Vague Symptom Phrases
VAGUE_PHRASES: List[str] = [
    "not feeling well",
    "feeling sick",
    "just sick",
    "unwell",
    "feeling bad",
    "something wrong",
    "problem",
    "issue",
    "ill",
    "don't know",
    "hurts all over",
    "weird feeling",
    "bad feeling",
    "uncomfortable"
]


def _evaluate_completeness(
    payload: PatientIntakeCreate
) -> Tuple[float, List[str]]:
    """
    Computes Completeness Score (0.0 to 1.0) and records missing-field flags.
    Weights:
    - Chief complaint informative (>= 5 chars): 0.20
    - Symptom duration present: 0.15
    - Severity present & valid (1-10): 0.15
    - Body location present: 0.10
    - Vitals coverage: up to 0.20 (0.08 for 1 vital, 0.12 for 2, 0.16 for 3, 0.20 for 4)
    - Clinical history & risk factors (comorbidities, meds, allergies): up to 0.20 (0.07 + 0.07 + 0.06)
    """
    score = 0.0
    flags: List[str] = []

    # 1. Chief Complaint (0.20)
    complaint_clean = (payload.chief_complaint or "").strip()
    if len(complaint_clean) >= 5:
        score += 0.20
    elif len(complaint_clean) > 0:
        score += 0.10
        flags.append("CHIEF_COMPLAINT_TOO_BRIEF")
    else:
        flags.append("MISSING_CHIEF_COMPLAINT")

    # 2. Duration (0.15)
    duration_clean = (payload.symptom_duration or "").strip()
    if len(duration_clean) >= 1:
        score += 0.15
    else:
        flags.append("MISSING_DURATION")

    # 3. Severity (0.15)
    if payload.severity is not None and 1 <= payload.severity <= 10:
        score += 0.15
    else:
        flags.append("MISSING_SEVERITY")

    # 4. Body Location (0.10)
    loc_clean = (payload.body_location or "").strip()
    if len(loc_clean) >= 2:
        score += 0.10
    else:
        flags.append("MISSING_BODY_LOCATION")

    # 5. Vitals Coverage (0.20 max)
    vitals = payload.vitals
    vital_count = 0
    if vitals:
        if vitals.temperature is not None:
            vital_count += 1
        if vitals.pulse is not None:
            vital_count += 1
        if vitals.blood_pressure is not None and len(vitals.blood_pressure.strip()) > 0:
            vital_count += 1
        if vitals.spo2 is not None:
            vital_count += 1

    if vital_count == 4:
        score += 0.20
    elif vital_count == 3:
        score += 0.16
        flags.append("PARTIAL_VITALS_RECORDED")
    elif vital_count == 2:
        score += 0.12
        flags.append("PARTIAL_VITALS_RECORDED")
    elif vital_count == 1:
        score += 0.08
        flags.append("PARTIAL_VITALS_RECORDED")
    else:
        flags.append("MISSING_VITALS")

    # 6. Clinical History Coverage (0.20 max)
    # Comorbidities (0.07)
    if payload.comorbidities is not None:
        if isinstance(payload.comorbidities, list):
            has_comorbidities = len(payload.comorbidities) > 0
        else:
            has_comorbidities = len(str(payload.comorbidities).strip()) > 0
        if has_comorbidities:
            score += 0.07
        else:
            flags.append("MISSING_COMORBIDITIES")
    else:
        flags.append("MISSING_COMORBIDITIES")

    # Medications (0.07)
    meds_clean = (payload.current_medications or "").strip()
    if len(meds_clean) > 0:
        score += 0.07
    else:
        flags.append("MISSING_MEDICATIONS")

    # Allergies (0.06)
    allergies_clean = (payload.allergies or "").strip()
    if len(allergies_clean) > 0:
        score += 0.06
    else:
        flags.append("MISSING_ALLERGIES")

    # 7. Female Pregnancy Status Check (Applicable between ages 12 and 55)
    if payload.sex == "Female" and 12 <= payload.age <= 55:
        if not payload.pregnancy_status or not payload.pregnancy_status.strip():
            flags.append("MISSING_PREGNANCY_STATUS_APPLICABLE")
            score = max(0.0, score - 0.05)

    return min(1.0, round(score, 2)), flags


def _evaluate_specificity(
    payload: PatientIntakeCreate
) -> Tuple[str, Optional[str], List[str]]:
    """
    Evaluates whether the free-text description maps to structured clinical vocabulary
    or is overly vague.
    """
    text = (payload.chief_complaint or "").lower()
    if payload.additional_symptoms:
        for s in payload.additional_symptoms:
            text += " " + (s.symptom or "").lower()

    flags: List[str] = []
    matched_category: Optional[str] = None

    # Check for category matches
    for cat_name, keywords in CLINICAL_CATEGORIES.items():
        for kw in keywords:
            if kw in text:
                matched_category = cat_name
                break
        if matched_category:
            break

    # Check for vague phrases
    is_vague = False
    for vp in VAGUE_PHRASES:
        if vp in text:
            # If it only contains vague phrase and no specific category
            if not matched_category or len(text.strip()) < 20:
                is_vague = True
                break

    if is_vague:
        flags.append("VAGUE_SYMPTOM_DESCRIPTION")
        return "VAGUE", matched_category, flags
    elif matched_category:
        return "SPECIFIC", matched_category, flags
    else:
        return "UNCLASSIFIED", None, flags


def _evaluate_consistency_and_plausibility(
    payload: PatientIntakeCreate
) -> Tuple[float, List[str], bool, Optional[str]]:
    """
    Computes Consistency Score (0.0 to 1.0), detects cross-field contradictions,
    plausibility violations, and identifies hard red-flag contradictions.
    
    Returns:
        (consistency_score, flags, requires_clarification, clarifying_question)
    """
    score = 1.0
    flags: List[str] = []
    requires_clarification = False
    clarifying_question: Optional[str] = None

    complaint_lower = (payload.chief_complaint or "").lower()
    duration_lower = (payload.symptom_duration or "").lower()
    location_lower = (payload.body_location or "").lower()
    vitals = payload.vitals

    # All text combined for symptom context
    combined_symptom_text = complaint_lower
    if payload.additional_symptoms:
        for s in payload.additional_symptoms:
            combined_symptom_text += " " + (s.symptom or "").lower()

    # -------------------------------------------------------------
    # 1. FEVER CONTRADICTION
    # -------------------------------------------------------------
    # Stating "no fever" / "afebrile" while temp >= 100.4°F
    no_fever_phrases = ["no fever", "afebrile", "without fever", "no temperature", "temp normal"]
    has_no_fever_claim = any(p in combined_symptom_text for p in no_fever_phrases)

    if vitals and vitals.temperature is not None:
        if has_no_fever_claim and vitals.temperature >= 100.4:
            score -= 0.30
            flags.append("CONTRADICTION_FEVER_VS_TEMPERATURE")
            if not clarifying_question:
                clarifying_question = (
                    f"You reported having 'no fever', but your recorded temperature is {vitals.temperature}°F. "
                    "Please clarify if you are experiencing chills, fever, or took antipyretic medication recently."
                )

        # High fever claim while temperature is sub-normal or normal (< 98.6°F)
        high_fever_phrases = ["high fever", "burning fever", "chills with severe fever", "103 fever"]
        has_high_fever_claim = any(p in combined_symptom_text for p in high_fever_phrases)
        if has_high_fever_claim and vitals.temperature < 98.6:
            score -= 0.20
            flags.append("CONTRADICTION_FEVER_CLAIM_VS_NORMAL_TEMP")

    # -------------------------------------------------------------
    # 2. DURATION VS ACUITY / CHRONICITY CONTRADICTION
    # -------------------------------------------------------------
    acute_duration_patterns = [r"\b\d+\s*min", r"\b\d+\s*hour", r"\b1\s*hour", r"\b2\s*hours", r"\b3\s*hours", r"\bjust started\b", r"\bsudden\b"]
    is_acute_duration = any(re.search(p, duration_lower) for p in acute_duration_patterns)
    
    chronic_duration_patterns = [r"\b\d+\s*year", r"\b\d+\s*month", r"\bchronic\b", r"\blong[-\s]term\b", r"\byears\b", r"\bmonths\b"]
    is_chronic_duration = any(re.search(p, duration_lower) for p in chronic_duration_patterns)

    # Acute duration marked but text claims chronic long-standing condition
    if is_acute_duration and any(w in combined_symptom_text for w in ["chronic for years", "ongoing for years", "past 5 years", "chronic condition for decades"]):
        score -= 0.25
        flags.append("CONTRADICTION_DURATION_VS_CHRONICITY")
    
    # Chronic duration marked but text claims sudden onset minutes ago
    if is_chronic_duration and any(w in combined_symptom_text for w in ["just started 5 minutes ago", "sudden acute onset just now", "started 10 minutes ago"]):
        score -= 0.25
        flags.append("CONTRADICTION_DURATION_VS_ACUTE_ONSET")

    # -------------------------------------------------------------
    # 3. PAIN / SEVERITY CONTRADICTION
    # -------------------------------------------------------------
    no_pain_phrases = ["no pain", "painless", "zero pain", "not painful", "not in pain"]
    has_no_pain_claim = any(p in combined_symptom_text for p in no_pain_phrases)

    if has_no_pain_claim and payload.severity >= 7:
        score -= 0.30
        flags.append("CONTRADICTION_PAIN_VS_SEVERITY")
        if not clarifying_question:
            clarifying_question = (
                f"You reported '{[p for p in no_pain_phrases if p in combined_symptom_text][0]}', but selected a high severity score of {payload.severity}/10. "
                "Please clarify if you are experiencing severe distress or pain."
            )

    extreme_pain_phrases = ["worst pain of my life", "unbearable agony", "10/10 pain", "excruciating pain"]
    has_extreme_pain_claim = any(p in combined_symptom_text for p in extreme_pain_phrases)
    if has_extreme_pain_claim and payload.severity <= 2:
        score -= 0.25
        flags.append("CONTRADICTION_EXCRUCIATING_PAIN_VS_LOW_SEVERITY")

    # -------------------------------------------------------------
    # 4. HARD RED-FLAG CONTRADICTION CHECKS (BLOCK PROGRESSION)
    # -------------------------------------------------------------
    
    # A. RESPIRATORY CONTRADICTION (SpO2 < 90% vs "Normal Breathing" / "No shortness of breath")
    normal_breathing_phrases = [
        "normal breathing", "breathing normally", "no shortness of breath",
        "no breathing difficulty", "no breathlessness", "breathing is fine", "lungs clear"
    ]
    has_normal_breathing_claim = any(p in combined_symptom_text for p in normal_breathing_phrases)

    if vitals and vitals.spo2 is not None and vitals.spo2 < 90.0:
        if has_normal_breathing_claim:
            score -= 0.40
            flags.append("HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2")
            requires_clarification = True
            clarifying_question = (
                f"We noticed conflicting clinical information: you reported '{[p for p in normal_breathing_phrases if p in combined_symptom_text][0]}', "
                f"but recorded an oxygen saturation (SpO2) of {vitals.spo2}%, which indicates potential hypoxemia. "
                "Please clarify if you are experiencing any shortness of breath, rapid breathing, or dizziness so we can properly route your care."
            )

    # B. CHEST PAIN / CARDIAC CONTRADICTION
    # Case has location = chest and severity >= 7, but explicitly claims "no chest pain" or "no cardiac issue"
    no_chest_pain_phrases = ["no chest pain", "chest feels fine", "not heart related", "no chest pressure"]
    has_no_chest_pain_claim = any(p in combined_symptom_text for p in no_chest_pain_phrases)
    is_chest_location = "chest" in location_lower

    if is_chest_location and payload.severity >= 7 and has_no_chest_pain_claim:
        score -= 0.40
        flags.append("HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN")
        requires_clarification = True
        if not clarifying_question:
            clarifying_question = (
                "You listed 'Chest' as the primary symptom location with high severity, but indicated 'no chest pain'. "
                "Please clarify the exact sensations you are feeling in your chest (e.g. pressure, tightness, burning, or muscle soreness)."
            )

    # Patient over 40 reporting crushing chest pain in text, but duration marked "5 years" with zero acute discomfort
    if payload.age > 40 and "crushing chest pain" in combined_symptom_text and is_chronic_duration and payload.severity <= 1:
        score -= 0.35
        flags.append("HARD_CONTRADICTION_CHEST_PAIN_TIMELINE")
        requires_clarification = True
        if not clarifying_question:
            clarifying_question = (
                "You mentioned 'crushing chest pain' alongside a chronic duration and minimal severity score. "
                "Please clarify if you are having acute, active chest pain right now."
            )

    # C. STROKE / NEUROLOGICAL CONTRADICTION
    stroke_phrases = ["slurred speech", "facial droop", "one-sided weakness", "arm weakness", "sudden weakness"]
    has_stroke_claim = any(p in combined_symptom_text for p in stroke_phrases)
    no_neuro_phrases = ["no neurological symptoms", "no weakness", "normal speech", "no paralysis"]
    has_no_neuro_claim = any(p in combined_symptom_text for p in no_neuro_phrases)

    if has_stroke_claim and has_no_neuro_claim:
        score -= 0.40
        flags.append("HARD_CONTRADICTION_STROKE_SIGNS_VS_NO_NEURO")
        requires_clarification = True
        if not clarifying_question:
            clarifying_question = (
                "Conflicting neurological symptoms were recorded regarding weakness or slurred speech. "
                "Please clarify if you or the patient are experiencing any sudden face, arm, or leg weakness, or difficulty speaking."
            )

    # -------------------------------------------------------------
    # 5. ANATOMICAL / LOCATION CONTRADICTIONS
    # -------------------------------------------------------------
    if "headache" in complaint_lower or "migraine" in complaint_lower:
        if location_lower in ["foot", "ankle", "toe", "knee"] and "fall" not in combined_symptom_text:
            score -= 0.15
            flags.append("CONTRADICTION_COMPLAINT_VS_LOCATION")

    # -------------------------------------------------------------
    # 6. PHYSIOLOGICAL PLAUSIBILITY CHECKS
    # -------------------------------------------------------------
    if vitals:
        # Temperature
        if vitals.temperature is not None:
            if vitals.temperature < 88.0 or vitals.temperature > 108.5:
                score -= 0.20
                flags.append("IMPLAUSIBLE_TEMPERATURE")
        
        # Pulse
        if vitals.pulse is not None:
            if vitals.pulse < 30 or vitals.pulse > 230:
                score -= 0.20
                flags.append("IMPLAUSIBLE_PULSE")
        
        # SpO2
        if vitals.spo2 is not None:
            if vitals.spo2 < 50.0 or vitals.spo2 > 100.0:
                score -= 0.20
                flags.append("IMPLAUSIBLE_SPO2")

    # Implausible duration format
    if "minus" in duration_lower or "- " in duration_lower:
        score -= 0.15
        flags.append("IMPLAUSIBLE_DURATION")

    final_consistency = max(0.0, min(1.0, round(score, 2)))
    return final_consistency, flags, requires_clarification, clarifying_question


def evaluate_intake_quality(
    payload: PatientIntakeCreate
) -> QualityEvaluationResult:
    """
    Main entry point for the Quality Interpretation Module.
    Executes immediately after intake submission, before Tier-1 Red-Flag check
    and before Tier-2 Triage scoring.
    """
    # 1. Completeness Check
    completeness_score, completeness_flags = _evaluate_completeness(payload)

    # 2. Specificity Check
    specificity_status, structured_category, specificity_flags = _evaluate_specificity(payload)

    # 3. Consistency, Plausibility, and Hard Red-Flag Contradiction Check
    consistency_score, consistency_flags, requires_clarification, clarifying_question = (
        _evaluate_consistency_and_plausibility(payload)
    )

    # Combine all flags
    all_flags = completeness_flags + specificity_flags + consistency_flags

    # 4. Generate Deterministic Follow-Up Clarifying Questions
    follow_up_questions = generate_follow_up_questions(all_flags, payload)

    # If requires clarification and no specific single question set, use the primary blocking question
    if requires_clarification and not clarifying_question and follow_up_questions:
        blocking_q = next((q for q in follow_up_questions if q.is_blocking), follow_up_questions[0])
        clarifying_question = blocking_q.question

    return QualityEvaluationResult(
        completeness_score=completeness_score,
        consistency_score=consistency_score,
        flags=all_flags,
        requires_clarification=requires_clarification,
        clarifying_question=clarifying_question,
        structured_category=structured_category,
        specificity_status=specificity_status,
        follow_up_questions=follow_up_questions
    )
