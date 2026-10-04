"""
=============================================================================
LUMA Distributed AI Inference Node — FastAPI Server & Application Routing
=============================================================================
ไฟล์นี้เป็นศูนย์กลางหลักของ Node 3 (AI Inference Engine บน PC3):
1. ทำหน้าที่เป็น REST API Gateway ให้กับ Backend Core (Node 2)
2. มีระบบ Security Gatekeeper ตรวจสอบ Header 'X-LUMA-INTERNAL-SECRET' ทุก Request
3. Data Contract Validation ด้วย Pydantic ป้องกันข้อมูลผิดรูปหรือเกินขอบเขต
4. ควบคุมวงจรชีวิตของระบบ (Lifespan): จัดการ Task Queue Worker, VRAM Cache, และการปิดระบบ
5. Endpoints หลัก:
   - GET /: หน้าจอ HTML Dashboard แสดงสถานะโหนด, สถิติ VRAM และลิงก์เอกสาร
   - GET /ai/health: รายงานสถิติ GPU, ปริมาณคิว และสถานะความพร้อมของระบบ
   - GET /ai/models: สแกนโมเดล Checkpoints และ LoRAs จาก Stability Matrix อัตโนมัติ
   - POST /ai/generate: รับงาน Text-to-Image เข้าสู่ FIFO Queue (ตอบกลับ 202 ทันที)
   - POST /ai/edit: รับงาน Image-to-Image / Inpainting เข้าสู่ FIFO Queue
   - GET /ai/task/{task_id}: โพลล์สถานะ Step และ Progress แบบ Real-time
   - DELETE /ai/task/{task_id}: ยกเลิกงานสร้างภาพ (ทั้งแบบ Soft Cancel และ Hard Cancel)
=============================================================================
"""

import os
import sys
import uuid
import random
from contextlib import asynccontextmanager
from typing import Optional, Union, List, Any

# ตรวจสอบว่า Project Root อยู่ใน sys.path เสมอเพื่อป้องกัน Import Error
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont

# โมดูลภายในระบบ AI Node
from ai_server.config import AIConfig
from ai_server.utils.gpu_monitor import get_gpu_status, clear_vram_cache
from ai_server.utils.cache_manager import cleanup_stale_cache
from ai_server.utils.image_utils import (
    decode_base64_to_image, 
    encode_image_to_base64, 
    enforce_max_resolution
)
from ai_server.services.queue_manager import task_queue
from ai_server.services.prompt_builder import build_prompt_with_lora, LORA_REGISTRY, detect_model_family
from ai_server.services.forge_client import (
    is_forge_online, 
    run_txt2img, 
    run_img2img,
    run_inpaint,
    set_forge_model
)


# =============================================================================
# 1. วงจรชีวิตของเซิร์ฟเวอร์ (Application Lifespan Context Manager)
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    ควบคุมขั้นตอนการสตาร์ตและปิดเซิร์ฟเวอร์อย่างปลอดภัย (Graceful Lifecycle):
    - Startup: พิมพ์แบนเนอร์, เคลียร์ไฟล์ Cache ค้างเก่า, สตาร์ต Background Task Queue Worker
    - Shutdown: หยุดการทำงานของ Worker และสั่งล้างหน่วยความจำ VRAM บน GPU
    """
    print("==================================================")
    print("🚀 LUMA AI Server Starting up on Port 7860...")
    print(f"📡 Node Binding: {AIConfig.HOST}:{AIConfig.PORT}")
    print(f"🔗 Callback Target: {AIConfig.BACKEND_CALLBACK_URL}")
    print(f"🎨 LoRA Registry: Loaded {len(LORA_REGISTRY)} styles")
    print("==================================================")
    
    # ทำความสะอาดแคชรูปภาพเก่าที่ตกค้างจากการรันครั้งก่อน
    cleanup_stale_cache()
    # สตาร์ตลูปประมวลผลคิวในพื้นหลัง
    task_queue.start_worker()
    
    yield  # เซิร์ฟเวอร์ทำงานต่อเนื่องระหว่างจุดนี้
    
    print("🛑 LUMA AI Server Shutting down...")
    task_queue.stop_worker()
    clear_vram_cache()


# สร้าง FastAPI Instance พร้อมคำอธิบาย API
app = FastAPI(
    title="LUMA AI Engine API",
    description="Production-Hardened Distributed Generative AI Node with Input Sanitization, LoRA Injection, and VRAM Safeguards",
    version="1.2.0",
    lifespan=lifespan
)

# -----------------------------------------------------------------------------
# CORS Middleware: อนุญาตให้ Frontend สามารถยิง API มาทดสอบได้โดยตรง
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# 2. Pydantic Request Schemas (สัญญาเชื่อมต่อข้อมูลระดับเครือข่าย)
# =============================================================================
class GenerateRequest(BaseModel):
    """
    โครงสร้างข้อมูลสำหรับ Request การสร้างภาพแบบ Text-to-Image (txt2img):
    มีการตรวจสอบขอบเขตข้อมูลอย่างเข้มงวด (Data Validation) ตามสเปกความปลอดภัย
    """
    task_id: str = Field(..., description="รหัสงาน UUID ที่สร้างโดย Backend")
    prompt: str = Field(
        ..., 
        min_length=AIConfig.MIN_PROMPT_LENGTH, 
        max_length=AIConfig.MAX_PROMPT_LENGTH, 
        description="ข้อความอธิบายภาพ (สูงสุด 2,000 ตัวอักษร)"
    )
    negative_prompt: Optional[str] = Field(
        "blurry, low quality, distorted, bad anatomy", 
        max_length=AIConfig.MAX_NEGATIVE_PROMPT_LENGTH,
        description="ข้อความระบุสิ่งที่ไม่ต้องการให้ปรากฏในภาพ"
    )
    model: Optional[str] = None
    model_name: Optional[str] = AIConfig.DEFAULT_MODEL
    lora: Optional[str] = None
    lora_config: Optional[Any] = None  # รองรับได้ทั้ง String, Dict หรือ List ที่ส่งมาจาก Backend
    sampler_name: Optional[str] = AIConfig.DEFAULT_SAMPLER
    steps: Optional[int] = Field(
        AIConfig.DEFAULT_STEPS, 
        ge=AIConfig.MIN_STEPS, 
        le=AIConfig.MAX_STEPS, 
        description="จำนวนรอบ Sampling (1-50 Steps)"
    )
    cfg_scale: Optional[float] = Field(
        AIConfig.DEFAULT_CFG, 
        ge=AIConfig.MIN_CFG, 
        le=AIConfig.MAX_CFG, 
        description="ความเข้มงวดตาม Prompt (1.0-20.0)"
    )
    seed: Optional[int] = None
    width: Optional[int] = Field(
        AIConfig.DEFAULT_WIDTH, 
        ge=AIConfig.MIN_IMAGE_WIDTH, 
        le=AIConfig.MAX_IMAGE_WIDTH, 
        description="ความกว้างของภาพ (256-768px, หารด้วย 8 ลงตัว)"
    )
    height: Optional[int] = Field(
        AIConfig.DEFAULT_HEIGHT, 
        ge=AIConfig.MIN_IMAGE_HEIGHT, 
        le=AIConfig.MAX_IMAGE_HEIGHT, 
        description="ความสูงของภาพ (256-768px, หารด้วย 8 ลงตัว)"
    )
    task_type: Optional[str] = "txt2img"
    source_image_path: Optional[str] = None
    image_base64: Optional[str] = None
    mask_base64: Optional[str] = None
    denoising_strength: Optional[float] = 0.75
    callback_url: Optional[str] = AIConfig.BACKEND_CALLBACK_URL
    correlation_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4())[:8])


class EditRequest(BaseModel):
    """
    โครงสร้างข้อมูลสำหรับ Request การตัดต่อภาพ (Image-to-Image / Inpaint):
    รับภาพต้นฉบับ (image_base64) และภาพ Mask ขาว-ดำ (mask_base64)
    """
    task_id: str = Field(..., description="รหัสงาน UUID จาก Backend")
    prompt: str = Field(
        ..., 
        min_length=AIConfig.MIN_PROMPT_LENGTH, 
        max_length=AIConfig.MAX_PROMPT_LENGTH, 
        description="คำสั่งตัดต่อภาพ"
    )
    negative_prompt: Optional[str] = Field(
        "blurry, low quality, distorted, bad anatomy", 
        max_length=AIConfig.MAX_NEGATIVE_PROMPT_LENGTH
    )
    image_base64: str = Field(..., description="ภาพต้นฉบับในรูปแบบ Base64 Data URL")
    mask_base64: Optional[str] = Field(None, description="ภาพ Mask ขาว-ดำ สำหรับโหมด Inpainting")
    mode: Optional[str] = "inpaint"  # ตัวเลือกระหว่าง "inpaint" หรือ "img2img"
    model: Optional[str] = None
    model_name: Optional[str] = AIConfig.DEFAULT_MODEL
    lora: Optional[str] = None
    lora_config: Optional[Any] = None
    sampler_name: Optional[str] = AIConfig.DEFAULT_SAMPLER
    steps: Optional[int] = Field(AIConfig.DEFAULT_STEPS, ge=AIConfig.MIN_STEPS, le=AIConfig.MAX_STEPS)
    cfg_scale: Optional[float] = Field(AIConfig.DEFAULT_CFG, ge=AIConfig.MIN_CFG, le=AIConfig.MAX_CFG)
    seed: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    denoising_strength: Optional[float] = 0.75
    callback_url: Optional[str] = AIConfig.BACKEND_CALLBACK_URL
    correlation_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4())[:8])


# =============================================================================
# 3. Security Verification Helper (ด่านตรวจความปลอดภัย)
# =============================================================================
def verify_internal_secret(token: Optional[str]):
    """
    ตรวจสอบความปลอดภัยของ Request ผ่าน HTTP Header:
    - ต้องมี Header: 'X-LUMA-INTERNAL-SECRET'
    - ค่า Token ต้องตรงกับ AIConfig.INTERNAL_SECRET 100%
    - หากไม่ผ่าน จะโยน Exception HTTP 403 Forbidden ทันที
    """
    if not token or token != AIConfig.INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Invalid or missing X-LUMA-INTERNAL-SECRET header"
        )


def extract_primary_lora(data: dict) -> Optional[str]:
    """
    ฟังก์ชันอัจฉริยะในการแยกชื่อโมเดล LoRA จากรูปแบบที่หลากหลาย
    รองรับทั้งสตริงธรรมดา, Dict (เช่น {'id': '...'}) หรือ List ที่ Backend อาจส่งมา
    """
    if data.get("lora"):
        return data.get("lora")
    
    lora_cfg = data.get("lora_config")
    if not lora_cfg:
        return None
        
    if isinstance(lora_cfg, list) and len(lora_cfg) > 0:
        first = lora_cfg[0]
        if isinstance(first, dict):
            return first.get("id") or first.get("name")
        return str(first)
    elif isinstance(lora_cfg, dict):
        if "id" in lora_cfg:
            return lora_cfg.get("id")
        if "name" in lora_cfg:
            return lora_cfg.get("name")
        for k in lora_cfg.keys():
            if k in LORA_REGISTRY or k.endswith(".safetensors"):
                return k
        if len(lora_cfg) > 0:
            return list(lora_cfg.keys())[0]
    elif isinstance(lora_cfg, str):
        return lora_cfg
    return None


# =============================================================================
# 4. Inference Handlers (ฟังก์ชันประมวลผลงานภาพ)
# =============================================================================
def handle_txt2img_inference(data: dict) -> tuple[str, int]:
    """
    ประมวลผล Text-to-Image พร้อมระบบ Fallback Safety:
    1. ทำการแทรก LoRA Trigger Word อัตโนมัติ (Single Source of Truth)
    2. หาก Forge Online (:7861): ประมวลผลบนการ์ดจอ RTX 3070 จริง
    3. หาก Forge Offline: วาดภาพพรีวิวพร้อม Metadata เพื่อรักษาเสถียรภาพระบบ
    
    Returns:
        tuple[str, int]: (WebP Base64 Data URL, Actual Seed)
    """
    raw_prompt = data.get("prompt", "")
    lora_id = extract_primary_lora(data)
    model_name = data.get("model_name") or data.get("model") or AIConfig.DEFAULT_MODEL
    
    # แทรก LoRA Syntax และ Trigger Word ลงใน Prompt (พร้อมตรวจสอบ Model-LoRA Compatibility Guard)
    enriched_prompt, lora_tag = build_prompt_with_lora(raw_prompt, lora_id, model_name=model_name)
    print(f"[PROMPT ENRICHED] Raw: '{raw_prompt}' -> Enriched: '{enriched_prompt}' (LoRA: {lora_id})")

    # 1. รันบน GPU จริงผ่าน Forge API
    if is_forge_online():
        print("[ENGINE] WebUI Forge Engine is ONLINE on port 7861. Running on GPU...")
        forge_res, actual_seed = run_txt2img(
            prompt=enriched_prompt,
            negative_prompt=data.get("negative_prompt") if data.get("negative_prompt") else AIConfig.DEFAULT_NEGATIVE_PROMPT,
            steps=data.get("steps", AIConfig.DEFAULT_STEPS),
            cfg_scale=data.get("cfg_scale", AIConfig.DEFAULT_CFG),
            width=data.get("width", AIConfig.DEFAULT_WIDTH),
            height=data.get("height", AIConfig.DEFAULT_HEIGHT),
            sampler_name=data.get("sampler_name", AIConfig.DEFAULT_SAMPLER),
            seed=data.get("seed"),
            checkpoint=model_name
        )
        if forge_res:
            return forge_res, actual_seed

    # 2. กรณี Forge Offline: สลับใช้ High-Fidelity Fallback Preview
    if not AIConfig.ALLOW_FALLBACK_RENDER:
        raise RuntimeError("WebUI Forge GPU engine is offline and fallback rendering is disabled.")

    print("[ENGINE] Running High-Fidelity Fallback Renderer for txt2img...")
    w = min(data.get("width", AIConfig.DEFAULT_WIDTH), AIConfig.MAX_IMAGE_WIDTH)
    h = min(data.get("height", AIConfig.DEFAULT_HEIGHT), AIConfig.MAX_IMAGE_HEIGHT)

    raw_seed = data.get("seed")
    actual_seed = int(raw_seed) if raw_seed is not None and int(raw_seed) >= 0 else random.randint(100000000, 999999999)

    # วาดการ์ดพรีวิวด้วย Pillow
    img = Image.new("RGB", (w, h), color=(18, 22, 30))
    draw = ImageDraw.Draw(img)
    draw.rectangle([(16, 16), (w - 16, h - 16)], outline=(255, 100, 100), width=3)
    draw.text((36, 36), "⚠️ PREVIEW ONLY — Forge GPU offline [txt2img]", fill=(255, 100, 100))
    draw.text((36, 75), f"Prompt: {enriched_prompt[:65]}...", fill=(180, 210, 255))
    draw.text((36, 115), f"Model: {model_name} | LoRA: {lora_id or 'None'}", fill=(130, 160, 200))
    draw.text((36, 145), f"Resolution: {w}x{h} | Steps: {data.get('steps', 25)}", fill=(100, 130, 170))
    draw.text((36, 175), f"Seed: {actual_seed} | Sampler: {data.get('sampler_name', AIConfig.DEFAULT_SAMPLER)}", fill=(100, 130, 170))

    return encode_image_to_base64(img, format="WEBP"), actual_seed


def handle_edit_inference(data: dict) -> tuple[str, int]:
    """
    ประมวลผล Image Editing (Img2Img หรือ Inpaint):
    รองรับการตัดต่อภาพทั้งแบบมี Mask และไม่มี Mask พร้อมระบบ Fallback
    """
    raw_prompt = data.get("prompt", "")
    orig_b64 = data.get("image_base64")
    mask_b64 = data.get("mask_base64")
    lora_id = extract_primary_lora(data)
    model_name = data.get("model_name") or data.get("model") or AIConfig.DEFAULT_MODEL
    mode = (data.get("mode") or ("inpaint" if mask_b64 else "img2img")).lower()

    enriched_prompt, lora_tag = build_prompt_with_lora(raw_prompt, lora_id, model_name=model_name)
    print(f"[EDIT PROMPT ENRICHED] Mode: '{mode}' | Raw: '{raw_prompt}' -> Enriched: '{enriched_prompt}' (LoRA: {lora_id})")

    # 1. รันบน GPU จริง
    if is_forge_online():
        print(f"[ENGINE] WebUI Forge Engine is ONLINE on port 7861. Running {mode} on GPU...")
        if mode == "inpaint" and mask_b64:
            inpaint_res, actual_seed = run_inpaint(
                image_base64=orig_b64,
                mask_base64=mask_b64,
                prompt=enriched_prompt,
                negative_prompt=data.get("negative_prompt") if data.get("negative_prompt") else AIConfig.DEFAULT_NEGATIVE_PROMPT,
                steps=data.get("steps", AIConfig.DEFAULT_STEPS),
                cfg_scale=data.get("cfg_scale", AIConfig.DEFAULT_CFG),
                denoising_strength=data.get("denoising_strength", 0.75),
                sampler_name=data.get("sampler_name", AIConfig.DEFAULT_SAMPLER),
                seed=data.get("seed"),
                checkpoint=model_name
            )
            if inpaint_res:
                return inpaint_res, actual_seed
        else:
            img2img_res, actual_seed = run_img2img(
                image_base64=orig_b64,
                prompt=enriched_prompt,
                negative_prompt=data.get("negative_prompt") if data.get("negative_prompt") else AIConfig.DEFAULT_NEGATIVE_PROMPT,
                steps=data.get("steps", AIConfig.DEFAULT_STEPS),
                cfg_scale=data.get("cfg_scale", AIConfig.DEFAULT_CFG),
                denoising_strength=data.get("denoising_strength", 0.75),
                width=data.get("width"),
                height=data.get("height"),
                sampler_name=data.get("sampler_name", AIConfig.DEFAULT_SAMPLER),
                seed=data.get("seed"),
                checkpoint=model_name
            )
            if img2img_res:
                return img2img_res, actual_seed

    # 2. Fallback Preview สำหรับการทดสอบ
    if not AIConfig.ALLOW_FALLBACK_RENDER:
        raise RuntimeError(f"WebUI Forge GPU engine is offline and fallback rendering is disabled for {mode}.")

    print(f"[ENGINE] Running High-Fidelity Fallback Renderer for {mode}...")
    orig_img = decode_base64_to_image(orig_b64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w, h = orig_img.size

    raw_seed = data.get("seed")
    actual_seed = int(raw_seed) if raw_seed is not None and int(raw_seed) >= 0 else random.randint(100000000, 999999999)
    
    # วาดแถบ Banner คาดทับด้านล่างของภาพต้นฉบับ
    draw = ImageDraw.Draw(orig_img)
    banner_h = 44
    draw.rectangle([(0, h - banner_h), (w, h)], fill=(10, 15, 25))
    draw.text((16, h - 34), f"⚠️ PREVIEW ONLY — Forge GPU offline [{mode}]", fill=(255, 100, 100))
    draw.text((16, h - 18), f"Prompt: {enriched_prompt[:35]}... | Seed: {actual_seed}", fill=(180, 200, 220))
    
    return encode_image_to_base64(orig_img, format="WEBP"), actual_seed


handle_inpaint_inference = handle_edit_inference


# =============================================================================
# 5. REST API Endpoints
# =============================================================================
@app.get("/", response_class=HTMLResponse)
async def root_dashboard():
    """หน้าจอแดชบอร์ดหลักแสดงสถิติและสถานะของโหนด AI ในแบบ HTML"""
    gpu = get_gpu_status()
    device_name = gpu.get("device", "NVIDIA GPU")
    vram_free = gpu.get("vram_free_gb", 0.0)
    vram_total = gpu.get("vram_total_gb", 0.0)

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LUMA AI Inference Node (PC3)</title>
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {{
                --bg: #0d1117;
                --card: #161b22;
                --border: #30363d;
                --text: #c9d1d9;
                --accent: #58a6ff;
                --success: #3fb950;
            }}
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{
                font-family: 'Plus Jakarta Sans', sans-serif;
                background-color: var(--bg);
                color: var(--text);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
            }}
            .card {{
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 16px;
                max-width: 650px;
                width: 100%;
                padding: 32px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }}
            .header {{
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 24px;
                border-bottom: 1px solid var(--border);
                padding-bottom: 16px;
            }}
            .badge {{
                background: rgba(63, 185, 80, 0.15);
                color: var(--success);
                border: 1px solid rgba(63, 185, 80, 0.4);
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }}
            h1 {{ font-size: 22px; color: #fff; }}
            .metric-grid {{
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                margin-bottom: 24px;
            }}
            .metric {{
                background: #0d1117;
                border: 1px solid var(--border);
                padding: 16px;
                border-radius: 10px;
            }}
            .metric label {{ font-size: 12px; color: #8b949e; text-transform: uppercase; font-family: 'Fira Code', monospace; }}
            .metric .val {{ font-size: 18px; color: #fff; font-weight: 600; margin-top: 4px; }}
            .actions {{
                display: flex;
                gap: 12px;
            }}
            .btn {{
                flex: 1;
                text-align: center;
                padding: 12px;
                border-radius: 8px;
                font-weight: 600;
                text-decoration: none;
                transition: all 0.2s;
            }}
            .btn-primary {{
                background: #238636;
                color: #fff;
            }}
            .btn-primary:hover {{ background: #2ea043; }}
            .btn-secondary {{
                background: #21262d;
                color: #c9d1d9;
                border: 1px solid var(--border);
            }}
            .btn-secondary:hover {{ background: #30363d; color: #fff; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>🤖 LUMA AI Inference Node</h1>
                <span class="badge">● Online</span>
            </div>
            <div class="metric-grid">
                <div class="metric">
                    <label>Node IP & Port</label>
                    <div class="val" style="font-family: 'Fira Code', monospace;">192.168.1.30:7860</div>
                </div>
                <div class="metric">
                    <label>Hardware GPU</label>
                    <div class="val">{device_name}</div>
                </div>
                <div class="metric">
                    <label>VRAM Available</label>
                    <div class="val" style="color: var(--success);">{vram_free} GB / {vram_total} GB</div>
                </div>
                <div class="metric">
                    <label>Task Queue Status</label>
                    <div class="val">Idle (FIFO Ready)</div>
                </div>
            </div>
            <div class="actions">
                <a href="/docs" class="btn btn-primary">📖 Interactive API Docs (Swagger)</a>
                <a href="/ai/health" class="btn btn-secondary">🩺 Live Health JSON</a>
                <a href="/ai/models" class="btn btn-secondary">📦 Loaded Models</a>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content


@app.get("/ai/health")
async def health_check():
    """
    Endpoint ตรวจสุขภาพระบบ (Healthcheck):
    รายงานสถานะ GPU, จำนวนคิว และ Task ID ที่กำลังประมวลผลอยู่
    """
    gpu = get_gpu_status()
    return {
        "status": "online",
        "service": "LUMA AI Inference Node (PC3)",
        "queue_size": task_queue._queue.qsize(),
        "is_gpu_busy": task_queue.is_busy,
        "current_task": task_queue.current_task_id,
        "gpu": gpu
    }


@app.get("/ai/models")
async def list_available_models():
    """
    สแกนไดเรกทอรีของ Stability Matrix และส่งคืนรายการโมเดล Checkpoints และ LoRAs ทั้งหมด
    ช่วยให้ Frontend ดึงรายชื่อโมเดลไปแสดงใน Dropdown ได้โดยตรง
    """
    checkpoints = []
    loras = []

    # สแกน Checkpoint Models (.safetensors, .ckpt)
    if os.path.exists(AIConfig.CHECKPOINTS_DIR):
        for f in os.listdir(AIConfig.CHECKPOINTS_DIR):
            if f.endswith((".safetensors", ".ckpt")):
                checkpoints.append({
                    "id": f,
                    "name": f.replace(".safetensors", "").replace(".ckpt", ""),
                    "path": os.path.join(AIConfig.CHECKPOINTS_DIR, f),
                    "family": detect_model_family(f)
                })

    # สแกน LoRA Adapters (.safetensors)
    if os.path.exists(AIConfig.LORA_DIR):
        for f in os.listdir(AIConfig.LORA_DIR):
            if f.endswith(".safetensors"):
                lora_cfg = LORA_REGISTRY.get(f, {})
                lora_family = lora_cfg.get("family")
                if not lora_family or lora_family == "unknown":
                    lora_family = detect_model_family(f)
                loras.append({
                    "id": f,
                    "name": f.replace(".safetensors", ""),
                    "path": os.path.join(AIConfig.LORA_DIR, f),
                    "family": lora_family
                })

    return {
        "checkpoints": checkpoints,
        "loras": loras,
        "total_checkpoints": len(checkpoints),
        "total_loras": len(loras)
    }


@app.post("/ai/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_image(
    req: GenerateRequest,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """
    รับคำสั่ง Text-to-Image จาก Backend:
    1. ตรวจสอบความปลอดภัยด้วย Header X-LUMA-INTERNAL-SECRET
    2. นำงานเข้าคิว FIFO
    3. ตอบกลับ HTTP 202 Accepted ทันทีพร้อมแจ้งตำแหน่งคิว เพื่อไม่ให้เกิดการบล็อกการทำงาน
    """
    verify_internal_secret(x_luma_internal_secret)
    q_pos = await task_queue.enqueue(req.model_dump(), handle_txt2img_inference)
    return {
        "task_id": req.task_id,
        "status": "accepted",
        "queue_position": q_pos,
        "message": "Task successfully queued for GPU inference"
    }


@app.post("/ai/edit", status_code=status.HTTP_202_ACCEPTED)
async def edit_image(
    req: EditRequest,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """
    รับคำสั่ง Image Editing (Img2Img / Inpaint) จาก Backend
    ตอบกลับ HTTP 202 Accepted พร้อมตำแหน่งคิว
    """
    verify_internal_secret(x_luma_internal_secret)
    q_pos = await task_queue.enqueue(req.model_dump(), handle_inpaint_inference)
    return {
        "task_id": req.task_id,
        "status": "accepted",
        "queue_position": q_pos,
        "message": "Edit task successfully queued for GPU inference"
    }


@app.delete("/ai/task/{task_id}")
async def cancel_ai_task(
    task_id: str,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """
    ยกเลิกงานเจนภาพ (รองรับทั้ง Soft Cancel ในคิว และ Hard Cancel บน GPU):
    - คืนค่า 200 OK หากยกเลิกสำเร็จ
    - คืนค่า 409 Conflict หากงานเจนเสร็จสิ้นไปแล้ว
    """
    verify_internal_secret(x_luma_internal_secret)
    status_code, message = await task_queue.cancel_task(task_id)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=message)
    return {
        "task_id": task_id,
        "status": "cancelled",
        "message": message
    }


@app.get("/ai/status/{task_id}")
@app.get("/ai/task/{task_id}")
async def get_ai_task_status(
    task_id: str,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """
    โพลล์ดูสถานะของงานแบบ Real-time:
    - รายงานเปอร์เซ็นต์ Denoising Progress, ลำดับ Step, และค่า Seed จริง
    - ช่วยให้ Frontend นำไปเรนเดอร์ Progress Bar ที่แม่นยำ
    """
    verify_internal_secret(x_luma_internal_secret)
    info = task_queue.get_task_status(task_id)
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found in memory")
    return {
        "task_id": task_id,
        "status": info.get("status"),
        "elapsed": info.get("elapsed", 0.0),
        "queue_position": info.get("queue_position"),
        "total_queued": info.get("total_queued"),
        "progress": info.get("progress"),
        "step": info.get("step"),
        "total_steps": info.get("total_steps"),
        "seed": info.get("seed")
    }


if __name__ == "__main__":
    uvicorn.run("ai_server.server:app", host=AIConfig.HOST, port=AIConfig.PORT, reload=True)
