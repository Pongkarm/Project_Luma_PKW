/*
 * generate/mask-tools.js — แถบเครื่องมือของการระบาย mask
 *
 * พู่กัน/ยางลบ, ขนาด, ย้อนกลับ/ทำซ้ำ, ดูเฉพาะ mask และคีย์ลัด
 * ตัวระบายจริง (วาดลง canvas, ส่งออกเป็นภาพขาวดำ) อยู่ใน js/mask.js
 */

/* เรียกทุกครั้งที่ mask เปลี่ยน: อัปเดต % ที่ระบาย, ปุ่มย้อนกลับ/ทำซ้ำ, ปุ่มสร้างภาพ */
function onMaskChanged() {
  const percent = Math.round(MaskEditor.coverage() * 100);
  $('mask-coverage').textContent = percent > 0 ? 'ระบายแล้ว · ' + percent + '% ของภาพ' : 'ระบายพื้นที่ที่ต้องการแก้';
  $('undo-button').disabled = MaskEditor.undoStack.length === 0;
  $('redo-button').disabled = MaskEditor.redoStack.length === 0;
  $('clear-button').disabled = percent === 0;
  if (percent > 0) showAlert($('form-alert'), '');
  updateFooter();
}

/* สลับพู่กัน / ยางลบ */
function setBrushMode(newMode) {
  MaskEditor.mode = newMode;
  $('brush-button').setAttribute('aria-selected', newMode === 'brush');
  $('eraser-button').setAttribute('aria-selected', newMode === 'eraser');
}

/* ตั้งขนาดพู่กัน (4–200) ผ่านแถบเลื่อน เพื่อให้ตัวเลขข้าง ๆ อัปเดตตาม */
function setBrushSize(size) {
  const value = Math.min(200, Math.max(4, size));
  $('brush-size').value = value;
  $('brush-size').dispatchEvent(new Event('input'));
}

/* ผูกปุ่มทั้งหมดของแถบเครื่องมือระบาย และคีย์ลัด */
function setupMask() {
  MaskEditor.init($('mask-canvas'), onMaskChanged);
  bindSlider('brush-size', null, () => {
    MaskEditor.brushSize = Number($('brush-size').value);
    $('brush-size-value').textContent = $('brush-size').value;
  });
  $('brush-button').addEventListener('click', () => setBrushMode('brush'));
  $('eraser-button').addEventListener('click', () => setBrushMode('eraser'));
  $('undo-button').addEventListener('click', () => MaskEditor.undo());
  $('redo-button').addEventListener('click', () => MaskEditor.redo());
  $('clear-button').addEventListener('click', () => MaskEditor.clear());

  // ดูเฉพาะพื้นที่ที่ระบาย (ซ่อนภาพ แสดง mask เป็นสีขาวบนพื้นดำ)
  $('mask-only-button').addEventListener('click', () => {
    const on = $('mask-only-button').getAttribute('aria-pressed') !== 'true';
    $('mask-only-button').setAttribute('aria-pressed', on);
    $('mask-frame').classList.toggle('mask-frame--mask-only', on); // หน้าตาอยู่ใน css/extra.css
  });

  // คีย์ลัด: B พู่กัน, E ยางลบ, [ ] ขนาด, ⌘Z ย้อนกลับ, ⌘⇧Z ทำซ้ำ
  document.addEventListener('keydown', (event) => {
    if ($('mask-view').hidden) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) MaskEditor.redo();
      else MaskEditor.undo();
    } else if (key === 'b') setBrushMode('brush');
    else if (key === 'e') setBrushMode('eraser');
    else if (key === '[') setBrushSize(MaskEditor.brushSize - 6);
    else if (key === ']') setBrushSize(MaskEditor.brushSize + 6);
  });
}
