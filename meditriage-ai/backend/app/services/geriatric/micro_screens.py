"""
Micro-Screens for Geriatric Assessment
Instruments implemented:
1. ISAR (Identification of Seniors at Risk) - McCusker et al. (1999)
2. 4AT-lite (Delirium & Cognitive Impairment Screen) - Bellelli et al. (2014)
3. FRAIL Scale - Morley et al. (2012)
4. Fall Probe (5 indirect items) - CDC STEADI framework
"""

from typing import Dict
from dataclasses import dataclass


@dataclass(frozen=True)
class ScreenResult:
    tool_name: str
    total_score: int
    is_positive: bool
    risk_summary: str
    informant_type: str
    is_valid: bool
    validation_note: str
    citations: str


class MicroScreens:
    @classmethod
    def evaluate_isar(cls, answers: Dict[str, bool], informant_type: str = "self") -> ScreenResult:
        """
        ISAR (Identification of Seniors at Risk) - 6 items
        1. Regular help needed before illness
        2. Increased help needed since illness
        3. Hospitalized in past 6 months
        4. Vision impairment (cannot see well)
        5. Severe memory problem
        6. Taking 3+ medications daily
        Cutoff >= 2 indicates high risk of adverse outcomes.
        """
        score = sum(1 for k in [
            "needs_regular_help", "needs_more_help_now", "hospitalized_past_6m",
            "vision_impaired", "memory_problems", "taking_3_plus_meds"
        ] if answers.get(k) is True)

        is_pos = (score >= 2)
        summary = "High clinical risk / frailty vulnerability (ISAR >= 2)" if is_pos else "Standard risk (ISAR < 2)"
        
        return ScreenResult(
            tool_name="ISAR",
            total_score=score,
            is_positive=is_pos,
            risk_summary=summary,
            informant_type=informant_type,
            is_valid=True,
            validation_note="Valid assessment across self, caregiver, and clinician informants.",
            citations="McCusker J, Bellavance F, Cardin S, et al. Detection of older people at risk of adverse health outcomes after an emergency department visit: the ISAR tool. J Am Geriatr Soc. 1999;47(10):1229-1237."
        )

    @classmethod
    def evaluate_4at_lite(cls, item_scores: Dict[str, int], informant_type: str) -> ScreenResult:
        """
        4AT-lite Delirium Screen.
        CRITICAL GUARDRAIL: Caregiver or Clinician observed ONLY.
        Self-report 4AT-lite is medically invalid for acute delirium screening and is BLOCKED.
        """
        clean_inf = (informant_type or "").strip().lower()
        if clean_inf == "self":
            return ScreenResult(
                tool_name="4AT_LITE",
                total_score=0,
                is_positive=False,
                risk_summary="INVALID: Self-reported 4AT-lite blocked by clinical guardrail.",
                informant_type="self",
                is_valid=False,
                validation_note="BLOCKED: Delirium assessment requires external informant observation (caregiver or clinician). Patients experiencing acute delirium cannot reliably self-assess cognitive fluctuation.",
                citations="Bellelli G, Morandi A, Davis DH, et al. Validation of the 4AT, a new tool for rapid screening of delirium in older patients. Age Ageing. 2014;43(4):496-502."
            )

        # Calculate scores:
        # 1. alertness: 0 (normal), 4 (abnormal drowsiness or agitation)
        # 2. amt4: 0 (0 errors), 1 (1 error), 2 (2+ errors or untestable)
        # 3. attention: 0 (7+ months backward), 1 (<7 months), 2 (untestable)
        # 4. acute_change: 0 (no), 4 (yes, acute fluctuation)
        s1 = min(item_scores.get("alertness", 0), 4)
        s2 = min(item_scores.get("amt4", 0), 2)
        s3 = min(item_scores.get("attention", 0), 2)
        s4 = min(item_scores.get("acute_change", 0), 4)
        total = s1 + s2 + s3 + s4

        is_pos = (total >= 4)
        if total >= 4:
            summary = "Possible Delirium / Acute Cognitive Decline (4AT >= 4)"
        elif total >= 1:
            summary = "Possible Cognitive Impairment without acute delirium features (4AT 1-3)"
        else:
            summary = "Delirium unlikely (4AT = 0)"

        return ScreenResult(
            tool_name="4AT_LITE",
            total_score=total,
            is_positive=is_pos,
            risk_summary=summary,
            informant_type=clean_inf,
            is_valid=True,
            validation_note="Valid informant-observed evaluation.",
            citations="Bellelli G, Morandi A, Davis DH, et al. Validation of the 4AT, a new tool for rapid screening of delirium in older patients. Age Ageing. 2014;43(4):496-502."
        )

    @classmethod
    def evaluate_frail(cls, answers: Dict[str, bool], informant_type: str = "self") -> ScreenResult:
        """
        FRAIL Scale (Fatigue, Resistance, Ambulation, Illnesses, Loss of weight)
        Score >= 3 = Frail; 1-2 = Pre-frail; 0 = Robust.
        """
        score = sum(1 for k in ["fatigue", "resistance", "ambulation", "illness", "loss_of_weight"] if answers.get(k) is True)
        if score >= 3:
            summary = "Frail phenotype (FRAIL >= 3) - elevated risk of falls and rapid decompensation"
            is_pos = True
        elif score >= 1:
            summary = "Pre-frail (FRAIL 1-2)"
            is_pos = False
        else:
            summary = "Robust (FRAIL = 0)"
            is_pos = False

        return ScreenResult(
            tool_name="FRAIL",
            total_score=score,
            is_positive=is_pos,
            risk_summary=summary,
            informant_type=informant_type,
            is_valid=True,
            validation_note="Standard validated FRAIL questionnaire.",
            citations="Morley JE, Malmstrom TK, Miller DK. A simple frailty questionnaire (FRAIL) predicts outcomes in middle aged African Americans. J Am Med Dir Assoc. 2012;13(8):677-679."
        )

    @classmethod
    def evaluate_fall_probe(cls, answers: Dict[str, bool], informant_type: str = "self") -> ScreenResult:
        """
        Indirect Fall Risk Probe (5 questions, >= 2 positive = High Fall Risk)
        1. Unsteady/dizzy when standing
        2. Slipped or tripped in past 3 months
        3. Holding onto furniture when walking at home
        4. Fear of falling
        5. Pushing up multiple times to get out of chair
        """
        score = sum(1 for k in [
            "unsteady_standing", "slipped_past_3m", "holding_furniture",
            "fear_of_falling", "push_up_from_chair"
        ] if answers.get(k) is True)

        is_pos = (score >= 2)
        summary = "Elevated Fall Risk (>= 2 indirect risk markers)" if is_pos else "Low indirect fall risk"

        return ScreenResult(
            tool_name="FALL_PROBE",
            total_score=score,
            is_positive=is_pos,
            risk_summary=summary,
            informant_type=informant_type,
            is_valid=True,
            validation_note="CDC STEADI indirect functional inquiry protocol.",
            citations="CDC STEADI (Stopping Elderly Accidents, Deaths, & Injuries) Algorithm for Fall Risk Screening."
        )
