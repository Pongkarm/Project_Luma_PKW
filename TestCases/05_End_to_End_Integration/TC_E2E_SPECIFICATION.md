# 📋 Test Case Specification: Multi-Node End-to-End Integration (Full Pipeline)

> **การทดสอบ:** บูรณาการระบบเต็มรูปแบบ 4 โหนด (End-to-End Integration Suite)  
> **ทีมพัฒนา:** รวมทุกฝ่าย (DevOps + Frontend + Backend + AI Node)  
> **สถาปัตยกรรมเป้าหมาย:** Distributed System ข้ามเครือข่าย LAN (`10.23.130.0/24`)  
> **โหนดที่เกี่ยวข้อง:**  
> - **Node 1 (Gateway):** `10.23.130.212:80` (Nginx Reverse Proxy)  
> - **Node 2 (Frontend):** `10.23.130.6:5500` (HTML/JS Web Studio)  
> - **Node 3 (Backend):** `10.23.130.9:8000` (FastAPI Core Engine & Database)  
> - **Node 4 (AI Node):** `10.23.130.112:7860` (AI Inference & GPU Watchdog)  
> **เป้าหมาย:** พิสูจน์ว่าระบบทั้ง 4 โหนดสามารถทำงานร่วมกันได้อย่างไร้รอยต่อ (Zero Breaking Changes) ครอบคลุมวงจรชีวิตตั้งแต่การร้องขอของผู้ใช้จนถึงการได้รับภาพสร้างสรรค์เสร็จสมบูรณ์

---

## 📊 สรุปผลการทดสอบ (Executive Test Summary)

| กลุ่มการทดสอบ (Test Category) | จำนวนเคส | ผ่าน (PASS) | ล้มเหลว (FAIL) | อัตราความสำเร็จ |
| :--- | :---: | :---: | :---: | :---: |
| 1. Full User Lifecycle & Gateway Authentication | 2 | 2 | 0 | 100% |
| 2. Distributed txt2img Pipeline (Asynchronous Webhook) | 2 | 2 | 0 | 100% |
| 3. Image Ingestion & img2img / Inpaint Workflow | 2 | 2 | 0 | 100% |
| 4. Studio Tools Integration (Pose & GrabCut) | 2 | 2 | 0 | 100% |
| 5. Multi-Layer Security & Defense-in-Depth | 2 | 2 | 0 | 100% |
| **รวมทั้งหมด** | **10** | **10** | **0** | **100% 🏆** |

---

## 📝 รายละเอียดตาราง Test Cases (Detailed Test Specifications)

### หมวดที่ 1: การเข้าสู่ระบบและการขอข้อมูลโมเดล (Authentication & Metadata)

| Test ID | รายละเอียดการทดสอบ | ขั้นตอนการทดสอบ (Execution Sequence) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :---: |
| **TC-E2E-001** | วงจรการสมัครและล็อกอินผ่าน Gateway | User ➔ Gateway (:80) ➔ Frontend (:5500) ➔ กรอกข้อมูล ➔ Gateway ➔ Backend (:8000) ➔ ตรวจสอบ DB | ได้รับ JWT Bearer Token, Frontend บันทึกลง Storage, หน้าจอเปลี่ยนเป็นสตูดิโอ | **PASS** |
| **TC-E2E-002** | การดึงรายการ Model และ LoRA แบบไดนามิก | Frontend ร้องขอ `/api/models` ผ่าน Gateway ➔ Backend ถาม AI Node ➔ ส่งรายการกลับ | แสดง Checkpoint และ LoRA ครบตามตระกูล Dropdown กรองอัตโนมัติ | **PASS** |

### หมวดที่ 2: การสร้างภาพแบบกระจายศูนย์ (Distributed Callback txt2img Pipeline)

| Test ID | รายละเอียดการทดสอบ | ขั้นตอนการทดสอบ (Execution Sequence) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :---: |
| **TC-E2E-003** | การส่งงานเข้าคิว GPU และรอรับ Webhook | 1. Frontend ยิง `POST /generations` เข้า Gateway<br/>2. Backend บันทึก DB `pending` และยิงสั่ง AI Node<br/>3. AI Node รับงาน ตอบ 202 Accepted และเข้าคิว FIFO<br/>4. GPU RTX 3070 รันภาพ 25 สเต็ป<br/>5. AI Node ยิง Callback พร้อม Base64 และ Secret Token<br/>6. Backend เซฟไฟล์ลง Disk และอัปเดต DB `completed` | การทำงานแบบ Asynchronous ไหลลื่น ไม่เกิด Connection Timeout, ภาพถูกเซฟลง `outputs/` | **PASS** |
| **TC-E2E-004** | การโพลล์ความคืบหน้าแบบเรียลไทม์ (Live Progress) | ระหว่าง GPU กำลังเจนภาพ Frontend โพลล์ `GET /generations/{id}/progress` ผ่าน Gateway | แถบ Progress Bar บนหน้าเว็บขยับตามเปอร์เซ็นต์จริง (เช่น 20% ➔ 60% ➔ 100%) | **PASS** |

### หมวดที่ 3: การประมวลผลร่วมกับภาพต้นฉบับ (Upload & Inpaint Pipeline)

| Test ID | รายละเอียดการทดสอบ | ขั้นตอนการทดสอบ (Execution Sequence) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :---: |
| **TC-E2E-005** | อัปโหลดภาพต้นฉบับผ่านความปลอดภัย 5 ชั้น | ผู้ใช้อัปโหลดภาพ JPEG เข้าสตูดิโอ ➔ ผ่าน Gateway ➔ Backend ตรวจ 5-Layer Security | ภาพผ่านการตรวจ Magic Bytes, ลบ EXIF พิกัด GPS และได้ Image ID สำหรับสร้างงาน | **PASS** |
| **TC-E2E-006** | การระบาย Mask และแปลงภาพเฉพาะจุด (Inpaint) | 1. วาด Mask สีบน Canvas Inpaint<br/>2. ส่งภาพต้นฉบับ + Mask เข้า Backend<br/>3. AI Node โหลดโมเดลรัน Inpainting เติมวัตถุใหม่<br/>4. ผลลัพธ์ส่งกลับมาแสดงบนหน้าเว็บ | วัตถุใหม่ถูกวาดลงเฉพาะตำแหน่งที่ระบาย Mask โดยเนียนไปกับภาพพื้นหลังเดิม | **PASS** |

### หมวดที่ 4: การทำงานของเครื่องมือสตูดิโอข้ามเครื่อง (Studio Tools)

| Test ID | รายละเอียดการทดสอบ | ขั้นตอนการทดสอบ (Execution Sequence) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :---: |
| **TC-E2E-007** | ตรวจจับโครงกระดูกมนุษย์ (Pose Detection) | ส่งภาพคนเข้า `/api/tools/pose` ➔ Backend สกัดโครงสร้าง OpenPose ➔ ส่งกลับภาพ Skeleton | ได้รับภาพโครงกระดูกข้อต่อสีสันชัดเจน สามารถดาวน์โหลดไปเป็น ControlNet ต่อได้ | **PASS** |
| **TC-E2E-008** | การตัดพื้นหลังอัจฉริยะ (GrabCut Segmentation) | ส่งภาพถ่ายเข้า `/api/tools/remove-bg` ➔ Backend ประมวลผลตัดพื้นหลังผ่าน Worker Thread | ได้รับไฟล์ภาพ PNG โปร่งใส (Transparent Background) ที่ตัดฉากหลังออกเนียนกริบ | **PASS** |

### หมวดที่ 5: การทดสอบการป้องกันความปลอดภัย (Defense-in-Depth Verification)

| Test ID | รายละเอียดการทดสอบ | ขั้นตอนการทดสอบ (Execution Sequence) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :---: |
| **TC-E2E-009** | ป้องกันการยิงคำสั่งตรงข้ามโหนด (Subnet & Secret) | 1. พยายามยิงตรงเข้าพอร์ต 5500 ของ Frontend โดยไม่ผ่าน Gateway ➔ โดนบล็อก 403<br/>2. ยิง Callback ปลอมเข้า Backend โดยไม่มี Secret Token ➔ โดนบล็อก 403 | ทุกโหนดปฏิเสธคำขอที่ไม่ได้รับอนุญาต ต้องติดต่อผ่าน Gateway และใช้ Secret เท่านั้น | **PASS** |
| **TC-E2E-010** | สกัดกั้นไฟล์ภาพอันตราย (Malware / Bomb) | ส่งไฟล์สคริปต์เปลี่ยนนามสกุลเป็น `.png` และส่งภาพบอมบ์ขนาด 100M Pixels | Backend ดักจับได้ด้วย Magic Bytes และ Decompression Bomb Guard (HTTP 422) | **PASS** |

---

## 🚀 วิธีการสั่งรันชุดทดสอบบูรณาการ (Execution Guide)

### รันผ่านไฟล์สคริปต์อัตโนมัติ (Batch File):
```cmd
TestCases\05_End_to_End_Integration\run_e2e_tests.bat
```

### รันผ่าน Python Pipeline Runner:
```bash
python test_e2e_flow.py
```

### รันชุดทดสอบจำลอง 4 โหนดพร้อม Mock Forge:
```bash
python -u -m unittest -v ai_server.tests.test_multi_node_e2e
```
*(จำลองการส่งงานข้ามเครือข่าย ตรวจสอบ FIFO Queue, Webhook Callback และ Secret Header)*
