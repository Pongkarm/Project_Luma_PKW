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
    """Switches the active Stable Diffusion checkpoint in Forge with dynamic title lookup."""
    try:
        # 1. Fetch available models from Forge
        models_resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/sd-models", timeout=3.0)
        if models_resp.status_code == 200:
            available_models = models_resp.json()
            target_title = None
            clean_name = checkpoint_name.replace("'", "").replace('"', "").strip()
            
            # Find best match
            for m in available_models:
                title = m.get("title", "")
                fname = m.get("filename", "")
                mname = m.get("model_name", "")
                if clean_name.lower() in title.lower() or clean_name.lower() in fname.lower() or clean_name.lower() in mname.lower():
                    target_title = title
                    break
            
            if target_title:
                # Check current active model
                opt_resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/options", timeout=2.0)
                if opt_resp.status_code == 200:
                    current_model = opt_resp.json().get("sd_model_checkpoint", "")
                    if current_model == target_title:
                        return True  # Already active
                
                payload = {"sd_model_checkpoint": target_title}
                resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/options", json=payload, timeout=60.0)
                return resp.status_code == 200
        
        # Fallback to direct name
        payload = {"sd_model_checkpoint": checkpoint_name}
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/options", json=payload, timeout=30.0)
        return resp.status_code == 200
    except Exception as e:
        print(f"[FORGE MODEL SWITCH ERROR] {e}")
        return False

def run_txt2img(
    prompt: str,
    negative_prompt: Optional[str] = "blurry, low quality, distorted, bad anatomy",
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

    # Ensure strings are NEVER None (Forge crashes on null/None in negative_prompt)
    safe_prompt = str(prompt or "")
    safe_neg_prompt = str(negative_prompt) if (negative_prompt is not None and str(negative_prompt).strip() != "") else "blurry, low quality, distorted, bad anatomy"

    payload = {
        "prompt": safe_prompt,
        "negative_prompt": safe_neg_prompt,
        "steps": min(max(int(steps), 1), 50),
        "cfg_scale": float(cfg_scale),
        "width": min(int(width), AIConfig.MAX_IMAGE_WIDTH),
        "height": min(int(height), AIConfig.MAX_IMAGE_HEIGHT),
        "sampler_name": sampler_name or "DPM++ 2M Karras",
        "batch_size": 1,
        "enable_hr": False
    }

    try:
        print(f"[FORGE INFERENCE] Calling {FORGE_API_URL}/sdapi/v1/txt2img on GPU...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/txt2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                # Convert raw PNG from Forge into high-efficiency WebP
                pil_img = decode_base64_to_image(images[0])
                webp_b64 = encode_image_to_base64(pil_img, format="WEBP")
                print(f"[FORGE SUCCESS] Image generated on RTX 3070 and converted to WebP.")
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
    negative_prompt: Optional[str] = "blurry, low quality, distorted",
    steps: int = 25,
    cfg_scale: float = 7.5
) -> Optional[str]:
    """
    Executes Inpainting via Forge API with VRAM safety resolution clamping.
    """
    orig_img = decode_base64_to_image(image_base64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w, h = orig_img.size

    safe_prompt = str(prompt or "")
    safe_neg_prompt = str(negative_prompt) if (negative_prompt is not None and str(negative_prompt).strip() != "") else "blurry, low quality, distorted"

    payload = {
        "init_images": [image_base64],
        "mask": mask_base64,
        "prompt": safe_prompt,
        "negative_prompt": safe_neg_prompt,
        "steps": min(max(int(steps), 1), 50),
        "cfg_scale": float(cfg_scale),
        "width": w,
        "height": h,
        "inpainting_fill": 1,  # Original
        "inpaint_full_res": False
    }

    try:
        print(f"[FORGE INPAINT] Calling {FORGE_API_URL}/sdapi/v1/img2img on GPU...")
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
