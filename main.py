import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.database import engine, Base, SessionLocal
from app.api import auth, generation, callback, upload, models, admin
from app.core.config import settings

# 💡 ตั้งค่าระบบ Logging กลาง
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def _bootstrap_owner() -> None:
    """
    มอบสิทธิ์ owner ให้อีเมลใน ADMIN_BOOTSTRAP_EMAIL ถ้ายังไม่มี owner เลย

    ทำงานครั้งเดียวจริง ๆ: พอมี owner แล้วฟังก์ชันนี้ไม่ทำอะไรอีก แม้ตัวแปร
    จะยังอยู่ใน .env ก็ตาม ตัวแปรที่หลงเหลือจึงไม่สามารถแอบคืนสิทธิ์ให้ใคร
    ที่เพิ่งถูกถอดออกไปได้
    """
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models import AdminRole, User

    email = (settings.ADMIN_BOOTSTRAP_EMAIL or "").strip()
    if not email:
        return

    with Session(engine) as db:
        if db.query(AdminRole).filter(AdminRole.role == "owner").first():
            return
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            logger.warning(
                "ADMIN_BOOTSTRAP_EMAIL=%s ยังไม่ได้สมัครสมาชิก — ข้ามการมอบสิทธิ์", email
            )
            return
        db.add(AdminRole(user_id=user.id, role="owner", granted_by=None))
        db.commit()
        logger.info("มอบสิทธิ์ owner ให้ %s เรียบร้อย", email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # สร้างตารางใน Database เมื่อเซิร์ฟเวอร์เริ่มทำงาน
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
        _bootstrap_owner()
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
app.include_router(models.router)
app.include_router(admin.router)


@app.get("/", tags=["Health Check"])
def read_root():
    return {"message": "LUMA Backend is running! 🚀"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    headers = {}
    origin = request.headers.get("origin")
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"}, headers=headers)


@app.get("/healthz", tags=["Health Check"])
def health_check():
    """Health check endpoint สำหรับ Nginx, Frontend, และ DevOps"""
    db_state = "connected"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error(f"Health check: database unreachable | {exc}")
        db_state = "unreachable"

    body = {
        "status": "healthy" if db_state == "connected" else "degraded",
        "service": "LUMA Backend API",
        "version": "1.2.0",
        "ai_mode": settings.AI_MODE,
        "database": db_state,
    }
    return JSONResponse(status_code=200 if db_state == "connected" else 503, content=body)


@app.get("/api/status", tags=["System"])
def system_status():
    """System info endpoint สำหรับ Frontend Dashboard"""
    return {
        "status": "online",
        "supported_tasks": ["txt2img", "img2img", "inpaint"],
        "max_upload_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        "ai_mode": settings.AI_MODE
    }