# 📋 LUMA PROJECT MASTER HANDOFF DOCUMENT — AI NODE (PC3)
**Document Version:** 2.0.0  
**Updated At:** 2026-09-14  
**Project Workspace:** `D:\My_server\University\3rd year\Term_1\Image_processing\Project_Luma_git\Project_Luma_PKW`  
**Current Branch:** `ai-node` (Clean, Synced with `origin/ai-node`)  

---

## 👤 1. Executive Summary & Engineer Profile
* **Student Name:** Apisak Kongphakdee (อภิสักก์ คงภักดี)
* **Student ID:** `6710301009` (3rd Year, Computer Engineering / IT @ Chitralada Technology Institute - CDTI)
* **Course:** Image Processing (310-2307)
* **Role Assigned:** **AI Engineer (คนที่ 3)** บนโหนด PC3 (`0.0.0.0:7860`)
* **Project Name:** **LUMA** (**L**earning-based **U**niversal **M**edia **A**rtist)
* **GPU Hardware:** NVIDIA GeForce RTX 3070 Laptop GPU (8GB VRAM)

---

## 🌐 2. Master System Architecture & Multi-Node Network Topology

```text
[Node 1: Frontend (Winter - PC1)] 
         │  (HTTP REST / React + Tailwind UI)
         ▼
[Node 2: Backend Core (Pongkarm - PC2 / macOS :8000)]
         │  (FastAPI + PostgreSQL + JWT + Security Validation)
         ▼
[Node 3: AI Inference Node (Kong - PC3 / Windows :7860)]
         │  (FastAPI Wrapper + FIFO Queue + Fallback Renderer)
         ▼  (Internal Loopback :7861)
[WebUI Forge Engine (Port 7861 / RTX 3070 8GB)]
```

---

## 🚀 3. Phase 5 Engineering Accomplishments (Latest Milestones)

### A. Real Seed Extraction & Webhook Callback Persistence
* ดึงค่า **Actual Generation Seed** จาก Stable Diffusion WebUI Forge (`info.seed` หรือ `all_seeds[0]`) ในไฟล์ `ai_server/services/forge_client.py`
* ส่งค่า `"seed": <int>` แนบไปกับ Webhook Callback JSON (`POST /api/callback`)
* Backend บันทึกลงตาราง `generations.seed` เปิดให้ปุ่ม **"Reuse Seed"** บนหน้าเว็บ Frontend ใช้งานได้จริง

### B. Live Queue Position & GPU Denoising Progress Telemetry
* อัปเดต `GET /ai/task/{task_id}` ใน `ai_server/server.py` และ `queue_manager.py`:
  - สถานะ `queued`: คำนวณลำดับคิว `queue_position` (1-indexed) และ `total_queued`
  - สถานะ `processing`: โพลล์สถานะ denoising step จาก Forge API (`/sdapi/v1/progress`): `progress` (0.0–1.0), `step`, และ `total_steps`
  - สถานะ `completed`: ส่ง `progress: 1.0` และแนบ `seed`
* Backend ทำหน้าที่ Reverse Proxy (`GET /generations/{id}/progress`) ส่งต่อข้อมูล Live Telemetry สู่ Frontend แบบ Real-time

### C. Launcher Script Hardening & CLI Escaping Fix
* แก้ไขบั๊กใน `start_ai_server.bat` ที่ขยายสตริง `%~dp0` ติด trailing backslash เข้าไป escape quote (`"`) ส่งผลให้ argument flags หลุด
* ปรับให้รันผ่านโมดูลมาตรฐาน `python -m ai_server.run` เพื่อรับประกันการ Bind พอร์ต `0.0.0.0:7860` จาก `AIConfig` ทุกครั้ง

---

## 🧪 4. Test Suite & Validation (100% Green)
* **Test Suite Command:**
  ```powershell
  $env:PYTHONUTF8=1; python -u -m unittest -v ai_server.tests.test_edge_cases ai_server.tests.test_server
  ```
* **ผลลัพธ์:** **16/16 Tests ผ่านทั้งหมด (Ran 16 tests in ~4.8s - OK)**
* **ขอบเขตการทดสอบ:**
  - Healthcheck & GPU VRAM Detection
  - Model Catalogue Scanning (Stability Matrix Checkpoints & LoRAs)
  - LoRA Trigger Injection (Single Source of Truth)
  - Queue Enqueue, Priority, and Seed Metric Verification
  - Soft Cancel (ในคิว) และ Hard Cancel (GPU Interrupt)
  - Parameter Bounds Validation (Prompt Length, Steps 1-50, CFG 1.0-20.0, Dim 256-768px)
  - Security Authentication (`X-LUMA-INTERNAL-SECRET`)

---

## 📁 5. Directory Structure of Node 3 (`ai-node`)

```text
Project_Luma_PKW/
├── ai_server/
│   ├── data/
│   │   └── lora_registry.json      # Single Source of Truth LoRA configs
│   ├── services/
│   │   ├── forge_client.py         # Forge API bridge with seed extractor & fallback
│   │   ├── prompt_builder.py       # LoRA trigger word auto-injector
│   │   └── queue_manager.py        # FIFO queue with live progress & watchdog
│   ├── storage/                    # Local image cache
│   ├── tests/
│   │   ├── test_edge_cases.py      # Boundary & security tests
│   │   └── test_server.py          # Functional API tests
│   ├── utils/
│   │   ├── callbacks.py            # Async webhook callback with retry
│   │   ├── gpu_monitor.py          # PyTorch CUDA VRAM telemetry
│   │   └── image_utils.py          # WebP compression & base64 handling
│   ├── .env.example                # Configuration template
│   ├── config.py                   # Centralized safety limits & environment variables
│   ├── README.md                   # AI Node technical specifications
│   ├── run.py                      # Standalone entry point
│   ├── server.py                   # FastAPI application router & endpoints
│   └── start_forge_api.bat         # WebUI Forge headless API launcher (:7861)
├── start_ai_server.bat             # Production 1-click launcher (:7860)
├── TROUBLESHOOTING.md              # Incident logs & root cause resolutions
├── MERGE_PLAN.md                   # Multi-node merge sequence to main
├── HANDOFF-ai-node.md              # Master engineering handoff document
└── README.md                       # Project overview & architecture
```
