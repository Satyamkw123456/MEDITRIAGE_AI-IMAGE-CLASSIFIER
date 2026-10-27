from typing import Dict, Optional

LEVEL_COPY: Dict[str, Dict[str, str]] = {
    "Self-Care Info": {
        "title": "Self-Care & Home Monitoring",
        "action": "Manage at home with self-care measures and monitoring",
        "timeframe": "monitor at home; seek care if symptoms worsen",
        "call_to_action": "Review self-care guidance and continue monitoring",
    },
    "Routine": {
        "title": "Routine Consultation",
        "action": "Schedule an appointment with your primary care provider",
        "timeframe": "book within 1-2 weeks",
        "call_to_action": "Book regular appointment with your primary care physician",
    },
    "Urgent": {
        "title": "Urgent Medical Attention Required",
        "action": "Seek prompt medical evaluation today",
        "timeframe": "be seen within 24 hours",
        "call_to_action": "Visit an urgent care clinic or consult a physician within 24 hours",
    },
    "Emergency": {
        "title": "Immediate Emergency Care Required",
        "action": "Activate emergency response immediately",
        "timeframe": "call 112 now",
        "call_to_action": "Call emergency services (112) or proceed to the nearest emergency room immediately",
    },
}


def get_level_copy(level: Optional[str]) -> Dict[str, str]:
    """Returns standardized UI copy for the given triage level."""
    if not level:
        return LEVEL_COPY["Routine"]
    clean = level.strip().title()
    # Normalize aliases
    if clean in ("Self-Care", "Self_Care", "Self Care", "Self-Care Info", "Self_Care_Info"):
        return LEVEL_COPY["Self-Care Info"]
    if clean in LEVEL_COPY:
        return LEVEL_COPY[clean]
    # Exact case check
    for k, v in LEVEL_COPY.items():
        if k.lower() == level.strip().lower():
            return v
    return LEVEL_COPY["Routine"]
