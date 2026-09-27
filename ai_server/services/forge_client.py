"""
=============================================================================
LUMA Distributed AI Inference Node — WebUI Forge GPU API Bridge
=============================================================================
ไฟล์นี้เป็นตัวกลาง (Bridge/Client) เชื่อมต่อไปยัง Stable Diffusion WebUI Forge:
1. ทำงานผ่าน Headless REST API บนพอร์ต Loopback `http://127.0.0.1:7861`
2. ตรวจสอบสถานะการออนไลน์ของ Forge API (`/sdapi/v1/progress`)
3. โพลล์สถิติ Live Progress และ Sampling Step ระหว่างที่ GPU ทำการ Denoising
4. ระบบสลับโมเดล Checkpoint แบบไดนามิก (`/sdapi/v1/options`)
5. ฟังก์ชันสร้างภาพ 3 รูปแบบ:
   - run_txt2img: แปลงข้อความเป็นภาพ (Text-to-Image)
   - run_img2img: แปลงภาพต้นฉบับตาม Prompt (Image-to-Image)
   - run_inpaint: ตกแต่งเฉพาะจุดโดยใช้ Mask (Inpainting)
6. สกัดค่า Actual Generation Seed ที่แท้จริงจากผลลัพธ์ของโมเดล
7. บีบอัดภาพ Raw PNG จาก Forge ให้เป็น WebP (Quality 92) ทันทีบนหน่วยความจำ
=============================================================================
"""

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

# ที่อยู่ URL ของ Stable Diffusion WebUI Forge API บนเครื่องท้องถิ่น
FORGE_API_URL = "http://127.0.0.1:7861"


def is_forge_online() -> bool:
    """
    ตรวจสอบว่าเอนจิน Forge API กำลังรันและพร้อมรับคำสั่งบนพอร์ต 7861 หรือไม่:
    - ยิง GET ไปที่ /sdapi/v1/progress โดยกำหนด Timeout ต่ำ (0.5s) เพื่อไม่ให้ระบบหลักสะดุด
    - คืนค่า True หากตอบกลับ HTTP 200, คืนค่า False หาก Connection Refused หรือ Timeout
    """
    try:
        resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/progress", timeout=0.5)
        return resp.status_code == 200
    except Exception:
        return False


def get_forge_progress() -> dict:
    """
    ดึงความคืบหน้าแบบ Real-time ระหว่างที่ GPU กำลังคำนวณ Denoising:
    - progress (0.0 ถึง 1.0): เปอร์เซ็นต์ความคืบหน้าโดยรวม
    - eta_relative: เวลาที่คาดว่าจะเสร็จ (วินาที)
    - step และ total_steps: ลำดับ Step ปัจจุบัน เช่น 12/25
    """
    if not is_forge_online():
        return {"progress": 0.0, "step": 0, "total_steps": 0}
    try:
        # กำหนด skip_current_image=true เพื่อไม่ให้ Forge เปลืองแรงสร้างภาพ Preview ชั่วคราวส่งมา
        resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/progress?skip_current_image=true", timeout=0.5)
        if resp.status_code == 200:
            d = resp.json()
            state = d.get("state", {})
            return {
                "progress": round(float(d.get("progress", 0.0)), 2),
                "eta_relative": round(float(d.get("eta_relative", 0.0)), 1),
                "step": int(state.get("sampling_step", 0)),
                "total_steps": int(state.get("sampling_steps", 0))
            }
    except Exception:
        pass
    return {"progress": 0.0, "step": 0, "total_steps": 0}


def _extract_seed_from_forge_resp(data: dict, fallback_seed: int) -> int:
    """
    สกัดตัวเลข Actual Seed ที่แท้จริงจากการตอบกลับของ Forge:
    - ใน Forge เมื่อผู้ใช้ระบุ Seed = -1 (สุ่ม) Forge จะสุ่มตัวเลขจริงขึ้นมา
      และบันทึกไว้ใน JSON ฟิลด์ 'info' -> 'seed' หรือ 'all_seeds[0]'
    - ฟังก์ชันนี้ถอดรหัส JSON ซ้อนใน string เพื่อดึงตัวเลข Seed นั้นออกมา
      ส่งกลับไปให้ Backend บันทึก เพื่อให้หน้าเว็บกด "Reuse Seed" วาดซ้ำได้
    """
    try:
        info_str = data.get("info")
        if info_str:
            info_obj = json.loads(info_str) if isinstance(info_str, str) else info_str
            if "seed" in info_obj and info_obj["seed"] is not None and int(info_obj["seed"]) >= 0:
                return int(info_obj["seed"])
            all_seeds = info_obj.get("all_seeds", [])
            if all_seeds and len(all_seeds) > 0 and int(all_seeds[0]) >= 0:
                return int(all_seeds[0])
    except Exception as e:
        print(f"[FORGE SEED PARSE WARN] {e}")
    return fallback_seed


def interrupt_forge_generation() -> bool:
    """
    ส่งสัญญาณขัดจังหวะฉุกเฉิน (Hard Cancel) ไปยัง Forge:
    - เรียก POST /sdapi/v1/interrupt
    - สั่งให้ GPU หยุด Loop การ Denoising ทันที เพื่อคืนรอบการทำงานให้งานอื่น
    """
    try:
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/interrupt", timeout=0.5)
        return resp.status_code == 200
    except Exception as e:
        print(f"[FORGE INTERRUPT ERROR] {e}")
        return False


def set_forge_model(checkpoint_name: str) -> bool:
    """
    สลับโมเดล Checkpoint (Weights) ที่ใช้งานอยู่ใน Forge แบบไดนามิก:
    - ค้นหาชื่อโมเดลจากรายการที่ติดตั้งไว้จริงในเครื่องผ่าน /sdapi/v1/sd-models
    - หากโมเดลที่ต้องการยังไม่ได้โหลด จะส่งคำสั่งสลับโมเดลผ่าน /sdapi/v1/options
    """
    try:
        models_resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/sd-models", timeout=3.0)
        if models_resp.status_code == 200:
            available_models = models_resp.json()
            target_title = None
            clean_name = checkpoint_name.replace("'", "").replace('"', "").strip()
            
            # ค้นหาโมเดลที่ชื่อตรงกันมากที่สุด
            for m in available_models:
                title = m.get("title", "")
                fname = m.get("filename", "")
                mname = m.get("model_name", "")
                if clean_name.lower() in title.lower() or clean_name.lower() in fname.lower() or clean_name.lower() in mname.lower():
                    target_title = title
                    break
            
            if target_title:
                # ตรวจสอบโมเดลที่กำลัง Active อยู่ในปัจจุบัน หากตรงกันแล้วไม่ต้องสลับซ้ำ
                opt_resp = requests.get(f"{FORGE_API_URL}/sdapi/v1/options", timeout=2.0)
                if opt_resp.status_code == 200:
                    current_model = opt_resp.json().get("sd_model_checkpoint", "")
                    if current_model == target_title:
                        return True
                
                payload = {"sd_model_checkpoint": target_title}
                resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/options", json=payload, timeout=60.0)
                return resp.status_code == 200
        
        # กรณีค้นหาในลิสต์ไม่พบ ให้ลองส่งชื่อตรงๆ ไปยัง Options
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
    sampler_name: Optional[str] = "DPM++ 2M Karras",
    seed: Optional[int] = None,
    checkpoint: Optional[str] = None
) -> tuple[Optional[str], Optional[int]]:
    """
    ประมวลผล Text-to-Image บน GPU ผ่าน Forge API:
    
    Returns:
        tuple[str, int]: (รูปภาพผลลัพธ์ในรูปแบบ WebP Base64, Seed จริงที่ใช้)
    """
    if checkpoint:
        set_forge_model(checkpoint)

    # ป้องกันข้อผิดพลาด Null/None ใน Negative Prompt (Forge API จะเกิด 500 หากได้รับ None)
    safe_prompt = str(prompt or "")
    safe_neg_prompt = str(negative_prompt) if (negative_prompt is not None and str(negative_prompt).strip() != "") else AIConfig.DEFAULT_NEGATIVE_PROMPT

    payload = {
        "prompt": safe_prompt,
        "negative_prompt": safe_neg_prompt,
        "steps": min(max(int(steps), 1), AIConfig.MAX_STEPS),
        "cfg_scale": float(cfg_scale),
        "width": min(max(int(width), AIConfig.MIN_IMAGE_WIDTH), AIConfig.MAX_IMAGE_WIDTH),
        "height": min(max(int(height), AIConfig.MIN_IMAGE_HEIGHT), AIConfig.MAX_IMAGE_HEIGHT),
        "sampler_name": sampler_name or AIConfig.DEFAULT_SAMPLER,
        "seed": int(seed) if seed is not None and int(seed) >= 0 else -1,
        "batch_size": 1,
        "enable_hr": False
    }

    try:
        print(f"[FORGE INFERENCE] Calling {FORGE_API_URL}/sdapi/v1/txt2img on GPU (seed={payload['seed']})...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/txt2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                # แปลงภาพดิบ PNG ที่ได้จาก Forge ให้เป็น WebP เพื่อความรวดเร็วในการส่งกลับ
                pil_img = decode_base64_to_image(images[0])
                webp_b64 = encode_image_to_base64(pil_img, format="WEBP")
                actual_seed = _extract_seed_from_forge_resp(data, payload["seed"])
                print(f"[FORGE SUCCESS] Image generated on RTX 3070 (seed={actual_seed}) and converted to WebP.")
                return webp_b64, actual_seed
        else:
            print(f"[FORGE HTTP WARN] Status {resp.status_code}: {resp.text[:100]}")
    except Exception as exc:
        print(f"[FORGE INFERENCE FAILED] {exc}")
    
    return None, None


def run_img2img(
    image_base64: str,
    prompt: str,
    negative_prompt: Optional[str] = "blurry, low quality, distorted, bad anatomy",
    steps: int = 25,
    cfg_scale: float = 7.5,
    denoising_strength: float = 0.75,
    width: Optional[int] = None,
    height: Optional[int] = None,
    sampler_name: Optional[str] = "DPM++ 2M Karras",
    seed: Optional[int] = None,
    checkpoint: Optional[str] = None
) -> tuple[Optional[str], Optional[int]]:
    """
    ประมวลผล Image-to-Image (ดัดแปลงภาพต้นฉบับโดยไม่มี Mask) ผ่าน Forge API:
    - ปรับขนาดภาพต้นฉบับให้อยู่ในระยะปลอดภัย (256-768px และหาร 8 ลงตัว)
    - ส่ง init_images และ denoising_strength ควบคุมระดับการเปลี่ยนแปลงภาพ
    """
    if checkpoint:
        set_forge_model(checkpoint)

    orig_img = decode_base64_to_image(image_base64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w = width or orig_img.size[0]
    h = height or orig_img.size[1]

    # บังคับขนาดตามขอบเขตความปลอดภัย
    w = min(max(int(w), AIConfig.MIN_IMAGE_WIDTH), AIConfig.MAX_IMAGE_WIDTH)
    h = min(max(int(h), AIConfig.MIN_IMAGE_HEIGHT), AIConfig.MAX_IMAGE_HEIGHT)

    safe_prompt = str(prompt or "")
    safe_neg_prompt = str(negative_prompt) if (negative_prompt is not None and str(negative_prompt).strip() != "") else AIConfig.DEFAULT_NEGATIVE_PROMPT

    payload = {
        "init_images": [image_base64],
        "prompt": safe_prompt,
        "negative_prompt": safe_neg_prompt,
        "steps": min(max(int(steps), 1), AIConfig.MAX_STEPS),
        "cfg_scale": float(cfg_scale),
        "denoising_strength": float(denoising_strength if denoising_strength is not None else 0.75),
        "width": w,
        "height": h,
        "sampler_name": sampler_name or AIConfig.DEFAULT_SAMPLER,
        "seed": int(seed) if seed is not None and int(seed) >= 0 else -1,
        "batch_size": 1,
    }

    try:
        print(f"[FORGE IMG2IMG] Calling {FORGE_API_URL}/sdapi/v1/img2img on GPU (denoising={payload['denoising_strength']}, seed={payload['seed']})...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/img2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                pil_img = decode_base64_to_image(images[0])
                webp_b64 = encode_image_to_base64(pil_img, format="WEBP")
                actual_seed = _extract_seed_from_forge_resp(data, payload["seed"])
                print(f"[FORGE SUCCESS] img2img generated on RTX 3070 (seed={actual_seed}) and converted to WebP.")
                return webp_b64, actual_seed
        else:
            print(f"[FORGE HTTP WARN] Status {resp.status_code}: {resp.text[:100]}")
    except Exception as exc:
        print(f"[FORGE IMG2IMG FAILED] {exc}")
    
    return None, None


def run_inpaint(
    image_base64: str,
    mask_base64: str,
    prompt: str,
    negative_prompt: Optional[str] = "blurry, low quality, distorted",
    steps: int = 25,
    cfg_scale: float = 7.5,
    denoising_strength: float = 0.75,
    width: Optional[int] = None,
    height: Optional[int] = None,
    sampler_name: Optional[str] = "DPM++ 2M Karras",
    seed: Optional[int] = None,
    checkpoint: Optional[str] = None
) -> tuple[Optional[str], Optional[int]]:
    """
    ประมวลผล Inpainting (แก้ไขเฉพาะบริเวณที่กำหนดด้วย Mask ขาว-ดำ) ผ่าน Forge API:
    - ใช้สำหรับสร้างพื้นหลังใหม่ หรือลบ/แก้ไขวัตถุในภาพ
    - ส่งทั้งภาพต้นฉบับ (init_images) และภาพ Mask ขาว-ดำ (mask)
    """
    if checkpoint:
        set_forge_model(checkpoint)

    orig_img = decode_base64_to_image(image_base64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w = width or orig_img.size[0]
    h = height or orig_img.size[1]

    w = min(max(int(w), AIConfig.MIN_IMAGE_WIDTH), AIConfig.MAX_IMAGE_WIDTH)
    h = min(max(int(h), AIConfig.MIN_IMAGE_HEIGHT), AIConfig.MAX_IMAGE_HEIGHT)

    safe_prompt = str(prompt or "")
    safe_neg_prompt = str(negative_prompt) if (negative_prompt is not None and str(negative_prompt).strip() != "") else "blurry, low quality, distorted"

    payload = {
        "init_images": [image_base64],
        "mask": mask_base64,
        "prompt": safe_prompt,
        "negative_prompt": safe_neg_prompt,
        "steps": min(max(int(steps), 1), AIConfig.MAX_STEPS),
        "cfg_scale": float(cfg_scale),
        "denoising_strength": float(denoising_strength if denoising_strength is not None else 0.75),
        "width": w,
        "height": h,
        "sampler_name": sampler_name or AIConfig.DEFAULT_SAMPLER,
        "seed": int(seed) if seed is not None and int(seed) >= 0 else -1,
        "inpainting_fill": 1,  # 1 = Original image content
        "inpaint_full_res": False
    }

    try:
        print(f"[FORGE INPAINT] Calling {FORGE_API_URL}/sdapi/v1/img2img on GPU (denoising={payload['denoising_strength']}, seed={payload['seed']})...")
        resp = requests.post(f"{FORGE_API_URL}/sdapi/v1/img2img", json=payload, timeout=120.0)
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            if images:
                pil_img = decode_base64_to_image(images[0])
                webp_b64 = encode_image_to_base64(pil_img, format="WEBP")
                actual_seed = _extract_seed_from_forge_resp(data, payload["seed"])
                print(f"[FORGE SUCCESS] Inpaint generated on RTX 3070 (seed={actual_seed}) and converted to WebP.")
                return webp_b64, actual_seed
        else:
            print(f"[FORGE HTTP WARN] Status {resp.status_code}: {resp.text[:100]}")
    except Exception as exc:
        print(f"[FORGE INPAINT FAILED] {exc}")
    
    return None, None
