"""Image classifier port + ResNet (DermNet) adapter.

The trained weights are NOT shipped in the repository (large binary). Configure
SKIN_MODEL_PATH to a Keras .h5/.keras file. If unavailable, the pipeline degrades
honestly: it reports `classifier_status="unavailable"` and triages from the
clinical context only - it never fabricates image predictions.
"""
from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from typing import List, Optional, Protocol

from app.services.skin_triage.taxonomy import CLASS_BY_INDEX, NUM_CLASSES

logger = logging.getLogger(__name__)
IMAGE_SIZE = (224, 224)


@dataclass
class Prediction:
    label: str
    confidence: float
    class_index: int


class SkinClassifier(Protocol):
    name: str
    available: bool
    reason: Optional[str]

    def predict(self, jpeg_bytes: bytes, top_k: int = 5) -> List[Prediction]: ...


class UnavailableClassifier:
    name = "unavailable"
    available = False

    def __init__(self, reason: str):
        self.reason = reason

    def predict(self, jpeg_bytes: bytes, top_k: int = 5) -> List[Prediction]:
        return []


class ResNetDermClassifier:
    """Keras ResNet152 fine-tuned on DermNet (23 classes). TensorFlow is imported lazily."""

    name = "resnet152-dermnet"
    available = True
    reason = None

    def __init__(self, model_path: str):
        import tensorflow as tf  # noqa: WPS433 (lazy, optional dependency)

        self._tf = tf
        self._model = tf.keras.models.load_model(model_path)
        out = int(self._model.output_shape[-1])
        if out != NUM_CLASSES:
            raise ValueError(f"Model outputs {out} classes, expected {NUM_CLASSES}")

    def predict(self, jpeg_bytes: bytes, top_k: int = 5) -> List[Prediction]:
        import numpy as np
        from PIL import Image

        img = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB").resize(IMAGE_SIZE)
        arr = np.expand_dims(np.asarray(img, dtype="float32"), axis=0)
        arr = self._tf.keras.applications.resnet.preprocess_input(arr)
        probs = self._model.predict(arr, verbose=0)[0]
        idxs = np.argsort(probs)[-top_k:][::-1]
        return [
            Prediction(CLASS_BY_INDEX[int(i)].name, float(probs[int(i)]), int(i)) for i in idxs
        ]


_cached: Optional[SkinClassifier] = None
_override: Optional[SkinClassifier] = None


def set_classifier_override(clf: Optional[SkinClassifier]) -> None:
    """Test / plugin hook."""
    global _override
    _override = clf


def get_classifier() -> SkinClassifier:
    global _cached
    if _override is not None:
        return _override
    if _cached is not None:
        return _cached
    from app.core.config import settings

    path = settings.SKIN_MODEL_PATH
    if not path:
        _cached = UnavailableClassifier("SKIN_MODEL_PATH is not configured")
    elif not os.path.exists(path):
        _cached = UnavailableClassifier("Model file not found at configured path")
    else:
        try:
            _cached = ResNetDermClassifier(path)
        except Exception as exc:  # TF missing, bad file, wrong head
            logger.warning("Skin classifier unavailable: %s", exc)
            _cached = UnavailableClassifier(f"Model failed to load: {type(exc).__name__}")
    return _cached
