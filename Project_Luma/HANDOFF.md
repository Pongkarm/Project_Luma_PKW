# 📋 LUMA PROJECT MASTER HANDOFF DOCUMENT
**Document Version:** 1.0.0  
**Timestamp:** 2026-08-18T23:01:00+07:00  
**Project Workspace:** `D:\My_server\University\3rd year\Term_1\Image_processing\Project_Luma`

---

## 👤 1. Executive Summary & Student Profile
* **Student Name:** Apisak Kongphakdee (อภิสักก์ คงภักดี)
* **Student ID:** `6710301009` (3rd Year, Computer Engineering / IT @ Chitralada Technology Institute - CDTI)
* **Course:** Image Processing (310-2307)
* **Instructor:** Krisada Phromsuthirak (อ.กฤษฎา / อ.อู๊ด)
* **Role Assigned:** **AI Engineer (คนที่ 3)** บนโหนด PC3 (`192.168.1.30:7860`)
* **Project Name:** **LUMA** (**L**earning-based **U**niversal **M**edia **A**rtist)
* **Academic Mentor / AI Tutor:** Iris (ไอริส / พี่ไอ) จากระบบ CDTI AI Classroom

---

## 🌐 2. Master System Architecture & Distributed Network Topology

```
                                      ┌───────────────────────────────────────────────┐
                                      │              CLIENT BROWSER (User)            │
                                      └───────────────────────┬───────────────────────┘
                                                              │ HTTP (Port 80)
                                                              ▼
                                      ┌───────────────────────────────────────────────┐
                                      │             PC1: 192.168.1.10 (Gateway)       │
                                      │  • Nginx Reverse Proxy (proxy_read_timeout 300s)│
                                      │  • Frontend WebApp (Bootstrap 5, HTML/JS/CSS) │
                                      └───────────┬───────────────────────┬───────────┘
                                                  │                       │
                       /api/ (Proxy to Flask)     │                       │ /ai/ (Health/Docs)
                                                  ▼                       ▼
┌─────────────────────────────────────────────────────────┐  ┌─────────────────────────────────────────────────────────┐
│              PC2: 192.168.1.20 (Backend Node)           │  │              PC3: 192.168.1.30 (AI Inference Node)      │
│  • Flask REST API (Port 5000)                           │  │  • FastAPI AI Gateway (Port 7860)                      │
│  • SQLite Database with WAL Mode (tasks.db)             │  │  • GPU: NVIDIA GeForce RTX 3070 Laptop (8GB VRAM)      │
│  • JWT Authentication (2h Expiry)                       │  │  • FIFO Task Queue + 120s Timeout Watchdog             │
│  • File Storage (uploads/ with HTTP 24h Cache Header)   │  │  • LoRA Registry (Single Source of Truth)              │
│  • AI Client -> Sends Job: POST /ai/generate            │  │  • WebP Optimizer (Cuts Payload ~80%)                  │
│  • Callback Receiver: POST /api/callback                │◄─┼── • Async Callback + 3x Exponential Backoff            │
└─────────────────────────────────────────────────────────┘  └───────────────────────────┬─────────────────────────────┘
                                                                                         │ Internal HTTP (:7861)
                                                                                         ▼
                                                             ┌─────────────────────────────────────────────────────────┐
                                                             │     Stable Diffusion WebUI Forge Engine (Port 7861)    │
                                                             │  • Checkpoints: Counterfeit v3.0, Nova Anime XL, Pony   │
                                                             │  • LoRAs: Frieren, Himmel, Niji Mix, Tachi-e, Geekpower │
                                                             │  • Low-VRAM Optimizations & Block Caching               │
                                                             └─────────────────────────────────────────────────────────┘
```

---

## 🧠 3. Senior Architectural Decisions from Iris (พี่ไอ)

| ระบบ / กลไก | การตัดสินใจทางสถาปัตยกรรม (Architectural Decision) | เหตุผลและผลลัพธ์ (Rationale & Impact) |
|---|---|---|
| **Data Contract** | JSON Payload แนบ **Base64 WebP** (Quality 92) | ลดขนาดภาพเหลือ 200–400 KB ประหยัด Bandwidth ของวง LAN มากกว่า PNG ถึง ~80% |
| **LoRA Trigger Words** | **AI Server เป็นคนฉีด Trigger Words เอง** ผ่าน `lora_registry.json` | ยึดหลัก Single Source of Truth; Frontend ส่งแค่ LoRA ID ไม่ต้อง Hardcode คำเฉพาะ |
| **GPU Concurrency** | **FIFO Task Queue** (`asyncio.Queue` + 120s Timeout) | จัดคิวประมวลผล GPU ทีละ 1 งาน ป้องกันการเกิด Out-of-Memory (OOM) บน RTX 3070 8GB |
| **Callback Resilience** | **Asynchronous Callback** ผ่าน `httpx` พร้อม Exponential Retry 3 ครั้ง | ป้องกันภาพสูญหายกรณี Network กระตุก พร้อมบันทึกสำรองใน `ai_server/storage/cached/` |
| **Task Cancellation** | รองรับ **Soft Cancel** (ลบในคิว) และ **Hard Cancel** (สั่ง Forge `/sdapi/v1/interrupt`) | ไม่ให้ GPU เสียเวลาคำนวณงานที่ผู้ใช้กดยกเลิกหรือปิดเบราว์เซอร์หนี |
| **SQLite Concurrency (PC2)** | เปิดใช้งาน **SQLite WAL Mode** (`PRAGMA journal_mode=WAL;`) | ป้องกัน Database Lock เมื่อ Frontend Polling ถี่ๆ ขณะที่ AI Server ยิง Callback เขียนข้อมูล |
| **Canvas Inpainting (PC1)** | สูตรแปลงพิกัด Responsive: `(clientX - rect.left) * (canvas.width / rect.width)` | ป้องกัน Mask เพี้ยนจากการย่อ-ขยายหน้าจอบนอุปกรณ์มือถือและจอคอมพิวเตอร์ |
| **Nginx Reverse Proxy (PC1)** | `client_max_body_size 50M;` และ `proxy_read_timeout 300s;` สำหรับ `/api/generate` | ป้องกันปัญหา 504 Gateway Timeout ระหว่างที่ AI กำลัง Denoise ภาพ |

---

## 📁 4. Project Directory & Deliverables Breakdown

### 🎨 `frontend/` (คนที่ 1: UX/UI Frontend Developer)
* [README.md](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/frontend/README.md): สเปกงาน, 4-Layer Loading Pattern, Data Contract
* [js/api.js](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/frontend/js/api.js): Fetch Wrapper + Polling Task Status (3s)
* [js/edit.js](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/frontend/js/edit.js): Canvas Inpainting Tool พร้อมสูตรแปลงพิกัด Responsive

### ⚙️ `backend/` (คนที่ 2: Flask Backend Developer)
* [README.md](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/backend/README.md): API Specifications, State Machine, Callback Schema
* [config.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/backend/config.py): ตั้งค่า SQLite, JWT 2 ชั่วโมง, และ Internal Secret
* [models/\_\_init\_\_.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/backend/models/__init__.py): SQLAlchemy Setup พร้อม Listener เปิด SQLite WAL Mode อัตโนมัติ

### 🤖 `ai_server/` (คนที่ 3: AI Engineer - หน้าที่ของคุณ)
* [server.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/server.py): FastAPI Application หลัก (Endpoints: `/`, `/ai/health`, `/ai/models`, `/ai/generate`, `/ai/edit`, `/ai/task/{id}`)
* [config.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/config.py): พารามิเตอร์ VRAM, Max 768px, Stability Matrix Model Paths
* [run.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/run.py): Standalone Entry Point พร้อม Auto `sys.path` Resolution
* [data/lora_registry.json](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/data/lora_registry.json): คลังจับคู่ LoRA กับ Trigger Words และ Weights
* [services/queue_manager.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/services/queue_manager.py): FIFO Queue + Timeout Watchdog + Soft/Hard Task Cancellation
* [services/prompt_builder.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/services/prompt_builder.py): ระบบฉีด LoRA Trigger Words อัตโนมัติ
* [services/forge_client.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/services/forge_client.py): Bridge เชื่อมต่อกับ WebUI Forge API (Port 7861) พร้อม Fallback Renderer
* [utils/gpu_monitor.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/utils/gpu_monitor.py): Real-time GPU & VRAM Memory Metrics + `clear_vram_cache()`
* [utils/image_utils.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/utils/image_utils.py): Base64 ↔ PIL Converter + WebP Compression
* [utils/callbacks.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/utils/callbacks.py): Asynchronous HTTP Callback พร้อม Retry 3 ครั้ง
* [tests/test_server.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/tests/test_server.py): Unit Test Suite ครบ 5 หมวด
* [tests/demo_generation.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/tests/demo_generation.py): สคริปต์ทดสอบ End-to-End Generation & WebP Verification
* [start_forge_api.bat](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/ai_server/start_forge_api.bat): ตัวรัน WebUI Forge ในโหมด Headless API (:7861)
* [start_ai_server.bat](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/start_ai_server.bat): ตัวรันเซิร์ฟเวอร์ AI FastAPI (:7860) แบบ 1-Click

### 🚀 `devops/` (คนที่ 4: QA / DevOps & Nginx)
* [README.md](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/devops/README.md): Network Matrix, Firewall Rules, 3-Layer Demo Kit, Emergency Runbook
* [nginx/nginx.conf](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/devops/nginx/nginx.conf): Nginx Reverse Proxy Config ปรับแต่ง Timeout 300s, Gzip (Text only), Caching 24h
* [tests/locustfile.py](file:///d:/My_server/University/3rd%20year/Term_1/Image_processing/Project_Luma/devops/tests/locustfile.py): สคริปต์ Load Testing จำลองสัดส่วนผู้ใช้ 70:20:10

---

## 💻 5. Hardware & Environment Specifications
* **GPU:** NVIDIA GeForce RTX 3070 Laptop GPU (8GB GDDR6 VRAM, 140W TGP)
* **Python Executable:** `D:\StabilityMatrix-win-x64\Data\Packages\Stable Diffusion WebUI Forge - Neo\venv\Scripts\python.exe`
* **PyTorch Version:** `2.11.0+cu130` (CUDA Enabled: True)
* **Shared Stability Matrix Storage:** `D:\StabilityMatrix-win-x64\Data\Models\`
  * **Checkpoints:** `counterfeitV30_v30.safetensors`, `novaAnimeXL_ilV190.safetensors`, `prefectPonyXL_v6.safetensors`
  * **LoRAs:** `SousouNoFrieren_Frieren_IlluXL.safetensors`, `Char-Frieren-IL-V1.safetensors`, `himmel_sousou_no_frieren_ilxl.safetensors`, `niji_and_midj_mix217.safetensors`, `tachi-e.safetensors`, `[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors`

---

## 🚦 6. Current State & Next Steps for the Next Agent

### ✅ Current State (ความคืบหน้าปัจจุบัน):
1. **Phase 1 (Architecture & Setup):** 100% Completed
2. **Phase 2 (Core AI Inference Server):** 100% Completed
3. **Phase 3 (Real GPU Pipeline & LoRA Engine):** 100% Completed & Verified (ทดสอบรัน `demo_generation.py` ผ่านฉลุย ได้ภาพ WebP ขนาด ~8.8 KB)
4. **Server Status:** รันสดอยู่ที่ `http://0.0.0.0:7860` (Dashboard & Swagger UI พร้อมใช้งาน)

### 🟡 Immediate Next Actions (สิ่งที่ Agent ถัดไปต้องทำต่อ):
1. **Phase 4: Multi-Node LAN Integration**:
   * นำ IP `192.168.1.30:7860` ไปเชื่อมต่อกับ Flask Backend บน PC2 (`192.168.1.20:5000`)
   * ทดสอบยิง `POST /api/generate` จาก Backend มายัง AI Server และรับ Callback กลับไปยัง `/api/callback`
2. **Phase 5: Load & Stress Testing**:
   * ร่วมมือกับ DevOps รัน `locustfile.py` เพื่อทดสอบ Load 10 $\rightarrow$ 50 $\rightarrow$ 100 Concurrent Users และตรวจสอบ VRAM Leak
3. **Phase 6: Demo Kit & Report**:
   * จัดเตรียมภาพ Preset สำเร็จรูป 10–20 ภาพไว้ใน Gallery ล่วงหน้า
   * เรียบเรียงรายงานวิชาการตามข้อกำหนด (เรียงรหัสนักศึกษาจากน้อยไปมาก, ฟอนต์ Sarabun, ป้องกัน Page Break ตาราง/โค้ด)

---

## 🛠️ 7. Suggested Skills for the Next Agent
Agent ที่เข้ามารับช่วงต่อ ควรเปิดใช้งาน Skills ดังต่อไปนี้เพื่อความรวดเร็วและแม่นยำ:
* **`agent-async` & `async-human-code`**: สำหรับการเขียน/ตรวจสอบ Asynchronous Code (FastAPI, HTTPX, Task Queue, Non-blocking I/O)
* **`debug-mantra`**: สำหรับขั้นตอนการ Debug Network & Multi-node Communication เมื่อเจอปัญหา Connection Drop
* **`kien-thai`**: สำหรับการเขียน/ตรวจทานข้อความภาษาไทย รายงานวิชาการ และ Documentation ให้สละสลวย เป็นธรรมชาติ และถูกต้องตามหลักการเขียนของไทย
* **`scrutinize`**: สำหรับการรีวิวความปลอดภัยและ Code Quality ก่อนส่งมอบงานไฟนอล
