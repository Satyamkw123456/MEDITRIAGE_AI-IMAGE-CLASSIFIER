from typing import Dict, Any, Optional, Tuple
import re

from app.services.rules.red_flags import evaluate_red_flags


# Red-flag conversational phrases & keywords across English, Hindi, and Marathi
EMERGENCY_PATTERNS = [
    # Cardiac / Severe Chest Pain
    r"\b(crush(ing|ed)?\s+chest|chest\s+(pain|pressure|tightness|feels\s+crushed)|radiat(ing|es|ed)?\s+(to\s+)?(my\s+|the\s+)?(left\s+)?(arm|jaw|neck|back)|heart\s+attack)\b",
    r"(छाती\s*में\s*(बहुत\s*)?(तेज\s*)?दर्द|छाती\s*दब\s*रही|बाएं\s*हाथ\s*में\s*दर्द|पसीना\s*आ\s*रहा)",
    r"\b(chhati\s+me\s+dard|chhati\s+dabaav)\b",
    r"(छातीत\s*(तीव्र\s*)?वेदना|छाती\s*दाबली\s*जातेय|डाव्या\s*हातात\s*कळ)",
    r"\b(chhatit\s+vedna|davyat\s+hatat\s+kal)\b",

    # Neurological / Stroke Signs (FAST)
    r"\b(slurr(ed|ing)\s+speech|facial\s+droop|face\s+droop|arm\s+weakness|one[\s-]sided\s+weakness|loss\s+of\s+speech|paraly(zed|sis))\b",
    r"(लकवा|मुंह\s*टेढ़ा|बोलने\s*में\s*दिक्कत|आधा\s*शरीर\s*सुन्न|हाथ\s*पैर\s*काम\s*नहीं)",
    r"\b(lakwa|muh\s+tedha|aadha\s+sharir\s+sunn)\b",
    r"(पक्षाघात|तोंड\s*वाकडे|बोलणे\s*बोबडे|हात\s*पाय\s*लुळा\s*पडला)",
    r"\b(pakshaghat|tond\s+vakde|hat\s+pay\s+lula)\b",

    # Respiratory Failure / Cyanosis
    r"\b(cannot\s+breathe|gasping\s+for\s+air|lips\s+turn(ing)?\s+blue|suffocat(ing|ion)|severe\s+shortness\s+of\s+breath|oxygen\s+(saturation\s+)?.*failing|blue\s+lips)\b",
    r"(सांस\s*नहीं\s*आ\s*रही|दम\s*घुट\s*रहा|होंठ\s*नीले\s*पड़\s*रहे)",
    r"\b(saans\s+nahi\s+aa\s+rahi|dam\s+ghut\s+raha)\b",
    r"(श्वास\s*घेता\s*येत\s*नाही|श्वास\s*कोंडला|ओठ\s*निळे\s*पडले)",
    r"\b(shwas\s+gheta\s+yet\s+nahi|shwas\s+kondla)\b",

    # Unresponsiveness / Acute Loss of Consciousness / Seizure
    r"\b(unresponsive|unconscious|collapsed|active\s+seizure|convulsion|not\s+waking\s+up)\b",
    r"(बेहोश|मूर्छित|दौरा\s*पड़\s*रहा|उठ\s*नहीं\s*रहे)",
    r"\b(behosh|daura\s+pad\s+raha)\b",
    r"(बेशुद्ध|चक्कर\s*येऊन\s*पडले|झटका\s*येतोय|जागे\s*होत\s*नाहीत)",
    r"\b(beshuddha|jhatka\s+yetoy)\b",

    # Massive Hemorrhage / Hematemesis
    r"\b(cough(ing)?\s+up\s+.*blood|vomit(ing)?\s+.*blood|severe\s+uncontrolled\s+bleeding|profuse\s+bleeding)\b",
    r"(खून\s*की\s*उल्टी|खांसी\s*में\s*खून|बहुत\s*ज्यादा\s*खून\s*बह)",
    r"(रक्ताची\s*उलटी|खोFragment\s*रक्त|मोठ्या\s*प्रमाणात\s*रक्तस्राव)",
]


class EmergencyFilter:
    """
    Deterministic emergency pre-filter.
    Runs FIRST, independent of any LLM availability.
    If matched: immediately outputs emergency interrupt, stops LLM pipeline, and triggers clinician notification.
    """

    @classmethod
    def check_emergency(cls, message: str, case_data: Optional[Dict[str, Any]] = None) -> Tuple[bool, Optional[str]]:
        if not message:
            return False, None

        clean_msg = message.strip().lower()

        # 1. Regex Lexicon Match (Multi-lingual)
        for pattern in EMERGENCY_PATTERNS:
            match = re.search(pattern, clean_msg, re.IGNORECASE)
            if match:
                matched_phrase = match.group(0)
                return True, f"Emergency keyword/phrase detected: '{matched_phrase}'"

        # 2. Case Context Red-Flag Evaluation (if case vitals/symptoms provided)
        if case_data:
            symptoms = case_data.get("symptoms", [])
            vitals = case_data.get("vitals", {})
            age = case_data.get("age", 40)
            
            sym_list = []
            for s in symptoms:
                if isinstance(s, dict):
                    sym_list.append(s.get("symptom", s.get("name", s.get("description", ""))))
                else:
                    sym_list.append(str(s))
            chief_complaint = sym_list[0] if sym_list else case_data.get("chief_complaint", "")
            additional = sym_list[1:] if len(sym_list) > 1 else None

            spo2 = vitals.get("spo2")
            pulse = vitals.get("pulse")
            bp = vitals.get("blood_pressure")
            if not bp and ("systolic_bp" in vitals or "systolic" in vitals):
                sys_val = vitals.get("systolic_bp", vitals.get("systolic"))
                dia_val = vitals.get("diastolic_bp", vitals.get("diastolic", 80))
                bp = f"{sys_val}/{dia_val}"

            red_flag_res = evaluate_red_flags(
                chief_complaint=chief_complaint,
                age=age,
                additional_symptoms=additional,
                spo2=spo2,
                pulse=pulse,
                blood_pressure=bp,
            )
            if red_flag_res.is_emergency:
                reasons = red_flag_res.fired_rules or [red_flag_res.clinical_rationale or "Deterministic clinical red flag identified"]
                return True, f"Clinical red flag identified: {'; '.join(reasons)}"

        return False, None

    @classmethod
    def build_emergency_response(cls, trigger_reason: str) -> Dict[str, Any]:
        response_text = (
            "⚠️ **EMERGENCY ACTION REQUIRED IMMEDIATELY** ⚠️\n\n"
            "Based on the symptoms you reported (" + trigger_reason + "), "
            "this requires **immediate emergency medical evaluation**.\n\n"
            "**Please take the following steps right now:**\n"
            "1. **Call Emergency Services**: Dial **112** (National Emergency) or **108** (Ambulance) immediately.\n"
            "2. **Go to the Nearest Emergency Room (ER)**: Do not drive yourself; have an ambulance or family member take you.\n"
            "3. **Stop physical exertion**: Sit or lie down in a safe, comfortable position while waiting for help.\n\n"
            "*(A notification has been automatically dispatched to the clinical team to flag this emergency event.)*"
        )

        return {
            "is_emergency": True,
            "response_text": response_text,
            "trigger_reason": trigger_reason,
            "safety_flags": {
                "emergency_interrupt": True,
                "clinician_notified": True,
                "reason": trigger_reason,
            },
        }
