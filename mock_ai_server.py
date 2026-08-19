"""
LUMA Mock AI Server
รองรับ:
1. Direct Mode (POST /generate): สำหรับ txt2img, img2img, inpaint
2. Async Callback Mode (POST /ai/generate & POST /ai/edit): ตามสเปก Distributed Inference Node
"""
import io
import time
import base64
import asyncio
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

import httpx
from fastapi import FastAPI, BackgroundTasks, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | [Mock AI] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mock_ai_server")

app = FastAPI(
    title="LUMA Mock AI Inference Server",
    description="Dual-Mode Mock AI Server with txt2img, img2img, and Inpainting support",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────
class DirectGenerateRequest(BaseModel):
    task_type: Optional[str] = "txt2img"
    prompt: str = Field(..., min_length=1)
    negative_prompt: Optional[str] = None
    steps: Optional[int] = 25
    cfg_scale: Optional[float] = 7.5
    width: Optional[int] = 512
    height: Optional[int] = 512
    sampler_name: Optional[str] = "Euler a"
    seed: Optional[int] = -1
    model_name: Optional[str] = "counterfeitV30_v30.safetensors"
    lora_config: Optional[List[Dict[str, Any]]] = None
    source_image_path: Optional[str] = None
    image_base64: Optional[str] = None
    mask_base64: Optional[str] = None
    denoising_strength: Optional[float] = None


class CallbackGenerateRequest(BaseModel):
    task_id: str
    prompt: str = Field(..., min_length=1)
    negative_prompt: Optional[str] = None
    model: Optional[str] = "counterfeitV30_v30.safetensors"
    lora: Optional[str] = None
    steps: Optional[int] = 25
    cfg_scale: Optional[float] = 7.5
    width: Optional[int] = 512
    height: Optional[int] = 512
    callback_url: Optional[str] = "http://localhost:8000/api/callback"


class CallbackEditRequest(BaseModel):
    task_id: str
    prompt: str = Field(..., min_length=1)
    image_base64: str
    mask_base64: Optional[str] = None
    mode: Optional[str] = "img2img"  # "img2img" | "inpaint"
    steps: Optional[int] = 25
    cfg_scale: Optional[float] = 7.5
    callback_url: Optional[str] = "http://localhost:8000/api/callback"


# ──────────────────────────────────────────────
# Helper: สร้างภาพจำลองตาม Task Type (txt2img / img2img / inpaint)
# ──────────────────────────────────────────────
def generate_mock_image_base64(
    prompt: str,
    width: int = 512,
    height: int = 512,
    model_name: str = "counterfeitV30_v30",
    task_type: str = "txt2img",
    source_b64: Optional[str] = None,
    mask_b64: Optional[str] = None
) -> str:
    """วาดภาพจำลองด้วย Pillow แยกสไตล์ตามโหมดการทำงาน"""
    w = max(256, min(width, 1024))
    h = max(256, min(height, 1024))

    # 1. โหมด Inpainting (ถ้ามี source_image)
    if task_type == "inpaint" and source_b64:
        try:
            orig_bytes = base64.b64decode(source_b64)
            img = Image.open(io.BytesIO(orig_bytes)).convert("RGB").resize((w, h))
            draw = ImageDraw.Draw(img)

            # วาด Highlight Region จำลอง Inpainted Area
            margin = 30
            draw.rectangle(
                [(w // 4, h // 4), (w * 3 // 4, h * 3 // 4)],
                outline=(56, 189, 248),  # Cyan
                width=3
            )
            draw.text((w // 4 + 10, h // 4 + 10), "✨ LUMA Inpainted Region", fill=(56, 189, 248))
            draw.text((20, h - 35), f"Inpaint Prompt: {prompt[:40]}...", fill=(255, 255, 255))
            
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
        except Exception as e:
            logger.warning(f"Fallback to synthetic inpaint: {e}")

    # 2. โหมด img2img: ทำ Side-by-Side (Original vs Stylized)
    if task_type == "img2img" and source_b64:
        try:
            orig_bytes = base64.b64decode(source_b64)
            orig_img = Image.open(io.BytesIO(orig_bytes)).convert("RGB").resize((w // 2, h))
            
            # รวมภาพซ้าย-ขวา
            img = Image.new("RGB", (w, h), color=(15, 23, 42))
            img.paste(orig_img, (0, 0))
            
            draw = ImageDraw.Draw(img)
            # เส้นแบ่งครึ่ง
            draw.line([(w // 2, 0), (w // 2, h)], fill=(168, 85, 247), width=3)
            
            # ด้านซ้าย: Original
            draw.rectangle([(8, 8), (110, 32)], fill=(30, 41, 59))
            draw.text((16, 12), "📷 Original", fill=(241, 245, 249))
            
            # ด้านขวา: AI Stylized
            draw.rectangle([(w // 2 + 8, 8), (w // 2 + 130, 32)], fill=(126, 34, 206))
            draw.text((w // 2 + 16, 12), "🎨 AI Restyled", fill=(255, 255, 255))
            draw.text((w // 2 + 16, 50), f"Prompt: {prompt[:25]}...", fill=(203, 213, 225))
            draw.text((w // 2 + 16, 80), f"Model: {model_name[:20]}", fill=(148, 163, 184))

            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
        except Exception as e:
            logger.warning(f"Fallback to synthetic img2img: {e}")

    # 3. โหมด txt2img (Default Canvas)
    img = Image.new("RGB", (w, h), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    margin = 16
    draw.rectangle([(margin, margin), (w - margin, h - margin)], outline=(56, 189, 248), width=2)
    draw.rectangle([(margin + 4, margin + 4), (w - margin - 4, margin + 40)], fill=(30, 41, 59))
    draw.text((margin + 16, margin + 14), f"✨ LUMA AI Generated ({task_type})", fill=(241, 245, 249))

    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    y = margin + 60
    
    short_prompt = (prompt[:60] + "...") if len(prompt) > 60 else prompt
    draw.text((margin + 16, y), f"Prompt: {short_prompt}", fill=(148, 163, 184))
    y += 30
    draw.text((margin + 16, y), f"Model: {model_name}", fill=(148, 163, 184))
    y += 30
    draw.text((margin + 16, y), f"Resolution: {w}x{h} px", fill=(148, 163, 184))
    y += 30
    draw.text((margin + 16, y), f"Generated At: {timestamp_str}", fill=(100, 116, 139))

    center_x, center_y = w // 2, h // 2 + 30
    draw.ellipse([(center_x - 60, center_y - 60), (center_x + 60, center_y + 60)], outline=(168, 85, 247), width=3)
    draw.text((center_x - 35, center_y - 7), "LUMA AI", fill=(226, 232, 240))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ──────────────────────────────────────────────
# 1. Direct Mode Endpoint (POST /generate)
# ──────────────────────────────────────────────
@app.post("/generate")
async def generate_direct(payload: DirectGenerateRequest):
    """
    Direct Mode: Backend ยิงมาแล้วรอรับภาพ Base64 กลับทันที
    """
    logger.info(f"[Direct Mode] Received type={payload.task_type} prompt: '{payload.prompt[:40]}...'")
    await asyncio.sleep(0.4)

    img_b64 = generate_mock_image_base64(
        prompt=payload.prompt,
        width=payload.width or 512,
        height=payload.height or 512,
        model_name=payload.model_name or "counterfeitV30_v30",
        task_type=payload.task_type or "txt2img",
        source_b64=payload.image_base64,
        mask_b64=payload.mask_base64
    )

    logger.info("[Direct Mode] Image generated successfully! Returning Base64 payload.")
    return {
        "status": "completed",
        "image_base64": img_b64,
        "model_used": payload.model_name,
        "width": payload.width,
        "height": payload.height,
        "generation_time": 0.4
    }


# ──────────────────────────────────────────────
# 2. Async Callback Mode (POST /ai/generate & POST /ai/edit)
# ──────────────────────────────────────────────
async def execute_callback_task(
    task_id: str,
    prompt: str,
    model_name: str,
    width: int,
    height: int,
    task_type: str,
    callback_url: str,
    secret_header: Optional[str],
    source_b64: Optional[str] = None,
    mask_b64: Optional[str] = None
):
    """Background Task: ทำภาพเสร็จแล้วยิง Callback กลับไปยัง Backend"""
    logger.info(f"[Callback Mode] Started task_id: {task_id} (type={task_type})")
    await asyncio.sleep(1.2)

    img_b64 = generate_mock_image_base64(
        prompt=prompt,
        width=width,
        height=height,
        model_name=model_name,
        task_type=task_type,
        source_b64=source_b64,
        mask_b64=mask_b64
    )

    callback_payload = {
        "task_id": task_id,
        "status": "completed",
        "image_base64": img_b64,
        "error": None,
        "generation_time": 1.2
    }

    headers = {
        "Content-Type": "application/json",
        "X-LUMA-INTERNAL-SECRET": secret_header or "luma-distributed-token-secret-6710301009"
    }

    if callback_url:
        logger.info(f"[Callback Mode] Sending callback to {callback_url} (task: {task_id})")
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(callback_url, json=callback_payload, headers=headers)
                logger.info(f"[Callback Mode] Callback delivered with status: {res.status_code}")
            except Exception as e:
                logger.error(f"[Callback Mode] Failed to deliver callback: {e}")


@app.post("/ai/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_callback(
    payload: CallbackGenerateRequest,
    background_tasks: BackgroundTasks,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """Async Callback Mode (txt2img)"""
    logger.info(f"[Callback Mode: txt2img] Accepted job task_id: {payload.task_id}")
    background_tasks.add_task(
        execute_callback_task,
        task_id=payload.task_id,
        prompt=payload.prompt,
        model_name=payload.model or "counterfeitV30_v30.safetensors",
        width=payload.width or 512,
        height=payload.height or 512,
        task_type="txt2img",
        callback_url=payload.callback_url,
        secret_header=x_luma_internal_secret
    )
    return {
        "task_id": payload.task_id,
        "status": "accepted",
        "queue_position": 1,
        "message": "txt2img task queued in Mock AI Server"
    }


@app.post("/ai/edit", status_code=status.HTTP_202_ACCEPTED)
async def edit_callback(
    payload: CallbackEditRequest,
    background_tasks: BackgroundTasks,
    x_luma_internal_secret: Optional[str] = Header(None)
):
    """Async Callback Mode (img2img / inpaint)"""
    logger.info(f"[Callback Mode: {payload.mode}] Accepted edit job task_id: {payload.task_id}")
    background_tasks.add_task(
        execute_callback_task,
        task_id=payload.task_id,
        prompt=payload.prompt,
        model_name="counterfeitV30_v30.safetensors",
        width=512,
        height=512,
        task_type=payload.mode or "img2img",
        callback_url=payload.callback_url,
        secret_header=x_luma_internal_secret,
        source_b64=payload.image_base64,
        mask_b64=payload.mask_base64
    )
    return {
        "task_id": payload.task_id,
        "status": "accepted",
        "queue_position": 1,
        "message": f"{payload.mode} task queued in Mock AI Server"
    }


@app.get("/ai/health")
async def ai_health():
    return {
        "status": "online",
        "service": "LUMA Mock AI Inference Server",
        "gpu": {"device": "Mock NVIDIA RTX 3070", "vram_free_gb": 6.8, "vram_total_gb": 8.0}
    }


@app.get("/ai/models")
async def ai_models():
    return {
        "checkpoints": [
            {"id": "counterfeitV30_v30.safetensors", "name": "Counterfeit v3.0"},
            {"id": "novaAnimeXL_ilV190.safetensors", "name": "Nova Anime XL"},
            {"id": "prefectPonyXL_v6.safetensors", "name": "Prefect Pony XL"}
        ],
        "loras": [
            {"id": "SousouNoFrieren_Frieren_IlluXL.safetensors", "name": "Frieren"},
            {"id": "himmel_sousou_no_frieren_ilxl.safetensors", "name": "Himmel"}
        ]
    }


@app.get("/")
def root():
    return {
        "message": "LUMA Mock AI Server is running! 🎨",
        "modes": ["Direct: POST /generate", "Callback: POST /ai/generate", "Edit: POST /ai/edit"]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("mock_ai_server:app", host="0.0.0.0", port=8001, reload=True)
