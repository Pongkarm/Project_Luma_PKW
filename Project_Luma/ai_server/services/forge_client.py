# ai_server/services/forge_client.py — Forge API Client with WebP Optimization & Fallback
import requests
import json
from typing import Optional
from PIL import Image
from ai_server.config import AIConfig
from ai_server.utils.image_utils import (
    decode_base64_to_image, 
    encode_image_to_base64, 
    enforce_max_resolution
)

FORGE_API_URL = "http://127.0.0.1:7861"

def is_forge_online() -> bool:
    """Checks if WebUI Forge API daemon is listening on port 7861."""
    try:
        resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/progress", timeout=1.5)
        return resp.status_code == 200
    except Exception:
        return False

def interrupt_forge_generation() -> bool:
    """Sends an immediate interrupt signal to Forge GPU inference loop."""
    try:
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/interrupt", timeout=2.0)
        return resp.status_code == 200
    except Exception as e:
        print(f"[FORGE INTERRUPT ERROR] {e}")
        return False

def set_forge_model(checkpoint_name: str) -> bool:
    """Switches the active Stable Diffusion checkpoint in Forge."""
    try:
        payload = {"sd_model_checkpoint": checkpoint_name}
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/options", json=payload, timeout=10.0)
        return resp.status_code == 200
    except Exception as e:
        print(f"[FORGE MODEL SWITCH ERROR] {e}")
        return False

def run_txt2img(
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted, bad anatomy",
    steps: int = 25,
    cfg_scale: float = 7.5,
    width: int = 512,
    height: int = 512,
    sampler_name: str = "DPM++ 2M Karras",
    checkpoint: Optional[str] = None
) -> Optional[str]:
    """
    Executes txt2img generation via Forge API and returns optimized WebP Base64.
    """
    if checkpoint:
        set_forge_model(checkpoint)

    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "steps": min(steps, 50),
        "cfg_scale": cfg_scale,
        "width": min(width, AIConfig.MAX_IMAGE_WIDTH),
        "height": min(height, AIConfig.MAX_IMAGE_HEIGHT),
        "sampler_name": sampler_name,
        "batch_size": 1,
        "enable_hr": False
    }

    try:
        print(f"[FORGE INFERENCE] Calling {FORGE_API_URL}/sdapi/v1/txt2img...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/txt2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                # Convert raw PNG from Forge into high-efficiency WebP
                pil_img = decode_base64_to_image(images[0])
                webp_b64 = encode_image_to_base64(pil_img, format="WEBP")
                print(f"[FORGE SUCCESS] Image generated and converted to WebP.")
                return webp_b64
        else:
            print(f"[FORGE HTTP WARN] Status {resp.status_code}: {resp.text[:100]}")
    except Exception as exc:
        print(f"[FORGE INFERENCE FAILED] {exc}")
    
    return None

def run_inpaint(
    image_base64: str,
    mask_base64: str,
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted",
    steps: int = 25,
    cfg_scale: float = 7.5
) -> Optional[str]:
    """
    Executes Inpainting via Forge API with VRAM safety resolution clamping.
    """
    orig_img = decode_base64_to_image(image_base64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w, h = orig_img.size

    payload = {
        "init_images": [image_base64],
        "mask": mask_base64,
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "steps": min(steps, 50),
        "cfg_scale": cfg_scale,
        "width": w,
        "height": h,
        "inpainting_fill": 1,  # Original
        "inpaint_full_res": False
    }

    try:
        print(f"[FORGE INPAINT] Calling {FORGE_API_URL}/sdapi/v1/img2img...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/img2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                pil_img = decode_base64_to_image(images[0])
                return encode_image_to_base64(pil_img, format="WEBP")
    except Exception as exc:
        print(f"[FORGE INPAINT FAILED] {exc}")
    
    return None
