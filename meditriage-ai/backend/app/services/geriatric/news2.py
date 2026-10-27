"""
NEWS2 Scoring Implementation
Reference:
Royal College of Physicians. National Early Warning Score (NEWS) 2:
Standardising the assessment of acute-illness severity in the NHS.
Updated report of a working party. London: RCP, 2017.
ISBN 978-1-86016-682-2.
"""

from typing import Dict, Optional, Tuple
from dataclasses import dataclass


@dataclass(frozen=True)
class NEWS2Result:
    total_score: int
    parameter_scores: Dict[str, int]
    risk_band: str  # "LOW", "LOW_MEDIUM", "MEDIUM", "HIGH"
    single_param_trigger_3: bool
    scale_used: str  # "SCALE_1" or "SCALE_2"
    citation: str = (
        "Royal College of Physicians. National Early Warning Score (NEWS) 2: "
        "Standardising the assessment of acute-illness severity in the NHS. London: RCP, 2017."
    )


def calculate_news2(
    respiration_rate: Optional[int] = None,
    spo2: Optional[float] = None,
    on_oxygen: bool = False,
    systolic_bp: Optional[float] = None,
    pulse: Optional[int] = None,
    consciousness: str = "A",  # "A" (Alert), "C" (Confusion), "V" (Voice), "P" (Pain), "U" (Unresponsive)
    temperature: Optional[float] = None,  # Supports °C or °F
    has_hypercapnic_risk: bool = False,  # e.g., COPD with hypercapnic respiratory failure
    target_spo2_range: Optional[Tuple[float, float]] = None  # Personal target range e.g. (88, 92)
) -> NEWS2Result:
    param_scores: Dict[str, int] = {}
    target_range = target_spo2_range or (88.0, 92.0)

    # 1. Respiration Rate
    if respiration_rate is not None:
        if respiration_rate <= 8 or respiration_rate >= 25:
            param_scores["respiration_rate"] = 3
        elif 21 <= respiration_rate <= 24:
            param_scores["respiration_rate"] = 2
        elif 9 <= respiration_rate <= 11:
            param_scores["respiration_rate"] = 1
        else:
            param_scores["respiration_rate"] = 0

    # 2. SpO2 (Scale 1 vs Scale 2)
    scale_used = "SCALE_2" if has_hypercapnic_risk else "SCALE_1"
    if spo2 is not None:
        if has_hypercapnic_risk:
            # Scale 2 for Hypercapnic Respiratory Failure
            t_min, t_max = target_range
            if spo2 <= 83:
                param_scores["spo2"] = 3
            elif 84 <= spo2 <= 85:
                param_scores["spo2"] = 2
            elif 86 <= spo2 <= 87:
                param_scores["spo2"] = 1
            elif t_min <= spo2 <= t_max:
                param_scores["spo2"] = 0
            elif spo2 > t_max:
                if on_oxygen:
                    if spo2 >= 97:
                        param_scores["spo2"] = 3
                    elif 95 <= spo2 <= 96:
                        param_scores["spo2"] = 2
                    else:
                        param_scores["spo2"] = 1
                else:
                    param_scores["spo2"] = 0
        else:
            # Scale 1 (Default)
            if spo2 <= 91:
                param_scores["spo2"] = 3
            elif 92 <= spo2 <= 93:
                param_scores["spo2"] = 2
            elif 94 <= spo2 <= 95:
                param_scores["spo2"] = 1
            else:
                param_scores["spo2"] = 0

    # 3. Supplemental Oxygen
    param_scores["oxygen"] = 2 if on_oxygen else 0

    # 4. Systolic Blood Pressure (mmHg)
    if systolic_bp is not None:
        if systolic_bp <= 90 or systolic_bp >= 220:
            param_scores["systolic_bp"] = 3
        elif 91 <= systolic_bp <= 100:
            param_scores["systolic_bp"] = 2
        elif 101 <= systolic_bp <= 110:
            param_scores["systolic_bp"] = 1
        else:
            param_scores["systolic_bp"] = 0

    # 5. Pulse (Heart Rate, bpm)
    if pulse is not None:
        if pulse <= 40 or pulse >= 131:
            param_scores["pulse"] = 3
        elif 111 <= pulse <= 130:
            param_scores["pulse"] = 2
        elif (41 <= pulse <= 50) or (91 <= pulse <= 110):
            param_scores["pulse"] = 1
        else:
            param_scores["pulse"] = 0

    # 6. Consciousness (ACVPU)
    c_upper = (consciousness or "A").strip().upper()
    if c_upper in ("C", "V", "P", "U", "CONFUSION", "VOICE", "PAIN", "UNRESPONSIVE"):
        param_scores["consciousness"] = 3
    else:
        param_scores["consciousness"] = 0

    # 7. Temperature (°C conversion if needed)
    if temperature is not None:
        temp_c = temperature
        if temp_c > 50.0:  # Fahrenheit input
            temp_c = (temp_c - 32.0) * (5.0 / 9.0)

        if temp_c <= 35.0:
            param_scores["temperature"] = 3
        elif temp_c >= 39.1:
            param_scores["temperature"] = 2
        elif (35.1 <= temp_c <= 36.0) or (38.1 <= temp_c <= 39.0):
            param_scores["temperature"] = 1
        else:
            param_scores["temperature"] = 0

    total_score = sum(param_scores.values())
    single_trigger_3 = any(score >= 3 for score in param_scores.values())

    if total_score >= 7:
        risk_band = "HIGH"
    elif total_score >= 5:
        risk_band = "MEDIUM"
    elif single_trigger_3:
        risk_band = "LOW_MEDIUM"
    else:
        risk_band = "LOW"

    return NEWS2Result(
        total_score=total_score,
        parameter_scores=param_scores,
        risk_band=risk_band,
        single_param_trigger_3=single_trigger_3,
        scale_used=scale_used
    )
