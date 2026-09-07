# 🎨 LUMA: Distributed AI Image Generation Platform

[![Python](https://img.shields.io/badge/Python-3.10-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org)
[![Pytest](https://img.shields.io/badge/Tests-51%20Passed-brightgreen.svg)](https://pytest.org)
[![Coverage](https://img.shields.io/badge/Coverage-90%25-success.svg)](https://coverage.readthedocs.io)

**LUMA** เป็นระบบประมวลผลและสร้างภาพด้วยปัญญาประดิษฐ์ (AI Image Generation Platform) ที่ถูกออกแบบด้วยสถาปัตยกรรมแบบ **Distributed Computing** รองรับการสร้างภาพแบบ Multi-Modal ทั้ง **Text-to-Image (txt2img)**, **Image-to-Image (img2img)**, และ **Canvas Inpainting**

---

## 🏛️ 1. Architecture Overview (สถาปัตยกรรมระบบ)

ระบบแบ่งออกเป็น 3 Nodes อิสระ เชื่อมต่อกันผ่าน Local Area Network (LAN):

```mermaid
graph TD
    User([👤 User / Browser])
    
    subgraph PC1 ["Node 1: Frontend (192.168.1.10)"]
        UI[Bootstrap 5 + Canvas Inpaint Tool]
    end

    subgraph PC2 ["Node 2: Backend (192.168.1.20:8000)"]
        API[FastAPI Backend Engine]
        DB[(PostgreSQL Database)]
        Storage[Local File Storage: uploads/ & outputs/]
        Security[JWT + Bcrypt + 5-Layer Image Validation]
    end

    subgraph PC3 ["Node 3: AI Inference Engine (192.168.1.30:7860)"]
        AIEngine[FastAPI AI Wrapper]
        SD[Stable Diffusion / WebUI Forge RTX 3070]
        LoRA[LoRA Registry & Checkpoint Loader]
    end

    User -->|"HTTP / HTTPS"| UI
    UI -->|"REST API + JWT"| API
    API -->|"SQLAlchemy ORM"| DB
    API -->|"Atomic File I/O"| Storage
    API -->|"Direct (Sync) OR Callback (Webhook)"| AIEngine
    AIEngine -->|"Inference Execution"| SD
    AIEngine -->|"X-LUMA-INTERNAL-SECRET Callback"| API
```

---

## 🔄 2. Dual-Mode Inference Strategy

ระบบรองรับการทำงานกับ AI Node ใน 2 รูปแบบ สลับได้ง่ายๆ ผ่านการตั้งค่า `AI_MODE` ใน `.env`:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend (PC1)
    participant Backend as Backend Engine (PC2)
    participant DB as PostgreSQL
    participant AI as AI Node (PC3)

    alt Mode A: Direct Mode (Synchronous)
        Client->>Backend: POST /generations (Prompt, Settings)
        Backend->>DB: Record Task (status=pending)
        Backend->>AI: POST /generate (Prompt, Resolution)
        AI-->>Backend: Return Base64 PNG Image
        Backend->>Backend: Save outputs/{id}.png
        Backend->>DB: Update status=completed
        Client->>Backend: GET /generations/{id}/image
        Backend-->>Client: 200 OK (PNG File)
    else Mode B: Distributed Callback Mode (Asynchronous Webhook)
        Client->>Backend: POST /generations (Prompt)
        Backend->>DB: Record Task (status=pending)
        Backend->>AI: POST /ai/generate (task_id, callback_url)
        AI-->>Backend: 202 Accepted (Enqueued)
        Note over AI: GPU Inferences on RTX 3070...
        AI->>Backend: POST /api/callback (X-LUMA-INTERNAL-SECRET, Base64 Image)
        Backend->>Backend: Atomic Save outputs/{id}.png
        Backend->>DB: Update status=completed
        Client->>Backend: GET /generations/{id} (Polling status)
        Backend-->>Client: 200 OK (status: completed)
    end
```

---

## 🗄️ 3. Database Schema (Entity-Relationship)

```mermaid
erDiagram
    USERS ||--o{ GENERATIONS : owns
    USERS {
        uuid id PK "gen_random_uuid()"
        string username "Unique, Indexed"
        string email "Unique, Indexed"
        string password_hash "Bcrypt Encrypted"
        boolean is_active "Default: True"
        timestamp created_at "Server Default: NOW()"
    }
    GENERATIONS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "References users(id)"
        string task_type "txt2img | img2img | inpaint"
        text prompt "User prompt"
        text negative_prompt "Negative keywords"
        string model_name "SD Checkpoint model"
        jsonb lora_config "LoRA weights and triggers"
        string sampler_name "Sampling algorithm"
        int steps "Inference steps (1-150)"
        float cfg_scale "CFG scale (0-30)"
        bigint seed "Random seed"
        int width "Width in px"
        int height "Height in px"
        string source_image_path "Uploaded base image"
        string mask_image_path "Uploaded inpaint mask"
        float denoising_strength "img2img strength (0.0-1.0)"
        string output_path "Path to generated image"
        string status "pending | processing | completed | failed"
        text error_message "Error diagnostics"
        float duration_seconds "Processing duration"
        timestamp created_at "Created timestamp"
        timestamp completed_at "Completed timestamp"
    }
```

---

## 🛡️ 4. Five-Layer Image Security Validation

| Layer | Validation Type | Defense Purpose |
|---|---|---|
| **Layer 1** | Content-Type Header | กรองเบื้องต้นเฉพาะ `image/png`, `image/jpeg`, `image/webp` |
| **Layer 2** | File Size Limit (10MB) | ป้องกัน DoS จากไฟล์ขนาดใหญ่ (HTTP 413) |
| **Layer 3** | Magic Bytes Inspection | ตรวจสอบ Header ไบนารีแท้ ป้องกันมัลแวร์ที่ปลอมนามสกุล (HTTP 422) |
| **Layer 4** | Decompression Bomb Defense | จำกัด `Image.MAX_IMAGE_PIXELS = 16M` (4096x4096px) ตาม OWASP |
| **Layer 5** | EXIF Stripping & Atomic Write | ลบพิกัด GPS/Metadata เพื่อความเป็นส่วนตัว และบันทึกแบบ Atomic |

---

## 🧪 5. Testing & Quality Assurance (51 Tests, 90% Coverage)

```text
================================ tests coverage ================================
Name                         Stmts   Miss  Cover
------------------------------------------------
app/api/auth.py                 34      1    97%
app/api/callback.py             23      1    96%
app/api/generation.py           32      1    97%
app/api/upload.py               22      0   100% ⭐
app/core/config.py              19      0   100% ⭐
app/core/security.py            53      7    87%
app/db/database.py              11      0   100% ⭐
app/models/__init__.py          42      0   100% ⭐
app/schemas/generation.py       75      1    99%
app/schemas/token.py             4      0   100% ⭐
app/schemas/user.py             22      0   100% ⭐
app/services/generation.py     216     41    81%
app/services/upload.py          73     10    86%
------------------------------------------------
TOTAL                          630     62    90% 🏆
======================== 51 passed in 8.57s ========================
```

---

## 🚀 6. Quick Start Guide

### วิธีที่ 1: รันผ่าน Local Python Virtualenv
```bash
# 1. ติดตั้ง Dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. รัน Mock AI Server (Port 8001)
python mock_ai_server.py

# 3. รัน Backend API (Port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 4. สั่งรัน Automated Tests
pytest --cov=app --cov-report=term-missing
```

### วิธีที่ 2: รันผ่าน Docker Compose
```bash
docker-compose up --build
```

---

## 🎬 7. Live Demonstration Flow (สำหรับนำเสนออาจารย์)

1. **เปิด Swagger UI:** ไปที่ `http://localhost:8000/docs`
2. **Register & Login:** สมัครสมาชิกและล็อกอินรับ Token
3. **Check Profile:** เรียก `GET /auth/me` แสดงยอด `total_generations: 0`
4. **Live Demo 1 (txt2img):** สั่งสร้างภาพด้วย Prompt $\rightarrow$ เรียก `GET /generations/{id}/image` ดูภาพที่สร้างเสร็จ
5. **Live Demo 2 (img2img):** อัปโหลดภาพผ่าน `POST /uploads` $\rightarrow$ สั่ง `task_type="img2img"` $\rightarrow$ แสดงภาพ Before/After
6. **Live Demo 3 (Distributed Callback):** แสดงการทำงานแบบ Asynchronous Webhook
7. **Show Test Results:** รัน `pytest` แสดงผล 51/51 Tests ผ่าน 100% (Coverage 90%)
