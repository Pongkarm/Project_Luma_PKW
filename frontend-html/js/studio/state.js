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

/* blur ต้องเป็นเลขคี่ในช่วง 3–51 ไม่งั้น OpenCV ฝั่ง backend จะ error */
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
