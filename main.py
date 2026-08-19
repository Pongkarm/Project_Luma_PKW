import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.database import engine, Base
from app.models import User, Generation
from app.api import auth, generation, callback, upload

# 💡 ตั้งค่าระบบ Logging กลาง
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # สร้างตารางใน Database เมื่อเซิร์ฟเวอร์เริ่มทำงาน
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize tables on startup: {e}")
    yield


app = FastAPI(
    title="LUMA Backend API",
    description="Backend API for LUMA Image Generation Platform",
    version="1.0.0",
    lifespan=lifespan
)

# 💡 เพิ่ม CORS Middleware เพื่อให้ Frontend สามารถยิง API ข้าม Origin ได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🆕 เชื่อมต่อ Routers
app.include_router(auth.router)
app.include_router(generation.router)
app.include_router(callback.router)
app.include_router(upload.router)


@app.get("/", tags=["Health Check"])
def read_root():
    return {"message": "LUMA Backend is running! 🚀"}


@app.get("/healthz", tags=["Health Check"])
def health_check():
    """Health check endpoint สำหรับ Nginx, Frontend, และ DevOps"""
    return {
        "status": "healthy",
        "service": "LUMA Backend API",
        "version": "1.2.0",
        "ai_mode": settings.AI_MODE,
        "database": "connected"
    }


@app.get("/api/status", tags=["System"])
def system_status():
    """System info endpoint สำหรับ Frontend Dashboard"""
    return {
        "status": "online",
        "supported_tasks": ["txt2img", "img2img", "inpaint"],
        "max_upload_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        "ai_mode": settings.AI_MODE
    }