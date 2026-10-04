/*
 * generate/state.js — ข้อมูลที่ทุกส่วนของหน้าสร้างภาพใช้ร่วมกัน
 *
 * หน้าสร้างภาพแบ่งโค้ดเป็นหลายไฟล์ในโฟลเดอร์ js/generate/ (โหลดเรียงตามลำดับใน generate.html):
 *   state.js       ข้อมูลกลาง + การคำนวณขนาดภาพ          ← ไฟล์นี้
 *   families.js    ตระกูลของโมเดล และ LoRA ที่ใช้คู่กันได้
 *   settings.js    แผงขวา: โมเดล ขนาด แถบเลื่อน
 *   draft.js       โหมด + บันทึกร่าง + ปุ่มสร้างภาพ (เปิด/ปิด)
 *   source.js      ภาพต้นฉบับ: อัปโหลด ลากวาง รับภาพจากหน้าอื่น
 *   stage.js       ตรงกลาง: ว่าง / กำลังสร้าง / ผลลัพธ์ / แต่งด่วน
 *   run.js         ส่งงาน + ติดตามสถานะ + หยุด/ลบ/ใช้ต่อ
 *   recent.js      แถบงานล่าสุดด้านล่าง
 *   mask-tools.js  แถบเครื่องมือระบาย mask (ตัวระบายจริงอยู่ใน js/mask.js)
 *   main.js        เริ่มทำงาน: ผูกปุ่มทั้งหมดเข้ากับฟังก์ชัน
 *
 * ขั้นตอนหลักของหน้า:
 *  1) เลือกโหมด กรอกคำอธิบาย ตั้งค่า
 *  2) (โหมดที่ใช้ภาพ) อัปโหลดภาพไป POST /uploads
 *  3) (แก้เฉพาะจุด) ระบาย mask แล้วอัปโหลดเป็นภาพขาวดำ
 *  4) POST /generations → ได้ id ของงาน
 *  5) ถาม GET /generations/{id} ซ้ำ ๆ จนเสร็จ แล้วโหลดภาพมาแสดง
 *
 * ข้อมูลและฟังก์ชันในไฟล์นี้:
 *   mode, source, run, progress, quick, quickBusy, ...   สถานะกลางของหน้า (ดูคำอธิบายข้างตัวแปร)
 *   watchToken            ใช้ทิ้งคำตอบที่ค้างจากรอบเก่า หลังหยุด/เปลี่ยนงาน
 *   MODE_TEXT             ชื่อและข้อความของแต่ละโหมด
 *   snapSize()            ปัดขนาดให้หารด้วย 8 และอยู่ในช่วง 256–768
 *   fitToEngine()         ย่อภาพต้นฉบับให้ด้านยาวไม่เกิน 768 โดยคงสัดส่วน
 *   outputSize()          ขนาดภาพผลลัพธ์ที่จะได้
 *   ratioText()           อัตราส่วน เช่น 3:2
 *
 * เชื่อมกับ:
 *   ใช้ของ     config.js (LIMITS), ui.js ($)
 *   ถูกใช้โดย  ทุกไฟล์ในโฟลเดอร์ generate/
 */

let mode = 'txt2img';
let source = null; // ภาพต้นฉบับที่อัปโหลดแล้ว { url, width, height, name, sizeBytes }
let run = null; // งานที่กำลังแสดงตรงกลาง (ข้อมูลจาก backend)
let progress = null; // ความคืบหน้าล่าสุดจาก /progress
let runImageUrl = null; // ภาพผลลัพธ์ (object URL)
let runImageBlob = null;
let quick = null; // ผลของ "แต่งด่วน" ที่แสดงแทนภาพเดิม { tool, color, url, blob }
let quickBusy = null; // ชื่อเครื่องมือที่กำลังทำงาน
let watchStartedAt = 0;
let pollTimer = null;
let watchToken = 0; // เพิ่มทุกครั้งที่หยุดติดตามงาน — คำตอบที่ค้างจากรอบเก่าจะถูกทิ้ง
let clockTimer = null;
let stalled = false;
let uploading = false;
let submitting = false;

const POLL_GIVE_UP_MS = 5 * 60 * 1000; // backend ไม่ตัดงานที่ค้างให้เอง เราจึงเลิกถามเองหลัง 5 นาที

/* ชื่อและข้อความของแต่ละโหมด */
const MODE_TEXT = {
  txt2img: { title: 'สร้างจากข้อความ', prompt: 'อธิบายภาพที่ต้องการ', step: '2 · ตั้งค่า' },
  img2img: { title: 'สร้างจากภาพ', prompt: 'อยากให้เปลี่ยนอะไร?', step: '1 · เริ่มจาก' },
  inpaint: { title: 'แก้เฉพาะจุด', prompt: 'อยากให้เปลี่ยนอะไร?', step: '1 · เริ่มจาก' },
};

/* ---------- คำนวณขนาด ---------- */

/* ปัดให้หารด้วย 8 ลงตัว แล้วบีบให้อยู่ในช่วง 256–768 */
function snapSize(value) {
  const { min, max, multipleOf } = LIMITS.size;
  if (!Number.isFinite(value)) return min;
  const snapped = Math.round(value / multipleOf) * multipleOf;
  return Math.min(max, Math.max(min, snapped));
}

/* ย่อภาพต้นฉบับให้ด้านยาวไม่เกิน 768 (AI รับได้สูงสุดเท่านี้) โดยคงสัดส่วนไว้ */
function fitToEngine(width, height) {
  const longest = Math.max(width, height);
  const scale = longest > LIMITS.size.max ? LIMITS.size.max / longest : 1;
  return { width: snapSize(width * scale), height: snapSize(height * scale) };
}

/* ขนาดที่ภาพผลลัพธ์จะออกมา */
function outputSize() {
  if (mode !== 'txt2img' && source) return fitToEngine(source.width, source.height);
  return { width: Number($('width').value), height: Number($('height').value) };
}

/* หา ห.ร.ม. เพื่อแสดงอัตราส่วน เช่น 768×512 → 3:2 */
function ratioText(width, height) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const d = gcd(width, height);
  return width / d + ':' + height / d;
}
