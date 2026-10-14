# 📋 Test Case Specification: DevOps & Nginx Gateway (Node 1)

> **สายงาน:** DevOps, Infrastructure & QA  
> **ผู้รับผิดชอบหลัก:** [@bankjunjan](https://github.com/bankjunjan)  
> **อุปกรณ์เป้าหมาย (Node 1):** Windows Gateway (`10.23.130.212:80`)  
> **เทคโนโลยีหลัก:** Nginx 1.26, PowerShell 7, Python 3.11, Automated Shell Scripts, Win32 TCP/ICMP Telemetry  
> **เป้าหมาย:** ตรวจสอบการทำ Reverse Proxy, Network Security, Access Whitelist, Backup อัตโนมัติ และเสถียรภาพของเกตเวย์

---

## 📊 สรุปผลการทดสอบ (Executive Test Summary)

| กลุ่มการทดสอบ (Test Category) | จำนวนเคส | ผ่าน (PASS) | ล้มเหลว (FAIL) | อัตราความสำเร็จ |
| :--- | :---: | :---: | :---: | :---: |
| 1. Network Layer Reachability (Ping ICMP) | 4 | 4 | 0 | 100% |
| 2. TCP Port Handshake & Socket Readiness | 4 | 4 | 0 | 100% |
| 3. Direct Node Healthcheck & Telemetry | 3 | 3 | 0 | 100% |
| 4. Nginx Reverse Proxy Routing & URL Integrity | 4 | 4 | 0 | 100% |
| 5. Security Access Control & IP Whitelisting | 3 | 3 | 0 | 100% |
| 6. Automated Backup & SHA-256 Checksum | 2 | 2 | 0 | 100% |
| **รวมทั้งหมด** | **20** | **20** | **0** | **100% 🏆** |

---

## 📝 รายละเอียดตาราง Test Cases (Detailed Test Specifications)

### หมวดที่ 1: การเชื่อมต่อระดับเครือข่าย (Network Reachability)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-001** | ตรวจสอบการ Ping ไปยัง AI Node | AI Node เปิดอยู่ที่ `10.23.130.112` | ส่ง ICMP Echo Request ขนาด 32 bytes (Timeout 500ms) | ได้รับ ICMP Echo Reply, Packet Loss = 0% | **PASS** |
| **TC-DEV-002** | ตรวจสอบการ Ping ไปยัง Backend Node | Backend Node เปิดอยู่ที่ `10.23.130.9` | ส่ง ICMP Echo Request ขนาด 32 bytes (Timeout 500ms) | ได้รับ ICMP Echo Reply, Packet Loss = 0% | **PASS** |
| **TC-DEV-003** | ตรวจสอบการ Ping ไปยัง Frontend Node | Frontend Node เปิดอยู่ที่ `10.23.130.6` | ส่ง ICMP Echo Request ขนาด 32 bytes (Timeout 500ms) | ได้รับ ICMP Echo Reply, Packet Loss = 0% | **PASS** |
| **TC-DEV-004** | ตรวจสอบ Nginx Gateway Loopback & Interface | Local Gateway IP: `10.23.130.212` | ส่ง ICMP Echo Request เข้าหา IP การ์ด LAN ตัวเอง | ได้รับ Reply ทันที (Latency < 1ms) | **PASS** |

### หมวดที่ 2: ความพร้อมของพอร์ตบริการ (TCP Port Handshake)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-005** | ตรวจสอบพอร์ต 80 ของ Nginx Gateway | Nginx รันอยู่บนเครื่อง Gateway | ทำ TCP 3-Way Handshake ไปที่ `127.0.0.1:80` | Socket เชื่อมต่อสำเร็จ (TCP SYN-ACK) | **PASS** |
| **TC-DEV-006** | ตรวจสอบพอร์ต 5500 ของ Frontend Web Server | Frontend Python Server รันอยู่ | ทำ TCP Handshake ไปที่ `10.23.130.6:5500` | Socket เชื่อมต่อสำเร็จภายใน 1 วินาที | **PASS** |
| **TC-DEV-007** | ตรวจสอบพอร์ต 8000 ของ Backend FastAPI Server | Backend Uvicorn รันอยู่ | ทำ TCP Handshake ไปที่ `10.23.130.9:8000` | Socket เชื่อมต่อสำเร็จภายใน 1 วินาที | **PASS** |
| **TC-DEV-008** | ตรวจสอบพอร์ต 7860 ของ AI Server Inference | AI Server Uvicorn รันอยู่ | ทำ TCP Handshake ไปที่ `10.23.130.112:7860` | Socket เชื่อมต่อสำเร็จภายใน 1 วินาที | **PASS** |

### หมวดที่ 3: สุขภาพของแต่ละโหนดโดยตรง (Direct Node Healthcheck)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-009** | ตรวจสอบ Telemetry สถานะ AI Node | AI Node พอร์ต 7860 ทำงาน | เรียก `GET http://10.23.130.112:7860/ai/health` | HTTP 200, `status="online"`, แสดงชื่อ GPU และ VRAM Free | **PASS** |
| **TC-DEV-010** | ตรวจสอบสุขภาพ Backend และฐานข้อมูล | Backend พอร์ต 8000 ทำงาน | เรียก `GET http://10.23.130.9:8000/healthz` | HTTP 200, `status="healthy"`, `database="connected"` | **PASS** |
| **TC-DEV-011** | ตรวจสอบการให้บริการ Static Asset ของ Frontend | Frontend พอร์ต 5500 ทำงาน | เรียก `GET http://10.23.130.6:5500/login.html` | HTTP 200, Header `Content-Type: text/html`, มีแท็ก `<html>` | **PASS** |

### หมวดที่ 4: การทำงานของ Nginx Reverse Proxy (Gateway Routing)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-012** | ส่งต่อคำขอหน้าเว็บหลัก (Root `/`) | ผู้ใช้เรียก `http://10.23.130.212/` | Nginx ส่งต่อ request ไปยัง Frontend `:5500` | HTTP 200, ได้รับหน้า `index.html` ของระบบ LUMA | **PASS** |
| **TC-DEV-013** | ส่งต่อคำขอหน้าย่อย (`/login.html`, `/admin.html`) | ผู้ใช้เรียกหน้าผ่าน Gateway | Nginx Match location และ proxy_pass ไป Frontend | HTTP 200 ทั้งสองหน้าโดย URL บน Browser ไม่เปลี่ยน | **PASS** |
| **TC-DEV-014** | ส่งต่อคำขอ Backend Healthcheck (`/healthz`) | เรียก `http://10.23.130.212/healthz` | Nginx ส่งต่อ request ไปยัง Backend `:8000` | HTTP 200, JSON คืนค่า `status="healthy"` | **PASS** |
| **TC-DEV-015** | ส่งต่อคำขอ API Router Prefix (`/api/*`, `/auth/*`) | เรียก `GET http://10.23.130.212/api/models` | Nginx ส่งต่อเข้า Backend Router โดยรักษา Headers | ตอบกลับ HTTP 200 หรือ 401 (ตาม Auth State) ชี้ว่า Route ถึง Backend | **PASS** |

### หมวดที่ 5: ความปลอดภัยและการจำกัดสิทธิ์ (Security & Access Control)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-016** | การบล็อก IP ภายนอกวงแลน (Subnet Isolation) | จำลอง Request มาจาก IP นอก `10.23.130.0/24` | ยิง HTTP Request เข้า Gateway พอร์ต 80 | Nginx ปฏิเสธคำขอด้วย **HTTP 403 Forbidden** ทันที | **PASS** |
| **TC-DEV-017** | การป้องกันหน้า Dashboard เฉพาะ Gateway IP | เรียก `/dashboard` จากเครื่องอื่นในวงแลน | ยิง `GET http://10.23.130.212/dashboard` จาก Node อื่น | ตอบกลับ **HTTP 403 Forbidden** ตาม Security Whitelist | **PASS** |
| **TC-DEV-018** | การอนุญาต Dashboard จากเครื่อง Gateway เท่านั้น | เปิด Browser บนเครื่อง Gateway เอง | เข้า `http://localhost/dashboard` หรือ `10.23.130.212/dashboard` | HTTP 200 OK แสดงหน้า DevOps Monitoring Console | **PASS** |

### หมวดที่ 6: การสำรองข้อมูลและการกู้คืน (Backup & Integrity)

| Test ID | รายละเอียดการทดสอบ | สิ่งที่นำเข้า / เงื่อนไขเริ่มต้น | ขั้นตอนการทดสอบ (Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) | สถานะ |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-DEV-019** | สร้างไฟล์สำรองข้อมูลแบบบีบอัดอัตโนมัติ | สั่งรัน `nginx/backup_system.py` | สคริปต์รวบรวม Configuration, Database, Nginx Logs | สร้างไฟล์ `nginx/backups/LUMA_BACKUP_*.zip` สำเร็จ | **PASS** |
| **TC-DEV-020** | คำนวณและตรวจสอบ SHA-256 Checksum ของไฟล์ Backup | ไฟล์ Zip สำรองข้อมูลถูกสร้าง | สคริปต์อ่านไบนารีและประมวลผล SHA-256 Hash | ได้รหัส Hash 64 ตัวอักษร สำหรับตรวจสอบความถูกต้องของไฟล์ | **PASS** |

---

## 🚀 วิธีการสั่งรันชุดทดสอบนี้ (Execution Guide)

### รันผ่านไฟล์สคริปต์อัตโนมัติ (Batch File):
```cmd
TestCases\01_DevOps_Gateway\run_devops_tests.bat
```

### รันผ่าน PowerShell Console:
```powershell
powershell -ExecutionPolicy Bypass -File nginx/test_distributed_system.ps1
```

### รันผ่าน Python Runner:
```bash
python nginx/test_distributed_system.py
```
