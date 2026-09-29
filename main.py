import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.database import engine, Base, SessionLocal
from app.api import auth, generation, callback, upload, models, admin, tools
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
        from app.services.image_tools import cleanup_old_tool_results
        cleanup_old_tool_results(max_age_hours=24)
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
app.include_router(tools.router)


@app.get("/", tags=["Health Check"])
def read_root():
    
    return {"message": "LUMA Backend is running! 🚀"}


# -------------------------------------------------------------
# 1. Global Unhandled Exception Handler (ตัวดักจับ Error ที่หลุดการจัดการ)
# -------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    ดักจับ Exception ทุกชนิดที่ไม่ได้เขียน try-except รองรับไว้ใน Endpoint อื่นๆ
    เพื่อป้องกันไม่ให้ Server ล่ม และส่ง Response ที่ปลอดภัยกลับไปยัง Client
    """
    # บันทึก Error Log พร้อม Stack Trace อัตโนมัติ เพื่อนำไป Debug ย้อนหลัง
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    
    headers = {}
    origin = request.headers.get("origin")
    
    # กำหนดค่า CORS Headers ด้วยตัวเองแบบ Manual:
    # เพราะเมื่อเกิด Exception ในระดับแอปพลิเคชัน Middleware ปกติของ FastAPI
    # อาจถูกข้าม ทำให้ Browser ฟ้อง Error เป็น CORS Error แทนที่จะแสดง 500 จริง
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
        
    # ส่ง HTTP 500 กลับไปให้ Client พร้อมข้อความกลางๆ ไม่เปิดเผยข้อมูลเชิงลึกของระบบ (Security Best Practice)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"}, headers=headers)


# -------------------------------------------------------------
# 2. Health Check Endpoint (ตรวจสอบความพร้อมของระบบ)
# -------------------------------------------------------------
@app.get("/healthz", tags=["Health Check"])
def health_check():
    """
    Health check endpoint สำหรับ Nginx, Load Balancer, Kubernetes, และ DevOps
    ตรวจสอบว่า API ยังทำงานอยู่ และ Database ยังเชื่อมต่อได้ปกติหรือไม่
    """
    db_state = "connected"
    
    # ทดสอบการเชื่อมต่อฐานข้อมูลโดยการส่ง Query เบาๆ (SELECT 1)
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:
        # หาก DB ล่ม หรือเน็ตเวิร์กขาด บันทึก Error และเปลี่ยนสถานะ DB เป็น unreachable
        logger.error(f"Health check: database unreachable | {exc}")
        db_state = "unreachable"

    # เตรียมข้อมูลสถานะระบบ
    body = {
        "status": "healthy" if db_state == "connected" else "degraded",
        "service": "LUMA Backend API",
        "version": "1.2.0",
        "ai_mode": settings.AI_MODE,
        "database": db_state,
    }
    
    # หาก DB ปกติ ส่ง 200 OK
    # หาก DB มีปัญหา ส่ง 503 Service Unavailable เพื่อให้ Orchestrator (เช่น K8s) ทราบว่าระบบทำงานได้ไม่สมบูรณ์
    return JSONResponse(status_code=200 if db_state == "connected" else 503, content=body)


# -------------------------------------------------------------
# 3. System Status Endpoint (ส่งค่า Configuration และขีดความสามารถ)
# -------------------------------------------------------------
@app.get("/api/status", tags=["System"])
def system_status():
    """
    System info endpoint สำหรับ Frontend Dashboard
    ใช้ส่งสเปกและฟีเจอร์ที่เปิดใช้งานให้หน้าบ้านรู้ เพื่อปรับ UI ตาม Config ของหลังบ้าน
    """
    return {
        "status": "online",
        # รายการ Tasks ที่ AI รองรับ (Text-to-Image, Image-to-Image, Inpaint)
        "supported_tasks": ["txt2img", "img2img", "inpaint"],
        # แปลงขนาด Upload สูงสุดจากหน่วย Bytes ให้เป็น Megabytes (MB)
        "max_upload_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        # โหมดการทำงานของ AI เช่น CPU, CUDA, MOCK หรือ MODEL_NAME
        "ai_mode": settings.AI_MODE
    }