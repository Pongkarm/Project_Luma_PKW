# ai_server/config.py
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class AIConfig:
    # Server Binding
    HOST = os.environ.get("AI_HOST", "0.0.0.0")
    PORT = int(os.environ.get("AI_PORT", 7860))

    # Backend Callback Destination (Port 8000 matching teammate's backend)
    BACKEND_CALLBACK_URL = os.environ.get("BACKEND_CALLBACK_URL", "http://127.0.0.1:8000/api/callback")
    LAN_BACKEND_CALLBACK_URL = os.environ.get("LAN_BACKEND_CALLBACK_URL", "http://192.168.1.20:8000/api/callback")
    
    # Internal Security Secret
    INTERNAL_SECRET = os.environ.get("LUMA_INTERNAL_SECRET", "luma-distributed-token-secret-6710301009")

    # Image Resolution & VRAM Limits (Recommended by Iris)
    MAX_IMAGE_WIDTH = 768
    MAX_IMAGE_HEIGHT = 768
    DEFAULT_WIDTH = 512
    DEFAULT_HEIGHT = 512
    DEFAULT_STEPS = 25
    DEFAULT_CFG = 7.5

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
