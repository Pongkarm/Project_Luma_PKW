# 🛠️ LUMA System Incident Log & Troubleshooting Guide

**เอกสารบันทึกปัญหา การวิเคราะห์สาเหตุเชิงลึก (Root Cause Analysis) และแนวทางการแก้ไข**  
**โหนด:** Node 3 (AI Inference Node — PC3) & Multi-Node Integration  
**ผู้บันทึก:** นายอภิสักก์ คงภักดี (AI Engineer)  
**วันที่บันทึก:** 14 กันยายน 2026  

---

## 📌 สรุปภาพรวมของปัญหาที่พบและแก้ไขแล้ว (Incident Matrix)

| Incident ID | ปัญหาที่พบ (Symptom) | สาเหตุทางเทคนิค (Root Cause) | แนวทางการแก้ไข (Resolution) | ผลลัพธ์ (Outcome) |
|---|---|---|---|---|
| **INC-01** | Uvicorn รันบน `127.0.0.1:8000` แทนที่จะเป็น `0.0.0.0:7860` ทำให้เครื่องภายนอกต่อไม่ได้ | เครื่องหมาย `\` ต่อท้าย `%~dp0` ใน Batch File หลุดไป Escape เครื่องหมายคำพูด `\"` ทำให้ argument `--host 0.0.0.0 --port 7860` ถูกเพิกเฉย | ปรับ `start_ai_server.bat` ให้เรียกผ่านโมดูล `python -m ai_server.run` เพื่อดึงคอนฟิกจาก `AIConfig` โดยตรง | Uvicorn บายด์ที่ `0.0.0.0:7860` ถูกต้อง 100% |
| **INC-02** | Backend แจ้งเตือน `Failed to submit task to AI Server` (ต่อ IP ไม่ติด) | การสลับวง Wi-Fi/Hotspot (จากวงมหาลัย `10.170.62.x` เป็น Hotspot `172.20.10.x`) ทำให้ DHCP จ่าย IP ใหม่ แต่คอนฟิกใน `.env` ยังเป็น IP เดิม | สร้างกระบวนการตรวจสอบ IP อินเทอร์เฟซ (`ipconfig` / `ipconfig getifaddr en0`) และอัปเดต `.env` ให้ตรงกัน | เครือข่ายเชื่อมต่อถึงกันและตอบสนอง Healthcheck ได้ปกติ |
| **INC-03** | AI Node ไม่สามารถส่ง Webhook Callback กลับไปยัง Backend บนเครื่อง Mac ได้ | Uvicorn บน macOS ของ Backend รันด้วยค่า Default ที่ผูกกับ `127.0.0.1` จึงปฏิเสธ Packet ที่มาจากภายนอกวง Loopback | กำหนดให้ Backend ต้องระบุ Flag `--host 0.0.0.0` ทุกครั้งที่รันเซิร์ฟเวอร์ | AI Node สามารถยิง Callback ส่งรูปภาพ Base64 กลับเข้า Backend ได้สำเร็จ |
| **INC-04** | AI Server ปฏิเสธ Request จาก Backend ด้วยสถานะ `HTTP 403 Forbidden` | ค่า Header `X-LUMA-INTERNAL-SECRET` ไม่ตรงกัน หรือฝั่ง Backend ยังไม่ได้โหลดค่าคอนฟิกล่าสุดจาก `.env` เข้าสู่ Memory | ซิงค์ค่า Secret Token 64 ตัวอักษรให้ตรงกันทั้งสองฝั่ง และทำการ Restart Uvicorn บน Backend | การเรียกใช้งานผ่าน Security Handshake ได้รับ `202 Accepted` พร้อมรัน GPU ทันที |

---

## 🔍 รายละเอียดการวิเคราะห์ปัญหาเชิงลึก (Detailed Root Cause Analysis)

### 1. Incident 01: Windows CLI Batch Escaping Bug ในไฟล์ `start_ai_server.bat`
* **อาการ:** เมื่อดับเบิลคลิก `start_ai_server.bat` พบข้อความในหน้าต่างคอนโซลระบุ:
  ```text
  Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
  ```
  ทั้งที่ Banner แสดงผลด้านบนแจ้งว่าจะเริ่มที่พอร์ต 7860 ส่งผลให้เครื่องภายนอกไม่สามารถเข้าถึงได้ และเกิด Port Conflict หากมีโปรเซสอื่นใช้งานพอร์ต 8000 อยู่
* **การวิเคราะห์หาสาเหตุ (RCA):**
  ในไฟล์ Batch เดิม มีคำสั่ง:
  ```cmd
  "%PYTHON_EXEC%" -m uvicorn ai_server.server:app --app-dir "%~dp0" --host 0.0.0.0 --port 7860 --reload
  ```
  ตัวแปร `%~dp0` ใน Windows Command Prompt จะคืนค่า Path ที่ลงท้ายด้วย Backslash เสมอ (เช่น `D:\...\Project_Luma_PKW\`) เมื่อครอบด้วย Double Quotes กลายเป็น `"%~dp0"` ซึ่งขยายเป็น `"...\""`  
  ในมาตรฐาน C/C++ และ Python Command-Line Parser สัญลักษณ์ `\"` ถูกตีความเป็น **Escaped Quote** (อักขระคำพูดตัวอักษรธรรมดา ไม่ใช่ตัวปิด String) ส่งผลให้ Parser รวม argument ถัดไปทั้งหมด (`--host 0.0.0.0 --port 7860 --reload`) เข้าไปเป็นส่วนหนึ่งของสตริง `--app-dir` ทำให้ Uvicorn ตกกลับไปใช้ค่า Default คือ Host: `127.0.0.1` และ Port: `8000`
* **การแก้ไข:**
  ทำการตัดความซับซ้อนของการส่ง Flags ผ่าน Batch Script โดยเปลี่ยนให้เรียกใช้งานโมดูล Python กลางของโปรเจกต์:
  ```cmd
  "%PYTHON_EXEC%" -m ai_server.run
  ```
  ซึ่งภายในไฟล์ `ai_server/run.py` ได้เขียนตรรกะการ Resolve `PROJECT_ROOT` และดึงค่า `AIConfig.HOST` (`0.0.0.0`) กับ `AIConfig.PORT` (`7860`) ไว้อย่างถูกต้องแล้ว

---

### 2. Incident 02: Dynamic Subnet Migration & Multi-Node LAN Routing
* **อาการ:** Backend ของ Pongkarm พยายามยิงมาที่ AI Node แต่เกิด Connection Timeout หรือ Unreachable Host:
  ```text
  Failed to submit task to AI Server: http://172.20.10.2:7860/ai/generate
  ```
* **การวิเคราะห์หาสาเหตุ (RCA):**
  ในสภาพแวดล้อมการพัฒนา มีการสลับเครือข่ายระหว่าง Wi-Fi สถาบัน (Subnet `10.170.62.0/24`) กับ Personal Hotspot (Subnet `172.20.10.0/28`) ส่งผลให้อุปกรณ์แต่ละเครื่องได้รับการแจก IP Address ใหม่ผ่าน DHCP แบบ Dynamic เช่น:
  - เครื่อง AI Node เปลี่ยนจาก `10.170.62.113` เป็น `172.20.10.3`
  - เครื่อง Backend (Mac) ได้รับ IP `172.20.10.6`
  การที่ไฟล์ `.env` ของแต่ละเครื่องยังคงบันทึก Hardcoded IP เดิม ทำให้แพ็กเก็ตไม่ถูกส่งไปยังปลายทางที่ถูกต้อง
* **การแก้ไข:**
  1. จัดทำคำสั่งมาตรฐานเพื่อตรวจสอบ IP ปัจจุบัน:
     - Windows (AI Node): `Get-NetIPAddress -AddressFamily IPv4`
     - macOS (Backend): `ipconfig getifaddr en0`
  2. อัปเดตไฟล์คอนฟิกให้ตรงกันตามวงเครือข่ายปัจจุบัน:
     - ฝั่ง Backend `.env`: `AI_SERVER_CALLBACK_URL=http://172.20.10.3:7860/ai/generate`
     - ฝั่ง AI Server `.env`: `BACKEND_CALLBACK_URL=http://172.20.10.6:8000/api/callback`

---

### 3. Incident 03: macOS Backend Binding and Webhook Ingress
* **อาการ:** AI Server รันงานประมวลผลบนการ์ดจอ RTX 3070 สำเร็จ แต่เมื่อยิง Webhook Callback กลับไปที่ `http://172.20.10.6:8000/api/callback` เกิดข้อผิดพลาด Connection Refused หรือ Timeout
* **การวิเคราะห์หาสาเหตุ (RCA):**
  คำสั่งรัน Uvicorn พื้นฐานโดยทั่วไปหากไม่ระบุพารามิเตอร์ `--host` หรือระบุเป็น `127.0.0.1` จะยอมรับการเชื่อมต่อเฉพาะ Loopback Interface ภายในเครื่อง Mac เท่านั้น ปฏิเสธ Packet ขาเข้าที่มาจากเครื่อง AI Node ข้ามเครือข่าย Wi-Fi/Hotspot
* **การแก้ไข:**
  บังคับใช้คำสั่งรันเซิร์ฟเวอร์แบบ Listen All Interfaces บนเครื่อง Mac:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```
  พร้อมตรวจสอบการอนุญาต Firewall ใน macOS System Settings ให้ Process ของ Python รับการเชื่อมต่อขาเข้าได้

---

### 4. Incident 04: HTTP 403 Forbidden Security Handshake Mismatch
* **อาการ:** ในบันทึกของ AI Server แสดงข้อผิดพลาด:
  ```text
  INFO: 172.20.10.6:54738 - "POST /ai/generate HTTP/1.1" 403 Forbidden
  ```
  และ Client ได้รับ JSON ตอบกลับ:
  ```json
  {"detail": "Invalid or missing X-LUMA-INTERNAL-SECRET header"}
  ```
* **การวิเคราะห์หาสาเหตุ (RCA):**
  ฟังก์ชัน `verify_internal_secret()` ใน `ai_server/server.py` ตรวจสอบความถูกต้องของ Header `X-LUMA-INTERNAL-SECRET` ที่ส่งมาจาก Backend โดยเปรียบเทียบกับตัวแปร `LUMA_INTERNAL_SECRET`  
  สาเหตุเกิดจากฝั่ง Backend มีการบันทึกค่าใน `.env` ไม่ตรงกัน หรือมีการแก้ไขไฟล์ `.env` แต่กระบวนการรันของ Uvicorn ยังไม่ได้ถูก Restart ทำให้ Settings Instance ในหน่วยความจำยังคงเก็บค่าเดิมที่เป็นค่าเก่า
* **การแก้ไข:**
  1. นำ Token ความปลอดภัยที่มีความยาวและ Entropy สูง (สร้างด้วย `secrets.token_urlsafe(48)`):
     `YezuuiiLZOo_IXyz25aVqdNlaDdJhAbLC4oXTMN0BZ8Pj0azVhPILJ493qFcnX9D`
     ไประบุให้ตรงกันเป๊ะใน:
     - `ai_server/.env` -> `LUMA_INTERNAL_SECRET`
     - Backend `.env` -> `AI_CALLBACK_SECRET`
  2. ทำการปิดและเริ่มรัน Uvicorn บน Backend ใหม่เพื่อโหลด Environment Variables เข้าสู่ Process
  3. ทดสอบยิง Request อีกครั้ง ผลปรากฏว่าได้รับสถานะ `202 Accepted` และเริ่มประมวลผลเข้าคิวได้ทันที
