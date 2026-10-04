/*
 * config.js — ค่าตั้งต้นทั้งหมดของเว็บอยู่ที่ไฟล์นี้ไฟล์เดียว
 *
 * ถ้า backend ย้ายเครื่องหรือ IP เปลี่ยน ให้แก้ API_BASE_URL บรรทัดเดียว
 *   backend ในเครื่องตัวเอง:  http://localhost:8000
 *   backend ของเพื่อน:        http://<IP ของเครื่องเพื่อน>:8000
 *
 * ค่าในไฟล์นี้:
 *   API_BASE_URL          ที่อยู่ backend (ทุกคำขอใน api.js ต่อท้ายจากค่านี้)
 *   LIMITS                ขอบเขตของ prompt, steps, CFG, denoise, ขนาดภาพ, ไฟล์อัปโหลด
 *   DEFAULT_SIZE          ขนาดภาพตั้งต้น 768 × 768
 *   PAGE_SIZES            จำนวนงานที่ขอต่อครั้ง (แถบล่าสุด, สตูดิโอ, หน้าประวัติ)
 *   DRAFT_KEY             คีย์ของร่างหน้าสร้างภาพใน localStorage
 *   SIZE_PRESETS          ปุ่มขนาด 1:1 · 2:3 · 3:2
 *   FALLBACK_CHECKPOINTS  รายชื่อโมเดลสำรอง เมื่อถามเครื่อง AI ไม่ได้
 *   FALLBACK_LORAS        รายชื่อสไตล์ (LoRA) สำรอง
 *   SAMPLERS              วิธีสุ่มที่เลือกได้
 *
 * เชื่อมกับ:
 *   โหลดเป็นไฟล์แรกของทุกหน้า ไม่ใช้ของไฟล์อื่น
 *   ถูกใช้โดย  api.js, generate/*, studio/*, history/*
 *   ชุดทดสอบ (tests/lib.mjs) แทนค่า API_BASE_URL ระหว่างทางให้ชี้ไป backend ของการทดสอบ
 */
const API_BASE_URL = 'http://localhost:8000';

/*
 * ขอบเขตของค่าต่าง ๆ ที่ส่งไปให้ AI ได้
 * ใช้ค่าที่ "แคบกว่า" ระหว่าง backend กับ AI node เพื่อไม่ให้งานถูกปฏิเสธกลางทาง
 */
const LIMITS = {
  promptMax: 500,
  steps: { min: 1, max: 50, default: 25 },
  cfgScale: { min: 1, max: 20, step: 0.5, default: 7.5 },
  denoise: { min: 0, max: 1, step: 0.05, img2img: 0.65, inpaint: 0.8 },
  size: { min: 256, max: 768, multipleOf: 8 },
  uploadMaxBytes: 10 * 1024 * 1024,
  uploadTypes: ['image/png', 'image/jpeg', 'image/webp'],
  sketchBlur: { min: 3, max: 51, default: 21 },
};

/* ขนาดภาพตั้งต้นของโหมดสร้างจากข้อความ (ปุ่ม "รีเซ็ต" กลับมาที่ขนาดนี้) */
const DEFAULT_SIZE = { width: 768, height: 768 };

/* จำนวนงานที่ขอจาก backend ต่อครั้ง */
const PAGE_SIZES = {
  recent: 12, // แถบ "สร้างล่าสุด" ใต้หน้าสร้างภาพ (และรายการให้เลือกในสตูดิโอ)
  studioRecent: 8, // ภาพที่เสร็จแล้วที่แสดงให้เลือกในสตูดิโอ
  history: 24, // การ์ดต่อหน้าในหน้าประวัติ
};

/* คีย์ใน localStorage ของร่างหน้าสร้างภาพ — หน้าประวัติเขียนลงคีย์นี้ตอนกด "ใช้ค่าเดิม" */
const DRAFT_KEY = 'luma.html.draft';

/* ขนาดภาพสำเร็จรูป (กว้าง x สูง) */
const SIZE_PRESETS = [
  { label: '1:1', name: 'จัตุรัส', width: 768, height: 768 },
  { label: '2:3', name: 'แนวตั้ง', width: 512, height: 768 },
  { label: '3:2', name: 'แนวนอน', width: 768, height: 512 },
];

/*
 * รายชื่อโมเดลสำรอง — ใช้เมื่อขอรายชื่อจริงจาก GET /api/models ไม่สำเร็จ
 * (เช่น เครื่อง AI ปิดอยู่) หน้าเว็บจะได้ยังเลือกโมเดลได้
 */
const FALLBACK_CHECKPOINTS = [
  { id: 'counterfeitV30_v30.safetensors', name: 'Counterfeit v3.0', description: 'Illustration and anime' },
  { id: 'novaAnimeXL_ilV190.safetensors', name: 'Nova Anime XL', description: 'Detailed anime, XL base' },
  { id: 'prefectPonyXL_v6.safetensors', name: 'Prefect Pony XL', description: 'Stylised characters' },
];

const FALLBACK_LORAS = [
  { id: 'SousouNoFrieren_Frieren_IlluXL.safetensors', name: 'Frieren' },
  { id: 'himmel_sousou_no_frieren_ilxl.safetensors', name: 'Himmel' },
  { id: 'niji_and_midj_mix217.safetensors', name: 'Niji & Midjourney mix' },
  { id: 'tachi-e.safetensors', name: 'Tachi-e' },
  { id: '[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors', name: 'Geekpower' },
];

const SAMPLERS = ['Euler a', 'Euler', 'DPM++ 2M Karras', 'DPM++ SDE Karras', 'DDIM', 'UniPC'];
