from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass


INDIAN_BRAND_GENERIC_SEED: Dict[str, Dict[str, Any]] = {
    "ecosprin": {"generic": "aspirin", "verified": True, "source": "CIMS India / CDSCO Approved Formulations"},
    "disprin": {"generic": "aspirin", "verified": True, "source": "CIMS India"},
    "clopilet": {"generic": "clopidogrel", "verified": True, "source": "CIMS India / 1mg Compendium"},
    "plavix": {"generic": "clopidogrel", "verified": True, "source": "CIMS India"},
    "atorva": {"generic": "atorvastatin", "verified": True, "source": "CIMS India"},
    "atorlip": {"generic": "atorvastatin", "verified": True, "source": "CIMS India"},
    "telma": {"generic": "telmisartan", "verified": True, "source": "CIMS India"},
    "telmikind": {"generic": "telmisartan", "verified": True, "source": "CIMS India"},
    "metolar": {"generic": "metoprolol", "verified": True, "source": "CIMS India"},
    "betaloc": {"generic": "metoprolol", "verified": True, "source": "CIMS India"},
    "glycomet": {"generic": "metformin", "verified": True, "source": "CIMS India"},
    "acitrom": {"generic": "acenocoumarol", "verified": True, "source": "CIMS India / CDSCO"},
    "amaryl": {"generic": "glimepiride", "verified": True, "source": "CIMS India"},
    "daonil": {"generic": "glibenclamide", "verified": True, "source": "CIMS India"},
    "dytor": {"generic": "torsemide", "verified": True, "source": "CIMS India"},
    "lasix": {"generic": "furosemide", "verified": True, "source": "CIMS India"},
    "eliquis": {"generic": "apixaban", "verified": True, "source": "CIMS India"},
    "xarelto": {"generic": "rivaroxaban", "verified": True, "source": "CIMS India"},
    "pradaxa": {"generic": "dabigatran", "verified": True, "source": "CIMS India"},
    "wysolone": {"generic": "prednisolone", "verified": True, "source": "CIMS India"},
    "combiflam": {"generic": "ibuprofen + paracetamol", "verified": True, "source": "CIMS India"},
    "voveran": {"generic": "diclofenac", "verified": True, "source": "CIMS India"},
    "brufen": {"generic": "ibuprofen", "verified": True, "source": "CIMS India"},
    "lanoxin": {"generic": "digoxin", "verified": True, "source": "CIMS India"}
}

AYUSH_HERBAL_KEYWORDS = {
    "ayurveda", "ayush", "kadha", "churna", "bhasma", "arogya", "herbal",
    "homeopathy", "unani", "siddha", "ashwagandha", "giloy", "chyawanprash",
    "neem extract", "tulsi drops", "triphala", "shilajit"
}


@dataclass
class ResolvedMedication:
    raw_input: str
    generic_name: str
    is_verified: bool
    is_ayush_or_unverified: bool
    source_note: str


@dataclass
class DrugRuleTrigger:
    rule_id: str
    category: str  # "masking", "bleeding", "delirium", "renal", "hypoglycemia"
    rationale: str
    followup_recommendation: str
    refs: str


class MedicationShield:
    """
    Evaluates medication-induced risks, physiological masking, drug interactions,
    and polypharmacy in older patients. Adheres to strict communication rules:
    NEVER instructs patients to 'stop' or 'discontinue' medication directly;
    always recommends 'discuss with your doctor' or clinical physician review.
    """

    @classmethod
    def resolve_medication(cls, entry: str) -> ResolvedMedication:
        resolved_list, _ = cls.resolve_medications([entry])
        if resolved_list:
            return resolved_list[0]
        return ResolvedMedication(
            raw_input=entry,
            generic_name=entry.strip().lower(),
            is_verified=False,
            is_ayush_or_unverified=False,
            source_note="Unmapped Brand / User Specified Generic",
        )

    @classmethod
    def resolve_medications(cls, medication_entries: List[str]) -> Tuple[List[ResolvedMedication], List[str]]:
        resolved: List[ResolvedMedication] = []
        unverified_bucket: List[str] = []

        for entry in medication_entries:
            clean = entry.strip().lower()
            if not clean:
                continue

            # Check if AYUSH / herbal / unconventional
            if any(k in clean for k in AYUSH_HERBAL_KEYWORDS):
                unverified_bucket.append(entry)
                resolved.append(ResolvedMedication(
                    raw_input=entry,
                    generic_name="AYUSH/Herbal Formulation (Unverified)",
                    is_verified=False,
                    is_ayush_or_unverified=True,
                    source_note="Free-text herbal/traditional formulation; unverified pharmacology"
                ))
                continue

            # Check Indian Brand Dictionary
            matched_generic = None
            verified = False
            source = "Unmapped Brand / User Specified Generic"

            # Check exact or partial brand matches
            for brand, meta in INDIAN_BRAND_GENERIC_SEED.items():
                if brand in clean:
                    matched_generic = meta["generic"]
                    verified = meta["verified"]
                    source = meta["source"]
                    break

            if matched_generic:
                resolved.append(ResolvedMedication(
                    raw_input=entry,
                    generic_name=matched_generic,
                    is_verified=verified,
                    is_ayush_or_unverified=False,
                    source_note=source
                ))
            else:
                # Treat as directly specified generic or unmapped brand
                resolved.append(ResolvedMedication(
                    raw_input=entry,
                    generic_name=clean,
                    is_verified=False,
                    is_ayush_or_unverified=False,
                    source_note=source
                ))

        return resolved, unverified_bucket

    @classmethod
    def evaluate_medication_shield(
        cls,
        resolved_meds: List[ResolvedMedication],
        symptoms_text: str,
        vitals: Optional[Dict[str, Any]],
        age: int
    ) -> Tuple[List[DrugRuleTrigger], Dict[str, Any]]:
        triggers: List[DrugRuleTrigger] = []
        metadata: Dict[str, Any] = {}

        # 1. Polypharmacy count (exclude AYUSH/unverified from clinical polypharmacy threshold)
        active_clinical_meds = [m for m in resolved_meds if not m.is_ayush_or_unverified]
        med_count = len(active_clinical_meds)
        metadata["med_count"] = med_count
        metadata["has_polypharmacy_5"] = (med_count >= 5)
        metadata["has_polypharmacy_10"] = (med_count >= 10)

        all_generics_text = " ".join([m.generic_name.lower() for m in active_clinical_meds])
        sym_lower = (symptoms_text or "").lower()

        # Drug Rule 1: Bleeding Risk (Anticoagulant + Antiplatelet or NSAID)
        has_anticoag = any(k in all_generics_text for k in ["warfarin", "acenocoumarol", "apixaban", "rivaroxaban", "dabigatran", "heparin"])
        has_antiplatelet = any(k in all_generics_text for k in ["aspirin", "clopidogrel", "ticagrelor", "prasugrel"])
        has_nsaid = any(k in all_generics_text for k in ["ibuprofen", "diclofenac", "naproxen", "combiflam", "voveran"])

        if has_anticoag and (has_antiplatelet or has_nsaid):
            triggers.append(DrugRuleTrigger(
                rule_id="DRUG-RULE-BLEED-01",
                category="bleeding",
                rationale="Concomitant anticoagulant and antiplatelet/NSAID therapy significantly increases risk of major gastrointestinal and intracranial bleeding in older adults.",
                followup_recommendation="Discuss with your doctor regarding gastroprotection or medication reconciliation; check for black stools, dark urine, or unusual bruising.",
                refs="Inspired by AGS Beers Criteria (2023) and STOPP/START criteria version 3 (2023) bleeding risk recommendations."
            ))

        # Drug Rule 2: Physiological Masking (Rate control masking tachycardia in acute illness/sepsis)
        has_rate_control = any(k in all_generics_text for k in ["metoprolol", "atenolol", "bisoprolol", "carvedilol", "verapamil", "diltiazem", "digoxin"])
        vitals = vitals or {}
        pulse = vitals.get("pulse")
        if has_rate_control and pulse is not None and (60 <= pulse <= 90):
            if any(w in sym_lower for w in ["fever", "cough", "breathless", "pain", "weakness", "dysuria", "shivering"]):
                triggers.append(DrugRuleTrigger(
                    rule_id="DRUG-RULE-MASK-01",
                    category="masking",
                    rationale="Rate-limiting cardiac medication blunts normal tachycardic response to systemic infection, sepsis, or volume depletion.",
                    followup_recommendation="Normal pulse rate may mask physiological stress; discuss with your doctor if other signs of infection or dehydration are present.",
                    refs="Inspired by O'Mahony et al. STOPP/START criteria version 3; clinical geriatric pharmacotherapy principles."
                ))

        # Drug Rule 3: Delirium & Cognitive Risk (Sedatives, anticholinergics, or sudden confusion)
        has_deliriogenic = any(k in all_generics_text for k in ["alprazolam", "clonazepam", "zolpidem", "amitriptyline", "chlorpheniramine", "hydroxyzine", "promethazine", "prednisolone"])
        if has_deliriogenic and any(w in sym_lower for w in ["confusion", "drowsiness", "agitation", "hallucination", "disoriented"]):
            triggers.append(DrugRuleTrigger(
                rule_id="DRUG-RULE-DELIRIUM-01",
                category="delirium",
                rationale="Centrally-acting or anticholinergic medication may contribute to acute cognitive disturbance or delirium in older adults.",
                followup_recommendation="Discuss with your doctor for immediate medication review and assessment of acute delirium triggers.",
                refs="Inspired by 2023 American Geriatrics Society Beers Criteria for Potentially Inappropriate Medication Use in Older Adults."
            ))

        # Drug Rule 4: Hypoglycemia Risk (Sulfonylureas / Insulin with neuroglycopenic symptoms)
        has_hypoglycemic = any(k in all_generics_text for k in ["glimepiride", "glibenclamide", "gliclazide", "glipizide", "insulin"])
        if has_hypoglycemic and any(w in sym_lower for w in ["confusion", "sweating", "shakiness", "tremor", "dizziness", "unsteadiness", "fall"]):
            triggers.append(DrugRuleTrigger(
                rule_id="DRUG-RULE-HYPO-01",
                category="hypoglycemia",
                rationale="Potent insulin secretagogues or insulin can cause prolonged hypoglycemia in older adults due to reduced renal clearance and blunted adrenergic symptoms.",
                followup_recommendation="Check blood glucose immediately; discuss with your doctor to adjust glycemic goals and medication regimen.",
                refs="Inspired by Endocrine Society clinical guidelines on treatment of diabetes in older adults."
            ))

        # Drug Rule 5: Renal Risk / Triple Whammy (Diuretic + Renin-Angiotensin inhibitor + NSAID)
        has_diuretic = any(k in all_generics_text for k in ["furosemide", "torsemide", "lasix", "dytor", "hydrochlorothiazide", "chlorthalidone"])
        has_raas = any(k in all_generics_text for k in ["telmisartan", "losartan", "ramipril", "enalapril", "olmesartan"])
        if has_diuretic and has_raas and has_nsaid:
            triggers.append(DrugRuleTrigger(
                rule_id="DRUG-RULE-RENAL-01",
                category="renal",
                rationale="The combination of NSAID, diuretic, and ACEi/ARB ('triple whammy') impairs renal autoregulation and precipitously increases acute kidney injury risk.",
                followup_recommendation="Discuss with your doctor promptly for renal function monitoring and safer pain management alternatives.",
                refs="Inspired by Loboz KK, Shenfield GM. Drug Saf. 2005;28(3):215-224; STOPP criteria Section F (Kidney and Urinary System)."
            ))

        return triggers, metadata
