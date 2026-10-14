# 🎨 LUMA: Distributed AI Image Generation Platform

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Architecture](https://img.shields.io/badge/Architecture-4--Node%20Distributed-orange.svg)](#-1-architecture-overview-สถาปัตยกรรมระบบ-4-โหนด)
[![Nginx Gateway](https://img.shields.io/badge/Nginx%20Gateway-10.23.130.212%3A80-009639.svg?logo=nginx)](http://10.23.130.212)
[![AI Node (PC3)](https://img.shields.io/badge/AI%20Node%20(PC3)-10.23.130.112%3A7860-blueviolet.svg?logo=nvidia)](http://10.23.130.112:7860)
[![Tests](https://img.shields.io/badge/Tests-Full%20Multi--Node%20Passed%20(17%2F17%20AI%20%2B%2012%2F12%20QA)-brightgreen.svg)](#-6-testing--quality-assurance)
[![Safety](https://img.shields.io/badge/Safety-5--Layer%20Guard%20%2B%20LoRA%20Compat-success.svg)](#-3-model--lora-architecture-compatibility-ระบบตรวจสอบความเข้ากันได้)

**LUMA** เป็นแพลตฟอร์มสร้างและตัดต่อภาพด้วยปัญญาประดิษฐ์ระดับสตูดิโอ (AI Studio & Image Generation Platform) ที่ออกแบบด้วยสถาปัตยกรรม **Distributed Computing 4 โหนด (4 Physical Nodes)** รองรับการสร้างภาพแบบ Multi-Modal ทั้ง **Text-to-Image (txt2img)**, **Image-to-Image (img2img)**, และ **Canvas Inpainting** พร้อมเครื่องมือประมวลผลภาพขั้นสูงในตัว

---

## 🏛️ 1. Architecture Overview (สถาปัตยกรรมระบบ 4 โหนด)

ระบบแบ่งแยกหน้าที่การทำงานอย่างชัดเจนตามหลักการ Separation of Concerns ออกเป็น **4 Physical Nodes** เชื่อมต่อกันผ่านเครือข่ายวงแลน (Local Area Network):

```mermaid
graph TD
    User([👤 User / Web Browser])

    subgraph Node1 ["Node 1: Nginx Gateway & DevOps (10.23.130.212:80)"]
        Nginx["Nginx Reverse Proxy (Port 80)<br/>Single Entry Point & CORS Elimination"]
        AccessLog["Live Traffic Logger with Upstream IP"]
        Dashboard["DevOps Health Monitoring: /dashboard"]
        QATest["Automated QA Suite: 12-16 Test Cases"]
    end

    subgraph Node2 ["Node 2: Frontend Web Client (10.23.130.6:5500)"]
        UI["Modern Web Studio (HTML5 / Vanilla JS)<br/>Canvas Inpainting • GrabCut • Pose Detection"]
    end

    subgraph Node3 ["Node 3: Backend & Database (10.23.130.9:8000)"]
        API["FastAPI Core Engine & API Gateway"]
        DB[("Database: SQLite / PostgreSQL")]
        Storage["Storage: uploads/ & outputs/"]
        Security["JWT Auth • Bcrypt • 5-Layer Image Validation"]
    end

    subgraph Node4 ["Node 4: AI Inference Engine (10.23.130.112:7860 — PC3)"]
        AIEngine["FastAPI AI Engine (Port 7860)<br/>FIFO Queue • Watchdog 120s • Auto-skip"]
        SD["Stable Diffusion WebUI Forge (RTX 3070 8GB)<br/>Port 7861 Loopback (--nowebui --api)"]
        LoRA["LoRA Registry & Compatibility Guard"]
    end

    User -->|"HTTP Port 80"| Nginx
    Nginx -->|"Reverse Proxy / -> 10.23.130.6:5500"| UI
    Nginx -->|"Reverse Proxy /api/, /auth, /generations"| API
    UI -->|"REST API + JWT (via Gateway)"| API
    API -->|"Async Webhook Dispatch (/ai/generate)"| AIEngine
    AIEngine -->|"Forge API (:7861)"| SD
    AIEngine -->|"HTTP Callback (/api/callback) + WebP"| API
```

### ตารางแจกแจงอุปกรณ์และพอร์ตในเครือข่าย (Network & Hardware Matrix)

| Node | เครื่อง / บทบาท | ผู้รับผิดชอบ | ระบบปฏิบัติการ | IP Address | Port | หน้าที่หลัก |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **Nginx Gateway & DevOps** | คนที่ 4 (QA / DevOps) | Windows | `10.23.130.212` | `80` | จุดรับ Traffic จุดเดียว (Single Entry Point), Reverse Proxy กระจายงาน, Realtime Log, Monitoring Dashboard, QA Testing, Backup |
| **2** | **Frontend Client** | คนที่ 1 | macOS | `10.23.130.6` | `5500` | บริการหน้าเว็บ UI, Canvas Inpainting Tool, Studio GrabCut, Pose Detection |
| **3** | **Backend & Database** | คนที่ 2 (Pongkarm) | macOS | `10.23.130.9` | `8000` | จัดการ Authentication, บันทึก Task คิว, ฐานข้อมูล, จัดเก็บรูปภาพ, รับ Callback Webhook |
| **4** | **AI Inference Engine** | คนที่ 3 (Apisak K.) | Windows (PC3) | `10.23.130.112` | `7860` | ประมวลผลโมเดล Stable Diffusion บน GPU RTX 3070 8GB, FIFO Queue, LoRA Guard, WebP Compression |
| **-** | **Forge Headless Engine** | โลคอลภายใน Node 4 | Windows (PC3) | `127.0.0.1` | `7861` | เอนจิน Diffusion ทำงานเบื้องหลังผ่าน REST API (`--nowebui --api`) |

---

## 🔄 2. Dual-Mode Inference Strategy (กลยุทธ์การเชื่อมโยงระบบ AI)

Backend รองรับการทำงานร่วมกับ AI Node ใน 2 รูปแบบ สลับได้ผ่านตัวแปรสภาพแวดล้อม `AI_MODE`:

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน (Browser)
    participant Gateway as Node 1: Gateway (10.23.130.212)
    participant Frontend as Node 2: Frontend (10.23.130.6)
    participant Backend as Node 3: Backend (10.23.130.9)
    participant DB as ฐานข้อมูล (SQLite/PostgreSQL)
    participant AI as Node 4: AI Engine (10.23.130.112)
    participant Forge as Forge GPU (127.0.0.1:7861)

    alt โหมด A: Direct Mode (Synchronous — สำหรับทดสอบบนเครื่องเดี่ยว)
        User->>Gateway: POST /api/generations (Prompt, Settings)
        Gateway->>Backend: Forward to 10.23.130.9:8000
        Backend->>DB: บันทึกสถานะงาน (status=pending)
        Backend->>AI: POST /generate (Prompt, Resolution)
        AI->>Forge: /sdapi/v1/txt2img
        Forge-->>AI: PNG Image
        AI-->>Backend: ส่งภาพผลลัพธ์กลับมาทันที (Base64 WebP)
        Backend->>Backend: บันทึกภาพลง Disk (outputs/{id}.webp)
        Backend->>DB: อัปเดตสถานะงาน (status=completed)
        User->>Gateway: GET /api/generations/{id}/image
        Gateway->>Backend: Forward to 10.23.130.9:8000
        Backend-->>User: 200 OK (ไฟล์ภาพ)
    else โหมด B: Distributed Callback Mode (Asynchronous — ใช้งานจริงในระบบ 4 โหนด)
        User->>Gateway: POST /api/generations (Prompt, Settings)
        Gateway->>Backend: Forward to 10.23.130.9:8000
        Backend->>DB: บันทึกสถานะงาน (status=pending)
        Backend->>AI: POST /ai/generate (task_id, callback_url)
        AI-->>Backend: ตอบรับ HTTP 202 Accepted ทันที (เข้า FIFO Queue)
        Backend-->>Gateway: 202 Accepted (task_id, status: pending)
        Gateway-->>User: ตอบกลับทันที (ไม่เกิด 504 Gateway Timeout)
        Note over AI,Forge: GPU RTX 3070 ประมวลผล Denoising (7.54 it/s)...
        AI->>Forge: POST /sdapi/v1/txt2img
        Forge-->>AI: Output Latent Decoded
        AI->>AI: บีบอัด WebP (Method 6, Quality 92) + สำรอง Disaster Cache
        AI->>Backend: POST /api/callback (X-LUMA-INTERNAL-SECRET, WebP Base64, Seed)
        Backend->>Backend: บันทึกภาพแบบ Atomic Write (outputs/{id}.webp)
        Backend->>DB: อัปเดตสถานะงาน (status=completed)
        User->>Gateway: โพลล์สถานะ GET /api/generations/{id}
        Gateway->>Backend: Forward
        Backend-->>User: 200 OK (status: completed, image_url)
    end
```

---

## 🧠 3. Model & LoRA Architecture Compatibility (ระบบตรวจสอบความเข้ากันได้)

เนื่องจาก LoRA Adapter แต่ละตัวถูกเทรนขึ้นมาสำหรับ Base Model เฉพาะตระกูล หากนำ LoRA ข้ามรุ่นไปผสม (เช่น นำ LoRA ของ Illustrious XL ไปใช้กับ SD 1.5) ภาพที่ได้จะแตกลายและเกิด Artifacts ผิดเพี้ยน LUMA จึงมีระบบป้องกัน 2 ชั้น (**Defense-in-Depth**):

### ตารางจำแนกตระกูลโมเดล (Model Family Matrix)

| ตระกูลสถาปัตยกรรม (Family) | ตัวอย่าง Checkpoint Model | LoRA Adapter ที่รองรับ |
| :--- | :--- | :--- |
| **`sd15`** (Stable Diffusion 1.5) | `counterfeitV30_v30.safetensors` | `tachi-e`, `niji_and_midj_mix217` |
| **`illustrious_xl`** (Illustrious XL) | `novaAnimeXL_ilV190.safetensors` | `SousouNoFrieren`, `Char-Frieren-IL-V1`, `himmel` |
| **`pony_xl`** (Pony XL) | `prefectPonyXL_v6.safetensors` | `[Artstyle] SomethingWeird_Geekpower [PDXL]` |

### กลไกการป้องกัน 2 ระดับ:
1. **Frontend Level (UI Filter & Auto-Reset)**:
   * หน้าเว็บจะกรอง Dropdown ของ LoRA ให้แสดงเฉพาะตัวที่ตรงกับ Base Model ที่เลือก
   * หากผู้ใช้สลับโมเดลแล้ว LoRA เดิมเข้ากันไม่ได้ ระบบจะรีเซ็ตกลับเป็น `"ไม่ใช้"` และบันทึก Draft อัตโนมัติ ป้องกันความสับสนของผู้ใช้
2. **AI Server Level (Auto-skip Safety Guard)**:
   * กรณีมีคำขอยิงข้ามตระกูลส่งตรงมาทาง API ตัว Server จะไม่ทำให้ Request ล่ม (ไม่ Throw Error 500) แต่จะ **Auto-skip** ตัดแท็ก LoRA นั้นออก พร้อมบันทึก Warning Log เพื่อให้งานสร้างภาพยังคงดำเนินต่อไปได้อย่างปลอดภัย (**Zero Breaking Change**)

---

## 🗄️ 4. Database Schema (โครงสร้างฐานข้อมูล)

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
        int steps "Inference steps (1-50)"
        float cfg_scale "CFG scale (1.0-20.0)"
        bigint seed "Random seed"
        int width "Width in px (256-768)"
        int height "Height in px (256-768)"
        string source_image_path "Uploaded base image"
        string mask_image_path "Uploaded inpaint mask"
        float denoising_strength "img2img strength (0.05-1.0)"
        string output_path "Path to generated image"
        string status "pending | processing | completed | failed"
        text error_message "Error diagnostics"
        float duration_seconds "Processing duration"
        timestamp created_at "Created timestamp"
        timestamp completed_at "Completed timestamp"
    }
```

---

## 🛡️ 5. Five-Layer Image Security Validation (ระบบความปลอดภัย 5 ชั้น)

เพื่อป้องกันการโจมตีทางไซเบอร์และการส่งไฟล์อันตรายเข้าสู่ GPU ระบบมีระบบคัดกรองไฟล์ภาพที่เข้มงวด 5 ระดับ:

| ลำดับชั้น (Layer) | การตรวจสอบ (Validation Type) | วัตถุประสงค์ในการป้องกัน (Defense Purpose) |
|---|---|---|
| **Layer 1** | Content-Type Header Check | กรองเบื้องต้นเฉพาะ `image/png`, `image/jpeg`, `image/webp` |
| **Layer 2** | File Size Bound (10MB Limit) | ป้องกัน DoS จากไฟล์ขนาดยักษ์ (ตอบกลับ HTTP 413) |
| **Layer 3** | Magic Bytes Deep Inspection | ตรวจสอบ Header ไบนารีแท้จริง ป้องกันมัลแวร์ที่เปลี่ยนนามสกุลไฟล์หลอก (HTTP 422) |
| **Layer 4** | Decompression Bomb Defense | ควบคุม `Image.MAX_IMAGE_PIXELS = 16M` (4096×4096px) ตามมาตรฐาน OWASP |
| **Layer 5** | EXIF Stripping & Atomic Write | ลบพิกัด GPS/ข้อมูลส่วนบุคคลออกจากภาพ และบันทึกไฟล์แบบ Atomic ป้องกันไฟล์เสียหาย |

---

## 🧪 6. Testing & Quality Assurance (ผลการทดสอบเต็มระบบ)

ระบบผ่านการทดสอบแบบอัตโนมัติ (Automated Tests) ครบถ้วนทุกชั้นสถาปัตยกรรมทั้ง 4 โหนด:

* **Node 1 DevOps Gateway (`nginx/test_distributed_system.py`)**: ผ่านการทดสอบ **12/12 Tests (100% Pass)** ครอบคลุม Routing, Reverse Proxy, Upstream IP Whitelist, Data Ingestion, Image Validation และ Backup Integrity
* **Node 2 Frontend (`frontend-html`)**: ผ่านการทดสอบ **14/14 Tests** ครอบคลุมการคำนวณขนาดภาพ, กฎรหัสผ่าน, และการกรอง LoRA ตามตระกูลโมเดล
* **Node 3 Backend Core (`backend_node`)**: ผ่านการทดสอบ **83+ Integration Tests** ครอบคลุม Auth, Permissions, Upload Security, และ Webhook Idempotency
* **Node 4 AI Inference Node (`Project_Luma_PKW` / `ai_server`)**: ผ่านการทดสอบ **17/17 Tests (100% Pass)**
  * `test_server.py`: **9/9 Passed** (GPU Monitor, Models List, LoRA Trigger, Task Lifecycle, VRAM Guard)
  * `test_edge_cases.py`: **8/8 Passed** (Bounds Sanitization, Empty Prompt, HTTP 403 Security, Cancellation)
* **Multi-Node Full Pipeline (`test_multi_node_e2e.py`)**: ผ่านการทดสอบจำลองเชื่อมโยง 4 โหนดพร้อมกันแบบครบวงจรข้ามวงแลน

---

## 🚀 7. Quick Start Guide (วิธีเปิดใช้งานระบบในวงแลน)

### 1) รัน Node 4: AI Inference Server (พอร์ต 7860 — เครื่อง PC3)
ดับเบิลคลิกไฟล์ **`start_ai_server.bat`** (One-Click Launcher) หรือรันผ่าน Terminal:
```powershell
# ในโฟลเดอร์ Project_Luma_PKW หรือ Project_Luma
python -m ai_server.run
```
*(ระบบจะผูกเข้ากับ `0.0.0.0:7860` และเชื่อมต่อกับ Forge Headless บน `127.0.0.1:7861` อัตโนมัติ)*

### 2) รัน Node 3: Backend Core API (พอร์ต 8000 — เครื่อง Pongkarm)
```powershell
# ในโฟลเดอร์ backend_node
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3) รัน Node 2: Web Frontend (พอร์ต 5500)
```bash
# ในโฟลเดอร์ frontend_node/frontend-html
python serve_gateway.py
# หรือ python -m http.server 5500
```

### 4) รัน Node 1: Nginx Gateway & DevOps (พอร์ต 80)
ดับเบิลคลิกไฟล์:
```text
nginx\run_nginx_with_logs.bat
```

---

## 🎬 8. Live Demonstration Flow (ลำดับการนำเสนอโปรเจกต์)

1. **เข้าใช้งานผ่าน Single Entry Point:** เปิดเบราว์เซอร์ไปที่ **`http://10.23.130.212/`** (หน้า Gateway พอร์ต 80) โชว์ว่าโหลด UI จาก Node 2 ได้อย่างสมบูรณ์แบบโดยไม่ต้องระบุพอร์ต
2. **มอนิเตอร์สถานะระบบ:** เปิด **`http://10.23.130.212/dashboard`** แสดง Health Status และ VRAM ของทั้ง 4 โหนดแบบ Real-time
3. **ทดสอบ Model & LoRA Filtering:**
   * เลือกโมเดล **Counterfeit v3.0 (SD 1.5)** ➔ สังเกตว่าช่อง LoRA จะแสดงเฉพาะ Tachi-e และ Niji Mix
   * สลับไปเลือก **Nova Anime XL** ➔ สังเกตว่าตัวเลือก LoRA เปลี่ยนเป็น Frieren และ Himmel ทันที
4. **ทดสอบสร้างภาพ (txt2img Asynchronous Flow):**
   * กรอก Prompt ➔ กดสร้างภาพ ➔ Backend ตอบรับ `202 Accepted` ทันที
   * สังเกตหน้าต่าง AI Node Console ประมวลผลบน GPU RTX 3070 ด้วยความเร็ว ~7.54 it/s
   * เมื่อเสร็จสิ้น AI Node ส่ง Callback WebP กลับไปยัง Backend ➔ หน้าเว็บแสดงภาพสำเร็จ
5. **ทดสอบ Inpainting & Image Edit:** อัปโหลดภาพต้นฉบับ ➔ ระบาย Mask สีบนแคนวาส ➔ สั่ง Inpaint แปลงวัตถุเฉพาะจุด
6. **ทดสอบเครื่องมือสตูดิโอ (Studio Tools):** ทดสอบการตรวจจับท่าทาง (Pose Detection) และการตัดพื้นหลัง (GrabCut)
7. **รัน Automated QA Verification:** ดับเบิลคลิก `nginx/run_tests.bat` โชว์ผลการทดสอบผ่าน 100% Pass ยืนยันความพร้อมของระบบ
