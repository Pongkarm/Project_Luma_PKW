/*
 * studio/main.js — เริ่มทำงานหน้าสตูดิโอ: ผูกปุ่มทั้งหมดเข้ากับฟังก์ชัน
 *
 * ฟังก์ชันในไฟล์นี้:
 *   start()      ผูกปุ่มทั้งหมด แล้วเปิดภาพที่ส่งมาจากหน้าอื่น (ถ้ามี)
 *
 * เชื่อมกับ:
 *   ใช้ของ     layout.js (requireLogin), tools.js, view.js, state.js,
 *              widgets.js (bindSlider, openViewer), ui.js ($, takeSessionJson, toast)
 *   หน้าอื่น   รับ runId จาก sessionStorage คีย์ luma.studio-handoff
 *              (ฝากโดย generate/run.js และ history/main.js)
 */

/* เริ่มทำงาน: ผูกปุ่มทั้งหมด แล้วเปิดภาพที่ส่งมาจากหน้าอื่น (ถ้ามี) */
async function start() {
  await requireLogin('studio');

  // เลือกเครื่องมือ / สี
  $('tool-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('.seg__item');
    if (!button) return;
    tool = button.dataset.tool;
    renderTool();
  });
  $('color-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('.seg__item');
    if (!button) return;
    color = button.dataset.color;
    renderTool();
  });
  bindSlider('blur', 'blur-number', () => {
    $('blur').value = oddKernel(Number($('blur').value));
  });
  bindSlider('min-visibility', null, () => {
    $('min-visibility-value').textContent = Number($('min-visibility').value).toFixed(2);
    renderPose();
  });

  $('apply-button').addEventListener('click', applyTool);
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      applyTool();
    }
  });

  // เปิดภาพ: คลิก / ลากมาวาง / เลือกจากภาพล่าสุด
  const chooseFile = () => $('studio-file').click();
  $('drop-zone').addEventListener('click', chooseFile);
  $('drop-zone').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseFile();
    }
  });
  $('drop-zone').addEventListener('dragover', (event) => {
    event.preventDefault();
    $('drop-zone').classList.add('drop--over');
  });
  $('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('drop--over'));
  $('drop-zone').addEventListener('drop', (event) => {
    event.preventDefault();
    $('drop-zone').classList.remove('drop--over');
    if (event.dataTransfer.files[0]) openFile(event.dataTransfer.files[0]);
  });
  $('studio-file').addEventListener('change', (event) => {
    if (event.target.files[0]) openFile(event.target.files[0]);
    event.target.value = '';
  });
  $('recent-row').addEventListener('click', (event) => {
    const thumb = event.target.closest('.thumb');
    if (thumb) openRun(thumb.dataset.run);
  });

  // ปุ่มบนภาพ
  $('version-row').addEventListener('click', (event) => {
    const item = event.target.closest('.vstrip__item');
    if (item) selectVersion(versions[Number(item.dataset.index)]);
  });
  $('compare-button').addEventListener('click', () => {
    comparing = !comparing;
    render();
  });
  $('close-button').addEventListener('click', closeImage);
  $('studio-media').addEventListener('click', () => {
    if (!comparing && current) openViewer(showMask && current.mask ? current.mask.url : current.url, $('studio-caption').textContent);
  });
  $('use-source-button').addEventListener('click', (event) => sendToGenerate(current.blob, {}, event.currentTarget));

  // ผลของท่าทาง / ตัดฉาก
  $('copy-json').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(current.landmarks, null, 2));
      toast('คัดลอกจุดบนร่างกายแล้ว');
    } catch (ignored) {
      toast('คัดลอกไม่ได้ในเบราว์เซอร์นี้');
    }
  });
  $('toggle-mask').addEventListener('click', () => {
    showMask = !showMask;
    render();
  });
  $('replace-bg').addEventListener('click', (event) => sendCutout(true, event.currentTarget));
  $('replace-subject').addEventListener('click', (event) => sendCutout(false, event.currentTarget));

  render();

  // เปิดมาจากปุ่ม "แต่งต่อในสตูดิโอ" ในหน้าสร้างภาพ
  const handoff = takeSessionJson('luma.studio-handoff');
  if (handoff && handoff.runId) openRun(handoff.runId);
  loadRecent();
}

start();
