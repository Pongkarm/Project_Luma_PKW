# Prompt สำหรับ Antigravity ของ Kong — Node 3 (AI Server)

> คัดลอกทั้งหมดตั้งแต่เส้นล่างนี้ไปวางใน Antigravity ได้เลย

---

## บริบท

คุณกำลังทำงานกับ branch **`ai-node`** ของ repo `Pongkarm/Project_Luma_PKW` ซึ่งเป็น AI inference
node ของระบบ LUMA — รันบนเครื่อง Windows ที่มี RTX 3070 คุยกับ WebUI Forge ผ่าน
`http://127.0.0.1:7861/sdapi/v1/*`

โครงสร้างระบบเป็น 3 node: Node 1 = frontend, Node 2 = backend FastAPI + PostgreSQL,
Node 3 = ตัวนี้ **เบราว์เซอร์ไม่เคยคุยกับคุณโดยตรง** — backend เป็นคนยิงงานเข้ามาที่
`POST /ai/generate` และ `POST /ai/edit` แล้วคุณยิงผลกลับไปที่ `callback_url` ของเขา

โค้ดฝั่งคุณเขียนได้ระวังกว่าที่คิด — `extract_primary_lora()` รับ `lora_config` ได้ทั้ง list, dict
และ string, `_safe_b64decode` ฝั่ง backend ก็จัดการ Data URL ของคุณได้แล้ว **ปัญหาที่เหลืออยู่
เป็นเรื่องเส้นทางที่ยังไม่ได้ต่อ ไม่ใช่เรื่องความทนทานของ input**

งานเรียงตามผลกระทบ ข้อ 1 หนักสุด

---

## งานที่ 1 — img2img ไม่เคยวิ่งผ่าน GPU เลย

### ปัญหา

`ai_server/server.py` → `handle_inpaint_inference()` (บรรทัด ~184) รับงานทั้ง `img2img` และ
`inpaint` แต่ด่านเข้า Forge เขียนไว้ว่า:

```python
# 1. Try Live Forge Inpainting
if mask_b64 and is_forge_online():
    ...
    inpaint_res = run_inpaint(...)
    if inpaint_res:
        return inpaint_res

# 2. Fallback Inpaint Composite
orig_img = decode_base64_to_image(orig_b64)
...
draw.text((20, h - 40), "✨ LUMA Inpainted Region", fill=(0, 255, 200))
return encode_image_to_base64(orig_img, format="WEBP")
```

**เงื่อนไขคือ `mask_b64 and is_forge_online()`** — แต่งาน img2img ไม่มี mask ตามนิยาม
(`EditRequest.mask_base64` เป็น `Optional` และ backend ส่ง `None` มาเมื่อ `mode == "img2img"`)

ผลคือ **งาน img2img ทุกงานตกลง fallback เสมอ** ต่อให้ GPU ว่างและ Forge ออนไลน์อยู่ก็ตาม
สิ่งที่ผู้ใช้ได้กลับไปคือ **ภาพต้นฉบับของตัวเอง ที่มีข้อความ "✨ LUMA Inpainted Region"
เขียนทับมุมล่าง** และระบบรายงานว่างานสำเร็จ

นี่คือหนึ่งในสามโหมดหลักที่หน้าเว็บโฆษณาไว้ ("สร้างจากภาพ — เริ่มจากภาพที่มี แล้วกำหนดว่าจะให้
เปลี่ยนมากแค่ไหน") ตอนนี้ยังไม่มีอยู่จริง

### สิ่งที่ต้องทำ

1. **แยกเส้นทาง img2img ออกจาก inpaint** ให้ชัด โดยดูจาก `data.get("mode")` ไม่ใช่ดูว่ามี mask ไหม:
   ```python
   mode = (data.get("mode") or "inpaint").lower()
   if is_forge_online():
       if mode == "inpaint" and mask_b64:
           res = run_inpaint(...)
       else:
           res = run_img2img(...)      # ← ต้องเขียนใหม่
       if res:
           return res
   ```
2. **เขียน `run_img2img()` ใหม่ใน `ai_server/services/forge_client.py`** — ยิง
   `/sdapi/v1/img2img` เหมือน `run_inpaint()` แต่ **ไม่ส่ง `mask`** และ **ต้องส่ง
   `denoising_strength`** เพราะนั่นคือค่าที่กำหนดว่า "เปลี่ยนมากแค่ไหน" ซึ่งเป็นหัวใจของโหมดนี้:
   ```python
   payload = {
       "init_images": [image_base64],
       "prompt": safe_prompt,
       "negative_prompt": safe_neg_prompt,
       "steps": min(max(int(steps), 1), 50),
       "cfg_scale": float(cfg_scale),
       "denoising_strength": float(denoising_strength if denoising_strength is not None else 0.75),
       "width": w,
       "height": h,
   }
   ```
   สังเกตว่า `run_inpaint()` ปัจจุบันก็ **ไม่ได้ส่ง `denoising_strength`** เหมือนกัน — ปล่อยให้ Forge
   ใช้ default ควรเพิ่มเข้าไปด้วยเป็นพารามิเตอร์
3. **แก้ข้อความ fallback ให้บอกความจริง** ตอนนี้เขียนว่า "✨ LUMA Inpainted Region" ซึ่งอ่านเหมือน
   งานสำเร็จ ทั้งที่แปลว่า GPU ไม่ได้ทำงาน ควรเปลี่ยนเป็นข้อความที่บอกชัดว่านี่คือ preview เช่น
   `"⚠️ PREVIEW ONLY — Forge GPU offline"` ให้คนที่เห็นภาพรู้ทันทีว่าเกิดอะไรขึ้น
4. **พิจารณาว่า fallback ควรมีอยู่ไหม** — สำหรับ dev เครื่องที่ไม่มี GPU มันมีประโยชน์ แต่บนเครื่องจริง
   การส่งภาพปลอมกลับไปเป็น `status: "completed"` ทำให้แยกไม่ออกว่างานสำเร็จจริงหรือไม่
   แนะนำให้มี env flag เช่น `ALLOW_FALLBACK_RENDER=false` บนเครื่องจริง แล้วยิง callback เป็น
   `status: "failed"` พร้อม `error_message` ที่บอกว่า Forge offline แทน

### ตรวจว่าเสร็จ

ยิงงาน img2img (มี `image_base64` ไม่มี `mask_base64`) ตอน Forge ออนไลน์ → ต้องเห็น log
`[FORGE IMG2IMG] Calling .../sdapi/v1/img2img on GPU...` และภาพที่ได้ต้องเปลี่ยนไปจากต้นฉบับจริง
ไม่ใช่ต้นฉบับที่มีข้อความเขียนทับ

---

## งานที่ 2 — `EditRequest` แคบเกินไป จนของที่ backend กำลังจะส่งมาตกหล่น

### ปัญหา

`ai_server/server.py` บรรทัด ~86:

```python
class EditRequest(BaseModel):
    task_id: str
    prompt: str = Field(..., min_length=1, max_length=500)
    image_base64: str
    mask_base64: Optional[str] = None
    mode: Optional[str] = "img2img"
    steps: Optional[int] = Field(25, ge=1, le=50)
    cfg_scale: Optional[float] = Field(7.5, ge=1.0, le=20.0)
    callback_url: Optional[str] = ...
    correlation_id: Optional[str] = ...
```

เทียบกับ `GenerateRequest` ที่รับได้ครบทั้ง `negative_prompt`, `model`, `lora`, `lora_config`,
`sampler_name`, `seed`, `width`, `height`, `denoising_strength` — `EditRequest` **ขาดไปทั้งหมด**

ฝั่ง backend กำลังจะแก้ให้ส่งฟิลด์พวกนี้มา (Pongkarm ได้ prompt คู่กันไปแล้ว) ตอนนี้เขายังไม่ส่ง
แต่เมื่อเขาแก้เสร็จ **pydantic จะตัดฟิลด์ที่ไม่รู้จักทิ้งเงียบ ๆ** งานฝั่งเขาจะดูเหมือนเสร็จแต่ไม่มีผลอะไร

### สิ่งที่ต้องทำ

เพิ่มฟิลด์เหล่านี้เข้า `EditRequest` ให้ตรงกับ `GenerateRequest`:

```python
negative_prompt: Optional[str] = Field("blurry, low quality, distorted, bad anatomy", max_length=500)
model: Optional[str] = None
model_name: Optional[str] = "counterfeitV30_v30.safetensors"
lora: Optional[str] = None
lora_config: Optional[Any] = None
sampler_name: Optional[str] = "DPM++ 2M Karras"
seed: Optional[int] = None
width: Optional[int] = None
height: Optional[int] = None
denoising_strength: Optional[float] = 0.75
```

แล้ว **ทำให้ `handle_inpaint_inference()` ใช้มันจริง** — ตอนนี้ฟังก์ชันนั้นอ่านแค่
`prompt`, `image_base64`, `mask_base64`, `steps`, `cfg_scale` เท่านั้น ต้องเพิ่ม:

- เรียก `extract_primary_lora(data)` และ `build_prompt_with_lora()` เหมือนที่ `handle_txt2img_inference()`
  ทำอยู่ — ตอนนี้ **โหมดแก้ภาพไม่รองรับ LoRA เลย** ทั้งที่ txt2img รองรับ
- เรียก `set_forge_model(model_name)` ก่อนยิง — ตอนนี้โหมดแก้ภาพรันบน checkpoint อะไรก็ตาม
  ที่ค้างอยู่ใน Forge จากงานก่อนหน้า ซึ่งทำให้ผลลัพธ์ไม่คงเส้นคงวาโดยไม่มีใครรู้สาเหตุ
- ส่ง `negative_prompt` ต่อเข้า `run_inpaint()` / `run_img2img()`

---

## งานที่ 3 — `seed` และ `sampler_name` รับเข้ามาแล้วทิ้ง

### ปัญหา

`GenerateRequest` ประกาศรับ `seed` และ `sampler_name` ไว้เรียบร้อย (บรรทัด ~71, 77)
แต่ `handle_txt2img_inference()` (บรรทัด ~141) เรียก `run_txt2img()` แบบนี้:

```python
forge_res = run_txt2img(
    prompt=enriched_prompt,
    negative_prompt=...,
    steps=data.get("steps", 25),
    cfg_scale=data.get("cfg_scale", 7.5),
    width=data.get("width", 512),
    height=data.get("height", 512),
    checkpoint=model_name
)
```

**ไม่มี `sampler_name` และไม่มี `seed`** ทั้งที่ `run_txt2img()` มีพารามิเตอร์ `sampler_name` รออยู่แล้ว
(ค่า default `"DPM++ 2M Karras"` จึงถูกใช้เสมอ ไม่ว่าผู้ใช้เลือกอะไร)

ส่วน `seed` หนักกว่านั้น — `run_txt2img()` **ไม่มีพารามิเตอร์นี้เลย** และ payload ที่ส่งเข้า Forge
ก็ไม่มีคีย์ `"seed"` แปลว่าทุกงานสุ่มใหม่หมด **ผู้ใช้กด "สร้างซ้ำด้วย seed เดิม" แล้วไม่มีทางได้ภาพเดิม**

### สิ่งที่ต้องทำ

1. เพิ่ม `seed: Optional[int] = None` เข้า `run_txt2img()` แล้วใส่ลง payload:
   ```python
   "seed": int(seed) if seed is not None else -1,   # Forge ใช้ -1 = สุ่ม
   ```
2. ส่ง `sampler_name=data.get("sampler_name")` และ `seed=data.get("seed")` จาก
   `handle_txt2img_inference()` เข้าไป
3. ทำแบบเดียวกันกับเส้นทาง img2img / inpaint หลังงานที่ 1–2 เสร็จ
4. **พิจารณาส่ง seed จริงกลับไปใน callback** — ตอนนี้ `send_callback_with_retry()` ส่งกลับแค่
   `task_id`, `status`, `image_base64`, `error`, `generation_time` ถ้าผู้ใช้ส่ง seed มาเป็น `-1` (สุ่ม)
   เขาไม่มีทางรู้เลยว่าได้ seed อะไรไป จึงทำซ้ำภาพที่ชอบไม่ได้ Forge คืน seed จริงมาใน
   `response.json()["info"]` (เป็น JSON string ต้อง parse ซ้ำอีกชั้น) — ถ้าจะเพิ่ม ต้องคุยกับ
   Pongkarm ให้เพิ่มฟิลด์รับใน `AICallbackPayload` ด้วย

---

## งานที่ 4 — ช่วงค่าที่รับ ไม่ตรงกับ backend

### ปัญหา

| ฟิลด์ | Node 3 รับ (`server.py:63-84`) | backend รับ (`app/schemas/generation.py`) |
|---|---|---|
| `prompt` | **≤ 500 ตัวอักษร** | ≤ 2000 |
| `negative_prompt` | **≤ 500** | ≤ 2000 |
| `steps` | **1–50** | 1–150 |
| `cfg_scale` | **1.0–20.0** | 0.0–30.0 |
| `width` / `height` | **256–768** | 64–2048 |

backend รับงานไว้ก่อน ตอบ `202 Accepted` ให้ผู้ใช้ แล้วค่อยไปโดน **422** ตอนส่งต่อมาหาคุณ
ผู้ใช้จะเห็นแค่ว่างาน `failed` โดยไม่มีคำอธิบายที่เข้าใจได้

### สิ่งที่ต้องทำ

ต้องตกลงกับ Pongkarm ว่าจะขยับฝั่งไหน — **เขาได้ prompt ให้พิจารณารัดฝั่ง backend ให้แคบลงตามคุณแล้ว**
เพราะปฏิเสธตั้งแต่ตอนรับดีกว่าตายกลางทาง

สิ่งที่ต้องตอบเขากลับไปคือ **ข้อจำกัดไหนมาจาก VRAM จริง ๆ และขยายไม่ได้**:

- `width`/`height` ≤ 768 — น่าจะเป็นข้อจำกัดจริงของ RTX 3070 (8GB) ยืนยันหน่อยว่าใช่ไหม
  และถ้าใช่ `AIConfig.MAX_IMAGE_WIDTH` ตั้งไว้เท่าไหร่
- `steps` ≤ 50 — เป็นเรื่องเวลาต่องาน ไม่ใช่ VRAM ถ้าคิวไม่ยาวอาจขยายได้
- `prompt` ≤ 500 — **อันนี้น่าจะแคบเกินจำเป็น** prompt งานจริงยาวเกิน 500 ได้ง่ายมาก
  โดยเฉพาะเมื่อ `build_prompt_with_lora()` เติม trigger word เข้าไปอีก ควรขยายเป็น 2000 ให้ตรง backend
- `cfg_scale` ≥ 1.0 — Forge รับ 0 ไม่ได้อยู่แล้ว อันนี้เก็บไว้ถูกต้องแล้ว

ไม่ว่าจะสรุปยังไง **ตัวเลขต้องมาจากที่เดียว** ควรอยู่ใน `ai_server/config.py` แล้วให้ schema
อ่านไปใช้ ไม่ใช่ hardcode ใน `Field(...)` แล้วรอวันที่มันเลื่อนไม่ตรงกับ backend อีกรอบ

---

## งานที่ 5 — เอกสารสัญญาที่ปัจจุบัน "บังเอิญถูก"

ไม่ใช่ bug แต่เป็นของที่พังง่ายถ้าไม่มีใครจดไว้

### 5.1 รูปภาพส่งกลับเป็น Data URL

`ai_server/utils/image_utils.py` → `encode_image_to_base64()` คืนค่าเป็น:
```python
return f"data:image/{format.lower()};base64,{encoded}"
```

**ไม่ใช่ base64 เปล่า** ฝั่ง backend มี `_safe_b64decode()` ที่ตัด prefix ให้แล้ว (commit `b77126d`)
จึงทำงานได้ **แต่มันเป็นเรื่องที่ไม่มีใครเขียนไว้ที่ไหนเลย**

ถ้าฝั่ง backend เผลอ merge ทับด้วยเวอร์ชันเก่า มันจะกลับไป `base64.b64decode()` ตรง ๆ ซึ่ง
**ไม่ throw error** แต่จะทิ้งอักขระ `:` `;` `,` แล้วเลื่อน byte ทั้งสตรีม → ไฟล์ภาพเสียที่เปิดไม่ได้
โดย DB บันทึกว่า `completed` เรียบร้อย

**ต้องทำ:** เขียนสัญญานี้ลงใน `ai_server/README.md` ให้ชัดว่า `image_base64` ในทุก callback
เป็น Data URL รูปแบบ `data:image/webp;base64,...` และปลายทางต้องตัด prefix ก่อน decode
(ทางเลือกที่สะอาดกว่า: ส่ง base64 เปล่าแล้วเพิ่มฟิลด์ `image_format: "webp"` แยก — แต่ต้องแก้พร้อมกัน
ทั้งสองฝั่ง อย่าแก้ฝ่ายเดียว)

### 5.2 `/ai/models` — ห้ามเปลี่ยนรูปร่าง response

backend มี `app/api/models.py` ที่ proxy endpoint นี้ต่อให้ frontend และมันอ่าน
`data["checkpoints"]` กับ `data["loras"]` ตรง ๆ

รูปร่างที่คุณคืนอยู่ตอนนี้ **ตรงกับที่เขาคาดพอดี**:
```json
{"checkpoints": [{"id": "...", "name": "...", "path": "..."}], "loras": [...],
 "total_checkpoints": 0, "total_loras": 0}
```
เปลี่ยนชื่อคีย์เมื่อไหร่ ตัวเลือกโมเดลบนหน้าเว็บจะกลายเป็นว่างเปล่าทันที (frontend จะ fallback
ไป list ที่ hardcode ไว้ โดยไม่มี error ให้เห็น) — ถ้าจะเปลี่ยนต้องบอกทั้งสองฝั่งก่อน

---

## ห้ามแตะ

- **`app/`, `main.py`, `.env.example` ที่ root** — เป็นของ backend (Pongkarm) อยู่คนละ branch
- **`frontend/`** — เป็นของ Node 1 อยู่ branch `frontend-app`
- **ชื่อ endpoint และ header `X-LUMA-INTERNAL-SECRET`** — backend พึ่งพาอยู่ ห้ามเปลี่ยนโดยไม่บอก

## เสร็จแล้วรายงานว่า

1. img2img วิ่งผ่าน GPU จริงแล้วหรือยัง (แนบ log `[FORGE IMG2IMG]` และภาพก่อน/หลัง)
2. `EditRequest` รับฟิลด์ครบตาม `GenerateRequest` แล้วหรือยัง และ `handle_inpaint_inference()`
   ใช้ LoRA + checkpoint แล้วหรือยัง
3. `seed` ทำให้ได้ภาพเดิมซ้ำได้จริงไหม (ยิงงานเดียวกัน 2 ครั้งด้วย seed เดิม แล้วเทียบ)
4. ข้อจำกัดตัวไหนมาจาก VRAM จริง ๆ — ตอบกลับ Pongkarm เพื่อให้เขารัดฝั่ง backend ได้ถูก
5. สัญญา Data URL ถูกจดไว้ใน README แล้วหรือยัง
