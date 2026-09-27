"""
=============================================================================
LUMA Distributed AI Inference Node — Configuration & Safety Specification
=============================================================================
ไฟล์นี้ทำหน้าที่เป็น "Single Source of Truth" (ศูนย์กลางการตั้งค่าหลัก) สำหรับ AI Node:
1. การ Bind Network Interface และ Port ของ FastAPI Server
2. Security Secret Audit ป้องกันการหลุดของ Token และตรวจสอบความปลอดภัย
3. Safety Bounds & Limits (Prompt, Steps, CFG, Image Dimensions) ป้องกัน GPU ล่ม
4. Model Paths สำหรับเชื่อมโยงกับ Stability Matrix Checkpoints & LoRAs
5. Network Callback Configuration ไปยัง Backend Core API
=============================================================================
"""

import os
from dotenv import load_dotenv

# คำนวณ Absolute Path ของไดเรกทอรีรากโมดูล ai_server
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env (ทั้งในระดับโฟลเดอร์ ai_server และระดับ Project Root)
# ช่วยให้สามารถปรับเปลี่ยนค่า Configuration ได้โดยไม่ต้องแก้ไข Source Code
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(os.path.dirname(BASE_DIR), ".env"))

# Blacklist สำหรับตรวจจับ Secret Key ตัวอย่าง หรือ Key ที่เคยหลุดในอดีต
# หากพบว่าตัวแปรสภาพแวดล้อมใช้ค่าเหล่านี้ ระบบจะปฏิเสธการเริ่มทำงานทันที (Fail-Fast)
LEAKED_SECRETS = {
    "luma-distributed-token-secret-6710301009",
    "your-secure-random-32char-secret-here",
    "CHANGE_ME",
    "CHANGE_ME_GENERATE_A_NEW_ONE",
}


class AIConfig:
    """
    คลาสรวมศูนย์การตั้งค่าทั้งหมดของ AI Inference Node
    พารามิเตอร์ทั้งหมดในนี้จะถูกอ้างอิงโดย server.py, queue_manager.py และ forge_client.py
    """

    # -------------------------------------------------------------------------
    # 1. การตั้งค่าการเปิดเซิร์ฟเวอร์ (Server Network Binding)
    # -------------------------------------------------------------------------
    # 0.0.0.0 หมายถึงเปิดรับ Connection จากทุก Interface ในวง LAN (Ethernet/Wi-Fi)
    HOST = os.environ.get("AI_HOST", "0.0.0.0")
    # พอร์ตมาตรฐาน 7860 สำหรับ AI Node (PC3) ตามที่ตกลงกันในทีม
    PORT = int(os.environ.get("AI_PORT", 7860))

    # -------------------------------------------------------------------------
    # 2. ปลายทาง Callback ไปยัง Backend (Webhook Destination)
    # -------------------------------------------------------------------------
    # URL ของ Backend Core API (Node 2: พอร์ต 8000) สำหรับยิง Webhook แจ้งสถานะเมื่อภาพเจนเสร็จ
    BACKEND_CALLBACK_URL = os.environ.get("BACKEND_CALLBACK_URL", "http://127.0.0.1:8000/api/callback")
    # URL สำรองสำหรับใช้งานจริงบนวง LAN ในห้องปฏิบัติการ
    LAN_BACKEND_CALLBACK_URL = os.environ.get("LAN_BACKEND_CALLBACK_URL", "http://192.168.1.20:8000/api/callback")
    
    # -------------------------------------------------------------------------
    # 3. การรักษาความปลอดภัยภายในเครือข่าย (Internal Security Authentication)
    # -------------------------------------------------------------------------
    # Secret Token ที่ต้องส่งแนบมาใน Header 'X-LUMA-INTERNAL-SECRET' ทุกครั้ง
    # ทำหน้าที่เป็น Private API Key ระหว่าง Node ป้องกันไม่ให้บุคคลภายนอกในวง LAN แอบยิงตรงเข้า GPU
    INTERNAL_SECRET = os.environ.get("LUMA_INTERNAL_SECRET")
    
    # ตรวจสอบความปลอดภัยระดับสูง (Strict Validation):
    # - ต้องไม่เป็นค่าว่าง (None / Empty)
    # - ต้องไม่อยู่ใน Blacklist คีย์หลุด/คีย์ตัวอย่าง
    # - ต้องมีความยาวอย่างน้อย 32 ตัวอักษร เพื่อป้องกันการ Brute-force
    if not INTERNAL_SECRET or INTERNAL_SECRET in LEAKED_SECRETS or len(INTERNAL_SECRET) < 32:
        raise RuntimeError(
            "LUMA_INTERNAL_SECRET ยังไม่ได้ตั้ง เป็นค่าตัวอย่าง หรือสั้นเกินไป — "
            'สร้างใหม่: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )

    # -------------------------------------------------------------------------
    # 4. ขอบเขตความปลอดภัยของพารามิเตอร์ (Safety Bounds & Limits)
    # -------------------------------------------------------------------------
    # จำกัดความยาว Prompt ป้องกัน Buffer Overflow และการโจมตี Denial of Service (DoS)
    MIN_PROMPT_LENGTH = 1
    MAX_PROMPT_LENGTH = 2000
    MAX_NEGATIVE_PROMPT_LENGTH = 2000

    # จำกัดจำนวน Sampling Steps:
    # - น้อยสุด 1 step (สำหรับทดสอบ)
    # - มากสุด 50 steps (เพื่อป้องกันไม่ให้ Request ใดกินเวลา GPU นานเกินไปจนคิวอื่นค้าง)
    MIN_STEPS = 1
    MAX_STEPS = 50

    # จำกัดช่วง CFG Scale (Classifier-Free Guidance):
    # ควบคุมความเข้มงวดในการวาดตาม Prompt ให้อยู่ในช่วงที่โมเดลไม่เกิดภาพแตก (Burn/Artifact)
    MIN_CFG = 1.0
    MAX_CFG = 20.0

    # ขอบเขตขนาดภาพ (Resolution Guard for 8GB VRAM):
    # บน RTX 3070 8GB การรันภาพเกิน 768px โดยตรงในกระบวนการ Initial Latent
    # มีโอกาสทำให้เกิด CUDA Out of Memory (OOM) จึงต้องจำกัดไว้ที่ 256px - 768px
    MIN_IMAGE_WIDTH = 256
    MAX_IMAGE_WIDTH = 768
    MIN_IMAGE_HEIGHT = 256
    MAX_IMAGE_HEIGHT = 768

    # ค่าเริ่มต้นสำหรับพารามิเตอร์สร้างภาพ (Defaults)
    DEFAULT_WIDTH = 512
    DEFAULT_HEIGHT = 512
    DEFAULT_STEPS = 25
    DEFAULT_CFG = 7.5
    DEFAULT_SAMPLER = "DPM++ 2M Karras"
    DEFAULT_MODEL = "counterfeitV30_v30.safetensors"
    DEFAULT_NEGATIVE_PROMPT = "blurry, low quality, distorted, bad anatomy"

    # -------------------------------------------------------------------------
    # 5. โหมดการทำงานสำรอง (High-Fidelity Fallback Safeguard)
    # -------------------------------------------------------------------------
    # เมื่อเปิดเป็น True: หาก Stable Diffusion WebUI Forge ยังไม่พร้อมใช้งาน หรือออฟไลน์
    # เซิร์ฟเวอร์จะไม่แครช แต่จะสลับไปวาดภาพ Preview Canvas พร้อมแสดงข้อมูล Metadata
    # ช่วยให้สามารถทดสอบการเชื่อมต่อ Multi-Node Pipeline ได้อย่างต่อเนื่องแม้ไม่มี GPU
    ALLOW_FALLBACK_RENDER = os.environ.get("ALLOW_FALLBACK_RENDER", "true").lower() == "true"

    # -------------------------------------------------------------------------
    # 6. ที่อยู่ไฟล์โมเดลของ Stability Matrix (Model Directory Paths)
    # -------------------------------------------------------------------------
    # เชื่อมโยงกับไดเรกทอรีโมเดลของ Stability Matrix เพื่อใช้ Checkpoints และ LoRAs ร่วมกัน
    SM_DATA_DIR = os.environ.get("SM_DATA_DIR", "D:/StabilityMatrix-win-x64/Data")
    MODELS_DIR = os.path.join(SM_DATA_DIR, "Models")
    CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "StableDiffusion")
    LORA_DIR = os.path.join(MODELS_DIR, "Lora")
    CACHE_DIR = os.path.join(BASE_DIR, "storage", "cached")

    # -------------------------------------------------------------------------
    # 7. การกำหนดเวลา Timeout และระบบ Retry (Network Resilience)
    # -------------------------------------------------------------------------
    # กำหนดเวลาสูงสุดต่อ 1 งานเจนภาพ (120 วินาที) หาก GPU ค้าง ระบบจะตัดและคืนสถานะทันที
    TASK_TIMEOUT_SECONDS = 120
    # จำนวนครั้งสูงสุดในการลองส่ง Callback ซ้ำ หากเกิดปัญหาการเชื่อมต่อไปยัง Backend
    CALLBACK_MAX_RETRIES = 3

    # -------------------------------------------------------------------------
    # 8. การบีบอัดภาพส่งออก (WebP Compression Optimization)
    # -------------------------------------------------------------------------
    # ค่าคุณภาพการบีบอัดไฟล์ WebP (92%) ช่วยลดขนาดไฟล์ภาพลง 70-80% เมื่อเทียบกับ PNG
    # ทำให้การส่งภาพขนาดใหญ่ผ่านเครือข่าย LAN ระหว่าง Node รวดเร็ว ไม่กินแบนด์วิดท์
    WEBP_QUALITY = 92
