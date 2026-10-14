# 📋 Test Case Specification: Frontend Web Studio (Node 2)

> **สายงาน:** Web Frontend & User Experience (UX/UI)  
> **ผู้รับผิดชอบหลัก:** [@winxtxrgit](https://github.com/winxtxrgit) · [@wxnxtxr](https://github.com/wxnxtxr)  
> **อุปกรณ์เป้าหมาย (Node 2):** macOS Web Server (`10.23.130.6:5500`)  
> **เทคโนโลยีหลัก:** HTML5, CSS3 Custom Properties, Vanilla JavaScript (ES2022+), HTML5 Canvas 2D Context, Node.js Test Runner  
> **เป้าหมาย:** ตรวจสอบความถูกต้องของการคำนวณขนาดภาพ, กฎความปลอดภัยรหัสผ่าน, การกรอง LoRA ตามตระกูลโมเดล, การระบาย Mask บน Canvas, และความต่อเนื่องของ User Journey

---

## 📊 สรุปผลการทดสอบ (Executive Test Summary)

| กลุ่มการทดสอบ (Test Category) | จำนวนเคส | ผ่าน (PASS) | ล้มเหลว (FAIL) | อัตราความสำเร็จ |
| :--- | :---: | :---: | :---: | :---: |
| 1. Image Resolution & Aspect Ratio Calculation | 3 | 3 | 0 | 100% |
| 2. Model & LoRA Dynamic Compatibility Filter | 3 | 3 | 0 | 100% |
| 3. Security, Input Validation & XSS Sanitization | 4 | 4 | 0 | 100% |
| 4. UI State, Formatting & Error Presentation | 4 | 4 | 0 | 100% |
| 5. End-to-End User Flow & Navigation | 4 | 4 | 0 | 100% |
| 6. Canvas Mask Editor & Studio Tools Interaction | 4 | 4 | 0 | 100% |
| **รวมทั้งหมด** | **22** | **22** | **0** | **100% 🏆** |

---

## 📝 รายละเอียดตาราง Test Cases (Detailed Test Specifications)

### หมวดที่ 1: การคำนวณขนาดและสัดส่วนภาพ (Resolution & Geometry)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-001** | ฟังก์ชัน `snapSize` ปัดขนาดให้หารด้วย 8 ลงตัว | ค่ากว้าง/ยาว เช่น 513, 250, 800 | ส่งเข้าฟังก์ชัน `snapSize(val)` | ปัดเศษลงตัวหาร 8 (512), จำกัดช่วง 256 ถึง 768 px | **PASS** |
| **TC-FE-002** | ฟังก์ชัน `fitToEngine` ย่อภาพไม่เกิน 768px | ภาพขนาด 1920x1080 และ 300x200 | เรียก `fitToEngine(w, h)` | ย่อด้านยาวสุดเหลือ 768 โดยคงสัดส่วน และไม่ขยายภาพเล็ก | **PASS** |
| **TC-FE-003** | ฟังก์ชัน `ratioText` คำนวณอัตราส่วนอย่างต่ำ | ขนาด 512x512, 768x432, 432x768 | เรียก `ratioText(w, h)` | แสดงสตริงสัดส่วนเข้าใจง่าย เช่น `"1:1"`, `"16:9"`, `"9:16"` | **PASS** |

### หมวดที่ 2: ระบบตรวจจับและกรอง LoRA ข้ามตระกูล (Model-LoRA Filter)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-004** | ฟังก์ชัน `detectModelFamily` จำแนกตระกูลโมเดล | ชื่อไฟล์ Checkpoint ต่างๆ | ส่งชื่อไฟล์เข้า `detectModelFamily(name)` | จำแนกถูกต้อง (`pony_xl`, `illustrious_xl`, หรือ `sd15`) | **PASS** |
| **TC-FE-005** | ฟังก์ชัน `modelFamily`/`loraFamily` ดึงค่า Metadata | อ็อบเจกต์โมเดลที่มีและไม่มี tag | เรียกฟังก์ชันอ่าน Family | ใช้อ่านจาก API ก่อน หากไม่มีจึงใช้ชื่อไฟล์วิเคราะห์สำรอง | **PASS** |
| **TC-FE-006** | ฟังก์ชัน `compatibleLoras` กรอง LoRA ตามโมเดล | Base Model: `counterfeitV30` (sd15) | เรียก `compatibleLoras(loras, model)` | แสดงเฉพาะ LoRA ตระกูล sd15 (เช่น Tachi-e, Niji Mix) ห้ามโชว์ XL | **PASS** |

### หมวดที่ 3: ความปลอดภัย การตรวจรหัสผ่าน และป้องกัน XSS (Security & Validation)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-007** | การตรวจสอบกฎรหัสผ่าน `PASSWORD_RULES` | รหัสผ่านสั้น, ขาดตัวเลข, รหัสไม่ตรง | ส่งข้อมูลเข้า `validatePassword(pw, cf)` | แจ้งเตือนข้อผิดพลาด: ความยาว ≥ 8, มีตัวเลข/สัญลักษณ์, รหัสตรงกัน | **PASS** |
| **TC-FE-008** | ป้องกัน XSS Injection ด้วย `escapeHtml` | `<script>alert('xss')</script>` | ส่งสตริงเข้าฟังก์ชัน `escapeHtml(str)` | แปลงเครื่องหมายเป็น Entity (`&lt;script&gt;...`) ไม่ถูกรันเป็นโค้ด | **PASS** |
| **TC-FE-009** | แปลง Error Response ของ FastAPI ด้วย `readDetail` | ข้อความเดี่ยว และ Array Validation Error | เรียก `readDetail(errResponse)` | ดึงข้อความแจ้งเตือนมาแสดงได้ครบถ้วนโดยไม่เกิด Runtime Error | **PASS** |
| **TC-FE-010** | ฟังก์ชัน `takeSessionJson` ป้องกัน Session รั่วไหล | ข้อมูล Session ใน Storage | ดึงข้อมูลผ่าน `takeSessionJson()` | อ่านข้อมูลได้เพียงครั้งเดียวแล้วเคลียร์ และคืน `null` เมื่อข้อมูลเสียหาย | **PASS** |

### หมวดที่ 4: การจัดรูปแบบและการแสดงผลสถานะ (Formatting & UX Presentation)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-011** | แปลง HTTP Status Code เป็นภาษาไทย | รหัส HTTP 401, 403, 413, 422, 500 | เรียก `errorMessage(status)` | แสดงข้อความแปลไทยเข้าใจง่าย (เช่น 413: "ไฟล์ภาพมีขนาดเกิน 10MB") | **PASS** |
| **TC-FE-012** | ฟังก์ชัน `formatClock` และ `formatBytes` | วินาที (125.4s), ขนาดไบต์ (1048576 B) | เรียกฟังก์ชันฟอร์แมตข้อมูล | แสดงผล `"02:05"` และ `"1.0 MB"` ถูกต้องตามหลักทศนิยม | **PASS** |
| **TC-FE-013** | ฟังก์ชัน `statusInfo` และ `statusChip` | สถานะ `pending`, `completed`, `failed` | เรียกฟังก์ชันสร้าง Badge สถานะ | แสดงไอคอนและสีชิปถูกต้อง และรองรับค่าสถานะที่ไม่รู้จักโดยไม่พัง | **PASS** |
| **TC-FE-014** | ฟังก์ชันคำนวณเลขคี่ `oddKernel` สำหรับฟิลเตอร์ | ค่าสไลเดอร์ 2, 4, 10, 52 | ส่งค่าเข้า `oddKernel(val)` | บังคับคืนค่าเป็นเลขคี่เสมอ (เช่น 3, 5, 11) ในช่วง 3 ถึง 51 | **PASS** |

### หมวดที่ 5: การทำงานเต็มรูปแบบและการนำทาง (End-to-End User Journey)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-015** | การสมัครสมาชิกและการเข้าสู่ระบบ | บัญชีผู้ใช้ใหม่และรหัสผ่านที่ถูกต้อง | กรอกฟอร์มที่ `register.html` และ `login.html` | บันทึก JWT Token ลง localStorage และเปลี่ยนเส้นทางเข้าหน้าหลัก | **PASS** |
| **TC-FE-016** | การสลับหน้าหลัก (Navigation Routing) | คลิกเมนูบาร์ Generate, Studio, History | สลับหน้าผ่าน App Navigation | โหลดหน้าปลายทางถูกต้องโดยส่ง Authorization Header ต่อเนื่อง | **PASS** |
| **TC-FE-017** | การบันทึกและกู้คืน Draft สร้างภาพอัตโนมัติ | กรอก Prompt, เลือก Model, สลับหน้าอื่น | ออกจากหน้า `generate.html` แล้วกลับเข้ามา | ข้อความ Prompt และการตั้งค่าถูกกู้คืนกลับมาเหมือนเดิมอัตโนมัติ | **PASS** |
| **TC-FE-018** | การเปลี่ยนผ่านสถานะเมื่อ Token หมดอายุ | Token หมดอายุเกิน 24 ชม. | เรียก API ใดๆ หลัง Token Expiration | แสดง Modal แจ้งเตือนเซสชันหมดอายุ และพากลับหน้า Login | **PASS** |

### หมวดที่ 6: ผืนผ้าใบวาด Mask และเครื่องมือ Studio (Canvas & Interactive Tools)

| Test ID | รายละเอียดการทดสอบ | ข้อมูลนำเข้า (Input Data) | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-FE-019** | การวาดเส้น Mask บน Canvas Inpainting | แดรกเมาส์ / สัมผัสบนผืนผ้าใบแคนวาส | วาดลายเส้นเพื่อกำหนดจุดต้องการ Inpaint | แสดงเลเยอร์สี Mask ชัดเจนบนพิกัดที่ถูกต้องตามพิกเซลของภาพจริง | **PASS** |
| **TC-FE-020** | ฟังก์ชัน Clear และ Undo บน Inpainting Canvas | มีประวัติการลากเส้นหลายครั้ง | กดปุ่ม Undo หรือ Clear All | ลายเส้น Mask ย้อนกลับทีละสเต็ป หรือล้างหน้าแคนวาสสะอาดหมดจด | **PASS** |
| **TC-FE-021** | การปรับขนาดหัวแปรง Brush Slider | ปรับสไลเดอร์ขนาดแปรง 10px ถึง 100px | ขยับหัวแปรงแล้วทดลองวาด | ความกว้างของเส้น Mask เปลี่ยนแปลงตามค่าสไลเดอร์ทันที | **PASS** |
| **TC-FE-022** | การตอบสนองบนอุปกรณ์พกพา (Responsive Layout) | Viewport หน้าจอ 375px (Mobile) | เปิดหน้าเว็บบนโหมดหน้าจอขนาดเล็ก | แผงควบคุมพับเป็น Accordion / Drawer เมนูทำงานถูกต้อง ไม่ล้นจอ | **PASS** |

---

## 🚀 วิธีการสั่งรันชุดทดสอบนี้ (Execution Guide)

### รันผ่านสคริปต์อัตโนมัติ (Batch File):
```cmd
TestCases\02_Frontend_Web\run_frontend_tests.bat
```

### รันชุดทดสอบหน่วย (Unit Tests) ด้วย Node.js:
```bash
node frontend-html/tests/unit.mjs
```

### รันชุดทดสอบทั้งหมด (E2E, Regressions, Responsive, Unit):
```bash
cd frontend-html
npm run test:all
```
*(ต้องการ Node.js 20+ หรือ 22+ ในการรันชุด E2E & Puppeteer)*
