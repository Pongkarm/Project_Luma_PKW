# 🤖 Node 4: AI Inference Engine (PC3 — 10.23.130.112:7860)

## 📌 ภาพรวมและหน้าที่ของระบบ (Overview)

**Node 4** ทำหน้าที่เป็นเซิร์ฟเวอร์ประมวลผล Generative AI สำหรับโปรเจกต์ LUMA ภายใต้สถาปัตยกรรมกระจายศูนย์ 4 โหนด (4-Node Distributed Architecture) รันด้วย **FastAPI** บน Windows ทำงานร่วมกับฮาร์ดแวร์การ์ดจอ **NVIDIA GeForce RTX 3070 Laptop (8GB VRAM)** และเชื่อมต่อกับ **Stable Diffusion WebUI Forge Headless API** (`http://127.0.0.1:7861`) ผ่าน Local Loopback

### หน้าที่หลักของ Node 4 (AI Deliverables):
1. **คิวงาน In-Memory FIFO (Concurrency = 1)**: จัดการคิวงานสร้างภาพแบบเรียงลำดับ ป้องกันไม่ให้ GPU รับภาระเกินกำลัง และขจัดปัญหา GPU Out-of-Memory (OOM) 100%
2. **Watchdog Timer (120s)**: เฝ้าระวังไม่ให้งานค้าง หาก GPU ประมวลผลเกินเวลาจะสั่งยกเลิกและคืนสถานะทันที
3. **Model & LoRA Compatibility Guard**: ตรวจสอบตระกูลสถาปัตยกรรมโมเดล (`sd15`, `illustrious_xl`, `pony_xl`) และตัดคำสั่ง LoRA ที่ไม่เข้ากันออกอัตโนมัติ (**Auto-skip**) ป้องกันภาพผิดเพี้ยนและโมเดลแครช
4. **VAE Latent Alignment Math ($f=8$)**: บังคับขนาดภาพพิกเซลให้หาร 8 ลงตัวเสมอด้วยสูตร `(w // 8) * 8` พร้อมรีไซซ์ด้วย **Lanczos Resampling** ป้องกัน VAE Decoder ทำงานล้มเหลว
5. **High-Efficiency WebP Compression**: บีบอัดภาพผลลัพธ์เป็นฟอร์แมต WebP (Quality 92, Method 6) ลดขนาดไฟล์ลง ~70–80% เมื่อเทียบกับ PNG ส่งข้อมูลข้ามเครือข่าย LAN ได้อย่างรวดเร็ว
6. **Asynchronous HTTP Webhook Callback**: ยิงส่งผลลัพธ์พร้อม Base64 WebP และ Seed กลับไปยัง Backend Core (`http://10.23.130.9:8000/api/callback`)
7. **Disaster Recovery Local Cache**: บันทึกภาพผลลัพธ์สำรองลงในเครื่องโลคอล (`cache/{task_id}.webp.b64`) เผื่อกรณีสาย LAN สะดุดหรือ Backend รีสตาร์ท
8. **VRAM Zero-Leak Cleanup**: คืนหน่วยความจำ VRAM ให้ไดรเวอร์ CUDA ทันทีหลังจบทุกคำสั่ง ด้วย `gc.collect()`, `torch.cuda.empty_cache()` และ `torch.cuda.ipc_collect()`

---

## 🌐 โทโพโลยีการเชื่อมต่อเครือข่าย (Network Topology)

* **Node 1 (DevOps Gateway):** `http://10.23.130.212:80` (เส้นทางรับ Traffic จากภายนอก)
* **Node 2 (Frontend Client):** `http://10.23.130.6:5500` (หน้าจอสั่งงานผู้ใช้)
* **Node 3 (Backend Core):** `http://10.23.130.9:8000` (จุดรับ Webhook Callback)
* **Node 4 (AI Node — เครื่องนี้):** `http://10.23.130.112:7860` (FastAPI AI Engine)
* **Forge Headless Engine:** `http://127.0.0.1:7861` (รันคำสั่ง `--nowebui --api`)

---

## 📜 สัญญาข้อมูลระหว่างโหนด (Data Contracts & Guarantees)

### 1. รูปแบบ Payload ใน Webhook Callback ไปยัง Backend
เมื่อประมวลผลเสร็จสิ้น AI Node จะยิง HTTP POST ไปยัง `http://10.23.130.9:8000/api/callback`:
* **Header**: `X-LUMA-INTERNAL-SECRET: <AI_CALLBACK_SECRET>`
* **Payload JSON**:
```json
{
  "task_id": "b267e348-d030-4b55-b95f-0560f38d60d9",
  "status": "completed",
  "image_base64": "data:image/webp;base64,UklGRm...",
  "error": null,
  "generation_time": 3.65,
  "seed": 1827491024
}
```

### 2. รูปแบบ Response ของ `GET /ai/models` (พร้อมฟิลด์ `family`)
Backend Proxy และ Frontend ดึงข้อมูลจาก Endpoint นี้เพื่อนำไปกรอง LoRA Dropdown:
```json
{
  "checkpoints": [
    {
      "id": "counterfeitV30_v30.safetensors",
      "name": "counterfeitV30_v30",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/StableDiffusion/counterfeitV30_v30.safetensors",
      "family": "sd15"
    },
    {
      "id": "novaAnimeXL_ilV190.safetensors",
      "name": "novaAnimeXL_ilV190",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/StableDiffusion/novaAnimeXL_ilV190.safetensors",
      "family": "illustrious_xl"
    },
    {
      "id": "prefectPonyXL_v6.safetensors",
      "name": "prefectPonyXL_v6",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/StableDiffusion/prefectPonyXL_v6.safetensors",
      "family": "pony_xl"
    }
  ],
  "loras": [
    {
      "id": "SousouNoFrieren_Frieren_IlluXL.safetensors",
      "name": "SousouNoFrieren_Frieren_IlluXL",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/Lora/SousouNoFrieren_Frieren_IlluXL.safetensors",
      "family": "illustrious_xl"
    },
    {
      "id": "tachi-e.safetensors",
      "name": "tachi-e",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/Lora/tachi-e.safetensors",
      "family": "sd15"
    },
    {
      "id": "[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors",
      "name": "[Artstyle] SomethingWeird_Geekpower [PDXL]",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/Lora/[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors",
      "family": "pony_xl"
    }
  ],
  "total_checkpoints": 3,
  "total_loras": 6
}
```

---

## ⚙️ ขอบเขตค่าพารามิเตอร์ (Safety Bounds ใน `config.py`)

| พารามิเตอร์ | ขอบเขตที่รับได้ | ค่าเริ่มต้น | เหตุผลทางวิศวกรรม / Hardware Bound |
|---|---|---|---|
| `prompt` | 1–2,000 ตัวอักษร | - | รองรับ Prompt ขนาดยาวและการฉีด Trigger Words อัตโนมัติ |
| `negative_prompt` | ≤ 2,000 ตัวอักษร | `"blurry, low quality..."` | ป้องกัน Forge WebUI Error จากค่า `null` หรือค่าว่าง |
| `steps` | 1–50 steps | 25 | จำกัดเวลาประมวลผลต่อคิว ป้องกันคิวงานค้างนานเกินไป |
| `cfg_scale` | 1.0–20.0 | 7.5 | สอดคล้องกับคณิตศาสตร์ Diffusion (CFG ต่ำเกินไปภาพจะไม่ตรง Prompt) |
| `width` / `height` | 256–768 px | 512 | **ขีดจำกัดจริงของ VRAM 8GB บน RTX 3070** ป้องกัน CUDA Out-of-Memory (OOM) |
| `seed` | ≥ 0 (หรือ -1 สุ่ม) | -1 | รองรับการวาดภาพซ้ำด้วยค่าตั้งต้นเดิม (Reproducibility) |
| `denoising_strength`| 0.05–1.0 | 0.65 | ควบคุมระดับการเปลี่ยนแปลงสำหรับโหมด `img2img` และ `inpaint` |

---

## 🔌 สรุป API Endpoints ของ Node 4

* `POST /ai/generate`: รับงาน Text-to-Image เข้าสู่ FIFO Queue (ตอบกลับ `HTTP 202 Accepted` ทันที)
* `POST /ai/edit`: รับงาน Image-to-Image / Canvas Inpainting
* `GET /ai/task/{task_id}`: ตรวจสอบสถานะงานและตำแหน่งคิวแบบ Real-time
* `DELETE /ai/task/{task_id}`: สั่งยกเลิกงาน (รองรับทั้ง Soft Cancel ปลดออกจากคิว และ Hard Cancel ส่งสัญญาณ Interrupt ไปยัง GPU)
* `GET /ai/health`: รายงานสถานะการ์ดจอ VRAM Usage (Total / Allocated / Free) และจำนวนงานในคิว
* `GET /ai/models`: รายการ Checkpoints และ LoRAs พร้อมจำแนกตระกูล `family`

---

## 🚀 วิธีเปิดใช้งาน (Quick Start)

### วิธีที่ 1: รันด้วย 1-Click Batch Script (แนะนำสำหรับการนำเสนอ)
ดับเบิลคลิกไฟล์:
```text
start_ai_server.bat
```

### วิธีที่ 2: รันผ่านคำสั่ง Python Module
```powershell
python -m ai_server.run
```
*(ระบบจะบูต Uvicorn ASGI Server ที่ `0.0.0.0:7860` พร้อมระบบ Hot-Reload อัตโนมัติ)*

---

## 🧪 การรันชุดทดสอบ (Automated Unit Tests)

รันชุดทดสอบความถูกต้องของ AI Node ด้วย pytest (ผ่าน 17/17 รายการสมบูรณ์):
```powershell
pytest ai_server/tests/test_server.py ai_server/tests/test_edge_cases.py
```
