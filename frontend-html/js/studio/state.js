/*
 * studio/state.js — สตูดิโอแต่งภาพ (เครื่องมือ 4 อย่างของ backend)
 *
 *   POST /api/tools/sketch        ลายเส้น   (ส่ง blur_ksize เป็นเลขคี่)
 *   POST /api/tools/color-splash  เน้นสี    (ส่ง target_color = green | red)
 *   POST /api/tools/pose          ท่าทาง    (ได้ภาพ + จุดบนร่างกาย 33 จุด)
 *   POST /api/tools/remove-bg     ตัดฉาก    (ได้ภาพโปร่งใส + mask ขาวดำ)
 *
 * ทุกครั้งที่ใช้เครื่องมือ จะได้ "เวอร์ชัน" ใหม่ต่อท้ายแถบด้านล่าง
 * เวอร์ชันเก็บอยู่ในหน่วยความจำของหน้าเว็บเท่านั้น ปิดหน้าแล้วหาย
 *
 * ไฟล์ในโฟลเดอร์ js/studio/:
 *   state.js  ข้อมูลกลาง: เครื่องมือ, รายการเวอร์ชัน, เพิ่ม/เลือกเวอร์ชัน  ← ไฟล์นี้
 *   view.js   วาดหน้าจอ: ภาพ, เทียบก่อน/หลัง, แถบเวอร์ชัน, แผงขวา
 *   tools.js  เรียกเครื่องมือของ backend, เปิดภาพ, ส่งต่อไปหน้าสร้างภาพ
 *   main.js   เริ่มทำงาน: ผูกปุ่มทั้งหมด
 *
 * ข้อมูลและฟังก์ชันในไฟล์นี้:
 *   TOOLS, COLOR_TEXT       ชื่อ ไอคอน คำอธิบายของเครื่องมือ และสีที่เลือกได้
 *   versions, current, tool, color, busy, ...   สถานะกลางของหน้า
 *   session                 ใช้ทิ้งผลของเครื่องมือที่ค้างจากภาพเก่า
 *   oddKernel()             บังคับค่าความนุ่มของเส้นให้เป็นเลขคี่ 3–51
 *   versionName() / versionDetail()   ชื่อและรายละเอียดของเวอร์ชัน
 *   addVersion() / selectVersion()    เพิ่ม / เลือกเวอร์ชัน
 *   clearVersions() / startWith() / closeImage()   ล้าง / เริ่มภาพใหม่ / ปิดภาพ
 *
 * เชื่อมกับ:
 *   ใช้ของ     config.js (LIMITS), view.js (render)
 *   ถูกใช้โดย  ทุกไฟล์ใน studio/
 */

/*
 * เครื่องมือแต่ละตัวทำงานอย่างไร (คำนวณที่ backend ทั้งหมด: app/services/image_tools.py บน branch backend)
 * หน้าเว็บแค่ส่งภาพ + ตัวเลือกไป แล้วรับภาพผลกลับมา
 *
 * ลายเส้น (sketch) — Color Dodge
 *   1) แปลงเป็นขาวดำ  2) กลับสี (255 − ภาพ)  3) เบลอด้วย GaussianBlur ขนาด k×k
 *   4) ภาพขาวดำ ÷ (255 − ภาพที่เบลอ) × 256
 *   พื้นที่เรียบ: ค่าก่อน/หลังเบลอใกล้กัน → ผลหารเกือบ 255 → กลายเป็นสีขาว
 *   ตรงขอบวัตถุ: ค่าต่างกันมาก → เหลือเป็นเส้นสีเข้ม
 *   แถบ "ความนุ่มของเส้น" คือค่า k ยิ่งมาก เส้นยิ่งหนาและนุ่ม (ดู oddKernel ด้านล่าง)
 *
 * เน้นสี (color-splash) — กรองสีด้วย HSV
 *   แปลงภาพเป็น HSV เพราะแยกเฉดสี (H) ออกจากความสว่างได้ เลือกสีได้แม่นกว่า RGB
 *   inRange สร้าง mask ของสีที่เก็บไว้: เขียว H 35–85
 *   แดงต้องรวมสองช่วง H 0–10 กับ 170–180 เพราะแดงอยู่ตรงรอยต่อของวงล้อสี
 *   ในบริเวณ mask ใช้สีเดิม นอก mask ใช้ภาพขาวดำ แล้วรวมเป็นภาพเดียว
 *
 * ท่าทาง (pose) — MediaPipe Pose
 *   โมเดล AI หาจุดบนร่างกาย 33 จุด (x, y, z, visibility) ลองสูงสุด 3 รอบ เจอแล้วหยุด:
 *   ค่ามั่นใจ 0.5 (ภาพคนจริง) → 0.3 (ภาพวาด/อนิเมะ/ภาพจาก AI) → โมเดลละเอียดกว่าที่ 0.25 (ท่ายาก)
 *   ได้ภาพที่วาดโครงกระดูกแล้ว + รายการจุด (view.js renderPose แสดงเป็นตาราง)
 *   ไม่เจอคน → ได้รายการว่าง
 *
 * ตัดฉาก (remove-bg) — GrabCut + Morphology
 *   1) ย่อภาพให้ด้านยาว ≤ 512 px (เร็วขึ้นมาก)  2) ถือว่าตัวแบบอยู่ในกรอบที่เว้นขอบ 5%
 *   3) grabCut 5 รอบ: เรียนรู้สีของฉากหลังกับตัวแบบ แล้วแบ่งพิกเซลเป็นสองฝั่ง
 *   4) MORPH_CLOSE อุดรูเล็ก ๆ และเกลี่ยขอบ  5) ขยาย mask กลับเท่าภาพจริง
 *   ได้ภาพโปร่งใส + mask ขาวดำ (ขาว = ตัวแบบ) ซึ่งส่งไปโหมด inpaint ต่อได้ (tools.js sendCutout)
 *   ข้อจำกัด: ตัวแบบที่ชิดขอบภาพจะถูกตัดไม่ดี เพราะขอบ 5% ถูกถือเป็นฉากหลังเสมอ
 *
 * backend ทำได้ทีละไม่เกิน 2 งาน (Semaphore) และตัดทิ้งถ้าเกิน 60 วิ ภาพผลถูกลบเองหลัง 24 ชม.
 */
const TOOLS = {
  sketch: { name: 'ลายเส้น', icon: 'pencil', about: 'เปลี่ยนภาพเป็นลายเส้นดินสอขาวดำ' },
  'color-splash': { name: 'เน้นสี', icon: 'droplet', about: 'เก็บไว้สีเดียว ส่วนที่เหลือเป็นขาวดำ' },
  pose: { name: 'ท่าทาง', icon: 'pose', about: 'หาคนในภาพแล้วมาร์กจุดท่าทาง 33 จุด' },
  'remove-bg': { name: 'ตัดฉาก', icon: 'scissors', about: 'ตัดตัวแบบออกจากฉากหลัง พร้อม mask ที่ใช้ตัด เอาไปวาดฉากหลังใหม่ต่อได้เลย' },
};
const COLOR_TEXT = { green: 'เขียว', red: 'แดง' };

/*
 * แต่ละเวอร์ชัน:
 * { blob, url, width, height, tool (null = ต้นฉบับ), detail, parent (เวอร์ชันที่ใช้ทำ), landmarks?, mask? }
 */
let versions = [];
let current = null; // เวอร์ชันที่กำลังดู
let sourceLabel = ''; // ภาพมาจากไหน เช่น ชื่อไฟล์
let tool = 'sketch';
let color = 'green';
let busy = false;
let comparing = false;
let showMask = false;
let session = 0; // เพิ่มทุกครั้งที่เปลี่ยน/ปิดภาพ — ผลของเครื่องมือที่ค้างจากภาพเก่าจะถูกทิ้ง

/*
 * ขนาดเบลอ (k) ต้องเป็นเลขคี่ เพราะ kernel ของ GaussianBlur ต้องมีจุดกึ่งกลาง
 * backend รับแค่ 3–51 (นอกช่วงตอบ 422) และปัดเลขคู่เป็นคี่ให้เองอีกชั้น
 * ที่ปัดตรงนี้ด้วยเพื่อให้ค่าที่แสดงในชื่อเวอร์ชันตรงกับค่าที่ใช้จริง
 */
function oddKernel(value) {
  const { min, max } = LIMITS.sketchBlur;
  const clamped = Math.min(max, Math.max(min, Math.round(value)));
  return clamped % 2 === 1 ? clamped : clamped + 1;
}

/* "ต้นฉบับ" หรือ "2. ลายเส้น" — ตัวเลขช่วยแยกเวอร์ชันที่ใช้เครื่องมือเดียวกัน */
function versionName(version) {
  if (!version.tool) return 'ต้นฉบับ';
  return versions.indexOf(version) + '. ' + TOOLS[version.tool].name;
}

/* ค่าที่ใช้ทำเวอร์ชันนั้น เช่น ความนุ่มของเส้น หรือสีที่เก็บไว้ */
function versionDetail(version) {
  if (version.tool === 'color-splash') return COLOR_TEXT[version.detail];
  return version.detail;
}

/* ---------- เพิ่ม/เลือกเวอร์ชัน ---------- */

/* เพิ่มเวอร์ชันใหม่ท้ายแถบ แล้วเลือกให้เลย */
async function addVersion(version) {
  const mySession = session;
  // อ่านขนาดภาพไว้แสดงในคำบรรยาย
  const image = new Image();
  image.src = version.url;
  await image.decode().catch(() => {});
  if (mySession !== session) return URL.revokeObjectURL(version.url); // เปลี่ยนภาพระหว่างรอ
  version.width = image.naturalWidth;
  version.height = image.naturalHeight;
  versions.push(version);
  selectVersion(version);
}

/* เปลี่ยนเวอร์ชันที่แสดง (ปิดโหมดเทียบ/ดู mask) */
function selectVersion(version) {
  current = version;
  comparing = false;
  showMask = false;
  render();
}

/* ล้างเวอร์ชันทั้งหมด และคืนหน่วยความจำของภาพเหล่านั้น */
function clearVersions() {
  session += 1;
  busy = false;
  for (const version of versions) {
    URL.revokeObjectURL(version.url);
    if (version.mask) URL.revokeObjectURL(version.mask.url);
  }
  versions = [];
  current = null;
}

/* เริ่มใหม่ด้วยภาพใหม่ (ล้างเวอร์ชันเก่าทั้งหมด) */
function startWith(blob, label) {
  clearVersions();
  sourceLabel = label;
  addVersion({ blob, url: URL.createObjectURL(blob), tool: null, detail: null, parent: null });
}

/* ปิดภาพ กลับไปหน้าเลือกภาพ */
function closeImage() {
  clearVersions();
  render();
}
