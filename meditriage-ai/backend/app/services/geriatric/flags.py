import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.services.config.config_service import ConfigService


DEFAULT_SETTINGS = {
    "sbp_low_threshold": 100,
    "spo2_low_threshold": 92,
    "geriatric_age_threshold": 65,
    "hr_normal_min": 60,
    "hr_normal_max": 100,
    "temp_fever_threshold": 100.4,
    "temp_hypothermia_threshold": 95.0
}


def get_settings(db: Optional[Session] = None) -> Dict[str, Any]:
    if db is not None:
        try:
            cfg = ConfigService.get_published(db, "settings")
            if cfg and isinstance(cfg.payload, dict):
                merged = dict(DEFAULT_SETTINGS)
                merged.update(cfg.payload)
                return merged
        except Exception:
            pass
    return dict(DEFAULT_SETTINGS)


class FlagExtractor:
    """
    Deterministic function turning structured intake fields, vitals, medications,
    and caregiver observations into clinical flags.
    Thresholds live in governed config (namespace='settings').
    """

    @classmethod
    def extract_flags(
        cls,
        chief_complaint: str,
        age: int,
        symptoms: Optional[List[Dict[str, Any]]] = None,
        vitals: Optional[Dict[str, Any]] = None,
        medications: Optional[List[str]] = None,
        comorbidities: Optional[List[str] | str] = None,
        caregiver_notes: Optional[str] = None,
        has_baseline: bool = True,
        red_flag_retracted: bool = False,
        db: Optional[Session] = None
    ) -> Dict[str, bool]:
        settings = get_settings(db)
        flags: Dict[str, bool] = {}

        # Collect text corpus for NLP/keyword matching
        texts = [chief_complaint or ""]
        if symptoms:
            for s in symptoms:
                texts.append(s.get("symptom", ""))
                texts.append(s.get("body_location", "") or "")
        if caregiver_notes:
            texts.append(caregiver_notes)
        full_text = " ".join(texts).lower()

        # Helper keywords
        def has_any(*patterns) -> bool:
            for p in patterns:
                if re.search(r"\b" + re.escape(p) + r"\b", full_text, re.IGNORECASE):
                    return True
            return False

        # 1. Neuro / Confusion
        flags["new_confusion"] = has_any("confusion", "disoriented", "delirium", "altered mental status", "altered sensorium", "not making sense", "memory lapse", "disorientation")
        flags["new_drowsiness"] = has_any("drowsy", "drowsiness", "excessive sleepiness", "somnolent", "lethargic", "unresponsive", "stupor")
        flags["new_agitation"] = has_any("agitation", "agitated", "restless", "combative", "screaming", "hallucinating")
        flags["new_speech_change"] = has_any("slurred speech", "difficulty speaking", "speech change", "garbled speech", "incoherent", "aphasia")
        flags["focal_neuro"] = has_any("facial droop", "arm weakness", "leg weakness", "one-sided weakness", "hemiplegia", "numbness", "vision loss")
        flags["syncope"] = has_any("syncope", "passed out", "fainted", "fainting", "blackout", "loss of consciousness")
        flags["acute_vertigo"] = has_any("vertigo", "severe dizziness", "loss of balance", "unsteadiness", "unsteady", "spinning", "giddiness")

        # 2. Falls & Trauma
        flags["fall_recent"] = has_any("fall", "fell", "slipped", "trip", "tripped", "loss of balance", "found on floor")
        flags["head_strike"] = has_any("hit head", "head injury", "head strike", "struck head", "bumped head", "head trauma", "fall on head", "struck forehead", "forehead hematoma", "forehead contusion", "hit forehead", "forehead")
        flags["fall_with_head_strike"] = (flags["fall_recent"] and flags["head_strike"]) or has_any("fall with head strike", "fell and hit head", "hit head when fell")
        flags["severe_trauma_or_fracture"] = has_any("unable to bear weight", "inability to stand", "cannot bear weight", "shortened and externally rotated", "hip fracture", "groin pain", "deformed leg", "excruciating hip")

        # 3. Vitals Checks
        vitals = vitals or {}
        has_vitals = any(vitals.get(k) is not None for k in ["temperature", "pulse", "blood_pressure", "spo2"])
        flags["vitals_missing"] = not has_vitals

        # SBP parsing
        sbp = None
        bp_val = vitals.get("blood_pressure")
        if bp_val and isinstance(bp_val, str) and "/" in bp_val:
            try:
                sbp = float(bp_val.split("/")[0].strip())
            except Exception:
                sbp = None
        elif bp_val and isinstance(bp_val, (int, float)):
            sbp = float(bp_val)

        spo2 = vitals.get("spo2")
        pulse = vitals.get("pulse")
        temp = vitals.get("temperature")

        sbp_thresh = settings.get("sbp_low_threshold", 100)
        spo2_thresh = settings.get("spo2_low_threshold", 92)

        flags["sbp_lt_100"] = (sbp is not None and sbp < sbp_thresh)
        flags["spo2_lt_92"] = (spo2 is not None and spo2 < spo2_thresh)

        # Temperature
        temp_fever = settings.get("temp_fever_threshold", 100.4)
        temp_hypo = settings.get("temp_hypothermia_threshold", 95.0)
        flags["temp_abnormal"] = (temp is not None and (temp >= temp_fever or temp <= temp_hypo))
        
        # Patient statement such as 'no fever' must NOT override measured thermometer value
        flags["fever_documented"] = (temp is not None and temp >= temp_fever)
        flags["fever_contradiction"] = bool(flags["fever_documented"] and has_any("no fever", "denies fever", "not feverish", "no temp", "afebrile"))
        flags["fever_with_neuro"] = bool(flags["fever_documented"] and (
            flags.get("new_confusion") or flags.get("new_drowsiness") or has_any("headache", "neck stiffness", "stiff neck")
        ))
        flags["no_fever"] = (temp is not None and temp < temp_fever) and not flags["fever_documented"]

        # Physiologically implausible vital signs (sensor artifacts / extreme physiology)
        is_implausible = False
        if temp is not None and (temp > 108.0 or temp < 90.0):
            is_implausible = True
        if pulse is not None and (pulse < 20 or pulse > 250):
            is_implausible = True
        if spo2 is not None and (spo2 < 50.0):
            is_implausible = True
        if sbp is not None and (sbp < 50 or sbp > 300):
            is_implausible = True
        flags["implausible_vital"] = is_implausible

        # Pulse / Rate Control
        hr_min = settings.get("hr_normal_min", 60)
        hr_max = settings.get("hr_normal_max", 100)
        flags["hr_in_normal_range"] = (pulse is not None and hr_min <= pulse <= hr_max)

        # 4. Medication Flags
        meds_text = " ".join([m.lower() for m in (medications or [])])

        anticoag_keywords = ["warfarin", "coumadin", "acitrom", "acenocoumarol", "eliquis", "apixaban", "xarelto", "rivaroxaban", "pradaxa", "dabigatran", "heparin", "enoxaparin", "clexane"]
        antiplatelet_keywords = ["aspirin", "ecosprin", "disprin", "clopidogrel", "clopilet", "plavix", "brilinta", "ticagrelor", "prasugrel"]
        
        has_anticoag = any(k in meds_text for k in anticoag_keywords)
        has_antiplat = any(k in meds_text for k in antiplatelet_keywords)
        flags["on_anticoagulant"] = has_anticoag
        flags["on_anticoagulant_or_antiplatelet"] = has_anticoag or has_antiplat

        rate_control_keywords = ["metoprolol", "metolar", "atenolol", "bisoprolol", "carvedilol", "propranolol", "diltiazem", "verapamil", "digoxin", "lanoxin", "amiodarone", "cordarone", "sotalol"]
        flags["on_rate_control_drug"] = any(k in meds_text for k in rate_control_keywords)

        steroid_immuno_keywords = ["prednisolone", "wysolone", "dexamethasone", "methylprednisolone", "budesonide", "tacrolimus", "cyclosporine", "methotrexate", "azathioprine", "mycophenolate", "hydrocortisone"]
        flags["on_steroid_or_immunosuppressant"] = any(k in meds_text for k in steroid_immuno_keywords)

        sulfonylurea_insulin_keywords = ["glimepiride", "amaryl", "glipizide", "gliclazide", "glycomet-gp", "daonil", "glibenclamide", "insulin", "human mixtard", "lantus", "novorapid", "apidra", "humalog", "tresiba", "toujeo", "ryzodeg"]
        flags["on_sulfonylurea_or_insulin"] = any(k in meds_text for k in sulfonylurea_insulin_keywords)

        # 5. Caregiver & Nonspecific Frailty Indicators
        flags["general_weakness"] = has_any("weakness", "lethargy", "fatigue", "tiredness", "exhaustion", "bedbound", "generalized body ache")
        flags["poor_intake"] = has_any("poor intake", "refusing food", "not eating", "decreased appetite", "anorexia", "poor oral intake", "dehydrated", "not drinking water")
        flags["not_right_per_caregiver"] = has_any("not acting right", "not right", "something is off", "unusual behavior", "caregiver concern", "not like themselves", "sudden decline", "off baseline")

        # 6. Silent-MI & Atypical Cardiac Indicators
        flags["has_chest_pain"] = has_any("chest pain", "angina", "chest pressure", "substernal pain")
        flags["silent_mi_symptoms"] = (not flags["has_chest_pain"]) and has_any("fatigue", "dyspnea", "shortness of breath", "breathless", "nausea", "vomiting", "syncope", "fainting", "passed out", "giddiness")

        # 7. Sweating or Confusion (for Hypoglycemia)
        flags["sweating_or_confusion"] = flags["new_confusion"] or has_any("sweating", "profuse sweating", "cold sweats", "diaphoresis", "clammy", "tremors", "shakiness")

        # 8. Acute Symptom Present
        flags["acute_symptom_present"] = len(chief_complaint.strip()) > 3 or (symptoms is not None and len(symptoms) > 0)

        # 9. Baseline & Retraction
        flags["baseline_missing"] = not has_baseline
        flags["red_flag_retracted"] = red_flag_retracted

        # 10. Acute Emergency Discriminators
        flags["acute_gi_bleed"] = has_any("melena", "black tarry", "coffee ground", "coffee-ground", "vomiting blood", "rectal bleeding")
        flags["acute_stroke_signs"] = flags.get("focal_neuro", False) or flags.get("new_speech_change", False) or has_any("slurred speech", "facial droop", "arm weakness", "hemiplegia")
        flags["severe_respiratory_distress"] = has_any("severe dyspnea", "blue lips", "struggling to breathe", "gasping for air", "using neck muscles", "severe wheezing")

        # 11. Sudden Onset (< 24h) & Vascular Risk for Geriatric Stroke/ICH Pathway
        dur_texts = []
        if symptoms:
            for s in symptoms:
                if isinstance(s, dict) and s.get("duration"):
                    dur_texts.append(str(s.get("duration")))
        all_dur = " ".join(dur_texts).lower()

        sudden_words = ["sudden", "acute", "today", "morning", "since morning", "few hours", "hours", "hour", "mins", "minutes", "< 24", "<24", "1 day", "overnight", "new "]
        is_sudden = any(w in full_text for w in ["sudden", "acute", "since morning", "woke up with", "new "]) or any(w in all_dur for w in sudden_words)
        flags["sudden_onset_24h"] = is_sudden

        comorb_text = str(comorbidities or "").lower()
        vasc_keywords = ["htn", "hypertension", "high blood pressure", "dm", "diabetes", "diabetic", "af", "atrial fibrillation", "stroke", "tia", "transient ischemic attack", "infarct"]
        has_vasc = any(re.search(r"\b" + re.escape(k) + r"\b", comorb_text, re.IGNORECASE) for k in vasc_keywords) or any(re.search(r"\b" + re.escape(k) + r"\b", full_text, re.IGNORECASE) for k in vasc_keywords)
        flags["has_vascular_risk"] = bool(has_vasc)

        # 12. Nonspecific Frailty / Atypical Decline (GERI-GUARD-05)
        vague_terms = [
            "feeling unwell", "feeling bad", "uneasy", "not myself", "weak",
            "feeling off", "generally unwell", "unwell", "not feeling right",
            "just not right", "malaise", "lethargic and off"
        ]
        flags["vague_complaint"] = has_any(*vague_terms)
        has_comorbidity = False
        if isinstance(comorbidities, list) and len(comorbidities) > 0:
            has_comorbidity = any(str(c).strip().lower() not in ["none", "none known", "nil", ""] for c in comorbidities)
        elif isinstance(comorbidities, str) and comorbidities.strip():
            has_comorbidity = comorbidities.strip().lower() not in ["none", "none known", "nil", ""]
        flags["has_comorbidity"] = has_comorbidity
        flags["nonspecific_decline"] = bool(age >= 75 and flags["vague_complaint"] and has_comorbidity)

        return flags

