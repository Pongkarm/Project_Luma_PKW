# 🤖 คนที่ 3: AI Engineer (Node 3 — PC3: 192.168.1.30:7860)

## 📌 บทบาทและความรับผิดชอบ
รับผิดชอบการสร้าง **FastAPI AI Server (Port 7860)** ที่รันบนเครื่อง Windows (NVIDIA GeForce RTX 3070 8GB), บริหารจัดการโมเดล Stable Diffusion Checkpoints & LoRA Adapters ร่วมกับ WebUI Forge API (`http://127.0.0.1:7861`), จัดคิวงานด้วย In-memory FIFO Task Queue พร้อม Watchdog 120s, แปลงภาพผลลัพธ์เป็น WebP (Quality 92), และส่งผลลัพธ์ผ่าน Asynchronous HTTP Callback กลับไปยัง Backend (`/api/callback`).

---

## 📜 สัญญาข้อมูลระหว่างโหนด (Data Contracts & Guarantees)

### 1. รูปแบบภาพที่ส่งกลับใน Callback (`image_base64`)
* **Format**: Data URL มาตรฐาน **`data:image/webp;base64,<encoded_data>`** (ไม่ใช่ Raw Base64 เปล่า)
* **Quality & Size**: WebP Quality 92 ขนาดเฉลี่ย ~70–90 KB (ลดขนาดลง ~85% เมื่อเทียบกับ PNG)
* **การ Decode ฝั่ง Backend**: ฝั่ง Backend ต้องใช้ตัวตัด Prefix เช่น `_safe_b64decode()` เพื่อตัด `data:image/webp;base64,` ออกก่อนทำการ Decode ไบนารี

### 2. รูปแบบ Response ของ `/ai/models` (ห้ามเปลี่ยน Key)
Backend Proxy (`/api/models`) และ Frontend พึ่งพาโครงสร้าง JSON ด้านล่างนี้โดยตรง:
```json
{
  "checkpoints": [
    {
      "id": "novaAnimeXL_ilV190.safetensors",
      "name": "novaAnimeXL_ilV190",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/StableDiffusion/sd/novaAnimeXL_ilV190.safetensors"
    }
  ],
  "loras": [
    {
      "id": "SousouNoFrieren_Frieren_IlluXL.safetensors",
      "name": "SousouNoFrieren_Frieren_IlluXL",
      "path": "D:/StabilityMatrix-win-x64/Data/Models/Lora/SousouNoFrieren_Frieren_IlluXL.safetensors"
    }
  ],
  "total_checkpoints": 1,
  "total_loras": 1
}
```

---

## ⚙️ ขอบเขตค่าพารามิเตอร์ (Single Source of Truth ใน `config.py`)

| พารามิเตอร์ | ขอบเขตที่รับ | Default | เหตุผลทางวิศวกรรม / Hardware Bound |
|---|---|---|---|
| `prompt` | 1–2000 ตัวอักษร | - | รองรับการพิมพ์ Prompt ยาวและการฉีด LoRA Trigger Words |
| `negative_prompt` | ≤ 2000 ตัวอักษร | `"blurry, low quality..."` | ป้องกัน Forge Error จาก `null`/`None` |
| `steps` | 1–50 steps | 25 | ป้องกันงานค้างในคิวนานเกินไป (Time-budget Safeguard) |
| `cfg_scale` | 1.0–20.0 | 7.5 | สอดคล้องกับคณิตศาสตร์ Diffusion (CFG < 1.0 ไม่เสถียร) |
| `width` / `height` | 256–768 px | 512 | **ขีดจำกัดจริงของ VRAM 8GB** บน RTX 3070 ป้องกัน OOM Crash |
| `seed` | ≥ 0 (หรือ -1 สุ่ม) | -1 | รองรับการสร้างภาพเดิมซ้ำ (Reproducibility) |
| `denoising_strength`| 0.05–1.0 | 0.75 | กำหนดระดับการเปลี่ยนแปลงในโหมด `img2img` และ `inpaint` |

---

## 🔌 API Endpoints

### 1. `POST /ai/generate` (txt2img)
สร้างภาพจากข้อความ พร้อมระบบ LoRA Auto-Trigger Injection อัตโนมัติ:
```json
{
  "task_id": "uuid-here",
  "prompt": "1girl, frieren casting spell",
  "negative_prompt": "blurry, low quality",
  "model_name": "counterfeitV30_v30.safetensors",
  "lora_config": {"id": "SousouNoFrieren_Frieren_IlluXL.safetensors", "weight": 0.85},
  "sampler_name": "Euler a",
  "seed": 42,
  "steps": 25,
  "cfg_scale": 7.5,
  "width": 512,
  "height": 512,
  "callback_url": "http://192.168.1.20:8000/api/callback"
}
```

### 2. `POST /ai/edit` (img2img / inpaint)
รองรับทั้งการแปลงภาพต้นฉบับ (`mode: "img2img"`) และการระบายสีแก้ไขเฉพาะจุด (`mode: "inpaint"` ร่วมกับ `mask_base64`):
```json
{
  "task_id": "uuid-here",
  "prompt": "change background to snowy mountain",
  "image_base64": "<base64>",
  "mask_base64": "<base64_or_null>",
  "mode": "img2img",
  "model_name": "counterfeitV30_v30.safetensors",
  "denoising_strength": 0.65,
  "seed": 123456,
  "steps": 25,
  "callback_url": "http://192.168.1.20:8000/api/callback"
}
```

### 3. `DELETE /ai/task/{task_id}`
ยกเลิกงานที่กำลังรอใน FIFO Queue (Soft Cancel) หรือสั่ง Interrupt บน GPU Forge โดยตรง (Hard Cancel)

### 4. `GET /ai/health`
ส่งข้อมูลสถานะการ์ดจอ VRAM Allocated/Free และขนาดคิวงานแบบ Real-time

### 5. `GET /ai/models`
ส่งรายการโมเดล Checkpoints และ LoRA ที่สแกนได้จากเครื่อง Node 3

---

## 🛡️ Graceful Fallback Mode
* หาก WebUI Forge API (:7861) ปิดอยู่ และเปิด `ALLOW_FALLBACK_RENDER=true` ใน `.env`:
  ระบบจะสร้างภาพจำลองพร้อมข้อความเตือนชัดเจน **`⚠️ PREVIEW ONLY — Forge GPU offline`** เพื่อให้การทดสอบระบบเครือข่ายและ Frontend วิ่งได้ครบวงจรโดยไม่ติด Error 500
* หากปิด `ALLOW_FALLBACK_RENDER=false` (โหมด Production บนเครื่องจริง): ระบบจะปฏิเสธงานและรายงานสถานะ `failed` อย่างตรงไปตรงมา
