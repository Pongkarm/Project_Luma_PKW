from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    คลาสสำหรับโหลดและตรวจสอบ Environment Variables ของระบบ
    จะดึงค่าจาก Environment Variables ของ OS หรือไฟล์ .env มาใส่ในแอตทริบิวต์อัตโนมัติ
    """

    # --- Database & Authentication ---
    DATABASE_URL: str  # Connection string ของฐานข้อมูล (ต้องระบุ เช่น postgresql://...)
    SECRET_KEY: str  # กุญแจลับสำหรับเซ็น JWT Token (ต้องระบุ)
    ALGORITHM: str = "HS256"  # อัลกอริทึมเข้ารหัส JWT (ค่าเริ่มต้นเป็น HS256)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        30  # อายุการใช้งานของ Access Token (30 นาที)
    )

    # --- System Bootstrap ---
    # อีเมลของเจ้าของระบบคนแรก แก้ปัญหาไก่กับไข่: ไม่มีใครมอบสิทธิ์ให้คนแรกได้
    # อ่านตอนเริ่มเซิร์ฟเวอร์เท่านั้น และไม่ทำอะไรเลยถ้ามี owner อยู่แล้ว
    ADMIN_BOOTSTRAP_EMAIL: str = ""

    # --- AI Service Configuration ---
    # รูปแบบการเชื่อมต่อ AI:
    # "direct" = ส่งคำขอแล้วรอ Response ทันที (Synchronous)
    # "callback" = ส่งคำขอแล้วให้ AI Server ยิง Callback ผลลัพธ์กลับมาเมื่อประมวลผลเสร็จ (Asynchronous/Webhook)
    AI_MODE: str = "direct"

    # Endpoints สำหรับเชื่อมต่อกับ AI Server ภายนอก
    AI_SERVER_URL: str = "http://localhost:8001/generate"
    AI_SERVER_DIRECT_URL: str = "http://localhost:8001/generate"
    AI_SERVER_CALLBACK_URL: str = "http://localhost:8001/ai/generate"

    # Secret Key สำหรับยืนยันตัวตน (Signature/Token) ตอนที่ AI Server ยิง Callback กลับมา
    AI_CALLBACK_SECRET: str

    # URL ปลายทางของ Backend เราเองที่เตรียมไว้ให้ AI Server ยิงผลลัพธ์กลับมา
    BACKEND_CALLBACK_URL: str = "http://localhost:8000/api/callback"

    # --- Storage & File Uploads ---
    OUTPUTS_DIR: Path = Path("./outputs")  # โฟลเดอร์เก็บรูปที่ AI เจนเสร็จแล้ว
    UPLOADS_DIR: Path = Path("./uploads")  # โฟลเดอร์เก็บไฟล์ที่ User อัปโหลดขึ้นมา
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # จำกัดขนาดไฟล์อัปโหลดไม่เกิน 10 MB
    MAX_IMAGE_DIMENSION: int = 4096  # จำกัดความกว้าง/ความสูงรูปไม่เกิน 4096px

    # กำหนดค่าการทำงานของ Pydantic Settings:
    # - env_file=".env": ให้อ่านตัวแปรจากไฟล์ .env อัตโนมัติถ้าไม่มีใน Environment ของเครื่อง
    # - extra="ignore": หากใน .env มีตัวแปรอื่นที่ไม่ได้ประกาศไว้ในคลาส ให้ข้ามไป ไม่ต้อง throw error
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Instantiate คลาส Settings (จะเริ่มอ่านไฟล์ .env และ Validate ชนิดข้อมูลทันทีในจังหวะนี้)
settings = Settings()

# -----------------------------------------------------------------
# Security Guardrails (ตัวป้องกันข้อผิดพลาดด้านความปลอดภัยตอนรันระบบ)
# -----------------------------------------------------------------

# รายการ Secret Keys อันตรายที่เป็นค่า Default จากตัวอย่าง, รหัสนักศึกษา/งานวิจัย หรือเคยหลุดสู่สาธารณะ
LEAKED_SECRETS = {
    "luma-super-secret-jwt-key-2024-cdti-image-processing",
    "luma-distributed-token-secret-6710301009",
    "CHANGE_ME_GENERATE_A_NEW_ONE",
}

# วนลูปตรวจสอบ Secret Keys สำคัญของระบบ
for name, value in (
    ("SECRET_KEY", settings.SECRET_KEY),
    ("AI_CALLBACK_SECRET", settings.AI_CALLBACK_SECRET),
):
    # ป้องกันไม่ให้แอปพลิเคชันเริ่มทำงาน (Fail-Fast) หาก:
    # 1. พบว่ายังใช้ค่า Secret ที่เคยหลุดสู่สาธารณะ/ตัวอย่างในโค้ด
    # 2. ความยาวของ Secret สั้นกว่า 32 ตัวอักษร (Entropy ต่ำ เสี่ยงต่อการโดน Brute-force)
    if value in LEAKED_SECRETS or len(value) < 32:
        raise RuntimeError(
            f"{name} ยังเป็นค่าที่หลุดสาธารณะหรือสั้นเกินไป — "
            'สร้างใหม่: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )