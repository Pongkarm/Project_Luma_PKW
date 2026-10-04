# LUMA Frontend — เวอร์ชัน HTML

หน้าเว็บของ LUMA ที่เขียนด้วย **HTML + CSS + JavaScript ธรรมดา** ไม่มีเฟรมเวิร์ก ไม่ต้องติดตั้งอะไร
และไม่ต้อง build หน้าตาและการใช้งานยกมาจากเวอร์ชัน React เดิม เพราะใช้ไฟล์ CSS ชุดเดียวกัน
และโครง HTML ใช้ชื่อ class เดียวกับที่ React สร้าง

> ทีมตกลงใช้เวอร์ชัน HTML นี้ เวอร์ชัน React (โฟลเดอร์ `frontend/`) จึงถูกลบออกแล้ว
> ดูโค้ดเดิมได้ที่ commit `0a78911` เช่น `git show 0a78911:frontend/src/main.tsx`

## วิธีเปิด

1. แก้ที่อยู่ backend ใน `js/config.js` บรรทัดเดียว:

   ```js
   const API_BASE_URL = 'http://localhost:8000';       // backend ในเครื่องตัวเอง
   // const API_BASE_URL = 'http://172.20.10.6:8000';  // backend ของเพื่อน (ใส่ IP ปัจจุบันของเขา)
   ```

2. เปิดเว็บเซิร์ฟเวอร์ในโฟลเดอร์นี้:

   ```bash
   cd frontend-html
   python3 -m http.server 5500      # หรือ npm start
   ```

3. เปิด **http://localhost:5500** (เครื่องอื่นในวงเดียวกันใช้ `http://<IP เครื่องนี้>:5500`)

> ใช้ VS Code ส่วนขยาย Live Server แทนข้อ 2 ก็ได้ ส่วนการดับเบิลคลิกเปิดไฟล์ตรง ๆ (`file://`)
> ไม่แนะนำ เพราะเบราว์เซอร์บางตัวจำกัดการเรียก API จากไฟล์ในเครื่อง

## โครงสร้างไฟล์

```
frontend-html/
├── index.html          หน้าแรก — พาไปหน้าล็อกอินหรือหน้าสร้างภาพ
├── login.html          เข้าสู่ระบบ
├── register.html       สมัครบัญชี
├── generate.html       สร้างภาพ 3 โหมด: ข้อความ, จากภาพ, แก้เฉพาะจุด
├── studio.html         สตูดิโอ: ลายเส้น, เน้นสี, ท่าทาง, ตัดฉาก
├── history.html        ประวัติงานทั้งหมด + แผงรายละเอียด
├── account.html        โปรไฟล์, ธีม, ออกจากระบบ
├── admin.html          แผงแอดมิน (เห็นเฉพาะบัญชีที่มีสิทธิ์)
│
├── css/
│   ├── tokens.css      สี ขนาดตัวอักษร ระยะห่าง (ธีมมืด/สว่าง)  ┐ คัดลอกมาจาก
│   ├── base.css        ค่าพื้นฐานของทั้งหน้า                     │ frontend/src/shared/styles/
│   ├── ui.css          ปุ่ม ช่องกรอก แถบเลื่อน กล่องแจ้งเตือน     │ แล้วตัด class ที่เวอร์ชัน HTML
│   ├── layout.css      โครงหน้า + ขนาดจอต่าง ๆ (responsive)       │ ไม่ได้ใช้ออก (กฎที่เหลือไม่ได้แก้)
│   ├── studio.css      ส่วนของสตูดิโอ                           ┘
│   └── extra.css       ส่วนเสริมของเวอร์ชัน HTML: class ช่วยจัดหน้า (.stack .inline .text-meta …)
│                       และหน้าตาเฉพาะส่วน — ใช้แทนการเขียน style="..." ในโค้ด
│
└── js/
    ├── config.js       ที่อยู่ backend, ขอบเขตค่าต่าง ๆ, ขนาดเริ่มต้น, จำนวนต่อหน้า, รายชื่อโมเดลสำรอง
    ├── theme.js        ตั้งธีมก่อนหน้าแสดงผล (โหลดใน <head> ก่อน CSS)
    ├── start.js        หน้าแรก: ส่งไปหน้าล็อกอินหรือหน้าสร้างภาพ
    ├── icons.js        ไอคอนทั้งหมด (SVG)
    ├── api.js          ทุกการเรียก backend: แนบ token, อัปโหลดไฟล์, แปลง error เป็นภาษาไทย
    ├── ui.js           ฟังก์ชันช่วย: $(), escapeHtml, วันที่, ป้ายสถานะ, กล่องแจ้งเตือน, toast,
    │                   อ่านข้อมูลส่งต่อข้ามหน้า (takeSessionJson)
    ├── widgets.js      ชิ้นส่วนใช้ซ้ำ: เงื่อนไขรหัสผ่าน, หน้าต่างยืนยัน, ดูภาพเต็ม, แถบเลื่อน, ปุ่มพับ/กาง
    ├── layout.js       แถบบน + เมนูซ้าย + แถบล่างบนมือถือ, กันคนไม่ล็อกอิน, ธีม
    ├── mask.js         ตัวระบาย mask (วาดลง canvas, ส่งออกเป็นภาพขาวดำ)
    ├── login.js, register.js, account.js     หน้าเล็ก — ไฟล์เดียวต่อหน้า
    │
    ├── generate/       หน้าสร้างภาพ (หน้าใหญ่สุด จึงแบ่งตามหน้าที่)
    │   ├── state.js        ข้อมูลกลาง + คำนวณขนาดภาพ (มีแผนผังของทั้งโฟลเดอร์อยู่ด้านบน)
    │   ├── families.js     ตระกูลของโมเดล และ LoRA ที่ใช้คู่กันได้
    │   ├── settings.js     แผงขวา: โมเดล ขนาด แถบเลื่อน
    │   ├── draft.js        โหมด + บันทึกร่าง + ปุ่มสร้างภาพ
    │   ├── source.js       ภาพต้นฉบับ: อัปโหลด ลากวาง รับภาพจากหน้าอื่น
    │   ├── stage.js        ตรงกลาง: ว่าง / กำลังสร้าง / ผลลัพธ์ / แต่งด่วน
    │   ├── run.js          ส่งงาน + ติดตามสถานะ + หยุด/ลบ/ใช้ต่อ
    │   ├── recent.js       แถบงานล่าสุด
    │   ├── mask-tools.js   แถบเครื่องมือระบาย + คีย์ลัด
    │   └── main.js         เริ่มทำงาน: ผูกปุ่มทั้งหมด
    ├── studio/         state.js · view.js · tools.js · main.js
    ├── history/        list.js · detail.js · main.js
    └── admin/          overview.js · users.js · audit.js · admins.js · main.js

tests/                  ชุดทดสอบอัตโนมัติ (ดูหัวข้อ "การทดสอบ")
package.json            คำสั่ง npm test / npm start (ไม่มีแพ็กเกจให้ติดตั้ง)
```

ทุกไฟล์มีคอมเมนต์ด้านบนบอกว่าไฟล์นั้นทำอะไร มีฟังก์ชันอะไร และเชื่อมกับไฟล์ไหน/endpoint ไหนของ backend
ไม่มีไฟล์ไหนยาวเกินประมาณ 260 บรรทัด (รวมคอมเมนต์)

ทุกหน้าโหลดสคริปต์เรียงกันแบบนี้ ไฟล์หลังใช้ฟังก์ชันของไฟล์ก่อนหน้าได้
และไฟล์ `main.js` ของแต่ละหน้าต้องอยู่ท้ายสุด เพราะเป็นตัวสั่งเริ่มทำงาน:

```html
<script src="js/config.js"></script>      <!-- ค่าตั้งต้น -->
<script src="js/icons.js"></script>       <!-- ไอคอน -->
<script src="js/api.js"></script>         <!-- คุยกับ backend -->
<script src="js/ui.js"></script>          <!-- ฟังก์ชันช่วย -->
<script src="js/widgets.js"></script>     <!-- ชิ้นส่วนใช้ซ้ำ -->
<script src="js/layout.js"></script>      <!-- โครงหน้า -->
<script src="js/history/list.js"></script>
<script src="js/history/detail.js"></script>
<script src="js/history/main.js"></script> <!-- เริ่มทำงาน — ท้ายสุดเสมอ -->
```

### ไอคอน

เขียนแท็กว่างใน HTML แล้ว `icons.js` จะเปลี่ยนเป็นรูปให้เอง:

```html
<i data-icon="trash" data-size="14"></i>
```

ใน JavaScript ใช้ฟังก์ชัน `icon('trash', 14)` ซึ่งคืนโค้ด SVG เป็นข้อความ

## การทดสอบ

มีชุดทดสอบอัตโนมัติ 4 ชุดในโฟลเดอร์ `tests/` ใช้แค่ Node.js 22 ขึ้นไป กับ Google Chrome
ไม่ต้องติดตั้งแพ็กเกจเพิ่ม (`npm install` ไม่จำเป็น)

| คำสั่ง (รันในโฟลเดอร์ `frontend-html`) | ตรวจอะไร | เวลา |
|---|---|---|
| `npm run test:unit` | ฟังก์ชันคำนวณล้วน ๆ 14 ข้อ: ขนาดภาพ, ตระกูลโมเดลกับ LoRA, ข้อความ error, escapeHtml, เงื่อนไขรหัสผ่าน — **ไม่ต้องเปิด backend หรือ Chrome** | < 1 วินาที |
| `npm test` | ใช้งานจริงทุกหน้า 27 ขั้น: ล็อกอิน, สร้างภาพ 3 โหมด, กรอง LoRA ตามโมเดล, ระบาย mask, แต่งด่วน, ประวัติ, สตูดิโอ 4 เครื่องมือ, บัญชี, แอดมิน, สมัคร, token หมดอายุ | ~1 นาที |
| `npm run test:regressions` | บั๊กที่เคยแก้ 8 ข้อ (กดเร็วกว่า backend ตอบ, ภาพ 4096 px ในโหมดแก้เฉพาะจุด, ปุ่มบันทึกภาพ, LoRA ใน "ใช้ค่าเดิม") — ต้องรัน `npm test` ก่อนสักครั้ง | ~15 วินาที |
| `npm run test:responsive` | 18 หน้าจอ × 9 ขนาดจอ (320–1920px) ว่าไม่มีส่วนไหนล้นจอ | ~10 นาที |
| `npm run test:all` | ทั้งหมดตามลำดับ | |

ผลแสดงเป็น ✔ / ✘ ทีละขั้น ถ้าขั้นไหนไม่ผ่าน จะมีภาพหน้าจอตอนที่พังอยู่ใน `tests/output/`
(ชุด responsive เก็บภาพทุกหน้าจอไว้ใน `tests/output/responsive/` ให้เปิดดูด้วยตาได้)

### ก่อนรัน

การทดสอบ **สร้างบัญชีใหม่ สร้างงาน และลบงาน** จึงต้องรันกับ backend บนเครื่องตัวเอง
ไม่ใช่ backend ของเพื่อน — ถ้า `LUMA_API` ชี้ไปเครื่องอื่น ชุดทดสอบจะไม่ยอมรัน

1. เปิด backend + AI จำลองบนเครื่องตัวเอง (ดู `Process image/RUNNING-LOCALLY.md`):

   ```bash
   cd ~/luma-backend
   pg_ctl -D ./pgdata -o "-p 5433" -l pg.log start
   .venv/bin/python -m uvicorn mock_ai_server:app --port 8001 &
   .venv/bin/python -m uvicorn main:app --port 8000
   ```

2. ต้องมีบัญชีที่มีสิทธิ์ owner (ค่าเริ่มต้น `alice` / `SecurePassword123!`)

ไม่ต้องแก้ `js/config.js` — ชุดทดสอบเปิดเว็บเซิร์ฟเวอร์ของตัวเอง และชี้หน้าเว็บไปที่ backend
ของการทดสอบเฉพาะในเบราว์เซอร์ที่ใช้ทดสอบ ไฟล์จริงไม่ถูกแก้

ตั้งค่าเพิ่มเติมได้ผ่านตัวแปรแวดล้อม:

| ตัวแปร | ค่าเริ่มต้น | ใช้เมื่อ |
|---|---|---|
| `LUMA_API` | `http://localhost:8000` | backend อยู่พอร์ตอื่น |
| `LUMA_USER`, `LUMA_PASS` | `alice`, `SecurePassword123!` | ใช้บัญชี owner อื่น |
| `CHROME` | ตำแหน่ง Chrome บน macOS | ใช้ Windows/Linux |
| `SHOTS` | `390,768,1440` | อยากได้ภาพหน้าจอ responsive ขนาดอื่น |

ไฟล์ในโฟลเดอร์ `tests/`:

```
tests/
├── lib.mjs              เครื่องมือกลาง: เปิดเว็บเซิร์ฟเวอร์ + Chrome, สั่งกด/พิมพ์, สรุปผล
├── unit.mjs             ชุดทดสอบฟังก์ชัน (node:test — ไม่ใช้เบราว์เซอร์)
├── e2e.mjs              ชุดทดสอบการใช้งาน
├── regressions.mjs      ชุดกันบั๊กเก่ากลับมา
├── responsive.mjs       ชุดทดสอบขนาดจอ
└── fixtures/sample.png  ภาพทดสอบ 480×640 (วาดขึ้นเอง ไม่มีปัญหาลิขสิทธิ์)
```

## รองรับขนาดจอ (responsive)

ใช้กฎขนาดจอชุดเดียวกับเวอร์ชัน React (อยู่ใน `css/layout.css`):

| ความกว้างจอ | หน้าตา |
|---|---|
| 1100px ขึ้นไป | เมนูซ้ายเต็ม + พื้นที่ภาพตรงกลาง + แผงตั้งค่าด้านขวา |
| 768–1099px (แท็บเล็ต) | เมนูซ้ายเหลือแต่ไอคอน, แผงตั้งค่าย้ายไปอยู่ใต้ภาพ |
| ต่ำกว่า 768px (มือถือ) | เมนูซ้ายหายไป ใช้แถบเมนูด้านล่างแทน, ซ่อนแถบงานล่าสุด |
| หน้าล็อกอิน/สมัคร | ตั้งแต่ 940px แบ่งสองฝั่ง (แนะนำระบบ + ฟอร์ม) ต่ำกว่านั้นเหลือฟอร์มอย่างเดียว |
| แผงแอดมิน | ต่ำกว่า 1025px เมนูซ้ายเหลือแต่ไอคอน |

ตรวจซ้ำได้ทุกเมื่อด้วย `npm run test:responsive` (ดูหัวข้อ "การทดสอบ")

## เทียบกับเวอร์ชัน React เดิม (`frontend/src/` ใน commit `0a78911`)

| เวอร์ชัน React | เวอร์ชัน HTML |
|---|---|
| `config/env.ts`, `config/limits.ts`, `config/models.ts` | `js/config.js` |
| `services/*.ts`, `contracts/*.ts` | `js/api.js` |
| `shared/ui/*`, `shared/utils/*` | `js/ui.js`, `js/widgets.js`, `js/icons.js` |
| `features/layout/AppShell.tsx`, `app/guards.tsx` | `js/layout.js` |
| `features/auth/` | `login.html` + `js/login.js`, `register.html` + `js/register.js` |
| `features/generate/` | `generate.html`, `js/generate/*`, `js/mask.js` |
| `features/studio/` | `studio.html`, `js/studio/*` |
| `features/history/` | `history.html`, `js/history/*` |
| `features/account/` | `account.html`, `js/account.js` |
| `features/admin/` | `admin.html`, `js/admin/*` |
| `shared/styles/*.css` | `css/*.css` (ไฟล์เดียวกัน) |

## การทำงานหลัก

**ล็อกอิน:** `POST /auth/login` ได้ token แล้วเก็บไว้ใน `localStorage` จากนั้นทุกคำขอจะแนบ
`Authorization: Bearer <token>` ไปด้วย ถ้า backend ตอบ 401 แปลว่า token หมดอายุ จะพากลับหน้าล็อกอิน

**สร้างภาพ:**

```
อัปโหลดภาพต้นฉบับ  POST /uploads           (เฉพาะโหมดที่ใช้ภาพ)
อัปโหลด mask       POST /uploads           (เฉพาะโหมดแก้เฉพาะจุด: ขาว = วาดใหม่, ดำ = คงไว้)
ส่งงาน             POST /generations        → ได้ id
ถามสถานะซ้ำ ๆ       GET  /generations/{id}  ทุก 2 วิ (หลัง 1 นาทีทุก 5 วิ, เลิกถามหลัง 5 นาที)
ความคืบหน้า         GET  /generations/{id}/progress
โหลดภาพ            GET  /generations/{id}/image
หยุดงาน            POST /generations/{id}/cancel
```

**ภาพที่ต้องล็อกอินก่อนดู:** `<img src>` แนบ token ไม่ได้ จึงใช้ `apiImageUrl()` ดึงภาพเป็นไฟล์
แล้วค่อยแสดง

**ส่งภาพข้ามหน้า:** เช่น "แต่งต่อในสตูดิโอ" หรือ "วาดฉากหลังใหม่" ฝากข้อมูลไว้ใน `sessionStorage`
(คีย์ `luma.handoff` และ `luma.studio-handoff`) ให้หน้าปลายทางอ่านตอนเปิด

**สไตล์เสริม (LoRA) ใช้ได้เฉพาะโมเดลตระกูลเดียวกัน:** มี 3 ตระกูล คือ `sd15` · `illustrious_xl` · `pony_xl`
ช่อง "สไตล์เสริม" แสดงเฉพาะ LoRA ที่ใช้กับโมเดลที่เลือกได้ ถ้าเปลี่ยนโมเดลแล้ว LoRA ที่เลือกไว้ใช้ไม่ได้
จะเปลี่ยนเป็น "ไม่ใช้" ให้เอง ตระกูลอ่านจากช่อง `family` ของ `GET /api/models` ถ้าไม่มี ใช้รายชื่อใน
`config.js` หรือเดาจากชื่อไฟล์ด้วยกฎเดียวกับเครื่อง AI (รายละเอียดใน `js/generate/families.js`, issue #2)

**ร่างที่กรอกไว้:** หน้าสร้างภาพเก็บ prompt และค่าตั้งไว้ใน `localStorage` (คีย์ `luma.html.draft`)
รีเฟรชหน้าแล้วไม่หาย ปุ่ม "ใช้ค่าเดิมนี้" ในหน้าประวัติก็เขียนลงคีย์นี้

## ความปลอดภัย

- **ข้อความจาก backend หรือผู้ใช้** ต้องผ่าน `escapeHtml()` ทุกครั้งก่อนใส่ `innerHTML`
  (หรือใช้ `textContent`) — กันคนใส่โค้ดลงใน prompt แล้วไปรันในเครื่องคนอื่น
- **ทุกหน้ามี Content-Security-Policy** (แท็ก `<meta>` ใน `<head>`) รันได้เฉพาะสคริปต์จากไฟล์
  ในโฟลเดอร์นี้ จึง **ห้ามเขียน `<script>…</script>` หรือ `onclick="…"` ใน HTML** — ผูกปุ่มด้วย
  `addEventListener` ในไฟล์ JS แทน (ถ้าเผลอเขียน เบราว์เซอร์จะไม่รัน และ `npm test` จะแจ้ง error)
- **token เก็บใน `localStorage`** หลังล็อกอิน ปุ่มออกจากระบบลบ token ในเครื่องนี้ (backend
  ไม่มีปลายทางให้ยกเลิก token จึงใช้ได้จนหมดอายุ)
- **ตอนนี้คุยกับ backend ผ่าน `http://`** รหัสผ่านและ token วิ่งในวง Wi-Fi แบบไม่เข้ารหัส
  ใช้ในทีมช่วงพัฒนาได้ ถ้าจะเปิดให้คนนอกใช้ ต้องให้ nginx (branch `devops`) ทำ HTTPS ก่อน
  แล้วแก้ `API_BASE_URL` เป็น `https://…`

## ต่างจากเวอร์ชัน React เดิม

- ภาษาไทยอย่างเดียว (แผงแอดมินเป็นภาษาอังกฤษเหมือนต้นฉบับ) — ไม่มีปุ่มสลับภาษา
- ไม่มีการบันทึกชุดค่าตั้ง (preset) ในเมนูซ้าย
- ระบาย mask บนมือถือได้ (เวอร์ชัน React ปิดไว้บนจอเล็ก)
