/*
 * tests/unit.mjs — ทดสอบฟังก์ชันที่คำนวณล้วน ๆ (ไม่แตะหน้าเว็บ ไม่เรียก backend)
 *
 * วิธีรัน (ในโฟลเดอร์ frontend-html):   npm run test:unit
 * ไม่ต้องเปิด backend หรือ Chrome — ใช้เวลาไม่ถึงวินาที
 *
 * ไฟล์ใน js/ เป็นสคริปต์ธรรมดา (ไม่ใช่ module) จึงโหลดเข้า "บริบท" เดียวกันด้วย node:vm
 * เหมือนที่เบราว์เซอร์โหลดหลาย <script> ต่อกัน แล้วดึงฟังก์ชันออกมาทดสอบ
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* sessionStorage ปลอม (เก็บในหน่วยความจำ) */
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const context = vm.createContext({ sessionStorage: fakeStorage(), localStorage: fakeStorage() });
for (const file of ['js/config.js', 'js/icons.js', 'js/api.js', 'js/ui.js', 'js/widgets.js', 'js/generate/state.js', 'js/generate/families.js', 'js/studio/state.js']) {
  // icons.js ผูก DOMContentLoaded ตอนโหลด — ให้ document ปลอมรับไว้เฉย ๆ
  context.document = { addEventListener() {} };
  vm.runInContext(readFileSync(join(ROOT, file), 'utf8'), context, { filename: file });
}
const get = (name) => vm.runInContext(name, context);

/* ---------- ขนาดภาพ (js/generate/state.js) ---------- */

test('snapSize ปัดให้หารด้วย 8 ลงตัวและอยู่ในช่วง 256–768', () => {
  const snapSize = get('snapSize');
  assert.equal(snapSize(500), 504);
  assert.equal(snapSize(100), 256);
  assert.equal(snapSize(5000), 768);
  assert.equal(snapSize(NaN), 256);
});

test('fitToEngine ย่อด้านยาวเหลือ 768 โดยคงสัดส่วน และไม่ขยายภาพเล็ก', () => {
  const fitToEngine = get('fitToEngine');
  assert.deepEqual({ ...fitToEngine(4096, 2048) }, { width: 768, height: 384 });
  assert.deepEqual({ ...fitToEngine(480, 640) }, { width: 480, height: 640 });
  assert.deepEqual({ ...fitToEngine(1000, 1000) }, { width: 768, height: 768 });
});

test('ratioText แสดงอัตราส่วนอย่างต่ำ', () => {
  const ratioText = get('ratioText');
  assert.equal(ratioText(768, 512), '3:2');
  assert.equal(ratioText(512, 768), '2:3');
  assert.equal(ratioText(768, 768), '1:1');
});

/* ---------- ตระกูลโมเดลกับ LoRA (js/generate/families.js, issue #2) ---------- */

test('detectModelFamily ใช้กฎเดียวกับเครื่อง AI (pony/pdxl → illu/nova/xl → sd15)', () => {
  const detect = get('detectModelFamily');
  assert.equal(detect('prefectPonyXL_v6.safetensors'), 'pony_xl'); // มีทั้ง pony และ xl — pony มาก่อน
  assert.equal(detect('something_PDXL.safetensors'), 'pony_xl');
  assert.equal(detect('novaAnimeXL_ilV190.safetensors'), 'illustrious_xl');
  assert.equal(detect('myIllustriousMix.safetensors'), 'illustrious_xl');
  assert.equal(detect('counterfeitV30_v30.safetensors'), 'sd15');
  assert.equal(detect('anything_else.ckpt'), 'sd15');
  assert.equal(detect(''), 'sd15');
});

test('modelFamily / loraFamily ใช้ family จาก API ก่อน แล้วค่อยรายชื่อสำรอง', () => {
  assert.equal(get('modelFamily')({ id: 'counterfeitV30_v30.safetensors', family: 'pony_xl' }), 'pony_xl');
  assert.equal(get('modelFamily')({ id: 'counterfeitV30_v30.safetensors' }), 'sd15');
  assert.equal(get('loraFamily')({ id: 'tachi-e.safetensors' }), 'sd15');
  assert.equal(get('loraFamily')({ id: 'tachi-e.safetensors', family: 'illustrious_xl' }), 'illustrious_xl');
  assert.equal(get('loraFamily')({ id: 'brand-new-lora.safetensors' }), 'unknown');
});

test('compatibleLoras ได้คู่ตามเกณฑ์ของ issue #2 และเก็บ LoRA ที่ไม่รู้ตระกูลไว้', () => {
  const names = (family) => get('compatibleLoras')(get('FALLBACK_LORAS'), family).map((l) => l.name).join(', ');
  assert.equal(names('sd15'), 'Niji & Midjourney mix, Tachi-e');
  assert.equal(names('illustrious_xl'), 'Frieren, Frieren V1, Himmel');
  assert.equal(names('pony_xl'), 'Geekpower');
  const withUnknown = [{ id: 'brand-new-lora.safetensors', name: 'New' }];
  assert.equal(get('compatibleLoras')(withUnknown, 'pony_xl').length, 1);
});

/* ---------- สตูดิโอ (js/studio/state.js) ---------- */

test('oddKernel ได้เลขคี่ในช่วง 3–51 เสมอ', () => {
  const oddKernel = get('oddKernel');
  assert.equal(oddKernel(20), 21);
  assert.equal(oddKernel(21), 21);
  assert.equal(oddKernel(0), 3);
  assert.equal(oddKernel(100), 51);
});

/* ---------- ข้อความ error จาก backend (js/api.js) ---------- */

test('readDetail อ่านได้ทั้ง detail แบบข้อความและแบบรายการของ FastAPI', () => {
  const readDetail = get('readDetail');
  assert.equal(readDetail({ detail: 'ไม่พบงาน' }), 'ไม่พบงาน');
  assert.equal(readDetail({ detail: [{ loc: ['body', 'steps'], msg: 'too large' }] }), 'steps: too large');
  assert.equal(readDetail({ detail: [{ loc: ['body'], msg: 'invalid' }] }), 'invalid');
  assert.equal(readDetail(null), null);
  assert.equal(readDetail({}), null);
});

test('errorMessage แปลงรหัส HTTP เป็นข้อความภาษาไทย', () => {
  const errorMessage = get('errorMessage');
  assert.match(errorMessage(0), /ติดต่อ backend ไม่ได้/);
  assert.match(errorMessage(413), /ไฟล์ใหญ่เกินไป/);
  assert.equal(errorMessage(404, 'ไม่พบงานนี้'), 'ไม่พบงานนี้');
  assert.equal(errorMessage(418), 'เกิดข้อผิดพลาด (รหัส 418)');
});

/* ---------- ฟังก์ชันช่วย (js/ui.js) ---------- */

test('escapeHtml กันข้อความไม่ให้กลายเป็น HTML', () => {
  const escapeHtml = get('escapeHtml');
  assert.equal(escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.equal(escapeHtml("it's & more"), 'it&#39;s &amp; more');
  assert.equal(escapeHtml(null), '');
});

test('formatClock และ formatBytes', () => {
  assert.equal(get('formatClock')(65), '1:05');
  assert.equal(get('formatClock')(-3), '0:00');
  assert.equal(get('formatBytes')(48 * 1024), '48 KB');
  assert.equal(get('formatBytes')(2.5 * 1024 * 1024), '2.5 MB');
});

test('statusInfo และ statusChip รับสถานะที่ไม่รู้จักได้โดยไม่พัง', () => {
  assert.equal(get('statusInfo')('completed').text, 'เสร็จแล้ว');
  assert.equal(get('statusInfo')('archived').text, 'รอคิว');
  assert.match(get('statusChip')('archived'), /status--pending/);
  assert.match(get('statusChip')('processing'), /class="spin"/);
});

test('takeSessionJson อ่านได้ครั้งเดียว และคืน null เมื่อข้อมูลเสีย', () => {
  const take = get('takeSessionJson');
  context.sessionStorage.setItem('k', JSON.stringify({ runId: 'abc' }));
  assert.equal(take('k').runId, 'abc');
  assert.equal(take('k'), null); // ถูกลบไปแล้ว
  context.sessionStorage.setItem('k', '{broken');
  assert.equal(take('k'), null);
  assert.equal(context.sessionStorage.getItem('k'), null);
});

/* ---------- เงื่อนไขรหัสผ่าน (js/widgets.js) ---------- */

test('PASSWORD_RULES ตรวจความยาว ตัวเลข/สัญลักษณ์ และการยืนยัน', () => {
  const rules = get('PASSWORD_RULES');
  const passes = (pw, confirm) => rules.every((rule) => rule.test(pw, confirm));
  assert.equal(passes('Secret123', 'Secret123'), true);
  assert.equal(passes('short1', 'short1'), false); // สั้นไป
  assert.equal(passes('lettersonly', 'lettersonly'), false); // ไม่มีตัวเลข/สัญลักษณ์
  assert.equal(passes('Secret123', 'Secret124'), false); // ยืนยันไม่ตรง
});
