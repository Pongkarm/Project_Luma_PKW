# 🤖 Node 3: AI Inference Server (PC3 — 192.168.1.30:7860)

## 📌 ภาพรวมและหน้าที่ของระบบ (Overview)
**Node 3** ทำหน้าที่เป็นเซิร์ฟเวอร์ประมวลผล Generative AI สำหรับโปรเจกต์ LUMA โดยรันด้วย **FastAPI** บนระบบปฏิบัติการ Windows ทำงานร่วมกับฮาร์ดแวร์การ์ดจอ **NVIDIA GeForce RTX 3070 (8GB VRAM)** และเชื่อมต่อกับ **Stable Diffusion WebUI Forge API** (`http://127.0.0.1:7861`) 

### หน้าที่หลัก:
1. **คิวงาน In-Memory FIFO**: จัดการคิวงานสร้างภาพแบบเรียงลำดับ ป้องกันไม่ให้ GPU รับภาระเกินกำลัง (Concurrency = 1)
2. **Watchdog Timer (120s)**: เฝ้าระวังไม่ให้งานค้าง หาก GPU ประมวลผลเกินเวลาจะสั่งยกเลิกและคืนสถานะทันที
3. **Model & LoRA Compatibility Guard**: ตรวจสอบตระกูลโมเดล และตัดคำสั่ง LoRA ที่ไม่เข้ากันออกอัตโนมัติ (**Auto-skip**) ป้องกันภาพผิดเพี้ยน
4. **WebP Compression**: บีบอัดภาพผลลัพธ์เป็นไฟล์ WebP (Quality 92) ลดขนาดลง ~85% เมื่อเทียบกับ PNG เพื่อการส่งข้อมูลข้ามเครือข่ายที่รวดเร็ว
5. **Asynchronous HTTP Webhook Callback**: ยิงส่งภาพผลลัพธ์กลับไปยัง Backend Core (`/api/callback`) เมื่อประมวลผลเสร็จสิ้น

---

## 📜 สัญญาข้อมูลระหว่างโหนด (Data Contracts & Guarantees)

### 1. รูปแบบภาพใน Webhook Callback (`image_base64`)
* **Format**: Data URL มาตรฐาน **`data:image/webp;base64,<encoded_data>`**
* **Quality & Size**: WebP คุณภาพ 92 ขนาดเฉลี่ย ~70–90 KB (จากไฟล์ PNG เดิม ~1.2 MB)
* **ความปลอดภัย**: ส่งพร้อม Header `X-LUMA-INTERNAL-SECRET` เพื่อยืนยันความถูกต้องระหว่าง Node

### 2. รูปแบบ Response ของ `GET /ai/models` (พร้อมฟิลด์ `family`)
Backend Proxy และ Frontend ดึงข้อมูลจาก Endpoint นี้เพื่อทราบรายการโมเดลและตระกูลสถาปัตยกรรม:
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

## 🧠 Model-LoRA Compatibility & Auto-Skip Guard

LoRA Adapter แต่ละตัวถูกสร้างขึ้นสำหรับ Base Architecture ที่จำเพาะเจาะจง หากนำไปฉีดข้ามสถาปัตยกรรม (เช่น นำ Frieren LoRA ของ Illustrious XL ไปใช้กับ Checkpoint SD 1.5) เวกเตอร์น้ำหนักจะขัดแย้งกัน ส่งผลให้ภาพเบลอ เสียรูปทรง หรือเกิด Artifacts

### วิธีการทำงานของระบบป้องกัน:
1. `detect_model_family(model_name)`: วิเคราะห์ชื่อไฟล์ Checkpoint เพื่อระบุตระกูล (`sd15`, `illustrious_xl`, `pony_xl`)
2. `is_lora_compatible(lora_id, model_name)`: ตรวจสอบความสอดคล้องกับฐานข้อมูลใน `lora_registry.json`
3. **Auto-skip Action**: หากโมเดลและ LoRA ข้ามตระกูลกัน:
   * ระบบจะไม่โยน Exception 500 แต่จะบันทึกข้อความเตือน `[WARN] Compatibility Guard: LoRA ... is incompatible with model ...`
   * ตัดการฉีดแท็ก `<lora:...>` และ Trigger Words ออกจาก Prompt โดยอัตโนมัติ
   * ปล่อยให้งานสร้างภาพทำงานต่อไปได้อย่างปลอดภัย (Zero Breaking Change)

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

## 🔌 API Endpoints สรุป

* `POST /ai/generate`: รับงาน Text-to-Image เข้าสู่ FIFO Queue (ตอบกลับ 202 Accepted ทันที)
* `POST /ai/edit`: รับงาน Image-to-Image / Canvas Inpainting
* `GET /ai/task/{task_id}`: ตรวจสอบสถานะงานและตำแหน่งคิวแบบ Real-time
* `DELETE /ai/task/{task_id}`: สั่งยกเลิกงาน (รองรับทั้งการปลดออกจากคิว และการส่งสัญญาณ Interrupt ไปยัง GPU Forge)
* `GET /ai/health`: รายงานสถานะการ์ดจอ VRAM Usage (Total / Allocated / Free)
* `GET /ai/models`: รายการ Checkpoints และ LoRAs พร้อมตระกูล `family`

---

## 🛡️ High-Fidelity Fallback Mode (ระบบสำรองเมื่อไม่มี GPU)
* หากเปิด `ALLOW_FALLBACK_RENDER=true` ใน `.env`:
  * เมื่อ WebUI Forge ปิดอยู่ หรือรันบนเครื่องทั่วไปที่ไม่มีการ์ดจอ NVIDIA
  * ระบบจะวาดภาพ Canvas Preview พร้อมข้อมูลจำลองและลายน้ำ **`⚠️ PREVIEW ONLY — Forge GPU offline`**
  * ช่วยให้สามารถรัน Automated Integration Tests และเชื่อมต่อกับ Frontend/Backend ได้ 100% โดยไม่เกิดข้อผิดพลาด 500
