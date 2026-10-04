/*
 * widgets.js — ชิ้นส่วนหน้าจอที่ใช้ซ้ำหลายหน้า
 *
 *  - ปุ่มรูปตาในช่องรหัสผ่าน
 *  - หน้าต่างยืนยัน (confirmDialog) และหน้าต่างดูภาพเต็มจอ (openViewer)
 *  - แถบเลื่อนคู่ช่องตัวเลข (bindSlider) และปุ่มพับ/กาง (bindDisclosure)
 */

/* ปุ่มรูปตาในช่องรหัสผ่าน: กดเพื่อแสดง/ซ่อนรหัส */
function setupPasswordToggles() {
  for (const button of document.querySelectorAll('.pw__toggle')) {
    const input = button.parentElement.querySelector('input');
    button.innerHTML = icon('eye', 15);
    button.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.innerHTML = icon(reveal ? 'eyeOff' : 'eye', 15);
      button.title = reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
    });
  }
}

/* ---------- หน้าต่างยืนยัน และหน้าต่างดูภาพเต็ม ---------- */

/*
 * ถามยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ (เช่น ลบ)
 * คืนค่า Promise: true = ผู้ใช้กดยืนยัน, false = กดยกเลิก/กด Esc
 */
function confirmDialog({ title, body, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', danger = true }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML =
      '<div class="dialog" role="dialog" aria-modal="true" aria-label="' + escapeHtml(title) + '">' +
      '<div class="stack gap-6">' + icon('alert', 18) +
      '<h2 class="heading-lg">' + escapeHtml(title) + '</h2>' +
      '<p class="text-muted">' + escapeHtml(body) + '</p></div>' +
      '<div class="inline gap-8">' +
      '<button type="button" class="btn btn--secondary grow" data-answer="no">' + escapeHtml(cancelText) + '</button>' +
      '<button type="button" class="btn ' + (danger ? 'btn--danger' : 'btn--primary') + ' grow" data-answer="yes">' + escapeHtml(confirmText) + '</button>' +
      '</div></div>';

    function close(answer) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(answer);
    }
    function onKey(event) {
      if (event.key === 'Escape') close(false);
    }
    backdrop.addEventListener('click', (event) => {
      if (event.target.dataset.answer) close(event.target.dataset.answer === 'yes');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-answer="no"]').focus();
  });
}

/* ดูภาพขนาดเต็มจอ — คลิกที่ไหนก็ได้หรือกด Esc เพื่อปิด */
function openViewer(url, meta = '') {
  const viewer = document.createElement('div');
  viewer.className = 'viewer';
  viewer.setAttribute('role', 'dialog');
  viewer.innerHTML =
    '<img class="viewer__img" src="' + url + '" alt="" />' +
    '<button type="button" class="viewer__close" aria-label="ปิด">' + icon('close', 16) + '</button>' +
    (meta ? '<span class="viewer__meta">' + escapeHtml(meta) + '</span>' : '');

  function close() {
    document.removeEventListener('keydown', onKey);
    viewer.remove();
  }
  function onKey(event) {
    if (event.key === 'Escape') close();
  }
  viewer.addEventListener('click', (event) => {
    if (event.target.tagName !== 'IMG') close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(viewer);
}

/*
 * แถบเลื่อนที่มีช่องตัวเลขคู่กัน (เช่น จำนวนรอบ, CFG)
 * เลื่อนแถบ → ตัวเลขเปลี่ยน, พิมพ์ตัวเลข → แถบเลื่อนตาม
 * ส่วนที่เป็นสีของแถบ (--fill) ต้องอัปเดตเองเพราะ CSS ทำไม่ได้
 */
function bindSlider(rangeId, numberId, onChange) {
  const range = $(rangeId);
  const number = numberId ? $(numberId) : null;

  function paint() {
    const percent = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty('--fill', percent + '%');
    if (number) number.value = range.value;
  }
  range.addEventListener('input', () => {
    paint();
    if (onChange) onChange();
  });
  if (number) {
    number.addEventListener('change', () => {
      const value = Math.min(Number(range.max), Math.max(Number(range.min), Number(number.value)));
      range.value = Number.isFinite(value) ? value : range.min;
      paint();
      if (onChange) onChange();
    });
  }
  paint();
  return paint; // เรียกซ้ำได้เมื่อเปลี่ยนค่าจากโค้ด
}

/* ปุ่มพับ/กาง (เช่น "ตั้งค่าขั้นสูง") — ปุ่มต้องมี aria-controls ชี้ไปที่กล่องที่จะพับ */
function bindDisclosure(buttonId, storageKey) {
  const button = $(buttonId);
  const panel = $(button.getAttribute('aria-controls'));
  const saved = storageKey ? localStorage.getItem(storageKey) : null;
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', open);
    panel.hidden = !open;
    if (storageKey) localStorage.setItem(storageKey, open);
  };
  setOpen(saved === null ? button.getAttribute('aria-expanded') === 'true' : saved === 'true');
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
}
