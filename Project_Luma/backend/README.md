# ⚙️ คนที่ 2: Flask Backend Developer (PC2: 192.168.1.20)

## 📌 บทบาทและความรับผิดชอบ
รับผิดชอบการพัฒนา REST API, จัดการฐานข้อมูล SQLite (SQLAlchemy), ทำระบบยืนยันตัวตน JWT (Flask-JWT-Extended), จัดเก็บไฟล์รูปภาพ และเป็นตัวกลางเชื่อมต่อไปยัง AI Server (FastAPI @ `192.168.1.30:7860`)

---

## 📁 โครงสร้างไฟล์ใน `backend/`
```
backend/
├── app.py                  # Flask Application Entry Point
├── config.py               # Database URI (WAL Mode), Secret Keys, AI Server URL
├── requirements.txt        # Flask, Flask-SQLAlchemy, Flask-JWT-Extended, requests, etc.
├── models/
│   ├── __init__.py         # SQLAlchemy DB Init + WAL Mode Pragma
│   ├── user.py             # User Model (id, username, email, password_hash)
│   ├── image.py            # Image Model (id, user_id, filename, prompt, model_used)
│   └── task.py             # Task Model (id, task_id, status, prompt, result_path)
├── routes/
│   ├── __init__.py
│   ├── auth.py             # POST /api/register, POST /api/login, POST /api/logout
│   ├── image.py            # POST /api/generate, POST /api/edit, GET /uploads/<filename>
│   └── task.py             # GET /api/task/:id, POST /api/callback (รับรูปจาก AI)
├── services/
│   ├── __init__.py
│   └── ai_client.py        # Asynchronous HTTP Client ส่งงานไป AI Server
├── uploads/                # ไดเรกทอรีเก็บไฟล์ภาพที่สร้างเสร็จแล้ว (.webp / .png)
└── database/
    └── luma.db             # ไฟล์ฐานข้อมูล SQLite (WAL Mode)
```

---

## 🧠 คำแนะนำและ Best Practices จากพี่ไอ (Iris)
1. **SQLite WAL Mode**:
   * ต้องเปิดโหมด `PRAGMA journal_mode=WAL;` เพื่อให้ Frontend ยิง Poll อ่านสถานะได้ต่อเนื่องโดยไม่ชนกับตอนที่ AI ยิง Callback มาเขียนข้อมูล (ป้องกันข้อผิดพลาด Database is locked)
2. **Static File Serving & Caching**:
   * เพิ่ม Header `Cache-Control: public, max-age=3600` เมื่อส่งไฟล์ภาพจากโฟลเดอร์ `uploads/` เพื่อลดภาระ CPU
3. **Internal Security (Shared Secret)**:
   * เมื่อส่งงานไปหา AI Server หรือรับ Callback ให้ตรวจสอบ Header `X-LUMA-INTERNAL-SECRET` เสมอ
4. **JWT Authentication**:
   * ตั้งอายุ Access Token ไว้ที่ 2 ชั่วโมง (หรือ 24 ชั่วโมงสำหรับช่วงทดสอบ)

---

## 🔌 API Endpoints ที่ต้องสร้าง
| Method | Endpoint | รายละเอียด |
|---|---|---|
| `POST` | `/api/register` | สมัครสมาชิกใหม่ (Hash รหัสผ่านด้วย Werkzeug) |
| `POST` | `/api/login` | เข้าสู่ระบบ และส่งกลับ JWT Token |
| `POST` | `/api/generate` | รับ Prompt, สร้าง Task Status: `pending`, ส่งงานต่อไปยัง AI Server |
| `POST` | `/api/edit` | รับ Image + Mask, สร้าง Task, ส่งต่อไปยัง AI Server |
| `GET` | `/api/task/<task_id>` | ส่งคืนสถานะงาน (`pending`, `processing`, `completed`, `failed`) |
| `POST` | `/api/callback` | AI Server ยิงส่งภาพ WebP Base64 กลับมาเพื่อบันทึกลง Disk และอัปเดต DB |
| `GET` | `/api/images` | ดึงรายการภาพทั้งหมดของผู้ใช้ |
| `GET` | `/api/health` | Health check สำหรับ DevOps ตรวจสอบสถานะ DB และ Service |
