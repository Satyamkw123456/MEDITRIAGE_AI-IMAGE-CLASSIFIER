"""DermNet 23-class taxonomy with clinical risk tiers (1-4).

Tier 5 (Emergency) is deliberately unreachable from an image alone; it requires
a context red flag (see pipeline.EMERGENCY_PATTERNS).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class SkinClass:
    index: int
    name: str
    tier: int  # 1 self-care .. 4 urgent referral
    infectious: bool = False
    malignancy_concern: bool = False


_CLASSES = [
    SkinClass(0, "Acne and Rosacea", 1),
    SkinClass(1, "Actinic Keratosis Basal Cell Carcinoma and other Malignant Lesions", 4, malignancy_concern=True),
    SkinClass(2, "Atopic Dermatitis", 2),
    SkinClass(3, "Bullous Disease", 4),
    SkinClass(4, "Cellulitis Impetigo and other Bacterial Infections", 3, infectious=True),
    SkinClass(5, "Eczema", 2),
    SkinClass(6, "Exanthems and Drug Eruptions", 3),
    SkinClass(7, "Hair Loss Alopecia and other Hair Diseases", 1),
    SkinClass(8, "Herpes HPV and other STDs", 2, infectious=True),
    SkinClass(9, "Light Diseases and Disorders of Pigmentation", 1),
    SkinClass(10, "Lupus and other Connective Tissue diseases", 3),
    SkinClass(11, "Melanoma Skin Cancer Nevi and Moles", 4, malignancy_concern=True),
    SkinClass(12, "Nail Fungus and other Nail Disease", 1, infectious=True),
    SkinClass(13, "Poison Ivy and other Contact Dermatitis", 2),
    SkinClass(14, "Psoriasis Lichen Planus and related diseases", 2),
    SkinClass(15, "Scabies Lyme Disease and other Infestations and Bites", 3, infectious=True),
    SkinClass(16, "Seborrheic Keratoses and other Benign Tumors", 1),
    SkinClass(17, "Systemic Disease", 3),
    SkinClass(18, "Tinea Ringworm Candidiasis and other Fungal Infections", 1, infectious=True),
    SkinClass(19, "Urticaria Hives", 2),
    SkinClass(20, "Vascular Tumors", 2),
    SkinClass(21, "Vasculitis", 4),
    SkinClass(22, "Warts Molluscum and other Viral Infections", 1, infectious=True),
]

CLASS_BY_INDEX: Dict[int, SkinClass] = {c.index: c for c in _CLASSES}
NUM_CLASSES = len(_CLASSES)


def normalize_label(label: str) -> str:
    """Normalize class / knowledge-base ids ('Acne and Rosacea Photos' == 'Acne and Rosacea')."""
    s = label.lower()
    s = re.sub(r"\b(photos|pictures)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


_BY_NORM = {normalize_label(c.name): c for c in _CLASSES}


def class_for_label(label: str) -> Optional[SkinClass]:
    return _BY_NORM.get(normalize_label(label))
