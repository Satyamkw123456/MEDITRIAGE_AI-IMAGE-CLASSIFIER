from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
from app.schemas.intake import PatientIntakeCreate


@dataclass
class FollowUpQuestion:
    flag: str
    category: str  # "INCOMPLETE_FIELD" | "VAGUE_SYMPTOM" | "CONTRADICTION" | "IMPLAUSIBLE_VITAL" | "MISSING_RISK_FACTOR"
    question: str
    target_field: Optional[str] = None
    options: Optional[List[str]] = None
    is_blocking: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# Flag to Category Mapping
FLAG_CATEGORIES: Dict[str, str] = {
    # Incomplete Fields
    "CHIEF_COMPLAINT_TOO_BRIEF": "INCOMPLETE_FIELD",
    "MISSING_CHIEF_COMPLAINT": "INCOMPLETE_FIELD",
    "MISSING_DURATION": "INCOMPLETE_FIELD",
    "MISSING_SEVERITY": "INCOMPLETE_FIELD",
    "MISSING_BODY_LOCATION": "INCOMPLETE_FIELD",
    "MISSING_VITALS": "INCOMPLETE_FIELD",
    "PARTIAL_VITALS_RECORDED": "INCOMPLETE_FIELD",
    "MISSING_PREGNANCY_STATUS_APPLICABLE": "INCOMPLETE_FIELD",

    # Vague Symptoms
    "VAGUE_SYMPTOM_DESCRIPTION": "VAGUE_SYMPTOM",

    # Contradictions
    "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2": "CONTRADICTION",
    "HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN": "CONTRADICTION",
    "HARD_CONTRADICTION_CHEST_PAIN_TIMELINE": "CONTRADICTION",
    "HARD_CONTRADICTION_STROKE_SIGNS_VS_NO_NEURO": "CONTRADICTION",
    "CONTRADICTION_FEVER_VS_TEMPERATURE": "CONTRADICTION",
    "CONTRADICTION_FEVER_CLAIM_VS_NORMAL_TEMP": "CONTRADICTION",
    "CONTRADICTION_DURATION_VS_CHRONICITY": "CONTRADICTION",
    "CONTRADICTION_DURATION_VS_ACUTE_ONSET": "CONTRADICTION",
    "CONTRADICTION_PAIN_VS_SEVERITY": "CONTRADICTION",
    "CONTRADICTION_EXCRUCIATING_PAIN_VS_LOW_SEVERITY": "CONTRADICTION",
    "CONTRADICTION_COMPLAINT_VS_LOCATION": "CONTRADICTION",

    # Implausible Vitals
    "IMPLAUSIBLE_TEMPERATURE": "IMPLAUSIBLE_VITAL",
    "IMPLAUSIBLE_PULSE": "IMPLAUSIBLE_VITAL",
    "IMPLAUSIBLE_SPO2": "IMPLAUSIBLE_VITAL",
    "IMPLAUSIBLE_DURATION": "IMPLAUSIBLE_VITAL",

    # Missing Risk Factors
    "MISSING_COMORBIDITIES": "MISSING_RISK_FACTOR",
    "MISSING_MEDICATIONS": "MISSING_RISK_FACTOR",
    "MISSING_ALLERGIES": "MISSING_RISK_FACTOR",
}

BLOCKING_FLAGS = {
    "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2",
    "HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN",
    "HARD_CONTRADICTION_CHEST_PAIN_TIMELINE",
    "HARD_CONTRADICTION_STROKE_SIGNS_VS_NO_NEURO",
}


def generate_follow_up_for_flag(
    flag: str,
    payload: PatientIntakeCreate
) -> Optional[FollowUpQuestion]:
    """
    Generates a deterministic, clinically calibrated clarifying question for a specific quality flag.
    """
    category = FLAG_CATEGORIES.get(flag, "INCOMPLETE_FIELD")
    is_blocking = flag in BLOCKING_FLAGS
    complaint = (payload.chief_complaint or "").strip()
    duration = (payload.symptom_duration or "").strip()
    severity = payload.severity if payload.severity is not None else 5
    location = (payload.body_location or "").strip()
    vitals = payload.vitals
    temp = vitals.temperature if vitals and vitals.temperature is not None else None
    pulse = vitals.pulse if vitals and vitals.pulse is not None else None
    spo2 = vitals.spo2 if vitals and vitals.spo2 is not None else None

    # -------------------------------------------------------------
    # 1. INCOMPLETE FIELDS
    # -------------------------------------------------------------
    if flag == "CHIEF_COMPLAINT_TOO_BRIEF":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"Your chief complaint '{complaint}' is very brief. Could you describe what specific symptoms, sensations, or discomfort you are experiencing in more detail?",
            target_field="chief_complaint",
            options=None,
            is_blocking=is_blocking
        )
    elif flag == "MISSING_CHIEF_COMPLAINT":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Please provide a description of your primary symptom or reason for seeking medical advice today.",
            target_field="chief_complaint",
            options=None,
            is_blocking=is_blocking
        )
    elif flag == "MISSING_DURATION":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="How long have you been experiencing this primary symptom? Please specify the duration (e.g., minutes, hours, or days).",
            target_field="symptom_duration",
            options=["Less than 1 hour", "1-6 hours", "6-24 hours", "1-3 days", "4-7 days", "More than 1 week", "Chronic / Months"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_SEVERITY":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="On a scale of 1 to 10 (where 1 is mild and 10 is unbearable), how severe is your pain or discomfort?",
            target_field="severity",
            options=["1 - Very Mild", "2", "3", "4", "5 - Moderate", "6", "7", "8 - Severe", "9", "10 - Worst Possible"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_BODY_LOCATION":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Where in your body are you primarily feeling this symptom or discomfort (e.g., Chest, Head, Abdomen, Back, Legs)?",
            target_field="body_location",
            options=["Chest", "Head / Neck", "Abdomen", "Back / Spine", "Arms / Shoulders", "Legs / Knees / Feet", "Generalized / Whole Body"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_VITALS":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Do you have access to a thermometer, blood pressure monitor, or pulse oximeter to record your vital signs right now?",
            target_field="vitals",
            options=["Yes, I can measure them now", "No vitals monitoring equipment available"],
            is_blocking=is_blocking
        )
    elif flag == "PARTIAL_VITALS_RECORDED":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="If possible, please measure and provide any other available vital signs (such as temperature, pulse, BP, or oxygen saturation) to help us evaluate your condition.",
            target_field="vitals",
            options=["I will add additional vitals", "No further instruments available"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_PREGNANCY_STATUS_APPLICABLE":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Please specify your pregnancy status as this is essential for medication safety and clinical triage routing.",
            target_field="pregnancy_status",
            options=["Not Pregnant", "Trimester 1", "Trimester 2", "Trimester 3", "Unsure / Possible"],
            is_blocking=is_blocking
        )

    # -------------------------------------------------------------
    # 2. VAGUE SYMPTOMS
    # -------------------------------------------------------------
    elif flag == "VAGUE_SYMPTOM_DESCRIPTION":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You described feeling '{complaint}', which is broad. Could you describe the specific sensations you have (e.g., sharp pain, dull ache, burning, dizziness, nausea, fever, or breathlessness)?",
            target_field="chief_complaint",
            options=["Aching or sharp pain", "Dizziness or unsteadiness", "Breathing difficulty", "Fever or chills", "Stomach upset or nausea", "Extreme fatigue / weakness", "Other specific symptom"],
            is_blocking=is_blocking
        )

    # -------------------------------------------------------------
    # 3. CONTRADICTIONS
    # -------------------------------------------------------------
    elif flag == "HARD_CONTRADICTION_BREATHING_VS_CRITICAL_SPO2":
        spo2_str = f"{spo2}%" if spo2 is not None else "below 90%"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"We noticed conflicting clinical information: you reported normal breathing, but recorded an oxygen level (SpO2) of {spo2_str}, which indicates potential hypoxemia. Are you having any shortness of breath, rapid breathing, or dizziness?",
            target_field="vitals.spo2",
            options=["Yes, I am feeling short of breath / unwell", "No breathlessness, but will re-check pulse oximeter", "Pulse oximeter reading was verified"],
            is_blocking=is_blocking
        )
    elif flag == "HARD_CONTRADICTION_CHEST_LOCATION_VS_NO_CHEST_PAIN":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You listed 'Chest' as the primary symptom location with high severity ({severity}/10), but indicated 'no chest pain'. What specific sensations are you experiencing in your chest (e.g., tightness, pressure, burning, palpitations, or muscle soreness)?",
            target_field="chief_complaint",
            options=["Chest tightness or heaviness", "Burning / indigestion sensation", "Rapid heart beating / fluttering", "Muscle soreness from strain", "Selected chest by mistake"],
            is_blocking=is_blocking
        )
    elif flag == "HARD_CONTRADICTION_CHEST_PAIN_TIMELINE":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="You mentioned 'crushing chest pain' alongside a chronic timeline and low severity. Are you having active, acute chest pain or pressure right now?",
            target_field="severity",
            options=["Yes, active acute chest pain right now", "No active acute pain, discussing past history", "Mild chronic ache only"],
            is_blocking=is_blocking
        )
    elif flag == "HARD_CONTRADICTION_STROKE_SIGNS_VS_NO_NEURO":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Conflicting neurological symptoms were recorded regarding weakness or speech changes. Are you or the patient experiencing any sudden facial drooping, arm/leg weakness, or difficulty speaking?",
            target_field="chief_complaint",
            options=["Yes, sudden weakness or speech difficulty present", "No weakness or speech difficulty (cleared)", "Chronic long-standing weakness from prior stroke"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_FEVER_VS_TEMPERATURE":
        temp_str = f"{temp}°F" if temp is not None else "100.4°F or higher"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You reported having 'no fever', but your recorded temperature is {temp_str}. Are you experiencing chills, sweating, or did you recently take fever-reducing medication (e.g., Paracetamol)?",
            target_field="vitals.temperature",
            options=["Yes, feeling feverish / chills", "Took fever medication recently", "Thermometer reading was taken incorrectly"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_FEVER_CLAIM_VS_NORMAL_TEMP":
        temp_str = f"{temp}°F" if temp is not None else "normal"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You described having a severe or high fever, but your measured temperature is {temp_str}. When was this temperature taken, and are you having hot flashes or chills?",
            target_field="vitals.temperature",
            options=["Temperature measured just now", "Feeling hot/chilly despite normal reading", "Took antipyretic medication earlier"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_DURATION_VS_CHRONICITY":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You indicated an acute onset duration ('{duration}'), but described a condition lasting for years. Is this a brand-new sudden flare-up or your usual baseline symptom?",
            target_field="symptom_duration",
            options=["Sudden acute flare-up of symptoms", "Stable chronic baseline condition"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_DURATION_VS_ACUTE_ONSET":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You indicated a chronic duration ('{duration}'), but mentioned symptoms starting just minutes ago. Please clarify when this acute episode began.",
            target_field="symptom_duration",
            options=["Started within the last few minutes/hours", "Ongoing for weeks or months"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_PAIN_VS_SEVERITY":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You reported having 'no pain', but selected a high severity score of {severity}/10. Please clarify if you are experiencing severe distress, shortness of breath, or non-pain discomfort.",
            target_field="severity",
            options=["Experiencing severe non-pain distress (e.g. breathlessness)", "Severity score was entered too high by mistake", "Experiencing severe pain"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_EXCRUCIATING_PAIN_VS_LOW_SEVERITY":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You described extreme or unbearable pain, but marked a severity score of {severity}/10. Would you rate your current pain level higher on a 1 to 10 scale?",
            target_field="severity",
            options=["Yes, rate pain as 7-10 (Severe/Excruciating)", "Keep severity at current mild level (1-3)"],
            is_blocking=is_blocking
        )
    elif flag == "CONTRADICTION_COMPLAINT_VS_LOCATION":
        loc_str = location if location else "the selected anatomical area"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"You reported a headache/migraine but selected '{loc_str}' as the primary body location. Did you experience a fall, injury, or are these two separate symptoms?",
            target_field="body_location",
            options=["Primary symptom is Head / Neck pain", "Related to a fall or trauma", "Two separate concurrent issues"],
            is_blocking=is_blocking
        )

    # -------------------------------------------------------------
    # 4. IMPLAUSIBLE VITALS
    # -------------------------------------------------------------
    elif flag == "IMPLAUSIBLE_TEMPERATURE":
        temp_str = f"{temp}°F" if temp is not None else "the entered temperature"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"Your recorded body temperature ({temp_str}) is outside typical physiological limits. Please re-check with your thermometer and enter the updated reading.",
            target_field="vitals.temperature",
            options=None,
            is_blocking=is_blocking
        )
    elif flag == "IMPLAUSIBLE_PULSE":
        pulse_str = f"{pulse} bpm" if pulse is not None else "the entered pulse"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"Your recorded pulse rate ({pulse_str}) appears outside the usual physiological range. Please re-take your pulse at rest and enter the corrected value.",
            target_field="vitals.pulse",
            options=None,
            is_blocking=is_blocking
        )
    elif flag == "IMPLAUSIBLE_SPO2":
        spo2_str = f"{spo2}%" if spo2 is not None else "the entered SpO2"
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question=f"Your recorded oxygen saturation ({spo2_str}) is outside typical measurement limits. Please adjust your pulse oximeter, warm your hands, and re-enter the reading.",
            target_field="vitals.spo2",
            options=None,
            is_blocking=is_blocking
        )
    elif flag == "IMPLAUSIBLE_DURATION":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="The entered symptom duration format contains negative or invalid values. Please enter the number of hours or days you have had this symptom.",
            target_field="symptom_duration",
            options=None,
            is_blocking=is_blocking
        )

    # -------------------------------------------------------------
    # 5. MISSING RISK FACTORS
    # -------------------------------------------------------------
    elif flag == "MISSING_COMORBIDITIES":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Do you have any diagnosed chronic medical conditions (such as Hypertension, Diabetes, COPD, Asthma, or Heart Disease), or should we record 'None Known'?",
            target_field="comorbidities",
            options=["None Known", "Hypertension", "Diabetes", "Asthma / COPD", "Heart Disease", "Chronic Kidney Disease"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_MEDICATIONS":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Are you currently taking any daily prescription medications, blood thinners, or over-the-counter treatments? If none, please confirm 'No medications'.",
            target_field="current_medications",
            options=["No daily medications", "Taking blood pressure / diabetes medications", "Taking blood thinners (e.g. Aspirin, Warfarin)", "Other medications"],
            is_blocking=is_blocking
        )
    elif flag == "MISSING_ALLERGIES":
        return FollowUpQuestion(
            flag=flag,
            category=category,
            question="Do you have any known drug allergies (e.g., Penicillin, Sulfa drugs, Aspirin/NSAIDs), food allergies, or 'No Known Allergies'?",
            target_field="allergies",
            options=["No Known Allergies", "Penicillin / Antibiotics", "Aspirin / NSAIDs", "Sulfa drugs", "Other allergy"],
            is_blocking=is_blocking
        )

    return None


def generate_follow_up_questions(
    flags: List[str],
    payload: PatientIntakeCreate
) -> List[FollowUpQuestion]:
    """
    Generates an ordered list of specific follow-up questions corresponding to the detected quality flags.
    Blocking flags (hard contradictions) are prioritized first.
    """
    questions: List[FollowUpQuestion] = []
    seen_flags = set()

    # Prioritize blocking flags first
    sorted_flags = sorted(flags, key=lambda f: (0 if f in BLOCKING_FLAGS else 1, f))

    for flag in sorted_flags:
        if flag in seen_flags:
            continue
        seen_flags.add(flag)

        q = generate_follow_up_for_flag(flag, payload)
        if q:
            questions.append(q)

    return questions
