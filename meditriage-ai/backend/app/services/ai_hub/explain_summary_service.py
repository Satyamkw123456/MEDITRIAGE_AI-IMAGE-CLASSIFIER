from typing import Dict, Any


class ExplainSummaryService:
    """
    Translates and explains a structured clinical case summary at a chosen reading level
    (grade_4, grade_8, clinical) across English (en), Hindi (hi), and Marathi (mr).
    Content is strictly grounded in the structured case substrate, never invented.
    """

    @classmethod
    def explain_summary(
        cls,
        case_data: Dict[str, Any],
        reading_level: str = "grade_8",  # grade_4 | grade_8 | clinical
        language: str = "en",             # en | hi | mr
    ) -> Dict[str, Any]:
        age = case_data.get("age", "Unknown age")
        sex = case_data.get("sex", "Patient")
        complaint = case_data.get("chief_complaint", "General discomfort")
        symptoms = case_data.get("symptoms", [])
        vitals = case_data.get("vitals", {})
        triage_level = str(case_data.get("triage_level", "Routine")).upper()
        medications = case_data.get("medications", "None reported")

        symptoms_str = ", ".join([s.get("symptom", "") for s in symptoms if isinstance(s, dict)]) or complaint
        pulse = vitals.get("pulse", "N/A")
        spo2 = vitals.get("spo2", "N/A")
        bp = f"{vitals.get('systolic_bp', 'N/A')}/{vitals.get('diastolic_bp', 'N/A')}"

        # 1. English Explanations
        if language == "en":
            if reading_level == "grade_4":
                text = (
                    f"Hello. You are {age} years old and told us about feeling unwell with {complaint}. "
                    f"Your health check showed a triage urgency of {triage_level}. "
                    f"Your heart beat is {pulse} and oxygen level is {spo2}%. "
                    f"You are taking: {medications}. "
                    "Please rest and follow your doctor's instructions."
                )
            elif reading_level == "clinical":
                text = (
                    f"Clinical Synthesis: {age}-year-old {sex} presenting with primary complaint of {complaint}. "
                    f"Reported symptoms include {symptoms_str}. Physiological metrics indicate pulse {pulse} bpm, "
                    f"blood pressure {bp} mmHg, SpO2 {spo2}%. Deterministic triage assessment: {triage_level}. "
                    f"Current pharmacological regimen: {medications}. Recommended follow-up: formal physician evaluation."
                )
            else:  # grade_8
                text = (
                    f"Summary of Your Health Assessment: For a {age}-year-old {sex} presenting with {complaint}, "
                    f"the symptoms reported ({symptoms_str}) have been reviewed alongside your recorded vitals "
                    f"(Blood Pressure {bp}, Pulse {pulse}, Oxygen {spo2}%). Based on these clinical indicators, "
                    f"your current triage urgency is classified as {triage_level}. You have reported taking {medications}. "
                    "Please discuss these findings with your healthcare provider."
                )

        # 2. Hindi Explanations
        elif language == "hi":
            if reading_level == "grade_4":
                text = (
                    f"नमस्ते। आपकी उम्र {age} वर्ष है और आपने {complaint} की समस्या बताई है। "
                    f"जांच के अनुसार आपकी तात्कालिकता {triage_level} श्रेणी में है। "
                    f"आपकी नब्ज {pulse} और ऑक्सीजन {spo2}% है। "
                    f"आपकी दवाएं हैं: {medications}। कृपया डॉक्टर से मिलें और आराम करें।"
                )
            elif reading_level == "clinical":
                text = (
                    f"चिकित्सीय सारांश: {age} वर्षीय {sex}, मुख्य लक्षण: {complaint}। "
                    f"शारीरिक मापदंड: नब्ज {pulse} bpm, रक्तचाप {bp}, SpO2 {spo2}%। "
                    f"ट्राइएज स्तर: {triage_level}। वर्तमान दवाइयां: {medications}। चिकित्सक द्वारा मूल्यांकन आवश्यक है।"
                )
            else:  # grade_8
                text = (
                    f"आपकी स्वास्थ्य समीक्षा का सारांश: {age} वर्ष की उम्र में {complaint} की शिकायत दर्ज की गई है। "
                    f"आपके लक्षण ({symptoms_str}) और शारीरिक संकेतों (रक्तचाप {bp}, नब्ज {pulse}, ऑक्सीजन {spo2}%) "
                    f"के आधार पर आपकी प्राथमिकता {triage_level} निर्धारित की गई है। "
                    f"दवाओं का विवरण: {medications}। कृपया अपने चिकित्सक से परामर्श लें।"
                )

        # 3. Marathi Explanations
        else:  # mr
            if reading_level == "grade_4":
                text = (
                    f"नमस्कार. तुमचे वय {age} वर्षे असून तुम्हाला {complaint} चा त्रास होत आहे. "
                    f"तपासणीनुसार तुमची निकड {triage_level} स्तरावर आहे. "
                    f"तुमची नाडी {pulse} आणि ऑक्सिजन {spo2}% आहे. "
                    f"चालू औषधे: {medications}. कृपया विश्रांती घ्या आणि डॉक्टरांना भेटा."
                )
            elif reading_level == "clinical":
                text = (
                    f"वैद्यकीय सारांश: {age} वर्षीय {sex}, मुख्य तक्रार: {complaint}. "
                    f"शारीरिक मोजमाप: नाडी {pulse} bpm, रक्तदाब {bp}, SpO2 {spo2}%. "
                    f"ट्रायज पातळी: {triage_level}. चालू औषधे: {medications}. डॉक्टरांकडून प्रत्यक्ष तपासणी आवश्यक."
                )
            else:  # grade_8
                text = (
                    f"तुमच्या आरोग्य तपासणीचा सारांश: वय {age} वर्षे असलेल्या रुग्णाची {complaint} ची तक्रार आहे. "
                    f"लक्षणे ({symptoms_str}) आणि तपासणीचे आकडे (रक्तदाब {bp}, नाडी {pulse}, ऑक्सिजन {spo2}%) "
                    f"यानुसार आपली ट्रायज निकड {triage_level} ठरवण्यात आली आहे. "
                    f"नोंदवलेली औषधे: {medications}. कृपया आपल्या डॉक्टरांशी सल्लामसलत करा."
                )

        return {
            "reading_level": reading_level,
            "language": language,
            "grounded_sources": ["case_intake", "triage_results", "recorded_vitals"],
            "explained_summary": text,
        }
