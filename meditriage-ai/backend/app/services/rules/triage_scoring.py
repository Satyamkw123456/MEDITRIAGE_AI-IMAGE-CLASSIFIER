import re
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Union

_SYNONYMS_FILE = Path(__file__).resolve().parent / "symptom_synonyms.json"
_SYNONYMS = {}
if _SYNONYMS_FILE.exists():
    try:
        with open(_SYNONYMS_FILE, "r", encoding="utf-8") as f:
            _SYNONYMS = json.load(f)
    except Exception:
        _SYNONYMS = {}


def _matches_pattern(phrase: str, text: str) -> bool:
    """Matches a word or phrase with strict word boundaries to prevent substring false positives."""
    if not phrase or not text:
        return False
    phrase_clean = phrase.strip()
    if phrase_clean.lower() == "fall":
        # Specific token boundary preventing matches like 'waterfall'
        return bool(re.search(r"\bfall(?:s|en|ing)?\b", text, re.IGNORECASE))
    pattern = r"\b" + re.escape(phrase_clean) + r"\b"
    return bool(re.search(pattern, text, re.IGNORECASE))


def _matches_any(phrases: List[str], text: str) -> bool:
    for p in phrases:
        if _matches_pattern(p, text):
            return True
    return False


@dataclass
class TriageDriver:
    points: float
    description: str


@dataclass
class TriageScoreResult:
    risk_score: float
    triage_level: str  # 'Urgent', 'Routine', 'Self-Care Info'
    explanation: str
    drivers: List[TriageDriver] = field(default_factory=list)


def _parse_bp(bp_str: Optional[str]):
    if not bp_str:
        return None, None
    match = re.match(r"^(\d{2,3})/(\d{2,3})$", bp_str.strip())
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None


def _parse_duration_hours(duration_str: Optional[str]) -> Optional[float]:
    """Estimates symptom duration in hours from free text."""
    if not duration_str:
        return None
    d = duration_str.lower().strip()
    
    if "< 30" in d or "30 min" in d or "15 min" in d or "minute" in d:
        return 0.5
    
    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hour|hr)", d)
    if hour_match:
        return float(hour_match.group(1))
    
    day_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:day|d)", d)
    if day_match:
        return float(day_match.group(1)) * 24.0
    
    week_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:week|wk)", d)
    if week_match:
        return float(week_match.group(1)) * 168.0
    
    month_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:month|mo)", d)
    if month_match:
        return float(month_match.group(1)) * 720.0
    
    if "hour" in d:
        return 2.0
    if "day" in d:
        return 24.0
    if "week" in d:
        return 168.0
    
    return None


def calculate_triage_score(
    chief_complaint: str,
    severity: int,
    symptom_duration: str,
    body_location: str,
    age: int,
    comorbidities: Optional[Union[List[str], str]] = None,
    temperature: Optional[float] = None,
    pulse: Optional[int] = None,
    blood_pressure: Optional[str] = None,
    spo2: Optional[float] = None,
    additional_symptoms: Optional[List[str]] = None
) -> TriageScoreResult:
    """
    Computes an explainable, weighted risk score and maps it to:
    - 'Urgent' (Risk Score >= 60)
    - 'Routine' (30 <= Risk Score < 60)
    - 'Self-Care Info' (Risk Score < 30)

    Weights:
    1. Pain & Severity (0-25 pts)
    2. Symptom Nature & Anatomical Risk (0-25 pts)
    3. Physiological Vitals Abnormalities (0-25 pts)
    4. Duration & Acuity (0-10 pts)
    5. Geriatric Age & Comorbidities (0-15 pts)
    """
    drivers: List[TriageDriver] = []
    text_combined = f"{chief_complaint} {' '.join(additional_symptoms or [])} {body_location}".lower()

    # -------------------------------------------------------------
    # 1. Severity & Pain Score (0 to 25 pts)
    # -------------------------------------------------------------
    sev = max(1, min(10, severity))
    if sev >= 8:
        drivers.append(TriageDriver(25.0, f"High pain/severity level ({sev}/10)"))
    elif sev >= 6:
        drivers.append(TriageDriver(18.0, f"Moderate-to-high severity level ({sev}/10)"))
    elif sev >= 4:
        drivers.append(TriageDriver(14.0, f"Moderate severity level ({sev}/10)"))
    else:
        drivers.append(TriageDriver(4.0, f"Mild symptom severity ({sev}/10)"))

    # -------------------------------------------------------------
    # 2. Symptom Nature & Anatomical Risk (0 to 25 pts)
    # -------------------------------------------------------------
    symptom_pts = 0.0
    symptom_reasons = []

    abdominal_keywords = list(set(["abdomen", "abdominal", "stomach", "belly", "appendix", "gallbladder", "cramp", "vomiting", "nausea"] + _SYNONYMS.get("abdominal_pain", [])))
    respiratory_keywords = list(set(["cough", "wheeze", "wheezing", "bronchitis", "phlegm", "congestion", "throat", "breath"] + _SYNONYMS.get("shortness_of_breath", [])))
    neuro_keywords = list(set(["dizzy", "dizziness", "vertigo", "fall", "unsteady", "confused", "headache"] + _SYNONYMS.get("dizziness_vertigo", []) + _SYNONYMS.get("confusion", []) + _SYNONYMS.get("fall", []) + _SYNONYMS.get("headache", [])))
    neuro_acute_keywords = list(set(["fall", "unsteady", "vertigo", "loss of balance"] + _SYNONYMS.get("fall", []) + _SYNONYMS.get("dizziness_vertigo", [])))
    systemic_keywords = list(set(["fever", "chills", "sweats", "shivering", "malaise", "fatigue"] + _SYNONYMS.get("fever", []) + _SYNONYMS.get("weakness", [])))
    urinary_keywords = ["urinary", "urine", "burning", "dysuria", "flank", "kidney", "bladder"]
    musculoskeletal_keywords = ["knee", "back", "joint", "shoulder", "hip", "neck", "spine", "muscle", "stiffness", "arthritis", "strain"]

    category_matches = []

    # Acute Abdominal / Visceral
    if _matches_any(abdominal_keywords, text_combined):
        if _matches_any(["severe", "sharp", "cramping", "acute", "constant"], text_combined):
            category_matches.append((18.0, "Acute or sharp abdominal/GI pain"))
        else:
            category_matches.append((12.0, "Abdominal discomfort or gastrointestinal symptoms"))

    # Respiratory / Wheezing (Non-emergency)
    if _matches_any(respiratory_keywords, text_combined):
        if _matches_any(["productive", "fever", "worsening", "shortness"], text_combined):
            category_matches.append((15.0, "Productive cough or worsening respiratory symptoms"))
        else:
            category_matches.append((8.0, "Mild upper respiratory / cough symptoms"))

    # Neurological / Dizziness / Confusion / Fall
    if _matches_any(neuro_keywords, text_combined):
        if _matches_any(neuro_acute_keywords, text_combined):
            category_matches.append((16.0, "Acute dizziness, vertigo, or fall hazard in older adult"))
        else:
            category_matches.append((10.0, "Headache or lightheadedness"))

    # Systemic / Febrile / Chills
    if _matches_any(systemic_keywords, text_combined):
        category_matches.append((12.0, "Systemic febrile / flu-like symptoms"))

    # Urinary / Flank
    if _matches_any(urinary_keywords, text_combined):
        category_matches.append((12.0, "Genitourinary burning or flank discomfort"))

    # Musculoskeletal / Joint / Back
    if _matches_any(musculoskeletal_keywords, text_combined):
        category_matches.append((10.0, "Musculoskeletal ache or joint stiffness"))

    if category_matches:
        category_matches.sort(key=lambda x: x[0], reverse=True)
        primary_score = category_matches[0][0]
        secondary_contrib = min(7.0, sum(s * 0.2 for s, _ in category_matches[1:]))
        symptom_pts = min(25.0, primary_score + secondary_contrib)
        symptom_reasons = [reason for _, reason in category_matches]
    else:
        symptom_pts = 4.0
        symptom_reasons = ["Localized superficial or minor symptom"]

    if symptom_reasons:
        drivers.append(TriageDriver(symptom_pts, "; ".join(symptom_reasons)))

    # -------------------------------------------------------------
    # 3. Physiological Vitals Deviations (0 to 25 pts)
    # -------------------------------------------------------------
    # Temperature
    if temperature is not None:
        if temperature >= 102.0:
            drivers.append(TriageDriver(10.0, f"High fever recorded ({temperature}°F)"))
        elif temperature >= 100.4:
            drivers.append(TriageDriver(6.0, f"Elevated temperature / low-grade fever ({temperature}°F)"))
        elif temperature < 95.0:
            drivers.append(TriageDriver(10.0, f"Hypothermia / low body temperature ({temperature}°F)"))

    # Pulse
    if pulse is not None:
        if pulse >= 115:
            drivers.append(TriageDriver(10.0, f"Marked tachycardia ({pulse} bpm)"))
        elif pulse >= 95:
            drivers.append(TriageDriver(6.0, f"Elevated resting heart rate ({pulse} bpm)"))
        elif pulse < 50:
            drivers.append(TriageDriver(8.0, f"Significant bradycardia ({pulse} bpm)"))

    # Blood Pressure
    systolic, diastolic = _parse_bp(blood_pressure)
    if systolic is not None and diastolic is not None:
        if systolic >= 170 or diastolic >= 105:
            drivers.append(TriageDriver(10.0, f"Stage 2 severe hypertension ({blood_pressure} mmHg)"))
        elif systolic >= 140 or diastolic >= 90:
            drivers.append(TriageDriver(5.0, f"Elevated blood pressure ({blood_pressure} mmHg)"))
        elif systolic < 90 or diastolic < 60:
            drivers.append(TriageDriver(10.0, f"Hypotension / low blood pressure ({blood_pressure} mmHg)"))

    # SpO2
    if spo2 is not None:
        if spo2 <= 92.0:
            drivers.append(TriageDriver(12.0, f"Borderline low oxygen saturation ({spo2}%)"))
        elif spo2 <= 94.0:
            drivers.append(TriageDriver(6.0, f"Mildly reduced oxygen saturation ({spo2}%)"))

    # -------------------------------------------------------------
    # 4. Duration & Acuity (0 to 10 pts)
    # -------------------------------------------------------------
    duration_hours = _parse_duration_hours(symptom_duration)
    if duration_hours is not None:
        if duration_hours <= 6.0:
            drivers.append(TriageDriver(10.0, f"Acute sudden onset ({symptom_duration})"))
        elif duration_hours <= 24.0:
            drivers.append(TriageDriver(7.0, f"Recent acute onset ({symptom_duration})"))
        elif duration_hours <= 72.0:
            drivers.append(TriageDriver(5.0, f"Subacute onset ({symptom_duration})"))
        elif duration_hours <= 168.0:
            drivers.append(TriageDriver(4.0, f"Ongoing duration ({symptom_duration})"))
        else:
            drivers.append(TriageDriver(2.0, f"Chronic baseline duration ({symptom_duration})"))
    else:
        drivers.append(TriageDriver(3.0, f"Reported duration: {symptom_duration}"))

    # -------------------------------------------------------------
    # 5. Geriatric Age & Comorbidity Multipliers (0 to 15 pts)
    # -------------------------------------------------------------
    # Age factor
    if age >= 80:
        drivers.append(TriageDriver(8.0, f"Advanced geriatric age ({age} yrs)"))
    elif age >= 70:
        drivers.append(TriageDriver(5.0, f"Geriatric age tier ({age} yrs)"))
    elif age >= 60:
        drivers.append(TriageDriver(3.0, f"Older adult age ({age} yrs)"))

    # Comorbidity factor
    comorb_list: List[str] = []
    if isinstance(comorbidities, list):
        comorb_list = [c.strip() for c in comorbidities if c and c.strip() and c.strip().lower() != "none known" and c.strip().lower() != "none"]
    elif isinstance(comorbidities, str) and comorbidities.strip():
        parts = comorbidities.split(",")
        comorb_list = [p.strip() for p in parts if p and p.strip() and p.strip().lower() != "none known" and p.strip().lower() != "none"]

    if comorb_list:
        high_risk_conditions = [
            "diabetes", "diabetes mellitus", "copd", "asthma", "heart failure", 
            "chronic kidney disease", "ckd", "coronary artery disease", "cad", 
            "stroke", "cancer", "immunocompromised", "atrial fibrillation"
        ]
        has_high_risk = any(any(hr in c.lower() for hr in high_risk_conditions) for c in comorb_list)
        count = len(comorb_list)

        if has_high_risk and count >= 2:
            comorb_score = min(7.0, 3.0 + count * 2.0)
            drivers.append(TriageDriver(comorb_score, f"High-risk multi-comorbidity profile ({', '.join(comorb_list)})"))
        elif has_high_risk or count >= 2:
            comorb_score = min(5.0, 2.0 + count * 1.5)
            drivers.append(TriageDriver(comorb_score, f"Chronic comorbidities present ({', '.join(comorb_list)})"))
        else:
            drivers.append(TriageDriver(3.0, f"Pre-existing condition: {', '.join(comorb_list)}"))

    # -------------------------------------------------------------
    # Compute Aggregate Score & Triage Level
    # -------------------------------------------------------------
    total_raw_score = sum(d.points for d in drivers)
    final_score = round(min(100.0, max(0.0, total_raw_score)), 1)

    if final_score >= 60.0:
        triage_level = "Urgent"
    elif final_score >= 30.0:
        triage_level = "Routine"
    else:
        triage_level = "Self-Care Info"

    # Build human-readable driver explanation string
    driver_strs = [f"+{int(d.points) if d.points.is_integer() else d.points} pts: {d.description}" for d in drivers]
    explanation = f"Total Risk Score: {final_score}/100 ({triage_level}). Contributing Factors: {'; '.join(driver_strs)}."

    return TriageScoreResult(
        risk_score=final_score,
        triage_level=triage_level,
        explanation=explanation,
        drivers=drivers
    )
