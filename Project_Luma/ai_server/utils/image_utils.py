# ai_server/utils/image_utils.py
import io
import base64
from PIL import Image
from ai_server.config import AIConfig

def decode_base64_to_image(b64_string: str) -> Image.Image:
    """Decodes a Base64 string (or Data URL) into a PIL Image."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_string)
    image = Image.open(io.BytesIO(image_bytes))
    return image.convert("RGB")

def encode_image_to_base64(image: Image.Image, format: str = "WEBP", quality: int = AIConfig.WEBP_QUALITY) -> str:
    """Encodes a PIL Image into a high-efficiency WebP Base64 string (cuts size by ~80%)."""
    buffer = io.BytesIO()
    image.save(buffer, format=format, quality=quality, method=6)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{encoded}"

def enforce_max_resolution(image: Image.Image, max_dim: int = AIConfig.MAX_IMAGE_WIDTH) -> Image.Image:
    """Ensures image dimensions do not exceed safety limits for Inpainting VRAM."""
    w, h = image.size
    if w <= max_dim and h <= max_dim:
        return image
    
    ratio = min(max_dim / w, max_dim / h)
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    # Ensure divisible by 8 for SD Latent dimensions
    new_w = (new_w // 8) * 8
    new_h = (new_h // 8) * 8
    return image.resize((new_w, new_h), Image.Resampling.LANCZOS)
