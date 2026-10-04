/*
 * generate/main.js — เริ่มทำงานหน้าสร้างภาพ
 *
 * ลำดับ: ตรวจล็อกอิน → เตรียมแผงตั้งค่า → โหลดโมเดล → คืนร่างเดิม → ผูกปุ่ม → รับภาพจากหน้าอื่น
 *
 * ฟังก์ชันในไฟล์นี้:
 *   start()      เริ่มทำงานหน้า — เรียกครั้งเดียวตอนโหลด (บรรทัดสุดท้ายของไฟล์)
 *
 * เชื่อมกับ:
 *   ใช้ของ     layout.js (requireLogin) และฟังก์ชันจากทุกไฟล์ใน generate/
 *   ต้องโหลดท้ายสุดใน generate.html เพราะต้องใช้ฟังก์ชันของไฟล์อื่นทั้งหมด
 */

/* ลำดับสำคัญ: ต้องโหลดรายชื่อโมเดลก่อนคืนร่าง ไม่อย่างนั้นโมเดลที่เลือกไว้จะหาตัวเลือกไม่เจอ */
async function start() {
  await requireLogin('generate');
  setupForm();
  setupMask();
  await loadModels();
  await loadDraft();
  drawSizePresets();
  setMode(mode, { keepDenoise: true });

  // ปุ่มเลือกโหมด
  for (const button of document.querySelectorAll('#mode-tabs .seg__item')) {
    button.addEventListener('click', () => {
      setMode(button.dataset.mode);
      saveDraft();
    });
  }

  // ภาพต้นฉบับ: คลิก / Enter / ลากไฟล์มาวาง
  const chooseFile = () => $('source-file').click();
  $('drop-zone').addEventListener('click', chooseFile);
  $('drop-zone').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseFile();
    }
  });
  $('drop-zone').addEventListener('dragover', (event) => {
    event.preventDefault(); // จำเป็น ไม่อย่างนั้นเบราว์เซอร์จะไม่ยอมให้วาง
    $('drop-zone').classList.add('drop--over');
  });
  $('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('drop--over'));
  $('drop-zone').addEventListener('drop', (event) => {
    event.preventDefault();
    $('drop-zone').classList.remove('drop--over');
    const file = event.dataTransfer.files[0];
    if (file) uploadSource(file);
  });
  $('source-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) uploadSource(file);
    event.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้
  });
  $('source-change').addEventListener('click', chooseFile);
  $('source-remove').addEventListener('click', removeSource);

  // ปุ่มสร้าง + คีย์ลัด ⌘↵ / Ctrl+↵
  $('generate-button').addEventListener('click', submit);
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });

  $('stage').addEventListener('click', onStageClick);
  $('close-run-button').addEventListener('click', closeRun);
  $('runstrip-row').addEventListener('click', (event) => {
    const thumb = event.target.closest('.thumb');
    if (thumb) openRecent(thumb.dataset.run);
  });

  await takeHandoff();
  loadRecent();

  // เปิดมาจากหน้าประวัติด้วย ?run=<id> → แสดงงานนั้น
  const runId = new URLSearchParams(location.search).get('run');
  if (runId) openRecent(runId);
}

start();
