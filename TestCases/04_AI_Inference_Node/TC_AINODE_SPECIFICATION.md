# 📋 Test Case Specification: AI Inference Node (Node 4)

> **สายงาน:** Artificial Intelligence & GPU Inference Engine  
> **ผู้รับผิดชอบหลัก:** [@Kong19565](https://github.com/Kong19565)  
> **อุปกรณ์เป้าหมาย (Node 4):** Windows AI Server (`10.23.130.112:7860`)  
> **ฮาร์ดแวร์ประมวลผล:** NVIDIA GeForce RTX 3070 Laptop GPU (8GB GDDR6 VRAM)  
> **เทคโนโลยีหลัก:** Python 3.10+, FastAPI, Stable Diffusion WebUI Forge (:7861), PyTorch CUDA, Pillow, LoRA Compatibility Guard, FIFO Queue  
> **เป้าหมาย:** ตรวจสอบการเชื่อมต่อ Forge API, ระบบป้องกันโมเดลข้ามตระกูล (Auto-skip), ขอบเขตความปลอดภัยของพารามิเตอร์ (Safety Bounds for 8GB VRAM), ระบบเฝ้าระวังหน่วยความจำ (VRAM Watchdog), และการทำงานของระบบสำรอง (Fallback Safeguard)

---

## 📊 สรุปผลการทดสอบ (Executive Test Summary)

| กลุ่มการทดสอบ (Test Category) | จำนวนเคส | ผ่าน (PASS) | ล้มเหลว (FAIL) | อัตราความสำเร็จ |
| :--- | :---: | :---: | :---: | :---: |
| 1. AI Service Health & GPU Telemetry | 3 | 3 | 0 | 100% |
| 2. Model & LoRA Compatibility Auto-Skip Guard | 4 | 4 | 0 | 100% |
| 3. Safety Bounds & Limits (8GB VRAM Protection) | 7 | 7 | 0 | 100% |
| 4. FIFO Queue Engine & Task Dispatching | 3 | 3 | 0 | 100% |
| 5. High-Fidelity Fallback Rendering & Resilience | 3 | 3 | 0 | 100% |
| 6. Webhook Callback Dispatcher & Compression | 2 | 2 | 0 | 100% |
| **รวมทั้งหมด** | **22** | **22** | **0** | **100% 🏆** |

---

## 📝 รายละเอียดตาราง Test Cases (Detailed Test Specifications)

### หมวดที่ 1: สถานะเซิร์ฟเวอร์และการตรวจวัด GPU (Service Health & Telemetry)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-001** | ตรวจสอบสถานะการทำงานของ AI Server | เรียก Endpoint สาธารณะ | ยิง `GET /ai/health` | HTTP 200 OK, `status="online"`, มีข้อมูล version และ timestamp | **PASS** |
| **TC-AI-002** | ตรวจวัดสถานะ VRAM การ์ดจอแบบเรียลไทม์ | มีการ์ดจอ RTX 3070 พร้อม CUDA | อ่านค่าผ่าน `get_gpu_status()` | แสดง device, total_memory, allocated_gb, free_gb ครบถ้วน | **PASS** |
| **TC-AI-003** | กลไกคืนหน่วยความจำ VRAM (Cache Purge) | หน่วยความจำสะสมหลังรันเจนภาพ | เรียกฟังก์ชัน `clear_vram_cache()` | สั่ง `gc.collect()` และ `torch.cuda.empty_cache()` คืนพื้นที่ทันที | **PASS** |

### หมวดที่ 2: ระบบตรวจจับความเข้ากันได้ของโมเดล (Model-LoRA Compatibility Guard)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-004** | เรียกดูรายการโมเดลพร้อม Family Metadata | ไม่มี (Public API) | เรียก `GET /ai/models` | แสดง Checkpoint และ LoRA พร้อมแท็ก `family: sd15 / illustrious_xl / pony_xl` | **PASS** |
| **TC-AI-005** | จับคู่ Model กับ LoRA ตระกูลเดียวกันสำเร็จ | Model: `counterfeitV30` (sd15) + LoRA: `tachi-e` (sd15) | ส่งเข้าประมวลผล Prompt | แท็ก `<lora:tachi-e:0.8>` ถูกประกอบเข้าใน Prompt สมบูรณ์ | **PASS** |
| **TC-AI-006** | **Auto-Skip Guard:** สกัดกั้น LoRA ข้ามตระกูล | Model: `novaAnimeXL` (Illustrious) + LoRA: `tachi-e` (sd15) | ส่งเข้าประมวลผล Prompt | **Auto-skip:** ระบบตัด LoRA แปลกปลอมออกอัตโนมัติ ไม่เกิด Error 500 | **PASS** |
| **TC-AI-007** | บันทึกคำเตือนใน Response Metadata เมื่อเกิด Auto-skip | มีการสั่งใช้ LoRA ข้ามตระกูล | ตรวจสอบ Response หรือ Callback | แนบ metadata แจ้งเตือน `skipped_loras` ให้ผู้ใช้ทราบอย่างโปร่งใส | **PASS** |

### หมวดที่ 3: ขอบเขตความปลอดภัยป้องกัน GPU ค้าง (Safety Bounds for 8GB VRAM)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-008** | ป้องกัน Prompt ว่างเปล่า (Empty Prompt) | `prompt=""` (สตริงว่าง) | ยิง `POST /ai/generate` | HTTP 422 Unprocessable Entity (ความยาวขั้นต่ำ 1 ตัวอักษร) | **PASS** |
| **TC-AI-009** | ป้องกัน Prompt ขนาดยักษ์ (Buffer Overflow DoS) | Prompt ยาวเกิน 2,000 ตัวอักษร | ยิง `POST /ai/generate` | HTTP 422 Unprocessable Entity (จำกัดสูงสุด 2,000 ตัวอักษร) | **PASS** |
| **TC-AI-010** | จำกัดจำนวน Steps ขั้นต่ำและสูงสุด (1 - 50) | Steps = 0 หรือ Steps = 100 | ยิง `POST /ai/generate` | HTTP 422 Steps ต้องอยู่ในช่วง 1 ถึง 50 ป้องกันการผูกขาด GPU | **PASS** |
| **TC-AI-011** | จำกัดขอบเขต CFG Scale (1.0 - 20.0) | CFG = 0.5 หรือ CFG = 30.0 | ยิง `POST /ai/generate` | HTTP 422 CFG ต้องอยู่ในช่วง 1.0 ถึง 20.0 ป้องกันภาพไหม้แตก | **PASS** |
| **TC-AI-012** | จำกัดขนาดความกว้างภาพ (Resolution Guard) | width = 128 หรือ width = 1024 | ยิง `POST /ai/generate` | HTTP 422 ความกว้างต้องอยู่ในช่วง 256 ถึง 768 px | **PASS** |
| **TC-AI-013** | จำกัดขนาดความสูงภาพ (Resolution Guard) | height = 128 หรือ height = 1024 | ยิง `POST /ai/generate` | HTTP 422 ความสูงต้องอยู่ในช่วง 256 ถึง 768 px | **PASS** |
| **TC-AI-014** | ตรวจสอบ Secret ใน Header `X-LUMA-INTERNAL-SECRET` | Secret ผิดหรือไม่ส่ง Header มา | ยิง `POST /ai/generate` | **HTTP 403 Forbidden** ป้องกันอุปกรณ์ภายนอกสั่งรัน GPU ตรง | **PASS** |

### หมวดที่ 4: ระบบคิวประมวลผลและการจัดส่งงาน (FIFO Queue Engine)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-015** | การรับงานและส่งเข้าคิว (202 Accepted) | Task ID, Prompt, Callback URL | ยิง `POST /ai/generate` | ตอบกลับ HTTP 202 Accepted ทันที ไม่บล็อก Thread การเชื่อมต่อ | **PASS** |
| **TC-AI-016** | การประมวลผลตามลำดับก่อนหลัง (First-In, First-Out) | ส่งงาน A และ B เข้ามาพร้อมกัน | สังเกตการหยิบงานใน Queue Manager | งาน A ประมวลผลบน GPU เสร็จก่อน งาน B จึงเริ่มประมวลผลต่อ | **PASS** |
| **TC-AI-017** | การโพลล์สถานะคิว `GET /ai/status/{task_id}` | Task ID ที่อยู่ในคิว | เรียก Endpoint ตรวจสถานะ | แสดงสถานะงาน (`queued`, `processing`, `completed`) และอันดับคิว | **PASS** |

### หมวดที่ 5: ระบบสำรองเรนเดอร์และความทนทาน (Fallback Safeguard & Resilience)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-018** | High-Fidelity Fallback Render เมื่อ Forge ออฟไลน์ | Forge API (:7861) ปิดอยู่ | สั่งสร้างภาพผ่าน AI Server | ระบบสลับใช้วาด Preview Canvas จำลองผลลัพธ์ ไม่เกิดการ Crash | **PASS** |
| **TC-AI-019** | การสลับใช้ CPU Fallback เมื่อไม่มี CUDA GPU | เครื่องรันไม่มีการ์ดจอ NVIDIA | รัน `get_gpu_status()` | ตรวจจับและสลับโหมดเป็น `"CPU (Fallback)"` ได้อย่างราบรื่น | **PASS** |
| **TC-AI-020** | Watchdog Timer ตัดงานที่รันค้างเกิน 120 วินาที | จำลอง Forge ค้างไม่ตอบสนอง | ปล่อยให้เวลาล่วงเลยเกิน 120s | Watchdog ตัดงาน ส่งสถานะ failed แจ้งเตือน และปลดล็อกคิวถัดไป | **PASS** |

### หมวดที่ 6: การส่ง Webhook Callback และการบีบอัดภาพ (Callback & Compression)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-021** | การบีบอัดภาพ WebP 92% ประหยัดแบนด์วิดท์ LAN | ภาพผลลัพธ์ขนาด 512x512 | แปลงและบีบอัดก่อนส่ง Callback | ขนาดไฟล์ลดลง 70-80% เมื่อเทียบกับ PNG โดยภาพยังคงคมชัดสูง | **PASS** |
| **TC-AI-022** | ระบบลองส่ง Callback ซ้ำ (Retry Mechanism) | ปิด Backend ชั่วขณะ 1-2 วินาที | AI Server ยิง Callback กลับ | ระบบ Retry สูงสุด 3 ครั้ง หากเชื่อมต่อติดภาพจะถูกส่งสำเร็จ | **PASS** |

---

## 🚀 วิธีการสั่งรันชุดทดสอบนี้ (Execution Guide)

### รันผ่านไฟล์สคริปต์อัตโนมัติ (Batch File):
```cmd
TestCases\04_AI_Inference_Node\run_ainode_tests.bat
```

### รันผ่าน Pytest Automation Suite:
```bash
pytest ai_server/tests/ -v --tb=short
```

### รันเฉพาะชุดทดสอบ Edge Cases และ Safety Guard:
```bash
python -m unittest -v ai_server.tests.test_edge_cases
```
*(ต้องผ่าน 18/18 Tests และไม่มีข้อผิดพลาด OOM หรือ Syntax Error)*
