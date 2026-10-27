from typing import Dict, Any, Optional
import re
from sqlalchemy.orm import Session

from app.services.config.config_service import ConfigService


# Crisis / Hopelessness detection lexicon (English, Hindi transliterated/script, Marathi)
CRISIS_PATTERNS = [
    # English
    r"\b(suicid|kill\s+myself|end\s+my\s+life|want\s+to\s+die|hang\s+myself|overdose\s+myself|self[\s-]harm|slit\s+my\s+wrists|end\s+it\s+all)\b",
    r"\b(no\s+reason\s+to\s+live|better\s+off\s+dead|life\s+has\s+no\s+meaning|worthless\s+to\s+live)\b",
    r"\b(lethal\s+dose|swallow\s+all\s+my\s+pills|swallow\s+all\s+pills)\b",
    # Hindi (Devanagari & Romanized)
    r"(आत्महत्या|खुदकुशी|मरना\s*चाहता|मरना\s*चाहती|जान\s*दे\s*दू|जीने\s*का\s*कोई\s*फायदा\s*नहीं)",
    r"\b(aatmahatya|khudkushi|marna\s+chahta|marna\s+chahti|jaan\s+de\s+du|jeene\s+ka\s+koi\s+fayda\s+nahi)\b",
    # Marathi (Devanagari & Romanized)
    r"(आत्महत्या|जीवन\s*संपवायचे|जीव\s*द्यावासा|जगण्यात\s*काही\s*अर्थ\s*नाही)",
    r"\b(jeevan\s+sampvayche|jeev\s+dyavasa|jagnyat\s+kahi\s+arth\s+nahi)\b",
]

DEFAULT_CRISIS_RESOURCES = {
    "emergency": {"name": "National Emergency Number", "number": "112"},
    "ambulance": {"name": "National Ambulance Helpline", "number": "108"},
    "tele_manas": {"name": "Tele-MANAS Mental Health Helpline", "number": "14416"},
    "elderline": {"name": "Elderline Senior Citizen Helpline", "number": "14567"},
    "notes": "Emergency resources seeded; verify before demo",
}


class CrisisFilter:
    """
    Dedicated crisis, self-harm, and hopelessness interceptor.
    Routes patient expressions of despair immediately to governed national support lines.
    """

    @classmethod
    def check_crisis_language(cls, message: str) -> bool:
        if not message:
            return False
        clean_msg = message.strip().lower()
        for pattern in CRISIS_PATTERNS:
            if re.search(pattern, clean_msg, re.IGNORECASE):
                return True
        return False

    @classmethod
    def get_crisis_resources(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Loads verified helpline numbers dynamically from ConfigService."""
        if db:
            try:
                cfg = ConfigService.get_published(namespace="crisis", key="helplines", db=db)
                if cfg and isinstance(cfg, dict):
                    return cfg
            except Exception:
                pass
        return DEFAULT_CRISIS_RESOURCES

    @classmethod
    def build_crisis_response(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        resources = cls.get_crisis_resources(db)
        
        tele_manas = resources.get("tele_manas", {}).get("number", "14416")
        elderline = resources.get("elderline", {}).get("number", "14567")
        emergency = resources.get("emergency", {}).get("number", "112")
        ambulance = resources.get("ambulance", {}).get("number", "108")

        response_text = (
            "We hear you, and please know that you are not alone and help is available right now. "
            "Please reach out immediately to speak with a caring counselor who can support you:\n\n"
            f"- **Tele-MANAS (Mental Health Helpline - 24/7 Toll-Free)**: Call **{tele_manas}**\n"
            f"- **Elderline (Senior Citizen National Helpline - 8 AM to 8 PM)**: Call **{elderline}**\n"
            f"- **National Emergency Services**: Call **{emergency}**\n"
            f"- **Ambulance Service**: Call **{ambulance}**\n\n"
            "If you or someone you know is in immediate physical danger, please call emergency services (112) "
            "or go to the nearest emergency department right away."
        )

        return {
            "is_crisis": True,
            "response_text": response_text,
            "resources": resources,
            "safety_flags": {
                "crisis_detected": True,
                "helplines_provided": [tele_manas, elderline, emergency, ambulance],
            },
        }
