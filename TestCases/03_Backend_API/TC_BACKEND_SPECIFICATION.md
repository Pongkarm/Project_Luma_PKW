# 📋 Test Case Specification: Backend Core API & Database (Node 3)

> **สายงาน:** Backend Architecture, Security & Database  
> **ผู้รับผิดชอบหลัก:** [@Pongkarm](https://github.com/Pongkarm)  
> **อุปกรณ์เป้าหมาย (Node 3):** macOS Backend Server (`10.23.130.9:8000`)  
> **เทคโนโลยีหลัก:** Python 3.11+, FastAPI 0.115+, SQLAlchemy 2.0 ORM, PostgreSQL 15+ / SQLite, Pytest, Pillow, OpenCV, Bcrypt, PyJWT  
> **เป้าหมาย:** ตรวจสอบความปลอดภัย 5 ชั้นของการอัปโหลดไฟล์ภาพ, สิทธิ์การใช้งานตามบทบาท (RBAC), วงจรสถานะงานเจนภาพ, เครื่องมือประมวลผล Studio Tools, และความทนทานของ Webhook Callback

---

## 📊 สรุปผลการทดสอบ (Executive Test Summary)

| กลุ่มการทดสอบ (Test Category) | จำนวนเคส | ผ่าน (PASS) | ล้มเหลว (FAIL) | อัตราความสำเร็จ |
| :--- | :---: | :---: | :---: | :---: |
| 1. Authentication & JWT Security | 6 | 6 | 0 | 100% |
| 2. Role-Based Access Control (RBAC) & Audit | 5 | 5 | 0 | 100% |
| 3. Five-Layer Image Security Validation | 8 | 8 | 0 | 100% |
| 4. Generation Tasks & Progress Lifecycle | 7 | 7 | 0 | 100% |
| 5. Webhook Callback & Secret Verification | 4 | 4 | 0 | 100% |
| 6. Image Processing Studio Tools | 5 | 5 | 0 | 100% |
| **รวมทั้งหมด** | **35** | **35** | **0** | **100% 🏆** |

---

## 📝 รายละเอียดตาราง Test Cases (Detailed Test Specifications)

### หมวดที่ 1: ระบบยืนยันตัวตนและความปลอดภัยของโทเคน (Authentication & JWT)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-001** | สมัครสมาชิกผู้ใช้ใหม่สำเร็จ | username, email, password ถูกต้อง | ยิง `POST /auth/register` | HTTP 201 Created, รหัสผ่านถูกเข้ารหัส Bcrypt ลงฐานข้อมูล | **PASS** |
| **TC-BE-002** | ปฏิเสธการลงทะเบียนชื่อผู้ใช้ซ้ำ | username เดิมที่มีอยู่แล้วในระบบ | ยิง `POST /auth/register` ซ้ำ | HTTP 409 Conflict, แสดงข้อความ username ถูกใช้งานแล้ว | **PASS** |
| **TC-BE-003** | เข้าสู่ระบบสำเร็จและรับ Bearer Token | username และ password ถูกต้อง | ยิง `POST /auth/login` (OAuth2 Form) | HTTP 200 OK, ได้รับ `access_token` ชนิด JWT อายุ 24 ชม. | **PASS** |
| **TC-BE-004** | ปฏิเสธการล็อกอินด้วยรหัสผ่านไม่ถูกต้อง | username ถูกต้อง แต่ password ผิด | ยิง `POST /auth/login` | HTTP 401 Unauthorized, ไม่สร้างโทเคน | **PASS** |
| **TC-BE-005** | ดึงข้อมูล Profile ตนเองผ่าน Token | ส่ง `Authorization: Bearer <TOKEN>` | เรียก `GET /auth/me` | HTTP 200 OK, คืนค่า user_id, username, email, total_generations | **PASS** |
| **TC-BE-006** | ป้องกันการปลอมแปลง Token (JWT Tampering) | Token ที่ถูกแก้ไข Payload/Signature | ส่ง Token ปลอมเข้า `GET /auth/me` | HTTP 401 Unauthorized, Signature verification failed | **PASS** |

### หมวดที่ 2: การควบคุมสิทธิ์ตามบทบาทและบันทึกประวัติ (RBAC & Audit Log)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-007** | ผู้ใช้ทั่วไปเข้าหน้า Admin ต้องถูกปฏิเสธ | Token ของผู้ใช้สถานะ User ธรรมดา | เรียก `GET /admin/stats` หรือ `/admin/users` | HTTP 403 Forbidden ("สิทธิ์ไม่เพียงพอ") | **PASS** |
| **TC-BE-008** | สิทธิ์ Owner สามารถเข้าถึงได้ทุกฟังก์ชัน | Token ของผู้ใช้สถานะ Owner | เรียกดูสถิติ, จัดการบทบาท, ดู Audit | HTTP 200 OK ทุก Endpoint | **PASS** |
| **TC-BE-009** | สิทธิ์ Reviewer ดูข้อมูลได้แต่แก้บทบาทไม่ได้ | Token ของ Reviewer | สั่งแก้ Role ผู้ใช้คนอื่น | HTTP 403 Forbidden อนุญาตเฉพาะ Owner เท่านั้น | **PASS** |
| **TC-BE-010** | การแบนและปลดแบนผู้ใช้งาน (User Suspension) | `PATCH /admin/users/{id}/ban` | สั่งแบนผู้ใช้เป้าหมาย | บัญชีถูกตั้ง `is_active=False` และล็อกอินไม่ได้อีก | **PASS** |
| **TC-BE-011** | การบันทึก Audit Event อัตโนมัติ | มีการแบนผู้ใช้ หรือเปลี่ยนบทบาท Admin | ดำเนินการ Action สำคัญทางระบบ | สร้างระเบียนใหม่ในตาราง `AUDIT_EVENTS` บันทึก actor, target, timestamp | **PASS** |

### หมวดที่ 3: ระบบความปลอดภัยไฟล์ภาพ 5 ชั้น (Five-Layer Image Security Validation)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-012** | Layer 1: ตรวจ Content-Type Header ที่ถูกต้อง | ไฟล์ PNG/JPEG/WebP แท้ | ส่งผ่าน `POST /uploads` | ผ่านการตรวจสอบชั้นที่ 1 เข้าสู่ชั้นถัดไป | **PASS** |
| **TC-BE-013** | Layer 1: ปฏิเสธ Content-Type นอก whitelist | Header เป็น `text/plain` หรือ `application/pdf` | ส่งผ่าน `POST /uploads` | HTTP 422 Unprocessable Entity (ไม่อนุญาตประเภทไฟล์นี้) | **PASS** |
| **TC-BE-014** | Layer 2: ตรวจสอบขนาดไฟล์ภาพไม่เกิน 10MB | ไฟล์ภาพขนาด 5MB (ปกติ) | ส่งผ่าน `POST /uploads` | ผ่านการตรวจสอบชั้นที่ 2 | **PASS** |
| **TC-BE-015** | Layer 2: สกัดกั้นไฟล์ภาพขนาดเกิน 10MB (DoS) | ไฟล์ขนาดยักษ์ 12MB | ส่งผ่าน `POST /uploads` | **HTTP 413 Payload Too Large** ทันที ไม่กิน RAM เครื่อง | **PASS** |
| **TC-BE-016** | Layer 3: ตรวจสอบไบนารี Magic Bytes แท้จริง | ไฟล์ไบนารี PNG Header `\x89PNG\r\n\x1a\n` | อ่านหัวไบนารีแท้ของไฟล์ | ยืนยันประเภทไฟล์จริง ไม่ใช่ไฟล์ปลอมแปลง | **PASS** |
| **TC-BE-017** | Layer 3: ดักจับมัลแวร์ที่ปลอมนามสกุลไฟล์ | สคริปต์ไวรัส `.exe` ที่เปลี่ยนชื่อเป็น `.png` | ส่งไฟล์ปลอมเข้า `POST /uploads` | **HTTP 422 Unprocessable Entity** Magic Bytes ไม่ตรง | **PASS** |
| **TC-BE-018** | Layer 4: ป้องกัน Decompression Bomb (OWASP) | ภาพบีบอัดขนาดเล็กแต่คลี่เป็น 100 MegaPixels | พยายามโหลดเข้า Pillow | **Image.DecompressionBombError** ถูกดักจับและตอบ 422 ทันที | **PASS** |
| **TC-BE-019** | Layer 5: ลบพิกัด GPS/EXIF และบันทึก Atomic | ภาพถ่ายจากกล้องมือถือที่มีพิกัด GPS | ผ่านการ Save ใน `upload_service` | ภาพที่บันทึกถูกตัด EXIF ทิ้ง และบันทึกแบบไฟล์ชั่วคราวก่อนย้าย | **PASS** |

### หมวดที่ 4: วงจรสถานะงานสร้างภาพ (Generation Task Lifecycle)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-020** | สร้างงาน Text-to-Image (txt2img) | Prompt, Model, Sampler, Steps | ยิง `POST /generations` | บันทึกงานลงฐานข้อมูล `status="pending"` คืนค่า `task_id` | **PASS** |
| **TC-BE-021** | สร้างงาน Image-to-Image (img2img) | Source Image ID, Denoising 0.6 | ยิง `POST /generations` (type=img2img) | บันทึกงานพร้อมผูก `source_image_path` ถูกต้อง | **PASS** |
| **TC-BE-022** | สร้างงาน Inpaint พร้อมภาพ Mask | Source Image ID, Mask Image ID | ยิง `POST /generations` (type=inpaint) | บันทึกงานพร้อมผูกทั้ง Source Image และ Inpaint Mask | **PASS** |
| **TC-BE-023** | ตรวจสอบขอบเขตขนาดภาพ (256 - 768 px) | ความกว้าง 1024px หรือ 128px | ยิง `POST /generations` | HTTP 422 ขนาดภาพต้องอยู่ในช่วง 256 ถึง 768 px | **PASS** |
| **TC-BE-024** | โพลล์ความคืบหน้างานเจนภาพ (Polling) | Task ID ที่กำลังประมวลผล | เรียก `GET /generations/{id}/progress` | HTTP 200 OK, แสดงเปอร์เซ็นต์ความคืบหน้า (Progress 0-100%) | **PASS** |
| **TC-BE-025** | การยกเลิกงานสร้างภาพกลางคัน (Cancel Task) | Task ID ที่สถานะยังเป็น pending | ยิง `POST /generations/{id}/cancel` | ปรับสถานะเป็น `cancelled` และแจ้งตัดการส่งต่อ AI Node | **PASS** |
| **TC-BE-026** | การดึงไฟล์ภาพผลลัพธ์ที่สร้างเสร็จแล้ว | Task ID ที่สถานะเป็น `completed` | เรียก `GET /generations/{id}/image` | HTTP 200 OK ส่งไฟล์ภาพ WebP/PNG พร้อม Content-Type ถูกต้อง | **PASS** |

### หมวดที่ 5: การทำงานของ Webhook Callback (Callback & Security)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-027** | รับ Callback สำเร็จด้วย Secret Header ที่ถูกต้อง | Base64 Image, Secret ตรงกับ `.env` | ยิง `POST /api/callback` | HTTP 200 OK, เซฟภาพลง `outputs/{id}.webp`, อัปเดต DB `completed` | **PASS** |
| **TC-BE-028** | ปฏิเสธ Callback หาก Secret Token ไม่ตรง | Secret ปลอมหรือไม่แนบ Header | ยิง `POST /api/callback` | **HTTP 403 Forbidden** ป้องกันการยิงสวมรอยผลงาน | **PASS** |
| **TC-BE-029** | รับ Callback กรณีงานล้มเหลว (Failed Task) | status=failed พร้อม error_message | ยิง `POST /api/callback` | อัปเดต DB เป็น `failed` บันทึกสาเหตุข้อผิดพลาดลงตาราง | **PASS** |
| **TC-BE-030** | Idempotency ป้องกัน Callback ซ้ำซ้อน | ยิง Callback ของ Task ID เดิม 2 ครั้ง | จำลอง Network Retry จาก AI Node | ระบบรับทราบ ไม่ทำการบันทึกไฟล์ซ้ำซ้อน ไม่เกิด Crash | **PASS** |

### หมวดที่ 6: เครื่องมือประมวลผลสตูดิโอ (Studio Image Tools)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BE-031** | เครื่องมือตรวจจับท่าทาง (Pose Detection) | ภาพบุคคลเต็มตัว | ยิง `POST /api/tools/pose` | คืนภาพเส้นโครงกระดูก (Skeleton Keypoints) ชัดเจน | **PASS** |
| **TC-BE-032** | Pose Detection กรณีภาพไม่มีคน | ภาพวิวทิวทัศน์ (ไม่มีมนุษย์) | ยิง `POST /api/tools/pose` | ตอบกลับภาพพร้อมแนบ Warning Metadata (`no_pose_detected`) | **PASS** |
| **TC-BE-033** | เครื่องมือแปลงภาพเป็นลายเส้น (Sketch Filter) | ภาพถ่ายทั่วไป | ยิง `POST /api/tools/sketch` | สกัดขอบวัตถุ (Adaptive Edge) คืนภาพสเก็ตช์ขาวดำ | **PASS** |
| **TC-BE-034** | เครื่องมือดึงสีเฉพาะจุด (Color Splash) | ภาพถ่ายและเป้าหมายสี HSV | ยิง `POST /api/tools/color-splash` | คงสีของวัตถุเป้าหมาย และแปลงส่วนที่เหลือเป็นภาพขาวดำ | **PASS** |
| **TC-BE-035** | ตัดพื้นหลังด้วย GrabCut พร้อม Semaphore Guard | ภาพถ่ายวัตถุ/คน | ยิง `POST /api/tools/remove-bg` | ตัดพื้นหลังออก คืนภาพ PNG โปร่งใส พร้อมจำกัดโหลด CPU ด้วย Semaphore | **PASS** |

---

## 🚀 วิธีการสั่งรันชุดทดสอบนี้ (Execution Guide)

### รันผ่านไฟล์สคริปต์อัตโนมัติ (Batch File):
```cmd
TestCases\03_Backend_API\run_backend_tests.bat
```

### รันผ่าน Pytest Automation Runner:
```bash
pytest -v --tb=short
```

### รันพร้อมวัดระดับ Code Coverage:
```bash
pytest --cov=app --cov-report=term-missing
```
*(ต้องผ่าน 96/96 Tests และครอบคลุม Coverage มากกว่า 90%)*
