/*
 * generate/draft.js — โหมด, ร่างที่กรอกไว้, และปุ่มสร้างภาพ
 *
 * ร่างเก็บใน localStorage (คีย์ luma.html.draft) รีเฟรชหน้าแล้ว prompt ไม่หาย
 *
 * ฟังก์ชันในไฟล์นี้:
 *   saveDraft() / loadDraft()   จด/คืนค่าทุกช่องในแผงขวา (loadDraft โหลดภาพต้นฉบับกลับมาด้วย)
 *   setMode()                   เปลี่ยนโหมด และสลับช่องที่แสดง
 *   blocker()                   เหตุผลที่ยังกดสร้างไม่ได้ (หรือ null ถ้าพร้อม)
 *   updateFooter()              อัปเดตปุ่มสร้างภาพ และคำใบ้ขนาดที่จะได้
 *
 * เชื่อมกับ:
 *   ใช้ของ     state.js (mode, source, outputSize, MODE_TEXT), settings.js (paint*),
 *              source.js (setSource), stage.js (updateView), mask.js (MaskEditor.hasMask),
 *              config.js (DRAFT_KEY, LIMITS), api.js (apiImageUrl), ui.js ($)
 *   ถูกใช้โดย  เกือบทุกไฟล์ใน generate/ (เรียก updateFooter/saveDraft หลังมีอะไรเปลี่ยน)
 *   หน้าอื่น   history/detail.js เขียนร่างลงคีย์เดียวกันตอนกด "ใช้ค่าเดิม"
 */

/* ---------- บันทึกร่าง (prompt ไม่หายเมื่อรีเฟรชหน้า) ---------- */

const DRAFT_FIELDS = ['prompt', 'negative-prompt', 'model', 'lora', 'sampler', 'steps', 'cfg', 'seed', 'width', 'height', 'denoise'];

/* จดค่าทุกช่องในแผงขวาลง localStorage (เรียกทุกครั้งที่มีการแก้) */
function saveDraft() {
  const draft = { mode, source };
  for (const id of DRAFT_FIELDS) draft[id] = $(id).value;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/* คืนค่าที่จดไว้ตอนเปิดหน้า — ข้ามตัวเลือกที่ไม่มีแล้ว และโหลดภาพต้นฉบับกลับมาจาก server */
async function loadDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch (ignored) {
    // ร่างเสีย — เริ่มใหม่
  }
  if (!draft) return;
  for (const id of DRAFT_FIELDS) {
    if (draft[id] === undefined) continue;
    const element = $(id);
    // ข้ามตัวเลือกที่ไม่มีแล้ว (เช่น โมเดลที่ถูกลบจากเครื่อง AI)
    if (element.tagName === 'SELECT' && ![...element.options].some((o) => o.value === draft[id])) continue;
    element.value = draft[id];
  }
  for (const paint of [paintWidth, paintHeight, paintSteps, paintCfg, paintDenoise]) paint();
  $('prompt').dispatchEvent(new Event('input'));
  setMode(draft.mode || 'txt2img', { keepDenoise: true });

  // ภาพต้นฉบับอยู่บน server — โหลดตัวอย่างกลับมาแสดง
  if (draft.source) {
    try {
      setSource(draft.source, await apiImageUrl(draft.source.url));
    } catch (ignored) {
      // ไฟล์บน server หายไปแล้ว — เริ่มใหม่โดยไม่มีภาพ
    }
  }
}

/* ---------- โหมด ---------- */

/* เปลี่ยนโหมด: สลับช่องที่แสดงในแผงขวา และพื้นที่ตรงกลาง (ภาพ / ที่ระบาย mask) */
function setMode(newMode, options = {}) {
  mode = newMode;
  for (const button of document.querySelectorAll('#mode-tabs .seg__item')) {
    button.setAttribute('aria-selected', button.dataset.mode === mode);
  }
  const usesImage = mode !== 'txt2img';
  $('prompt-label').textContent = MODE_TEXT[mode].prompt;
  $('step-label').textContent = MODE_TEXT[mode].step;
  $('source-field').hidden = !usesImage;
  $('denoise-field').hidden = !usesImage;
  $('size-field').hidden = usesImage;
  $('output-size-field').hidden = !usesImage || !source;
  $('drop-text').textContent = mode === 'inpaint' ? 'ลากภาพที่จะแก้มาวาง หรือกดเลือกไฟล์' : 'ลากภาพมาวาง หรือกดเลือกไฟล์';

  if (!options.keepDenoise) {
    $('denoise').value = mode === 'inpaint' ? LIMITS.denoise.inpaint : LIMITS.denoise.img2img;
    paintDenoise();
  }
  updateView();
  updateFooter();
}

/* ---------- ปุ่มสร้างภาพ ---------- */

/* เหตุผลที่ยังกดสร้างไม่ได้ หรือ null ถ้าพร้อม */
function blocker() {
  const prompt = $('prompt').value.trim();
  if (!prompt) return 'พิมพ์คำอธิบายภาพก่อน';
  if (prompt.length > LIMITS.promptMax) return 'คำอธิบายยาวเกินไป';
  if (mode !== 'txt2img' && !source) return 'เพิ่มภาพต้นฉบับก่อน';
  if (mode === 'inpaint' && !MaskEditor.hasMask()) return 'ระบายพื้นที่ที่ต้องการแก้ก่อน';
  return null;
}

/* อัปเดตปุ่มสร้างภาพ: กดไม่ได้พร้อมบอกเหตุผล หรือกดได้พร้อมบอกขนาดที่จะได้ */
function updateFooter() {
  const reason = blocker();
  const busy = submitting || uploading;
  $('generate-button').disabled = Boolean(reason) || busy;
  $('generate-text').textContent = submitting ? 'กำลังส่งงาน…' : reason || (mode === 'inpaint' ? 'สร้างเฉพาะพื้นที่ที่ระบาย' : 'สร้างภาพ');

  const out = outputSize();
  if (mode === 'txt2img') {
    $('submit-hint').textContent = out.width + ' × ' + out.height + ' · ' + $('steps').value + ' steps';
  } else if (!source) {
    $('submit-hint').textContent = 'เพิ่มภาพต้นฉบับก่อน';
  } else {
    $('submit-hint').textContent = out.width + ' × ' + out.height + ' · change ' + Number($('denoise').value).toFixed(2);
  }
}
