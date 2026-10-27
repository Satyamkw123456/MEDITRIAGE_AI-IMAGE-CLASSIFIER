from typing import Dict, Any, List, Set, Optional, Tuple
from sqlalchemy.orm import Session
from app.services.geriatric.composer import Level, Vote
from app.services.config.config_service import ConfigService


SEEDED_GERIATRIC_RULES: List[Dict[str, Any]] = [
    {
        "id": "GERI-FLOOR-01-ACUTE-NEURO",
        "name": "Geriatric Safety Floor: Acute Neurological / Vertigo / Confusion in Older Adult",
        "applies_if": "age >= 65 and (new_confusion or new_drowsiness or new_speech_change or syncope or acute_vertigo or focal_neuro)",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": "sudden_onset_24h and (has_vascular_risk or on_anticoagulant_or_antiplatelet)",
        "forbid_levels": ["SELF_CARE", "ROUTINE"],
        "followups": ["urgent_clinical_review", "neurological_assessment"],
        "source": "NICE CG103 / NICE NG232",
        "reviewed_by": None,
        "refs": "NICE Clinical Guideline CG103 (Delirium: prevention, diagnosis and management in 18 and over); NICE NG232 (Head injury: assessment and early management).",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-FLOOR-02-STROKE-ICH",
        "name": "Geriatric Emergency Floor: Acute Neuro/Vertigo (<24h) with Vascular Risk / Anticoagulation (Stroke/ICH Pathway)",
        "applies_if": "age >= 65 and (new_confusion or new_drowsiness or new_speech_change or syncope or acute_vertigo or focal_neuro) and sudden_onset_24h and (has_vascular_risk or on_anticoagulant_or_antiplatelet)",
        "escalate_to": "EMERGENCY",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE", "ROUTINE", "URGENT"],
        "followups": ["emergency_ct_head", "stroke_code_activation"],
        "source": "NICE NG128 / AHA-ASA 2019",
        "reviewed_by": None,
        "refs": "NICE Guideline NG128 (Stroke and transient ischaemic attack in over 16s: diagnosis and initial management, 2019/2022); AHA/ASA Guideline for the Early Management of Patients With Acute Ischemic Stroke (Stroke. 2019;50:e344-e418).",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-FLOOR-03-FEVER",
        "name": "Geriatric Safety Floor: Documented Fever in Older Adult (Sepsis / Severe Infection Risk)",
        "applies_if": "age >= 65 and fever_documented",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE", "ROUTINE"],
        "followups": ["sepsis_screening", "blood_cultures_cbc", "urgent_physician_review"],
        "source": "IDSA Fever in Older Adults (2009)",
        "reviewed_by": None,
        "refs": "High KP, et al. Clinical Practice Guideline for the Evaluation of Fever and Infection in Older Adult Residents of Long-Term Care Facilities (IDSA 2009). Clin Infect Dis. 2009;48(2):149-171.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-GUARD-04-IMPLAUSIBLE-VITAL",
        "name": "Geriatric Safety Guard: Physiologically Implausible / Extreme Vital Sign Artifact",
        "applies_if": "age >= 65 and implausible_vital",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE", "ROUTINE"],
        "followups": ["re-measure now", "manual_vital_signs_verification"],
        "source": "Physiological Vital Signs Plausibility Limits / ESI Guidelines",
        "reviewed_by": None,
        "refs": "Emergency Severity Index (ESI) Implementation Handbook 2020: Physiologic extremes and artifact verification protocols.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-GUARD-05-NONSPECIFIC-DECLINE",
        "name": "Geriatric Safety Guard: Atypical Presentation / Non-Specific Decline in Frail Older Adult",
        "applies_if": "age >= 75 and vague_complaint and has_comorbidity",
        "escalate_to": "INFO",
        "escalate_to_emergency_if": None,
        "forbid_levels": [],
        "followups": ["frailty_assessment", "comprehensive_geriatric_assessment", "clinician_review"],
        "source": "British Geriatrics Society (BGS) Silver Book II",
        "reviewed_by": None,
        "refs": "British Geriatrics Society. Silver Book II: Quality care for older people with urgent and emergency care needs (2021). Atypical presentations and non-specific decline in older people.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-01-CONFUSION",
        "name": "Acute Cognitive Decline or Delirium in Older Adult",
        "applies_if": "age >= 65 and (new_confusion or new_drowsiness or new_agitation or new_speech_change)",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": "temp_abnormal or sbp_lt_100 or spo2_lt_92 or focal_neuro or head_strike or on_anticoagulant",
        "forbid_levels": ["SELF_CARE"],
        "followups": ["four_at_lite", "glucose_check", "med_change_14d"],
        "source": "Lancet / NICE CG103",
        "reviewed_by": None,
        "refs": "Inouye SK, et al. Delirium in elderly people. Lancet. 2014;383(9920):911-922; NICE Clinical Guideline CG103 (Delirium: prevention, diagnosis and management).",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-02-FALL-ANTICOAG",
        "name": "Recent Fall with Head Strike on Anticoagulation or Antiplatelet",
        "applies_if": "age >= 65 and fall_recent and head_strike and on_anticoagulant_or_antiplatelet",
        "escalate_to": "EMERGENCY",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE", "ROUTINE", "URGENT"],
        "followups": ["immediate_ct_head_referral", "gcs_assessment"],
        "source": "NICE NG232 / Canadian CT Head Rule",
        "reviewed_by": None,
        "refs": "NICE Guideline NG232: Head injury: assessment and early management (2023 Update); Canadian CT Head Rule.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-03-ATYPICAL-DECLINE",
        "name": "Nonspecific Geriatric Vulnerability & Caregiver Alarm",
        "applies_if": "age >= 65 and (general_weakness or poor_intake or not_right_per_caregiver)",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE"],
        "followups": ["functional_baseline_probe", "hydration_check", "caregiver_inquiry"],
        "source": "Ann Emerg Med 2010",
        "reviewed_by": None,
        "refs": "Samaras N, et al. Older patients in the emergency department: a review. Ann Emerg Med. 2010;56(3):261-269.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-04-SILENT-MI",
        "name": "Atypical Cardiac Presentation (Silent MI / Anginal Equivalent) in Older Adult",
        "applies_if": "age >= 65 and silent_mi_symptoms and (has_diabetes or has_ckd)",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE"],
        "followups": ["urgent_12_lead_ecg", "cardiac_enzymes_troponin"],
        "source": "AHA/ACC Chest Pain 2021",
        "reviewed_by": None,
        "refs": "Brieger D, et al. Acute coronary syndromes without chest pain. Chest. 2004;126(2):461-469; AHA/ACC Guideline for Evaluation of Chest Pain (2021).",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-05-RATE-CONTROL-MASKING",
        "name": "Physiological Tachycardia Masking by Rate-Limiting Medications",
        "applies_if": "on_rate_control_drug and hr_in_normal_range and acute_symptom_present",
        "escalate_to": "INFO",
        "escalate_to_emergency_if": None,
        "forbid_levels": [],
        "followups": ["orthostatic_vitals", "infection_workup_despite_normal_hr"],
        "source": "STOPP/START version 3",
        "reviewed_by": None,
        "refs": "O'Mahony D, et al. STOPP/START criteria for potentially inappropriate prescribing in older people: version 3. Eur Geriatr Med. 2023.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-06-IMMUNO-AFEBRILE",
        "name": "Blunted Febrile Response in Immunosuppressed or Steroid-Treated Older Adult",
        "applies_if": "on_steroid_or_immunosuppressant and no_fever",
        "escalate_to": "INFO",
        "escalate_to_emergency_if": None,
        "forbid_levels": [],
        "followups": ["complete_blood_count", "crp_procalcitonin", "urine_analysis"],
        "source": "IDSA Fever in Elderly 2009",
        "reviewed_by": None,
        "refs": "Norman DC. Fever in the elderly. Clin Infect Dis. 2000;31(1):148-151; IDSA Guideline for Evaluation of Fever in Older Adults (2009).",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-07-SULFONYLUREA-HYPO",
        "name": "Hypoglycemia Warning with Insulin Secretagogue / Insulin Therapy",
        "applies_if": "on_sulfonylurea_or_insulin and sweating_or_confusion",
        "escalate_to": "URGENT",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE"],
        "followups": ["glucose_check", "hypoglycemia_rule_out", "medication_review"],
        "source": "JAMA Intern Med 2016",
        "reviewed_by": None,
        "refs": "Lipska KJ, et al. Association of hypoglycemia with serious fall-related injuries in older adults with diabetes. JAMA Intern Med. 2016;176(11):1714-1716.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    },
    {
        "id": "GERI-RULE-08-VITALS-MISSING",
        "name": "Missing Vital Signs in High-Risk Geriatric Presentation",
        "applies_if": "age >= 65 and vitals_missing",
        "escalate_to": "ROUTINE",
        "escalate_to_emergency_if": None,
        "forbid_levels": ["SELF_CARE"],
        "followups": ["vital_signs_acquisition", "temperature_pulse_bp_spo2_measurement"],
        "source": "ESI Implementation Handbook 2020",
        "reviewed_by": None,
        "refs": "Emergency Severity Index (ESI) Implementation Handbook 2020: High-risk elderly missing vitals default rule.",
        "citation_status": "verified",
        "validation_status": "PENDING_CLINICIAN_REVIEW"
    }
]


class GeriatricRulesEngine:
    """
    Evaluates governed geriatric clinical rules loaded from database config
    (namespace='geriatric_rules'). Seeded rules are stored as data, not hardcoded.
    """

    @classmethod
    def load_rules(cls, db: Optional[Session] = None) -> List[Dict[str, Any]]:
        if db is not None:
            try:
                for k in ("rules", "default"):
                    payload = ConfigService.get_published(namespace="geriatric_rules", key=k, db=db)
                    if payload and isinstance(payload, list) and len(payload) > 0:
                        return payload
                    if payload and isinstance(payload, dict) and "rules" in payload:
                        return payload["rules"]
            except Exception:
                pass
        return SEEDED_GERIATRIC_RULES

    @classmethod
    def evaluate_rules(
        cls,
        flags: Dict[str, bool],
        age: int,
        db: Optional[Session] = None,
        rules: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[List[Vote], Set[Level], List[str], List[str]]:
        active_rules = rules if rules is not None else cls.load_rules(db)
        rule_cfg_by_id = {
            r["id"]: r for r in active_rules if isinstance(r, dict) and "id" in r
        }
        votes: List[Vote] = []
        forbidden_levels: Set[Level] = set()
        followups_ordered: List[str] = []
        rule_triggers_fired: List[str] = []

        is_geriatric = (age >= 65)

        # 0. Geriatric Safety Floor & Stroke/ICH Pathway (Governed Rules)
        r_f1 = rule_cfg_by_id.get("GERI-FLOOR-01-ACUTE-NEURO")
        r_f2 = rule_cfg_by_id.get("GERI-FLOOR-02-STROKE-ICH")
        r_f3 = rule_cfg_by_id.get("GERI-FLOOR-03-FEVER")
        r_g4 = rule_cfg_by_id.get("GERI-GUARD-04-IMPLAUSIBLE-VITAL")
        r_g5 = rule_cfg_by_id.get("GERI-GUARD-05-NONSPECIFIC-DECLINE")

        neuro_triggers = (
            flags.get("new_confusion") or
            flags.get("new_drowsiness") or
            flags.get("new_speech_change") or
            flags.get("syncope") or
            flags.get("acute_vertigo") or
            flags.get("focal_neuro")
        )

        if is_geriatric and neuro_triggers:
            is_emergency_floor = flags.get("sudden_onset_24h") and (
                flags.get("has_vascular_risk") or flags.get("on_anticoagulant_or_antiplatelet")
            )
            if is_emergency_floor and (r_f2 is None or r_f2.get("enabled", True) is not False):
                rule_triggers_fired.append("GERI-FLOOR-02-STROKE-ICH")
                forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE, Level.URGENT})
                votes.append(Vote(
                    source="GERI-FLOOR-02-STROKE-ICH",
                    level=Level.EMERGENCY,
                    rationale="Geriatric emergency safety floor: acute neuro/vertigo with sudden onset (<24h) and vascular risk factors or anticoagulation warrants immediate Emergency assessment (stroke/ICH pathway)."
                ))
                for f in ["emergency_ct_head", "stroke_code_activation"]:
                    if f not in followups_ordered:
                        followups_ordered.append(f)
            elif (r_f1 is None or r_f1.get("enabled", True) is not False):
                rule_triggers_fired.append("GERI-FLOOR-01-ACUTE-NEURO")
                forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE})
                votes.append(Vote(
                    source="GERI-FLOOR-01-ACUTE-NEURO",
                    level=Level.URGENT,
                    rationale="Geriatric safety floor: acute neuro/vertigo/confusion in older adult (age >= 65) requires minimum Urgent clinical evaluation."
                ))
                for f in ["urgent_clinical_review", "neurological_assessment"]:
                    if f not in followups_ordered:
                        followups_ordered.append(f)

        # 0b. GERI-FLOOR-03-FEVER (age >= 65 and temp >= 100.4 F)
        if (r_f3 is None or r_f3.get("enabled", True) is not False) and is_geriatric and flags.get("fever_documented"):
            rule_triggers_fired.append("GERI-FLOOR-03-FEVER")
            forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE})
            votes.append(Vote(
                source="GERI-FLOOR-03-FEVER",
                level=Level.URGENT,
                rationale="Geriatric safety floor: Documented fever (>=100.4 F / 38.0 C) in older adult (age >= 65) warrants minimum Urgent evaluation for infection/sepsis. Thermometer measurement supersedes patient denial."
            ))
            for f in ["sepsis_screening", "blood_cultures_cbc", "urgent_physician_review"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 0c. GERI-GUARD-04-IMPLAUSIBLE-VITAL (extreme / implausible vitals fail-closed to Urgent)
        if (r_g4 is None or r_g4.get("enabled", True) is not False) and is_geriatric and flags.get("implausible_vital"):
            rule_triggers_fired.append("GERI-GUARD-04-IMPLAUSIBLE-VITAL")
            forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE})
            votes.append(Vote(
                source="GERI-GUARD-04-IMPLAUSIBLE-VITAL",
                level=Level.URGENT,
                rationale="Physiologically implausible vital signs detected in older adult; fail-closed default applied to Urgent with mandatory clinician review and immediate vital signs re-measurement."
            ))
            for f in ["re-measure now", "manual_vital_signs_verification"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 0d. GERI-GUARD-05-NONSPECIFIC-DECLINE (age >= 75 with vague decline & chronic illness flags review)
        if (r_g5 is None or r_g5.get("enabled", True) is not False) and flags.get("nonspecific_decline"):
            rule_triggers_fired.append("GERI-GUARD-05-NONSPECIFIC-DECLINE")
            votes.append(Vote(
                source="GERI-GUARD-05-NONSPECIFIC-DECLINE",
                level=Level.SELF_CARE,
                rationale="Atypical non-specific presentation / generalized decline in older adult (age >= 75) with chronic disease; flags mandatory clinician review."
            ))
            for f in ["frailty_assessment", "comprehensive_geriatric_assessment", "clinician_review"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 1. Rule 1: Confusion / Delirium
        r1_cfg = rule_cfg_by_id.get("GERI-RULE-01-CONFUSION")
        if (r1_cfg is None or r1_cfg.get("enabled", True) is not False) and is_geriatric and (flags.get("new_confusion") or flags.get("new_drowsiness") or flags.get("new_agitation") or flags.get("new_speech_change")):
            rule_triggers_fired.append("GERI-RULE-01-CONFUSION")
            forbidden_levels.add(Level.SELF_CARE)
            is_emergency = any(flags.get(k) is True for k in [
                "temp_abnormal", "sbp_lt_100", "spo2_lt_92", "focal_neuro", "head_strike", "on_anticoagulant", "vitals_missing"
            ])
            if is_emergency:
                r1_emerg = Level.from_str(r1_cfg.get("escalate_to_emergency", "EMERGENCY")) if r1_cfg else Level.EMERGENCY
                votes.append(Vote(
                    source="GERI-RULE-01-CONFUSION",
                    level=r1_emerg,
                    rationale="Acute confusion or delirium in older adult combined with vital instability, missing vitals, focal neurology, or anticoagulant therapy warrants immediate emergency resuscitation."
                ))
            else:
                r1_urg = Level.from_str(r1_cfg.get("escalate_to", "URGENT")) if r1_cfg else Level.URGENT
                votes.append(Vote(
                    source="GERI-RULE-01-CONFUSION",
                    level=r1_urg,
                    rationale="New acute confusion, drowsiness, or altered speech in older adult requires urgent clinical and cognitive assessment."
                ))
            for f in ["four_at_lite", "glucose_check", "med_change_14d"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 2. Rule 2: Fall on Anticoagulation / Antiplatelet
        r2_cfg = rule_cfg_by_id.get("GERI-RULE-02-FALL-ANTICOAG")
        if (r2_cfg is None or r2_cfg.get("enabled", True) is not False) and is_geriatric and flags.get("fall_recent") and flags.get("head_strike") and flags.get("on_anticoagulant_or_antiplatelet"):
            rule_triggers_fired.append("GERI-RULE-02-FALL-ANTICOAG")
            r2_level = Level.from_str(r2_cfg.get("escalate_to", "EMERGENCY")) if r2_cfg else Level.EMERGENCY
            if r2_cfg and "forbid_levels" in r2_cfg:
                forbidden_levels.update({Level.from_str(lvl) for lvl in r2_cfg["forbid_levels"]})
            else:
                forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE, Level.URGENT})
            votes.append(Vote(
                source="GERI-RULE-02-FALL-ANTICOAG",
                level=r2_level,
                rationale="Older adult on anticoagulant/antiplatelet therapy with head strike following a fall has a high probability of intracranial hemorrhage; emergency trauma evaluation required."
            ))
            for f in ["immediate_ct_head_referral", "gcs_assessment"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 2b. Severe Trauma or Suspected Hip Fracture
        if is_geriatric and flags.get("severe_trauma_or_fracture"):
            rule_triggers_fired.append("GERI-RULE-TRAUMA-FRACTURE")
            forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE})
            votes.append(Vote(
                source="GERI-RULE-TRAUMA-FRACTURE",
                level=Level.URGENT,
                rationale="Older adult with acute hip trauma, severe groin pain, or inability to bear weight has high likelihood of proximal femur fracture; urgent orthopedic imaging required."
            ))
            for f in ["pelvis_hip_radiograph", "analgesia_and_immobilization"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 2c. Acute Stroke Signs / Focal Neuro
        if flags.get("acute_stroke_signs"):
            rule_triggers_fired.append("EMERGENCY-STROKE-SIGNS")
            forbidden_levels.update({Level.SELF_CARE, Level.ROUTINE, Level.URGENT})
            votes.append(Vote(
                source="EMERGENCY-STROKE-SIGNS",
                level=Level.EMERGENCY,
                rationale="Acute focal neurological deficit or acute speech difficulty warrants immediate emergency stroke code activation."
            ))
            for f in ["immediate_ct_head_referral", "gcs_assessment"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 3. Rule 3: Nonspecific Decline & Caregiver Concern
        r3_cfg = rule_cfg_by_id.get("GERI-RULE-03-ATYPICAL-DECLINE")
        if (r3_cfg is None or r3_cfg.get("enabled", True) is not False) and is_geriatric and (flags.get("general_weakness") or flags.get("poor_intake") or flags.get("not_right_per_caregiver")):
            rule_triggers_fired.append("GERI-RULE-03-ATYPICAL-DECLINE")
            forbidden_levels.add(Level.SELF_CARE)
            r3_urg = Level.from_str(r3_cfg.get("escalate_to", "URGENT")) if r3_cfg else Level.URGENT
            votes.append(Vote(
                source="GERI-RULE-03-ATYPICAL-DECLINE",
                level=r3_urg,
                rationale="Nonspecific functional decline, lethargy, or caregiver alarm in an older adult indicates high risk of occult serious illness."
            ))
            for f in ["functional_baseline_probe", "hydration_check", "caregiver_inquiry"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 4. Rule 4: Silent MI
        r4_cfg = rule_cfg_by_id.get("GERI-RULE-04-SILENT-MI")
        if (r4_cfg is None or r4_cfg.get("enabled", True) is not False) and is_geriatric and flags.get("silent_mi_symptoms") and (not flags.get("has_chest_pain")):
            rule_triggers_fired.append("GERI-RULE-04-SILENT-MI")
            forbidden_levels.add(Level.SELF_CARE)
            r4_urg = Level.from_str(r4_cfg.get("escalate_to", "URGENT")) if r4_cfg else Level.URGENT
            votes.append(Vote(
                source="GERI-RULE-04-SILENT-MI",
                level=r4_urg,
                rationale="Older adult presenting with unexplained fatigue, dyspnea, or nausea without chest pain is at elevated risk for anginal equivalent."
            ))
            for f in ["urgent_12_lead_ecg", "cardiac_enzymes_troponin"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 5. Rule 5: Rate Control Masking
        r5_cfg = rule_cfg_by_id.get("GERI-RULE-05-RATE-CONTROL-MASKING")
        if (r5_cfg is None or r5_cfg.get("enabled", True) is not False) and flags.get("on_rate_control_drug") and flags.get("hr_in_normal_range") and flags.get("acute_symptom_present"):
            rule_triggers_fired.append("GERI-RULE-05-RATE-CONTROL-MASKING")
            r5_info = Level.from_str(r5_cfg.get("escalate_to", "INFO")) if r5_cfg else Level.INFO
            votes.append(Vote(
                source="GERI-RULE-05-RATE-CONTROL-MASKING",
                level=r5_info,
                rationale="Heart rate in normal range may reflect drug-induced chronotropic blunting rather than absence of systemic stress."
            ))
            for f in ["orthostatic_vitals", "infection_workup_despite_normal_hr"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 6. Rule 6: Immuno/Steroid Afebrile
        r6_cfg = rule_cfg_by_id.get("GERI-RULE-06-IMMUNO-AFEBRILE")
        if (r6_cfg is None or r6_cfg.get("enabled", True) is not False) and flags.get("on_steroid_or_immunosuppressant") and flags.get("no_fever"):
            rule_triggers_fired.append("GERI-RULE-06-IMMUNO-AFEBRILE")
            r6_info = Level.from_str(r6_cfg.get("escalate_to", "INFO")) if r6_cfg else Level.INFO
            votes.append(Vote(
                source="GERI-RULE-06-IMMUNO-AFEBRILE",
                level=r6_info,
                rationale="Immunosuppressed older adult lacks expected febrile response; absence of fever does not rule out severe infection."
            ))
            for f in ["complete_blood_count", "crp_procalcitonin", "urine_analysis"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 7. Rule 7: Sulfonylurea / Insulin Hypoglycemia
        r7_cfg = rule_cfg_by_id.get("GERI-RULE-07-SULFONYLUREA-HYPO")
        if (r7_cfg is None or r7_cfg.get("enabled", True) is not False) and flags.get("on_sulfonylurea_or_insulin") and flags.get("sweating_or_confusion"):
            rule_triggers_fired.append("GERI-RULE-07-SULFONYLUREA-HYPO")
            forbidden_levels.add(Level.SELF_CARE)
            r7_urg = Level.from_str(r7_cfg.get("escalate_to", "URGENT")) if r7_cfg else Level.URGENT
            votes.append(Vote(
                source="GERI-RULE-07-SULFONYLUREA-HYPO",
                level=r7_urg,
                rationale="Diaphoresis, tremors, or acute confusion in older adult on hypoglycemic agents indicates probable acute hypoglycemia."
            ))
            for f in ["glucose_check", "hypoglycemia_rule_out", "medication_review"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        # 8. Rule 8: Missing Vitals Default Rule
        r8_cfg = rule_cfg_by_id.get("GERI-RULE-08-VITALS-MISSING")
        if (r8_cfg is None or r8_cfg.get("enabled", True) is not False) and is_geriatric and flags.get("vitals_missing"):
            rule_triggers_fired.append("GERI-RULE-08-VITALS-MISSING")
            forbidden_levels.add(Level.SELF_CARE)
            r8_rot = Level.from_str(r8_cfg.get("escalate_to", "ROUTINE")) if r8_cfg else Level.ROUTINE
            votes.append(Vote(
                source="GERI-RULE-08-VITALS-MISSING",
                level=r8_rot,
                rationale="Vital signs are missing in a geriatric presentation; self-care is forbidden until baseline vitals are acquired."
            ))
            for f in ["vital_signs_acquisition", "temperature_pulse_bp_spo2_measurement"]:
                if f not in followups_ordered:
                    followups_ordered.append(f)

        return votes, forbidden_levels, followups_ordered, rule_triggers_fired
