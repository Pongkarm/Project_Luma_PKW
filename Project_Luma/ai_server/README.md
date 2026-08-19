# 🤖 คนที่ 3: AI Engineer (PC3: 192.168.1.30:7860)

## 📌 บทบาทและความรับผิดชอบ (หน้าที่ของคุณ)
รับผิดชอบการสร้าง **FastAPI AI Server (Port 7860)**, บริหารจัดการโมเดล Stable Diffusion Checkpoints & LoRA Adapters, พัฒนาระบบ In-memory Task Queue เพื่อป้องกัน GPU VRAM Out-of-Memory (OOM), แปลงภาพผลลัพธ์เป็น WebP ความละเอียดสูงแต่ขนาดเล็ก และส่งผลลัพธ์ผ่าน Asynchronous HTTP Callback กลับไปยัง Flask Backend (`192.168.1.20:5000/api/callback`)

---

## 📁 โครงสร้างไฟล์ใน `ai_server/`
```
ai_server/
├── server.py               # จุดรันหลัก FastAPI App + REST Endpoints
├── config.py               # Configuration (VRAM, Max Resolution, Secret Token, Backend URL)
├── requirements.txt        # fastapi, uvicorn, torch, diffusers, pillow, httpx, pydantic
├── models/
│   ├── checkpoints/        # โมเดลหลัก Stable Diffusion (.safetensors)
│   ├── lora/               # ไฟล์ LoRA Styles (Anime, Photorealistic, Cyberpunk)
│   └── vae/                # VAE Models
├── services/
│   ├── queue_manager.py    # ระบบ FIFO Task Queue + Timeout Watchdog (120s)
│   ├── generator.py        # ลอจิกการสร้างภาพ txt2img
│   ├── editor.py           # ลอจิกการแปลงภาพ img2img และ Inpainting ด้วย Mask
│   └── model_manager.py    # โหลด / สลับโมเดล และจัดการ PyTorch GPU Cache
├── utils/
│   ├── image_utils.py      # แปลง Base64 ↔ PIL Image และ Optimize WebP (ลดขนาด ~80%)
│   ├── gpu_monitor.py      # ตรวจสอบ VRAM, GPU Name และสถานะ Memory
│   └── callbacks.py        # Asynchronous Callback ด้วย HTTPX พร้อม Exponential Retry 3 ครั้ง
└── storage/
    └── cached/             # สำรองภาพชั่วคราวกรณี Backend Network หลุด
```

---

## 🧠 คำแนะนำและ Best Practices จากพี่ไอ (Iris)
1. **WebP Optimization**: แปลงผลลัพธ์ภาพทุกภาพเป็น WebP (Quality 92) ช่วยลดขนาด Payload เหลือเพียง 200–400 KB ทำให้ส่ง Base64 ผ่าน JSON บน LAN ได้อย่างรวดเร็วและไม่หน่วง
2. **Robust Callback & Retry**: ยิง Callback กลับ Backend ด้วย `httpx.AsyncClient` พร้อมกลไก Retry 3 ครั้ง (1s, 2s, 4s) และเซฟไฟล์สำรองใน `storage/cached/`
3. **Inpainting VRAM Safeguard**: ล็อคขนาด Inpaint สูงสุดไม่เกิน 768×768 (Native 512×512) พร้อมสั่ง `torch.cuda.empty_cache()` และ `gc.collect()` ทุกครั้งหลังจบ Task
4. **FIFO Task Queue**: จัดคิวงานประมวลผล GPU ทีละ 1 Task อย่างเคร่งครัด ป้องกันการเกิด Race Condition และ VRAM Crash
5. **Internal Security**: ตรวจสอบ Header `X-LUMA-INTERNAL-SECRET` ในทุก Request ที่เข้ามา

---

## 🔌 API Endpoints
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `POST` | `/ai/generate` | รับ Prompt, LoRA, Steps เพื่อสร้างภาพ (txt2img) |
| `POST` | `/ai/edit` | รับ Original Image + Prompt เพื่อแปลงภาพ (img2img) |
| `POST` | `/ai/inpaint` | รับ Original Image + Black/White Mask เพื่อแก้ไขภาพเฉพาะจุด |
| `GET` | `/ai/models` | ส่งรายชื่อ Checkpoint และ LoRA ทั้งหมดที่พร้อมใช้งาน |
| `GET` | `/ai/health` | ส่งข้อมูล GPU Name, VRAM Total, VRAM Used, และ VRAM Free |
