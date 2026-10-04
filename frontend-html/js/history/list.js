/*
 * history/list.js — หน้าประวัติ: รายการงาน
 *  - GET /generations?page=..&page_size=.. ดึงรายการทีละหน้า (ใหม่สุดก่อน)
 *  - คลิกการ์ด → แผงรายละเอียดทางขวา (ที่อยู่หน้าเว็บจะเป็น history.html?id=...)
 *
 * ไฟล์ในโฟลเดอร์ js/history/:
 *   list.js    การ์ดงานทีละหน้า  ← ไฟล์นี้
 *   detail.js  แผงรายละเอียดด้านขวา + ปุ่มบันทึก/แต่ง/ใช้ค่าเดิม/ลบ
 *   main.js    เริ่มทำงาน: ผูกปุ่มทั้งหมด
 */

const PAGE_SIZE = 24;
let page = 1;
let runs = []; // งานในหน้าที่แสดงอยู่
let selected = null; // งานที่เปิดดูรายละเอียด
let selectedImageUrl = null;
const imageUrls = {}; // จำภาพที่โหลดแล้ว

/* GET /generations หน้าปัจจุบัน แล้ววาดการ์ด */
async function loadPage() {
  showAlert($('history-alert'), '');
  let data;
  try {
    data = await apiRequest('/generations?page=' + page + '&page_size=' + PAGE_SIZE);
  } catch (error) {
    showAlert($('history-alert'), 'โหลดประวัติไม่สำเร็จ: ' + error.message);
    return;
  }

  // หน้านี้ว่าง (เช่น เพิ่งลบรายการสุดท้ายของหน้า) → ถอยกลับหนึ่งหน้า
  if (data.items.length === 0 && page > 1) {
    page -= 1;
    return loadPage();
  }

  runs = data.items;
  const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);
  $('total-text').textContent = data.total + ' รายการ';
  $('range-text').textContent = from + '–' + to + ' จาก ' + data.total;
  $('prev-button').disabled = page <= 1;
  $('next-button').disabled = page >= lastPage;

  $('empty').hidden = runs.length > 0;
  $('grid').hidden = runs.length === 0;
  drawCards();
}

/* วาดการ์ดทั้งหมด แล้วค่อย ๆ โหลดภาพของงานที่เสร็จแล้ว */
function drawCards() {
  $('grid').innerHTML = runs.map(cardHtml).join('');
  for (const run of runs) {
    if (run.status === 'completed' && !imageUrls[run.id]) loadCardImage(run);
  }
}

/* การ์ดหนึ่งใบ: ภาพ (หรือสถานะถ้ายังไม่เสร็จ) + ป้ายสถานะ + prompt */
function cardHtml(run) {
  let media;
  if (imageUrls[run.id]) {
    media = '<img class="img-in" src="' + imageUrls[run.id] + '" alt="" />';
  } else if (run.status === 'completed') {
    media = '<span class="skeleton fill"></span>';
  } else if (run.status === 'failed') {
    const text = wasCancelled(run) ? 'คุณหยุดงานนี้ไว้' : run.error_message || 'ระบบสร้างภาพนี้ไม่สำเร็จ';
    media = icon('xCircle', 18) + '<span class="runcard__error">' + escapeHtml(text.slice(0, 70)) + '</span>';
  } else {
    const spinner = run.status === 'processing' ? icon('refresh', 18, 'spin') : icon('queue', 18).replaceAll('<path ', '<path stroke-dasharray="3 3" ');
    media = spinner + '<div class="track track--card"><div class="track__indeterminate"></div></div>';
  }
  return (
    '<div class="card card--interactive runcard" role="button" tabindex="0" data-id="' + run.id + '" aria-current="' + Boolean(selected && selected.id === run.id) + '">' +
    '<div class="runcard__media" id="media-' + run.id + '">' + media + '<span class="runcard__badge">' + statusChip(run.status) + '</span></div>' +
    '<div class="runcard__body"><span class="runcard__prompt">' + escapeHtml(run.prompt) + '</span>' +
    '<span class="mono text-tiny">' + run.task_type + ' · ' + run.width + '×' + run.height + '</span></div></div>'
  );
}

/* ภาพต้องล็อกอินก่อนจึงดูได้ → ดึงทีละภาพด้วย token */
async function loadCardImage(run) {
  try {
    imageUrls[run.id] = await apiImageUrl('/generations/' + run.id + '/image');
    const media = $('media-' + run.id);
    if (media) media.innerHTML = '<img class="img-in" src="' + imageUrls[run.id] + '" alt="" /><span class="runcard__badge">' + statusChip(run.status) + '</span>';
  } catch (ignored) {
    // ไฟล์ภาพหาย — ปล่อยกล่องว่างไว้
  }
}
