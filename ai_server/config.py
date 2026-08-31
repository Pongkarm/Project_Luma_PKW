import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Load local .env files if present
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(os.path.dirname(BASE_DIR), ".env"))

LEAKED_SECRETS = {
    "luma-distributed-token-secret-6710301009",
    "your-secure-random-32char-secret-here",
    "CHANGE_ME",
    "CHANGE_ME_GENERATE_A_NEW_ONE",
}

class AIConfig:
    # Server Binding
    HOST = os.environ.get("AI_HOST", "0.0.0.0")
    PORT = int(os.environ.get("AI_PORT", 7860))

    # Backend Callback Destination (Port 8000 matching teammate's backend)
    BACKEND_CALLBACK_URL = os.environ.get("BACKEND_CALLBACK_URL", "http://127.0.0.1:8000/api/callback")
    LAN_BACKEND_CALLBACK_URL = os.environ.get("LAN_BACKEND_CALLBACK_URL", "http://192.168.1.20:8000/api/callback")
    
    # Internal Security Secret (Must be configured via Environment Variable)
    INTERNAL_SECRET = os.environ.get("LUMA_INTERNAL_SECRET")
    if not INTERNAL_SECRET or INTERNAL_SECRET in LEAKED_SECRETS or len(INTERNAL_SECRET) < 32:
        raise RuntimeError(
            "LUMA_INTERNAL_SECRET ยังไม่ได้ตั้ง เป็นค่าตัวอย่าง หรือสั้นเกินไป — "
            'สร้างใหม่: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )

    # Safety Limits & Constraints (Single Source of Truth)
    MIN_PROMPT_LENGTH = 1
    MAX_PROMPT_LENGTH = 2000
    MAX_NEGATIVE_PROMPT_LENGTH = 2000
    MIN_STEPS = 1
    MAX_STEPS = 50
    MIN_CFG = 1.0
    MAX_CFG = 20.0
    MIN_IMAGE_WIDTH = 256
    MAX_IMAGE_WIDTH = 768
    MIN_IMAGE_HEIGHT = 256
    MAX_IMAGE_HEIGHT = 768
    DEFAULT_WIDTH = 512
    DEFAULT_HEIGHT = 512
    DEFAULT_STEPS = 25
    DEFAULT_CFG = 7.5
    DEFAULT_SAMPLER = "DPM++ 2M Karras"
    DEFAULT_MODEL = "counterfeitV30_v30.safetensors"
    DEFAULT_NEGATIVE_PROMPT = "blurry, low quality, distorted, bad anatomy"

    # Fallback Mode Flag (Allow mock rendering when Forge is offline)
    ALLOW_FALLBACK_RENDER = os.environ.get("ALLOW_FALLBACK_RENDER", "true").lower() == "true"

    # Stability Matrix Shared Models
    SM_DATA_DIR = os.environ.get("SM_DATA_DIR", "D:/StabilityMatrix-win-x64/Data")
    MODELS_DIR = os.path.join(SM_DATA_DIR, "Models")
    CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "StableDiffusion")
    LORA_DIR = os.path.join(MODELS_DIR, "Lora")
    CACHE_DIR = os.path.join(BASE_DIR, "storage", "cached")

    # Timeouts & Retries
    TASK_TIMEOUT_SECONDS = 120  # Max 2 minutes per generation
    CALLBACK_MAX_RETRIES = 3

    # WebP Output Compression
    WEBP_QUALITY = 92
