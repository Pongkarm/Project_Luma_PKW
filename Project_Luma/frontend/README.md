# 👤 คนที่ 1: UX/UI Frontend Developer (PC1: 192.168.1.10)

## 📌 บทบาทและความรับผิดชอบ
รับผิดชอบการออกแบบ UI/UX, โครงสร้างหน้าเว็บแบบ Responsive (Bootstrap 5), การต่อเชื่อม REST API ผ่าน Fetch API, การทำ Canvas Inpainting Mask Tool และการจัดการ State/Loading UI

---

## 📁 โครงสร้างไฟล์ใน `frontend/`
```
frontend/
├── index.html              # หน้าแรก / Landing Page
├── login.html              # หน้าเข้าสู่ระบบ
├── register.html           # หน้าสมัครสมาชิก
├── dashboard.html          # หน้า Dashboard สรุปการใช้งาน
├── generate.html           # หน้าสร้างภาพ (txt2img)
├── edit.html               # หน้าแต่งภาพ & Inpainting (img2img / Inpaint)
├── gallery.html            # หน้าคลังภาพและดาวน์โหลด
├── css/
│   ├── style.css           # สไตล์หลักของระบบ
│   └── components.css      # สไตล์ Loading, Tips, Toasts, Canvas
├── js/
│   ├── api.js              # Fetch API Wrapper & Token Management
│   ├── app.js              # Global Utilities & Toast Notifications
│   ├── auth.js             # Login / Register / Logout Logic
│   ├── generate.js         # txt2img Logic & 4-Layer Loading UI
│   ├── edit.js             # Canvas Mask & Inpainting Logic
│   └── gallery.js          # คลังภาพและ Filter Logic
└── assets/                 # ไอคอนและรูปภาพตกแต่ง
```

---

## 🎨 สรุปคำแนะนำและ Best Practices จากพี่ไอ (Iris)
1. **4-Layer Loading Pattern** (ระหว่างรอ AI 30-40 วิ):
   * **Layer 1**: Indeterminate Spinner / Progress Bar
   * **Layer 2**: Status Text สลับตามเฟส ("กำลังวิเคราะห์ Prompt..." -> "กำลัง Denoise..." -> "กำลัง Render...")
   * **Layer 3**: Skeleton / Placeholder Preview
   * **Layer 4**: Tips แนะนำเทคนิคการ Prompt สลับทุก 5 วินาที
2. **Responsive Canvas Inpainting**:
   * คำนวณพิกัดจริงด้วยสูตร `(clientX - rect.left) * (canvas.width / rect.width)`
   * รองรับทั้ง Mouse Event และ Touch Event (`e.touches[0]`)
   * Export Mask ภาพขาว-ดำ (`#000000` = ไม่แก้, `#FFFFFF` = บริเวณที่ต้อง Inpaint) ในฟอร์แมต WebP / PNG DataURL
3. **Smooth Error Handling**:
   * คืน State ให้ปุ่ม Generate ทันทีที่เกิด Error
   * ห้ามล้างค่า Prompt ที่ผู้ใช้พิมพ์ไว้ (เก็บสำรองใน LocalStorage หรือ Form State)
   * ใช้ Toast Notification หรือ Modal แจ้งข้อความที่อ่านง่าย (User-friendly language)

---

## 🔌 API Endpoints ที่ต้องเชื่อมต่อ
* `POST /api/login` -> `{ username, password }`
* `POST /api/register` -> `{ username, email, password }`
* `POST /api/generate` -> `{ prompt, negative_prompt, model, lora, steps, cfg_scale }`
* `POST /api/edit` -> `{ prompt, image_base64, mask_base64, mode }`
* `GET /api/task/:id` -> Polling ตรวจสอบสถานะทุก 3 วินาที
* `GET /api/images` -> ดึงรายการภาพทั้งหมดใน Gallery
