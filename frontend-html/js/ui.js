/*
 * ui.js — ฟังก์ชันช่วยเล็ก ๆ ที่ทุกหน้าใช้
 *
 *  - $(id), escapeHtml(), จัดรูปแบบวันที่/เวลา/ขนาดไฟล์
 *  - สถานะงาน (รอคิว / กำลังสร้าง / เสร็จแล้ว / ไม่สำเร็จ) และป้ายสถานะ
 *  - กล่องแจ้งเตือน (showAlert) และข้อความเด้งมุมจอ (toast)
 *
 * ฟังก์ชันในไฟล์นี้:
 *   $()                      หา element จาก id
 *   escapeHtml()             กันข้อความกลายเป็น HTML (ใช้ทุกครั้งก่อนใส่ innerHTML)
 *   formatDate() / formatClock() / formatBytes()   จัดรูปแบบวันที่ เวลา ขนาดไฟล์
 *   takeSessionJson()        อ่านข้อมูลที่หน้าอื่นฝากไว้ใน sessionStorage (ครั้งเดียว)
 *   STATUS, statusInfo()     ชื่อและไอคอนของสถานะงาน 4 แบบ
 *   isFinished() / wasCancelled()   งานจบแล้วหรือยัง / ถูกผู้ใช้กดหยุดหรือไม่
 *   dashedCircle() / statusIcon() / statusChip()    ไอคอนและป้ายสถานะ
 *   showAlert() / toast()    กล่องแจ้งเตือน และข้อความเด้งมุมจอ
 *
 * เชื่อมกับ:
 *   ใช้ของ     icons.js (icon)
 *   ถูกใช้โดย  ทุกหน้า
 */

/* ---------- ฟังก์ชันช่วย ---------- */

/* หา element จาก id — เขียนสั้นกว่า document.getElementById */
function $(id) {
  return document.getElementById(id);
}

/*
 * กันไม่ให้ข้อความจากผู้ใช้ (เช่น prompt) กลายเป็นโค้ด HTML
 * ต้องใช้ทุกครั้งที่เอาข้อความจาก backend ไปใส่ใน innerHTML
 */
function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* วันที่แบบไทย เช่น "2 ต.ค. 2569 15:00" */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

/*
 * อ่านข้อมูลที่หน้าอื่นฝากไว้ใน sessionStorage แล้วลบทิ้ง (ใช้ได้ครั้งเดียว)
 * คืนค่า null ถ้าไม่มี หรือข้อมูลเสีย
 */
function takeSessionJson(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw);
  } catch (ignored) {
    return null;
  }
}

/* วินาที → "1:05" */
function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* ขนาดไฟล์ เช่น "47 KB" หรือ "2.3 MB" */
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ---------- สถานะงาน ---------- */

/* backend ไม่มีสถานะ "ยกเลิก" — งานที่ถูกหยุดจะเป็น failed พร้อมข้อความนี้ */
const CANCELLED_MESSAGE = 'Cancelled by user';

const STATUS = {
  pending: { text: 'รอคิว', icon: 'queue' },
  processing: { text: 'กำลังสร้าง', icon: 'refresh' },
  completed: { text: 'เสร็จแล้ว', icon: 'checkCircle' },
  failed: { text: 'ไม่สำเร็จ', icon: 'xCircle' },
};


/* งานจบแล้วหรือยัง (สำเร็จหรือล้มเหลว) */
function isFinished(run) {
  return run.status === 'completed' || run.status === 'failed';
}

/* งานนี้ถูกผู้ใช้กดหยุดหรือไม่ (ดูจากข้อความ error) */
function wasCancelled(run) {
  return run.status === 'failed' && run.error_message === CANCELLED_MESSAGE;
}

/* ข้อมูลแสดงผลของสถานะ — สถานะที่ไม่รู้จัก (เช่น backend เพิ่มใหม่) แสดงเหมือน "รอคิว" */
function statusInfo(status) {
  return STATUS[status] || STATUS.pending;
}

/* วงกลมเส้นประ — ใช้กับ "รอคิว" และเงื่อนไขรหัสผ่านที่ยังไม่ผ่าน */
function dashedCircle(size, className = '') {
  return icon('queue', size, className).replaceAll('<path ', '<path stroke-dasharray="3 3" ');
}

/* ไอคอนของสถานะงาน: รอคิว = วงกลมเส้นประ, กำลังสร้าง = ลูกศรหมุน */
function statusIcon(status, size) {
  if (status === 'processing') return icon('refresh', size, 'spin');
  if (status === 'pending' || !STATUS[status]) return dashedCircle(size);
  return icon(statusInfo(status).icon, size);
}

/* ป้ายสถานะ เช่น ✓ เสร็จแล้ว (สีต่างกันตามสถานะ) */
function statusChip(status) {
  const known = STATUS[status] ? status : 'pending';
  return '<span class="status status--' + known + '">' + statusIcon(known, 12) + statusInfo(known).text + '</span>';
}

/* ---------- กล่องแจ้งเตือน ---------- */

/*
 * แสดงข้อความในกล่อง
 *   tone: 'error' (แดง) | 'info' (ฟ้า) | 'note' (เทา)   ใส่ text ว่างเพื่อซ่อน
 */
function showAlert(element, text, tone = 'error') {
  if (!text) {
    element.hidden = true;
    element.innerHTML = '';
    return;
  }
  element.className = 'alert' + (tone === 'error' ? ' alert--error' : tone === 'note' ? ' alert--note' : '');
  element.innerHTML = icon(tone === 'error' ? 'alert' : 'info', 14, 'alert__icon') + '<div>' + escapeHtml(text) + '</div>';
  element.hidden = false;
}

/* ข้อความเด้งมุมจอแล้วหายเองใน 3 วินาที */
function toast(text) {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    document.body.appendChild(box);
  }
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = icon('checkCircle', 14, 'toast__icon') + escapeHtml(text);
  box.appendChild(item);
  setTimeout(() => item.remove(), 3000);
}
