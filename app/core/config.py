from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # อีเมลของเจ้าของระบบคนแรก แก้ปัญหาไก่กับไข่: ไม่มีใครมอบสิทธิ์ให้คนแรกได้
    # อ่านตอนเริ่มเซิร์ฟเวอร์เท่านั้น และไม่ทำอะไรเลยถ้ามี owner อยู่แล้ว
    ADMIN_BOOTSTRAP_EMAIL: str = ""
    
    # AI Service Configuration
    AI_MODE: str = "direct"  # "direct" | "callback"
    AI_SERVER_URL: str = "http://localhost:8001/generate"
    AI_SERVER_DIRECT_URL: str = "http://localhost:8001/generate"
    AI_SERVER_CALLBACK_URL: str = "http://localhost:8001/ai/generate"
    AI_CALLBACK_SECRET: str
    BACKEND_CALLBACK_URL: str = "http://localhost:8000/api/callback"
    OUTPUTS_DIR: Path = Path("./outputs")
    UPLOADS_DIR: Path = Path("./uploads")
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    MAX_IMAGE_DIMENSION: int = 4096  # Max 4096x4096 px

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

LEAKED_SECRETS = {
    "luma-super-secret-jwt-key-2024-cdti-image-processing",
    "luma-distributed-token-secret-6710301009",
    "CHANGE_ME_GENERATE_A_NEW_ONE",
}

for name, value in (
    ("SECRET_KEY", settings.SECRET_KEY),
    ("AI_CALLBACK_SECRET", settings.AI_CALLBACK_SECRET),
):
    if value in LEAKED_SECRETS or len(value) < 32:
        raise RuntimeError(
            f"{name} ยังเป็นค่าที่หลุดสาธารณะหรือสั้นเกินไป — "
            'สร้างใหม่: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
