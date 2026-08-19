from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AI Service Configuration
    AI_MODE: str = "direct"  # "direct" | "callback"
    AI_SERVER_URL: str = "http://localhost:8001/generate"
    AI_SERVER_DIRECT_URL: str = "http://localhost:8001/generate"
    AI_SERVER_CALLBACK_URL: str = "http://localhost:8001/ai/generate"
    AI_CALLBACK_SECRET: str = "luma-distributed-token-secret-6710301009"
    BACKEND_CALLBACK_URL: str = "http://localhost:8000/api/callback"
    OUTPUTS_DIR: Path = Path("./outputs")
    UPLOADS_DIR: Path = Path("./uploads")
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    MAX_IMAGE_DIMENSION: int = 4096  # Max 4096x4096 px

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
