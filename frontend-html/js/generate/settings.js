/*
 * generate/settings.js — แผงตั้งค่าด้านขวา
 *
 * เติมรายชื่อโมเดล/สไตล์, ปุ่มขนาดภาพ 1:1 2:3 3:2, แถบเลื่อนต่าง ๆ
 */

/* เติมตัวเลือกใน <select> จากรายการ { value, text } */
function fillSelect(select, items) {
  select.innerHTML = items
    .map((item) => '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.text) + '</option>')
    .join('');
}

/* ขอรายชื่อโมเดลจริงจากเครื่อง AI ผ่าน backend ถ้าไม่ได้ใช้รายชื่อสำรองใน config.js */
async function loadModels() {
  let checkpoints = FALLBACK_CHECKPOINTS;
  let loras = FALLBACK_LORAS;
  try {
    const catalogue = await apiRequest('/api/models');
    if (catalogue.checkpoints && catalogue.checkpoints.length) checkpoints = catalogue.checkpoints;
    if (catalogue.loras && catalogue.loras.length) loras = catalogue.loras;
  } catch (ignored) {
    // เครื่อง AI ไม่ตอบ — ใช้รายชื่อสำรอง
  }
  // เครื่อง AI ไม่ได้บอกคำอธิบายโมเดล จึงเอาคำอธิบายจากรายชื่อสำรองที่ id ตรงกันมาใส่
  fillSelect(
    $('model'),
    checkpoints.map((m) => {
      const known = FALLBACK_CHECKPOINTS.find((f) => f.id === m.id);
      return { value: m.id, text: known ? known.name + ' — ' + known.description : m.name };
    }),
  );
  fillSelect($('lora'), [{ value: '', text: 'ไม่ใช้' }, ...loras.map((l) => ({ value: l.id, text: l.name }))]);
}

/* ปุ่มขนาดสำเร็จรูป 1:1 / 2:3 / 3:2 / กำหนดเอง */
function drawSizePresets() {
  const width = Number($('width').value);
  const height = Number($('height').value);
  const customOpen = !$('custom-size').hidden;
  // ปุ่มที่เลือกอยู่ = พื้นทึบ (btn--secondary), ปุ่มอื่น = โปร่งมีกรอบ (btn--ghost btn--outlined)
  const look = (on) => (on ? 'btn--secondary' : 'btn--ghost btn--outlined');
  let html = '';
  for (const preset of SIZE_PRESETS) {
    const active = !customOpen && preset.width === width && preset.height === height;
    // กรอบเล็ก ๆ แสดงรูปร่างของภาพ: จัตุรัส / แนวตั้ง / แนวนอน
    const shape = preset.width === preset.height ? 'square' : preset.height > preset.width ? 'tall' : 'wide';
    html +=
      '<button type="button" class="btn btn--sm gap-6 ' + look(active) + '" aria-pressed="' + active + '"' +
      ' data-width="' + preset.width + '" data-height="' + preset.height + '" title="' + preset.name + ' · ' + preset.width + ' × ' + preset.height + '">' +
      '<span aria-hidden="true" class="size-shape size-shape--' + shape + '"></span>' +
      preset.label + '</button>';
  }
  html +=
    '<button type="button" class="btn btn--sm ' + look(customOpen) + '" aria-pressed="' + customOpen + '" data-custom="1">กำหนดเอง</button>';
  $('size-presets').innerHTML = html;
  $('size-meta').textContent = width + ' × ' + height + ' px · ' + ratioText(width, height);
  $('size-reset').disabled = width === DEFAULT_SIZE.width && height === DEFAULT_SIZE.height && !customOpen;
}

let paintWidth;
let paintHeight;
let paintSteps;
let paintCfg;
let paintDenoise;

/* เตรียมแผงขวา: ผูกแถบเลื่อน ปุ่มพับ/กาง ปุ่มขนาด และตัวนับตัวอักษร */
function setupForm() {
  fillSelect($('sampler'), SAMPLERS.map((s) => ({ value: s, text: s })));

  paintWidth = bindSlider('width', 'width-number', onSizeChanged);
  paintHeight = bindSlider('height', 'height-number', onSizeChanged);
  paintSteps = bindSlider('steps', 'steps-number', saveDraft);
  paintCfg = bindSlider('cfg', 'cfg-number', saveDraft);
  paintDenoise = bindSlider('denoise', 'denoise-number', () => {
    saveDraft();
    updateFooter();
  });
  bindDisclosure('avoid-toggle', 'luma.html.avoidOpen');
  bindDisclosure('advanced-toggle', 'luma.html.advancedOpen');

  // ปุ่มขนาดสำเร็จรูป
  $('size-presets').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.custom) {
      $('custom-size').hidden = !$('custom-size').hidden;
    } else {
      $('custom-size').hidden = true;
      setSize(Number(button.dataset.width), Number(button.dataset.height));
    }
    drawSizePresets();
  });
  $('swap-button').addEventListener('click', () => setSize(Number($('height').value), Number($('width').value)));
  $('size-reset').addEventListener('click', () => {
    $('custom-size').hidden = true;
    setSize(DEFAULT_SIZE.width, DEFAULT_SIZE.height);
  });

  $('seed-random').addEventListener('click', () => {
    $('seed').value = Math.floor(Math.random() * 2 ** 32);
    saveDraft();
  });

  // ตัวนับตัวอักษร
  const count = () => {
    $('prompt-count').textContent = $('prompt').value.length + ' / ' + LIMITS.promptMax;
    $('negative-count').textContent = $('negative-prompt').value.length + ' / ' + LIMITS.promptMax;
    updateFooter();
  };
  $('prompt').addEventListener('input', count);
  $('negative-prompt').addEventListener('input', count);
  for (const id of ['prompt', 'negative-prompt', 'model', 'lora', 'sampler', 'seed']) {
    $(id).addEventListener('input', saveDraft);
    $(id).addEventListener('change', saveDraft);
  }
  count();
}

/* ตั้งขนาดภาพ (ปัดให้ถูกกติกาก่อนเสมอ) */
function setSize(width, height) {
  $('width').value = snapSize(width);
  $('height').value = snapSize(height);
  paintWidth();
  paintHeight();
  onSizeChanged();
}

/* ขนาดเปลี่ยน → วาดปุ่มขนาดใหม่ อัปเดตปุ่มสร้าง และจดร่าง */
function onSizeChanged() {
  drawSizePresets();
  updateFooter();
  saveDraft();
}
