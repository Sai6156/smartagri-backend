"""Generate small JPEG data-URLs for scan history thumbnails."""

import base64
import io

from PIL import Image

THUMB_MAX = 160
JPEG_QUALITY = 72


def image_bytes_to_thumbnail_data_url(image_bytes: bytes) -> str:
    """Resize leaf image to a compact data URL for DB storage and cross-device sync."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return ""
