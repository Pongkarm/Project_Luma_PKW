import os
import sys

# Ensure root directory is always in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont

import uuid
from ai_server.config import AIConfig
from ai_server.utils.gpu_monitor import get_gpu_status, clear_vram_cache
from ai_server.utils.cache_manager import cleanup_stale_cache
from ai_server.utils.image_utils import (
    decode_base64_to_image, 
    encode_image_to_base64, 
    enforce_max_resolution
)
from ai_server.services.queue_manager import task_queue
from ai_server.services.prompt_builder import build_prompt_with_lora, LORA_REGISTRY

# --- Lifespan Context ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==================================================")
    print("🚀 LUMA AI Server Starting up on Port 7860...")
    print(f"📡 Node Binding: {AIConfig.HOST}:{AIConfig.PORT}")
    print(f"🔗 Callback Target: {AIConfig.BACKEND_CALLBACK_URL}")
    print(f"🎨 LoRA Registry: Loaded {len(LORA_REGISTRY)} styles")
    print("==================================================")
    cleanup_stale_cache()
    task_queue.start_worker()
    yield
    print("🛑 LUMA AI Server Shutting down...")
    task_queue.stop_worker()
    clear_vram_cache()

app = FastAPI(
    title="LUMA AI Engine API",
    description="Production-Hardened Distributed Generative AI Node with Input Sanitization, LoRA Injection, and VRAM Safeguards",
    version="1.2.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from typing import Optional, Union, List, Any

# --- Pydantic Schemas with Strict Input Constraints (Compatible with Backend) ---
class GenerateRequest(BaseModel):
    task_id: str
    prompt: str = Field(..., min_length=AIConfig.MIN_PROMPT_LENGTH, max_length=AIConfig.MAX_PROMPT_LENGTH, description="Prompt text (max 2000 chars)")
    negative_prompt: Optional[str] = Field("blurry, low quality, distorted, bad anatomy", max_length=AIConfig.MAX_NEGATIVE_PROMPT_LENGTH)
    model: Optional[str] = None
    model_name: Optional[str] = AIConfig.DEFAULT_MODEL
    lora: Optional[str] = None
    lora_config: Optional[Any] = None  # Can be list, dict, or string from backend
    sampler_name: Optional[str] = AIConfig.DEFAULT_SAMPLER
    steps: Optional[int] = Field(AIConfig.DEFAULT_STEPS, ge=AIConfig.MIN_STEPS, le=AIConfig.MAX_STEPS, description="Denoising steps (1-50)")
    cfg_scale: Optional[float] = Field(AIConfig.DEFAULT_CFG, ge=AIConfig.MIN_CFG, le=AIConfig.MAX_CFG, description="CFG scale (1.0-20.0)")
    seed: Optional[int] = None
    width: Optional[int] = Field(AIConfig.DEFAULT_WIDTH, ge=AIConfig.MIN_IMAGE_WIDTH, le=AIConfig.MAX_IMAGE_WIDTH, description="Image width (256-768, divisible by 8)")
    height: Optional[int] = Field(AIConfig.DEFAULT_HEIGHT, ge=AIConfig.MIN_IMAGE_HEIGHT, le=AIConfig.MAX_IMAGE_HEIGHT, description="Image height (256-768, divisible by 8)")
    task_type: Optional[str] = "txt2img"
    source_image_path: Optional[str] = None
    image_base64: Optional[str] = None
    mask_base64: Optional[str] = None
    denoising_strength: Optional[float] = 0.75
    callback_url: Optional[str] = AIConfig.BACKEND_CALLBACK_URL
    correlation_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4())[:8])

class EditRequest(BaseModel):
    task_id: str
    prompt: str = Field(..., min_length=AIConfig.MIN_PROMPT_LENGTH, max_length=AIConfig.MAX_PROMPT_LENGTH, description="Prompt text (max 2000 chars)")
    negative_prompt: Optional[str] = Field("blurry, low quality, distorted, bad anatomy", max_length=AIConfig.MAX_NEGATIVE_PROMPT_LENGTH)
    image_base64: str
    mask_base64: Optional[str] = None
    mode: Optional[str] = "inpaint"  # inpaint | img2img
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

# --- Security Verification Helper ---
def verify_internal_secret(token: Optional[str]):
    if token and token != AIConfig.INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Invalid X-LUMA-INTERNAL-SECRET header"
        )

from ai_server.services.forge_client import (
    is_forge_online, 
    run_txt2img, 
    run_img2img,
    run_inpaint,
    set_forge_model
)

def extract_primary_lora(data: dict) -> Optional[str]:
    """Extracts LoRA ID from either 'lora', 'lora_config' (list, dict, or string)."""
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
        # Check if dict is a key-value mapping like {"SousouNoFrieren_Frieren_IlluXL.safetensors": 0.85}
        for k in lora_cfg.keys():
            if k in LORA_REGISTRY or k.endswith(".safetensors"):
                return k
        if len(lora_cfg) > 0:
            return list(lora_cfg.keys())[0]
    elif isinstance(lora_cfg, str):
        return lora_cfg
    return None

# --- Inference Handlers ---
def handle_txt2img_inference(data: dict) -> str:
    """
    Generates image with LoRA trigger word injection (Single Source of Truth).
    Connects to live Forge GPU Engine if available, or generates high-fidelity preview if offline.
    """
    raw_prompt = data.get("prompt", "")
    lora_id = extract_primary_lora(data)
    model_name = data.get("model_name") or data.get("model") or AIConfig.DEFAULT_MODEL
    
    # Auto-inject LoRA trigger word and syntax
    enriched_prompt, lora_tag = build_prompt_with_lora(raw_prompt, lora_id)
    print(f"[PROMPT ENRICHED] Raw: '{raw_prompt}' -> Enriched: '{enriched_prompt}' (LoRA: {lora_id})")

    # 1. Try Live Forge GPU Inference
    if is_forge_online():
        print("[ENGINE] WebUI Forge Engine is ONLINE on port 7861. Running on GPU...")
        forge_res = run_txt2img(
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
            return forge_res

    # 2. High-Fidelity Fallback Preview (for Standalone Dev & Safety)
    if not AIConfig.ALLOW_FALLBACK_RENDER:
        raise RuntimeError("WebUI Forge GPU engine is offline and fallback rendering is disabled.")

    print("[ENGINE] Running High-Fidelity Fallback Renderer for txt2img...")
    w = min(data.get("width", AIConfig.DEFAULT_WIDTH), AIConfig.MAX_IMAGE_WIDTH)
    h = min(data.get("height", AIConfig.DEFAULT_HEIGHT), AIConfig.MAX_IMAGE_HEIGHT)

    img = Image.new("RGB", (w, h), color=(18, 22, 30))
    draw = ImageDraw.Draw(img)
    draw.rectangle([(16, 16), (w - 16, h - 16)], outline=(255, 100, 100), width=3)
    draw.text((36, 36), "⚠️ PREVIEW ONLY — Forge GPU offline [txt2img]", fill=(255, 100, 100))
    draw.text((36, 75), f"Prompt: {enriched_prompt[:65]}...", fill=(180, 210, 255))
    draw.text((36, 115), f"Model: {model_name} | LoRA: {lora_id or 'None'}", fill=(130, 160, 200))
    draw.text((36, 145), f"Resolution: {w}x{h} | Steps: {data.get('steps', 25)}", fill=(100, 130, 170))

    return encode_image_to_base64(img, format="WEBP")

def handle_edit_inference(data: dict) -> str:
    """
    Handles img2img and inpainting with mask tensor, LoRA auto-injection,
    checkpoint resolution, resolution safety, and Forge/fallback execution.
    """
    raw_prompt = data.get("prompt", "")
    orig_b64 = data.get("image_base64")
    mask_b64 = data.get("mask_base64")
    lora_id = extract_primary_lora(data)
    model_name = data.get("model_name") or data.get("model") or AIConfig.DEFAULT_MODEL
    mode = (data.get("mode") or ("inpaint" if mask_b64 else "img2img")).lower()

    # Auto-inject LoRA trigger word and syntax
    enriched_prompt, lora_tag = build_prompt_with_lora(raw_prompt, lora_id)
    print(f"[EDIT PROMPT ENRICHED] Mode: '{mode}' | Raw: '{raw_prompt}' -> Enriched: '{enriched_prompt}' (LoRA: {lora_id})")

    # 1. Try Live Forge GPU Inference
    if is_forge_online():
        print(f"[ENGINE] WebUI Forge Engine is ONLINE on port 7861. Running {mode} on GPU...")
        if mode == "inpaint" and mask_b64:
            inpaint_res = run_inpaint(
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
                return inpaint_res
        else:  # img2img mode (no mask)
            img2img_res = run_img2img(
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
                return img2img_res

    # 2. Fallback Preview (for Standalone Dev & Safety)
    if not AIConfig.ALLOW_FALLBACK_RENDER:
        raise RuntimeError(f"WebUI Forge GPU engine is offline and fallback rendering is disabled for {mode}.")

    print(f"[ENGINE] Running High-Fidelity Fallback Renderer for {mode}...")
    orig_img = decode_base64_to_image(orig_b64)
    orig_img = enforce_max_resolution(orig_img, max_dim=AIConfig.MAX_IMAGE_WIDTH)
    w, h = orig_img.size
    
    # Overlay fallback banner
    draw = ImageDraw.Draw(orig_img)
    banner_h = 44
    draw.rectangle([(0, h - banner_h), (w, h)], fill=(10, 15, 25))
    draw.text((16, h - 34), f"⚠️ PREVIEW ONLY — Forge GPU offline [{mode}]", fill=(255, 100, 100))
    draw.text((16, h - 18), f"Prompt: {enriched_prompt[:40]}... | Model: {model_name[:20]}", fill=(180, 200, 220))
    
    return encode_image_to_base64(orig_img, format="WEBP")

# Alias for backwards compatibility
handle_inpaint_inference = handle_edit_inference

# --- REST Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def root_dashboard():
    """Returns a visual status dashboard for LUMA AI Node."""
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
    """Returns GPU metrics, VRAM usage, and queue status."""
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
    """Dynamically scans and lists loaded Checkpoint models and LoRA adapters from Stability Matrix."""
    checkpoints = []
    loras = []

    # Scan Checkpoints
    if os.path.exists(AIConfig.CHECKPOINTS_DIR):
        for f in os.listdir(AIConfig.CHECKPOINTS_DIR):
            if f.endswith((".safetensors", ".ckpt")):
                checkpoints.append({
                    "id": f,
                    "name": f.replace(".safetensors", "").replace(".ckpt", ""),
                    "path": os.path.join(AIConfig.CHECKPOINTS_DIR, f)
                })

    # Scan LoRAs
    if os.path.exists(AIConfig.LORA_DIR):
        for f in os.listdir(AIConfig.LORA_DIR):
            if f.endswith(".safetensors"):
                loras.append({
                    "id": f,
                    "name": f.replace(".safetensors", ""),
                    "path": os.path.join(AIConfig.LORA_DIR, f)
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
    """Enqueues a txt2img generation request and returns immediate acceptance."""
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
    """Enqueues an img2img / inpaint editing request."""
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
    Cancels a generation task (Soft Cancel if in Queue, Hard Cancel if on GPU).
    Returns 200 OK or 409 Conflict if already completed.
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

@app.get("/ai/task/{task_id}")
async def get_ai_task_status(task_id: str):
    """Returns real-time in-memory status of an AI Task."""
    info = task_queue.get_task_status(task_id)
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found in memory")
    return {
        "task_id": task_id,
        "status": info.get("status"),
        "elapsed": info.get("elapsed", 0.0)
    }

if __name__ == "__main__":
    uvicorn.run("ai_server.server:app", host=AIConfig.HOST, port=AIConfig.PORT, reload=True)
