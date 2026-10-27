"""Upload validation + sanitization (type sniffing, bomb guard, EXIF strip, downscale)."""
from __future__ import annotations

import hashlib
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 25_000_000
MAX_SIDE = 1024
Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # Pillow raises DecompressionBombError above 2x


class ImageRejected(ValueError):
    """Raised with a user-safe message when an upload is not acceptable."""


@dataclass
class SanitizedImage:
    data: bytes
    mime: str
    width: int
    height: int
    sha256: str


def sanitize_image(raw: bytes) -> SanitizedImage:
    if not raw:
        raise ImageRejected("The uploaded file is empty.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            probe = Image.open(io.BytesIO(raw))
        fmt = (probe.format or "").upper()
        if fmt not in ALLOWED_FORMATS:
            raise ImageRejected("Unsupported image type. Upload a JPEG, PNG or WebP photo.")
        if probe.width * probe.height > MAX_PIXELS:
            raise ImageRejected("Image resolution is too large.")
        probe.verify()  # structural integrity
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)  # honour orientation, then drop all metadata
        img = img.convert("RGB")
    except ImageRejected:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError, ValueError):
        raise ImageRejected("The file is not a valid image.")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)  # re-encode => no EXIF/GPS
    data = out.getvalue()
    return SanitizedImage(data, "image/jpeg", img.width, img.height, hashlib.sha256(data).hexdigest())
