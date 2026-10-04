/*
 * generate/settings.js — แผงตั้งค่าด้านขวา
 *
 * เติมรายชื่อโมเดล/สไตล์, ปุ่มขนาดภาพ 1:1 2:3 3:2, แถบเลื่อนต่าง ๆ
 *
 * ฟังก์ชันในไฟล์นี้:
 *   fillSelect()          เติมตัวเลือกใน <select>
 *   loadModels()          ขอรายชื่อโมเดลและ LoRA จากเครื่อง AI (ใช้รายชื่อสำรองถ้าไม่ได้)
 *   availableModels / availableLoras   รายชื่อที่โหลดได้ล่าสุด (ใช้กรองช่อง LoRA)
 *   updateLoraOptions()   ให้ช่อง LoRA เหลือเฉพาะตัวที่ใช้กับโมเดลที่เลือกได้ (issue #2)
 *   drawSizePresets()     วาดปุ่มขนาด 1:1 / 2:3 / 3:2 / กำหนดเอง
 *   setupForm()           ผูกแถบเลื่อน ปุ่มพับ/กาง ปุ่มขนาด และตัวนับตัวอักษร
 *   setSize() / onSizeChanged()   เปลี่ยนขนาดภาพ แล้วอัปเดตปุ่มและร่าง
 *   paintWidth, paintHeight, ...  ฟังก์ชันวาดแถบเลื่อนใหม่ (ได้จาก bindSlider)
 *
 * เชื่อมกับ:
 *   ใช้ของ     config.js (LIMITS, DEFAULT_SIZE, SIZE_PRESETS, FALLBACK_*, SAMPLERS),
 *              widgets.js (bindSlider, bindDisclosure), state.js (snapSize, ratioText),
 *              families.js (modelFamily, compatibleLoras, FAMILY_TEXT),
 *              draft.js (saveDraft, updateFooter), api.js (apiRequest), ui.js ($, escapeHtml)
 *   ถูกใช้โดย  main.js (setupForm, loadModels, drawSizePresets), draft.js (paint*, updateLoraOptions)
 *   backend    GET /api/models
 */

/* เติมตัวเลือกใน <select> จากรายการ { value, text } */
function fillSelect(select, items) {
  select.innerHTML = items
    .map((item) => '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.text) + '</option>')
    .join('');
}

let availableModels = FALLBACK_CHECKPOINTS;
let availableLoras = FALLBACK_LORAS;

/* ขอรายชื่อโมเดลจริงจากเครื่อง AI ผ่าน backend ถ้าไม่ได้ใช้รายชื่อสำรองใน config.js */
async function loadModels() {
  try {
    const catalogue = await apiRequest('/api/models');
    if (catalogue.checkpoints && catalogue.checkpoints.length) availableModels = catalogue.checkpoints;
    if (catalogue.loras && catalogue.loras.length) availableLoras = catalogue.loras;
  } catch (ignored) {
    // เครื่อง AI ไม่ตอบ — ใช้รายชื่อสำรอง
  }
  // เครื่อง AI ไม่ได้บอกคำอธิบายโมเดล จึงเอาคำอธิบายจากรายชื่อสำรองที่ id ตรงกันมาใส่
  fillSelect(
    $('model'),
    availableModels.map((m) => {
      const known = FALLBACK_CHECKPOINTS.find((f) => f.id === m.id);
      return { value: m.id, text: known ? known.name + ' — ' + known.description : m.name };
    }),
  );
  updateLoraOptions({ quiet: true });
}

/*
 * ให้ช่อง LoRA เหลือเฉพาะตัวที่ใช้กับโมเดลที่เลือกอยู่ได้ (issue #2)
 * ถ้า LoRA ที่เลือกไว้ใช้กับโมเดลใหม่ไม่ได้ → เปลี่ยนเป็น "ไม่ใช้" แล้วจดร่างใหม่
 *   quiet: true = ไม่แจ้งผู้ใช้ (ตอนโหลดหน้า / คืนร่าง)
 */
function updateLoraOptions({ quiet = false } = {}) {
  const model = availableModels.find((m) => m.id === $('model').value) || { id: $('model').value };
  const family = modelFamily(model);
  const loras = compatibleLoras(availableLoras, family);
  const previous = $('lora').value;

  fillSelect($('lora'), [{ value: '', text: 'ไม่ใช้' }, ...loras.map((l) => ({ value: l.id, text: l.name }))]);
  $('lora-hint').textContent =
    'แสดงเฉพาะสไตล์ที่ใช้กับโมเดลตระกูล ' + (FAMILY_TEXT[family] || family) + ' ได้ · เลือกได้ครั้งละหนึ่งสไตล์';

  const stillThere = loras.some((l) => l.id === previous);
  $('lora').value = stillThere ? previous : '';
  if (previous && !stillThere) {
    const dropped = availableLoras.find((l) => l.id === previous);
    if (!quiet) toast('สไตล์ "' + (dropped ? dropped.name : previous) + '" ใช้กับโมเดลนี้ไม่ได้ จึงเปลี่ยนเป็น "ไม่ใช้"');
    saveDraft();
  }
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
  // เปลี่ยนโมเดล → กรองช่อง LoRA ใหม่ (ต้องผูกก่อน saveDraft ด้านล่าง จะได้จดค่า LoRA ที่ถูกแล้ว)
  $('model').addEventListener('change', () => updateLoraOptions());
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
