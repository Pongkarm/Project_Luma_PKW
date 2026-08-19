# 📋 LUMA Backend — Master Handoff Document (v3.0 Production-Ready)

> **Project:** LUMA Backend (AI Image Generation & Distributed Inference Platform)  
> **Role:** Person 2 (FastAPI Backend Lead — Auth, Dual-Mode AI Orchestrator, Storage, Security, Automated Testing)  
> **Version:** 3.0.0  
> **Updated At:** 2026-08-19  
> **Tech Stack:** Python 3.10+, FastAPI, PostgreSQL 15, SQLAlchemy 2.0, Pydantic v2, HTTPX, Pillow, Jose (JWT), Bcrypt, Pytest (Coverage 90%), Docker  

---

## 🎯 1. Executive Summary

LUMA Backend เป็นระบบ RESTful API & Job Manager ระดับ Production-Ready สำหรับแพลตฟอร์มสร้างและปรับแต่งภาพด้วย AI (Stable Diffusion / Forge WebUI)
- **Multi-Modal Generation:** รองรับ Text-to-Image (`txt2img`), Image-to-Image (`img2img`), และ Canvas Inpainting (`inpaint`)
- **Dual-Mode AI Engine:** สลับโหมดการทำงานได้ระหว่าง **Direct (Sync)** สำหรับการพัฒนา/Demo และ **Distributed Callback (Async Webhook)** สำหรับระบบ Production ขนาดใหญ่
- **Enterprise-Grade Security:** ป้องกัน Decompression Bomb Attack ตาม OWASP, ตรวจสอบ Magic Bytes, ลบพิกัด GPS/EXIF อัตโนมัติ และป้องกันการโจมตีแบบ ID Enumeration ด้วย Data Isolation
- **High Quality Assurance:** ชุดการทดสอบ **Pytest 51 Tests (ผ่าน 100%)** ด้วย **Code Coverage 90%** ภายใน 8.42 วินาที

---

## 📁 2. Complete Project Directory Structure

```text
Project/
├── app/
│   ├── api/
│   │   ├── auth.py                   # Routes: /auth/register, /auth/login, /auth/me
│   │   ├── generation.py             # Routes: /generations (POST create, GET list, GET single, GET image)
│   │   ├── callback.py               # Routes: /api/callback (AI Webhook with secret validation & idempotency)
│   │   └── upload.py                 # Routes: /uploads (POST upload, GET/HEAD static image serving)
│   ├── core/
│   │   ├── config.py                 # Pydantic BaseSettings loading from .env (UPLOADS_DIR, OUTPUTS_DIR, AI_MODE)
│   │   └── security.py               # Bcrypt password hashing, JWT creation/verification, get_current_user
│   ├── db/
│   │   └── database.py               # SQLAlchemy 2.0 engine, SessionLocal, Base, get_db dependency
│   ├── models/
│   │   └── __init__.py               # SQLAlchemy ORM Models: User (users) and Generation (generations)
│   ├── schemas/
│   │   ├── token.py                  # Token & TokenData schemas
│   │   ├── user.py                   # UserCreate, UserResponse, UserProfileResponse (with total_generations)
│   │   └── generation.py             # GenerationCreate, GenerationResponse, ImageUploadResponse, AICallbackPayload
│   └── services/
│       ├── generation.py             # Core Job Orchestrator, Mode-Aware Background Task, AI Error Handling
│       └── upload.py                 # 5-Layer Image Validation, EXIF Stripping, Atomic File I/O
├── tests/
│   ├── conftest.py                   # Central Test Fixtures (TestClient, DB Session, Test Users, Mock Images)
│   ├── test_auth.py                  # 10 Tests (Register, Login, /auth/me, Validations)
│   ├── test_callback.py              # 7 Tests (Secret Validation, Idempotency, Failure Handling)
│   ├── test_generations.py           # 8 Tests (txt2img Creation, Pagination, Data Isolation)
│   ├── test_security.py              # 6 Tests (Bcrypt, JWT Expiry, Tampering, SQL Injection, CORS)
│   ├── test_services.py              # 7 Tests (AI Server Timeout, 500 Error, Missing B64, Path Edge Cases)
│   └── test_upload.py                # 13 Tests (5-Layer Validation, Corrupt Image Reject, img2img Pipeline)
├── Dockerfile                        # Production Dockerfile with health checks
├── docker-compose.yml                # Multi-Container Compose (Backend + PostgreSQL + Mock AI)
├── .dockerignore                     # Docker Clean Build Rules
├── requirements.txt                  # Production & Testing Dependencies
├── README.md                         # Architecture Diagrams, Mermaid Sequences, ER Schema
├── FRONTEND_INTEGRATION_GUIDE.md     # Complete API Cheat Sheet for Frontend Developer (PC1)
├── mock_ai_server.py                 # Standalone Dual-Mode Mock AI Engine (Port 8001)
├── test_e2e_flow.py                  # 15-Step E2E User Journey Acceptance Test Suite
└── pytest.ini                        # Pytest Configuration
```

---

## 🗄️ 3. Database Schema (PostgreSQL `luma_db`)

### 3.1 `users` Table
| Column | Type | Constraints / Details |
|---|---|---|
| `id` | `UUID` | Primary Key, `gen_random_uuid()` |
| `username` | `VARCHAR(50)` | Unique, Indexed, Not Null |
| `email` | `VARCHAR(255)` | Unique, Indexed, Not Null |
| `password_hash` | `VARCHAR(255)` | Bcrypt Hash, Not Null |
| `is_active` | `BOOLEAN` | Default: `True` |
| `created_at` | `TIMESTAMPTZ` | Default: `NOW()` |

### 3.2 `generations` Table
| Column | Type | Constraints / Details |
|---|---|---|
| `id` | `UUID` | Primary Key, `gen_random_uuid()` |
| `user_id` | `UUID` | Foreign Key $\rightarrow$ `users.id` (Data Isolation) |
| `task_type` | `VARCHAR(20)` | `"txt2img"` \| `"img2img"` \| `"inpaint"` |
| `prompt` | `TEXT` | Prompt ข้อความ |
| `negative_prompt` | `TEXT` | Negative keywords |
| `model_name` | `VARCHAR(100)` | Checkpoint Model เช่น `counterfeitV30_v30.safetensors` |
| `lora_config` | `JSONB` | การตั้งค่า LoRA และ Triggers |
| `sampler_name` | `VARCHAR(50)` | เช่น `Euler a`, `DPM++ 2M Karras` |
| `steps` | `INTEGER` | 1 - 150 (Default: 20) |
| `cfg_scale` | `FLOAT` | 0.0 - 30.0 (Default: 7.0) |
| `seed` | `BIGINT` | Seed สำหรับสุ่มภาพ |
| `width`, `height` | `INTEGER` | ความกว้าง/สูง (Pixels) |
| `source_image_path` | `VARCHAR(500)` | Path ของภาพต้นฉบับใน `uploads/` (สำหรับ img2img/inpaint) |
| `mask_image_path` | `VARCHAR(500)` | Path ของภาพ Mask ใน `uploads/` (สำหรับ inpaint) |
| `denoising_strength`| `FLOAT` | 0.0 - 1.0 (Default: 0.7) |
| `output_path` | `VARCHAR(500)` | Absolute Path ของไฟล์ภาพใน `outputs/` |
| `status` | `VARCHAR(20)` | `"pending"` $\rightarrow$ `"processing"` $\rightarrow$ `"completed"` \| `"failed"` |
| `error_message` | `TEXT` | รายละเอียดข้อผิดพลาดเมื่อล้มเหลว |
| `duration_seconds` | `FLOAT` | เวลาประมวลผลทั้งหมด (วินาที) |
| `created_at` | `TIMESTAMPTZ` | เวลาที่สร้างคำสั่ง |
| `completed_at` | `TIMESTAMPTZ` | เวลาที่ประมวลผลเสร็จสิ้น |

---

## 🔌 4. Full REST API Specification

### 🔐 Authentication (`/auth`)
- `POST /auth/register` $\rightarrow$ สมัครสมาชิก (คืนค่า UserResponse ไม่มี Password)
- `POST /auth/login` $\rightarrow$ ล็อกอินด้วย `username` + `password` (คืนค่า Bearer JWT Token)
- `GET /auth/me` $\rightarrow$ ดึงข้อมูลโปรไฟล์ผู้ใช้ พร้อมสรุปยอด `total_generations`

### 🎨 Image Generation (`/generations`)
- `POST /generations` $\rightarrow$ สร้างงานใหม่ (`txt2img`, `img2img`, `inpaint`) ตอบ 201 ทันทีและส่งเข้า Worker
- `GET /generations` $\rightarrow$ ดูประวัติงานของตนเอง พร้อม Pagination (`page`, `page_size`, `total`)
- `GET /generations/{id}` $\rightarrow$ ดูสถานะของงาน (`pending`, `processing`, `completed`, `failed`)
- `GET /generations/{id}/image` $\rightarrow$ ดาวน์โหลดไฟล์ภาพผลลัพธ์ PNG

### 📤 Image Upload (`/uploads`)
- `POST /uploads` & `POST /generations/upload` $\rightarrow$ รับไฟล์ Multipart, ตรวจสอบ 5 ชั้น, บันทึกลง `uploads/`, ส่งคืน Metadata + URL
- `GET /uploads/{filename}` $\rightarrow$ ดึงไฟล์ภาพ Static พร้อม Header `Cache-Control: public, max-age=86400`
- `HEAD /uploads/{filename}` $\rightarrow$ ตรวจสอบความมีอยู่ของไฟล์ (200 OK / 404 Not Found)

### 📡 Distributed Webhook Callback (`/api/callback`)
- `POST /api/callback` $\rightarrow$ AI Node ยิงผลลัพธ์กลับมา พร้อม Header `X-LUMA-INTERNAL-SECRET`
  - รองรับ **Idempotency** (ยิงซ้ำตอบ 200 `duplicate: true`)
  - บันทึกไฟล์ภาพแบบ **Atomic Write (`.tmp` $\rightarrow$ `replace`)**

### 🏥 System & Health Diagnostics
- `GET /healthz` $\rightarrow$ เช็คสถานะสุขภาพของเซิร์ฟเวอร์
- `GET /api/status` $\rightarrow$ เช็คขีดจำกัดขนาดไฟล์และโหมดการทำงาน

---

## 🧪 5. Verification & Testing Matrix

### Automated Pytest Suite (`pytest --cov=app`)
```text
tests/test_auth.py ......................... [10 Tests PASSED]
tests/test_callback.py ..................... [ 7 Tests PASSED]
tests/test_generations.py .................. [ 8 Tests PASSED]
tests/test_security.py ..................... [ 6 Tests PASSED]
tests/test_services.py ..................... [ 7 Tests PASSED]
tests/test_upload.py ....................... [13 Tests PASSED]
================================================================
TOTAL: 51 Passed | Runtime: 8.42s | Coverage: 90%
```

### End-to-End User Journey Test (`python test_e2e_flow.py`)
```text
✅ 1. Mock AI Server Health Check
✅ 2. User Registration
✅ 3. User Login & JWT Issuance
✅ 4. Profile Stats Verification via GET /auth/me
✅ 5. Direct Mode txt2img Generation
✅ 6. Direct Mode Image Download
✅ 7. Callback Security Defense (Secret Rejection)
✅ 8. Callback Mode Distributed txt2img
✅ 9. Callback Mode Image Retrieval
✅ 10. Webhook Idempotency & Duplicate Safety
✅ 11. Image Upload with 5-Layer Validation
✅ 12. Static Image Serving with Cache-Control
✅ 13. img2img Transformation Pipeline
✅ 14. Download Transformed Image
✅ 15. Real-Time Profile Generation Counter Verification
================================================================
🏆 15 / 15 E2E Scenarios PASSED (100% SUCCESS)
```

---

## 🚀 6. Execution Commands

### Local Virtual Environment
```bash
# 1. Activate Environment
source .venv/bin/activate

# 2. Start Mock AI Server (Port 8001)
uvicorn mock_ai_server:app --port 8001 &

# 3. Start Backend Server (Port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 4. Run Pytest Suite
pytest --cov=app --cov-report=term-missing

# 5. Run Full E2E Integration Suite
python test_e2e_flow.py
```

### Docker Multi-Container Cluster
```bash
docker-compose up --build
```
