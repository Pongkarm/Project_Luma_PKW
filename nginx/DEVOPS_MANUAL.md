# LUMA Image Processing Platform — คู่มือ DevOps & QA (คนที่ 4)
**วิชา:** Distributed System & Image Processing  
**บทบาท:** คนที่ 4 — QA / DevOps  
**หน้าที่:** ทดสอบระบบ (QA), เขียนคู่มือ (Manual), การติดตั้งระบบ (Deployment), แดชบอร์ดตรวจสอบ (Dashboard), การสำรองข้อมูล (Backup)  
**วันที่จัดทำ:** 5 ตุลาคม 2026  

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (Distributed System Architecture)

ระบบ LUMA ออกแบบตามหลักการ **Distributed Architecture (ระบบแบบกระจายตัว)** โดยแยกบทบาทหน้าที่ของอุปกรณ์คอมพิวเตอร์ออกเป็น 4 เครื่องที่ทำงานร่วมกันผ่านเครือข่ายวงแลน โดยมี **Nginx เป็น Reverse Proxy Gateway ด่านหน้าเพียงจุดเดียว**

```
                       Browser (ผู้ใช้งาน)
                               │ (พอร์ต 80)
                               ▼
                   [Node 1] Nginx Gateway
                        (172.20.10.9:80)
                               │
            ┌──────────────────┴──────────────────┐
            │ (Reverse Proxy Web)                 │ (Reverse Proxy API)
            ▼                                     ▼
   [Node 2] Frontend                     [Node 3] Backend
    (macOS: 172.20.10.8:5500)             (macOS: 172.20.10.6:8000)
    - Web UI (HTML/CSS/JS)                - FastAPI & SQLite Database
                                                  │
                                                  ▼ (Internal Inference Call)
                                         [Node 4] AI Server
                                      (Windows: 172.20.10.3:7860)
                                      - Stable Diffusion GPU (RTX 3070)
```

### ตารางแจกแจงอุปกรณ์และพอร์ตในเครือข่าย (Network Matrix)

| Node | เครื่อง / บทบาท | ระบบปฏิบัติการ | IP Address | Port | หน้าที่หลัก |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | **Nginx Gateway (ด่านหน้า)** | Windows | `172.20.10.9` | `80` | จุดรับ Traffic รวม, ทำ Reverse Proxy, คัดกรองความปลอดภัย, ดูดซับ CORS |
| **2** | **Frontend Client** | macOS | `172.20.10.8` | `5500` | ให้บริการหน้าเว็บ HTML5, CSS3, JavaScript (ไม่เปิดรับ Browser ตรง) |
| **3** | **Backend & Database** | macOS | `172.20.10.6` | `8000` | ประมวลผล Business Logic, ระบบสมาชิก, บันทึกฐานข้อมูล SQLite |
| **4** | **AI Inference Node** | Windows | `172.20.10.3` | `7860` | ประมวลผลโมเดล AI ด้วย GPU RTX 3070 (เสร็จแล้วส่งรูปกลับให้ Backend) |

---

## 2. คู่มือการติดตั้งและเปิดใช้งาน (Deployment Guide)

### 2.1 การเปิดใช้งาน Node 1: Nginx Gateway (เครื่อง DevOps)
1. เปิดโฟลเดอร์ `nginx` บนเครื่อง Windows
2. ดับเบิลคลิกไฟล์ **`run_nginx_with_logs.bat`** (หรือรัน `.\run_nginx.ps1` ใน PowerShell)
3. หน้าต่างดำจะเปิดขึ้นมาพร้อมแสดงสถานะ:
   ```text
   =====================================================
     [LUMA] Starting Nginx Server on Port 80
     [LUMA] Streaming LIVE Access Logs (Press Ctrl+C to stop)
   =====================================================
   ```
4. หากต้องการปิด ให้กด `Ctrl + C` หรือดับเบิลคลิก `stop_nginx.bat`

### 2.2 การเปิดใช้งาน Node 2: Frontend (macOS)
1. เปิด Terminal บน macOS เข้าโฟลเดอร์หน้าเว็บ:
   ```bash
   cd frontend-html
   ```
2. ตรวจสอบไฟล์ `js/config.js` บรรทัด 24 ให้เป็น:
   ```javascript
   const API_BASE_URL = '';
   ```
3. รันเว็บเซิร์ฟเวอร์:
   ```bash
   python3 -m http.server 5500
   ```

### 2.3 การเปิดใช้งาน Node 3: Backend (macOS)
1. เปิด Terminal บน macOS เข้าโฟลเดอร์โปรเจกต์:
   ```bash
   python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

### 2.4 การเปิดใช้งาน Node 4: AI Server (Windows)
1. ตรวจสอบให้เปิดเซิร์ฟเวอร์ AI พอร์ต 7860 ด้วยคำสั่ง:
   ```powershell
   python -m ai_server.run
   ```

### 2.5 การตั้งค่า Domain Name (`luma.local`) และการจำกัดสิทธิ์เฉพาะวงแลน
ระบบรองรับการเข้าถึงผ่านชื่อโดเมน `http://luma.local` โดยจำกัดสิทธิ์ให้เข้าได้เฉพาะอุปกรณ์ในวงแลนเดียวกัน (`172.20.10.0/24`) เท่านั้น:
* **เครื่อง Windows (เครื่องตัวเอง / เพื่อน):** คลิกขวาที่ไฟล์ **`nginx/setup_domain.bat`** แล้วเลือก *"Run as administrator"* ระบบจะบันทึก `172.20.10.9 luma.local` เข้าไฟล์ hosts ให้อัตโนมัติ
* **เครื่อง macOS (เพื่อน):** รันคำสั่ง `sudo nano /etc/hosts` แล้วเพิ่มบรรทัด:
  ```text
  172.20.10.9    luma.local
  ```
* **นโยบายความปลอดภัย:** หากมี IP นอกวงแลนพยายามเข้าใช้งาน Nginx จะปฏิเสธทันทีด้วยรหัส **HTTP 403 Forbidden**

---

## 3. คู่มือการทดสอบระบบ (QA & Verification)

ในฐานะ **QA (Quality Assurance)** มีชุดทดสอบอัตโนมัติ `test_distributed_system.py` ที่ตรวจสอบทั้ง 4 เครื่องแบบ End-to-End รวม 12 Test Cases

### วิธีรันชุดทดสอบ
* **วิธีที่ 1 (1-Click):** ดับเบิลคลิกที่ไฟล์ **`nginx/run_tests.bat`**
* **วิธีที่ 2 (Command Line):** 
  ```powershell
  python nginx/test_distributed_system.py
  ```

### ผลการทดสอบ (Test Results Report)

| Test ID | รายการทดสอบ | ผลลัพธ์ | รายละเอียดทางเทคนิค |
| :---: | :--- | :---: | :--- |
| **TC-01** | Nginx Gateway Port 80 | **PASS** | ตรวจสอบพอร์ต 80 ของ Nginx พร้อมรับคำขอ |
| **TC-02** | Frontend Server Port 5500 | **PASS** | พอร์ต 5500 ของเครื่อง Mac เปิดรับปกติ |
| **TC-03** | Backend Server Port 8000 | **PASS** | พอร์ต 8000 ของ FastAPI บน Mac พร้อมใช้งาน |
| **TC-04** | AI Server Port 7860 | **PASS** | พอร์ต 7860 ของเครื่อง Windows GPU พร้อมใช้งาน |
| **TC-05** | AI Node GPU Telemetry | **PASS** | ตรวจพบ NVIDIA RTX 3070 VRAM ว่าง 8.0 GB |
| **TC-06** | Backend & Database State | **PASS** | เชื่อมต่อ SQLite Database สำเร็จ (`status: healthy`) |
| **TC-07** | Frontend Static Assets | **PASS** | ดาวน์โหลดไฟล์ `login.html` ขนาด 4,735 bytes สำเร็จ |
| **TC-08** | Proxy -> Frontend Root (`/`) | **PASS** | Nginx ส่งต่อหน้าแรกได้ผลลัพธ์ HTTP 200 OK |
| **TC-09** | Proxy -> Frontend Page (`/login.html`) | **PASS** | Nginx ส่งต่อหน้าเข้าสู่ระบบได้ผลลัพธ์ HTTP 200 OK |
| **TC-10** | Proxy -> Backend API (`/healthz`) | **PASS** | Nginx ส่งต่อคำขอ API ได้ JSON กลับมาสมบูรณ์ |
| **TC-11** | Proxy -> Route Integrity (`/api/models`) | **PASS** | เส้นทาง `/api/` ส่งตรงเข้า Backend โดยไม่โดนตัด Path |
| **TC-12** | Gateway Routing Enforcement | **PASS** | ค่า `API_BASE_URL` ใน `config.js` บังคับผ่าน Nginx 100% |

**สรุปผล:** ผ่าน 12 จาก 12 การทดสอบ (**Pass Rate: 100.0%**)

---

## 4. แดชบอร์ดตรวจสอบระบบ (DevOps Monitoring Dashboard)

ระบบมีหน้าเว็บแดชบอร์ดตรวจสอบสถานะแบบ Real-time ให้ผู้ดูแลระบบและอาจารย์ดูได้ทันที:

* **URL เข้าดูแดชบอร์ด:**
  ```text
  http://172.20.10.9/dashboard.html
  # หรือ http://localhost/dashboard.html
  ```
* **ความปลอดภัย (Access Control):**
  * จำกัดสิทธิ์การเข้าถึง **เฉพาะเครื่อง Nginx (`172.20.10.9` และ `localhost`) เท่านั้น** โดยใช้คำสั่ง `allow/deny` ใน `nginx.conf`
  * หากเครื่องอื่นในวงแลน (เช่น Frontend Mac หรือเครื่องคนนอก) พยายามเปิดดู จะถูกปฏิเสธด้วย **`HTTP 403 Forbidden`** ทันที เพื่อความปลอดภัยของข้อมูลเซิร์ฟเวอร์
* **ฟีเจอร์ของแดชบอร์ด:**
  1. การ์ดสถานะของทั้ง 4 Node แบบสด (Nginx, Frontend, Backend, AI Server)
  2. ระบบตรวจจับสถานะอัตโนมัติทุกๆ 5 วินาที (Auto-polling)
  3. แสดงชื่อรุ่น GPU และสถานะฐานข้อมูล
  4. แสดงแผนผัง Data Flow Topology
  5. ปุ่ม Refresh และปุ่มเปิดแอป LUMA

---

## 5. การสำรองข้อมูลระบบ (Automated Backup & Disaster Recovery)

เพื่อป้องกันข้อมูลสูญหาย มีระบบสำรองข้อมูลอัตโนมัติแบบ 1-Click:

### วิธีสำรองข้อมูล
* **ดับเบิลคลิกที่:** **`nginx/run_backup.bat`**
* หรือรันคำสั่ง: `python nginx/backup_system.py`

### สิ่งที่ถูกสำรองลงในไฟล์ ZIP:
1. ไฟล์คอนฟิกของ Nginx ทั้งหมด (`conf/nginx.conf`, `conf/mime.types`)
2. ไฟล์บันทึกประวัติการเรียกใช้งาน (`logs/access.log`, `logs/error.log`)
3. ไฟล์หน้าเว็บแดชบอร์ด (`dashboard.html`)
4. สคริปต์ชุดทดสอบระบบ (`test_distributed_system.py`)
5. สแนปช็อตสถานะคลัสเตอร์ ณ วินาทีที่สำรอง (`cluster_snapshot.json`)
6. ฐานข้อมูลระบบ (หากมีในเครื่อง)

ไฟล์สำรองจะถูกบีบอัดและตั้งชื่อตามวันเวลา เช่น:
`nginx/backups/LUMA_BACKUP_YYYYMMDD_HHMMSS.zip` พร้อมคำนวณ **SHA-256 Checksum** เพื่อยืนยันความถูกต้องของข้อมูล

---

## 6. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting & FAQs)

| ปัญหา | สาเหตุ | วิธีแก้ไข |
| :--- | :--- | :--- |
| เครื่องอื่นเข้า `172.20.10.9` ไม่ได้ | เบราว์เซอร์บน Mac เผลอเติม `https://` | พิมพ์ `http://172.20.10.9` ให้มี `http://` ชัดเจน |
| คำขอสร้างภาพไม่ขึ้นใน Log Nginx | `config.js` บน Frontend ยังชี้ไปที่ Backend ตรง | แก้ `const API_BASE_URL = '';` บนเครื่อง Frontend |
| เครื่อง Mac หลุดการเชื่อมต่อ | Mac พับฝาหรือหน้าจอดับ (Sleep Mode) | ปลุกหน้าจอ Mac ขึ้นมา และตรวจว่ายังต่อ Wi-Fi เดียวกัน |
| Nginx พอร์ต 80 ถูกใช้งานโดยระบบอื่น | มี IIS หรือ Windows World Wide Web เปิดอยู่ | รัน `Stop-Service W3SVC` ใน PowerShell แล้วรัน Nginx ใหม่ |
