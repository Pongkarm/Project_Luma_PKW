# 🚀 คนที่ 4: QA / DevOps Engineer & Nginx Reverse Proxy (PC1 & All PCs)

## 📌 บทบาทและความรับผิดชอบ
รับผิดชอบการติดตั้งและคอนฟิก Nginx Reverse Proxy บน PC1, จัดการระบบเครือข่าย LAN (IP, Subnet, Firewall), เขียนชุดทดสอบอัตโนมัติ (pytest, Postman Collections, Locust Load Testing), ดูแล Health Monitoring Dashboard และเตรียมแผนสำรองฉุกเฉิน (Disaster Recovery & Demo Kit)

---

## 📁 โครงสร้างไฟล์ใน `devops/`
```
devops/
├── nginx/
│   └── nginx.conf              # Nginx Reverse Proxy Config (Timeout 300s, Caching, Gzip)
├── tests/
│   ├── locustfile.py           # สคริปต์ Load Testing (70% Viewer, 20% Creator, 10% Auth)
│   ├── test_auth.py            # Unit Test สำหรับ Auth API
│   ├── test_image_api.py       # Unit Test สำหรับ Image & Task API
│   └── test_integration.py     # End-to-End Test (FE -> Nginx -> BE -> AI -> Callback)
├── deploy/
│   ├── health_check.ps1        # ตรวจสอบสถานะทุก Service บนวง LAN
│   ├── deploy_frontend.ps1     # สคริปต์ Deploy ไฟล์หน้าเว็บ
│   └── backup_db.ps1           # สคริปต์สำรองฐานข้อมูล SQLite และ Uploads
└── docs/
    ├── RUNBOOK.md              # คู่มือฉุกเฉินวัน Demo (Emergency Runbook)
    └── network_topology.md     # ตาราง IP Address, Port Matrix และ Firewall Rules
```

---

## 🌐 Network & Firewall Matrix
| Node / Role | IP Address | Port | Protocol | หน้าที่ |
|---|---|---|---|---|
| **PC1 (Frontend + Nginx)** | `192.168.1.10` | **80** | HTTP | Gateway หน้าด่าน & Static Files |
| **PC2 (Flask Backend + DB)**| `192.168.1.20` | **5000** | HTTP | REST API & SQLite Database |
| **PC3 (AI Server + GPU)**   | `192.168.1.30` | **7860** | HTTP | FastAPI & Stable Diffusion Inference |
| **ทุกเครื่อง (Management)**  | All | **22** | SSH | Remote Deploy & File Sync |

---

## 🛠️ คำแนะนำสำคัญจากพี่ไอ (Iris) สำหรับวัน Demo
1. **Nginx Tuning**:
   * ตั้งค่า `client_max_body_size 50M;`
   * แยก Timeout: API ทั่วไป `proxy_read_timeout 30s;` ส่วน AI Generation `proxy_read_timeout 300s;`
   * ปิด Buffering สำหรับ AI Generation (`proxy_buffering off;`)
2. **Locust Load Testing (70:20:10 Ratio)**:
   * จำลอง Gallery User (70%), Creator User (20%), และ Auth User (10%)
   * ทดสอบระดับ Smoke (10 users) -> Normal (50 users) -> Peak (100 users)
3. **3-Layer Demo Kit (แผนรับมือวันพรีเซนต์)**:
   * **Layer 1 (Live LAN)**: รันสดบนวง LAN 3-4 เครื่อง
   * **Layer 2 (Degraded)**: Pre-generate รูปตัวอย่าง 10-20 รูปเก็บไว้ในระบบ สำหรับกดแสดงผลหรือ Inpainting ได้ทันทีไม่ต้องรอ GPU
   * **Layer 3 (Backup)**: บันทึกวิดีโอ Screen Recording การทำงานครบทุก Flow (3 นาที) และเตรียมสไลด์ Architecture ไว้ใน USB Drive
