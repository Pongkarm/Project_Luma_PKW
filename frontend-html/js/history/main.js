/*
 * history/main.js — เริ่มทำงานหน้าประวัติ: ผูกปุ่มทั้งหมด แล้วโหลดหน้าแรก
 */

/* เริ่มทำงาน: ผูกปุ่ม โหลดหน้าแรก แล้วเปิดงานตาม ?id= ถ้ามี */
async function start() {
  await requireLogin('history');

  $('prev-button').addEventListener('click', () => {
    page -= 1;
    loadPage();
  });
  $('next-button').addEventListener('click', () => {
    page += 1;
    loadPage();
  });

  // การ์ดถูกสร้างใหม่ทุกครั้ง จึงดักคลิก/Enter ที่กล่องแม่
  const openCard = (event) => {
    const card = event.target.closest('.runcard');
    if (card) select(runs.find((run) => run.id === card.dataset.id));
  };
  $('grid').addEventListener('click', openCard);
  $('grid').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCard(event);
    }
  });

  $('detail-image').addEventListener('click', () => {
    if (selectedImageUrl) openViewer(selectedImageUrl, selected.width + ' × ' + selected.height);
  });
  $('copy-prompt').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(selected.prompt);
      toast('คัดลอกแล้ว');
    } catch (ignored) {
      toast('คัดลอกไม่ได้ในเบราว์เซอร์นี้');
    }
  });
  $('detail-save').addEventListener('click', () => toast('บันทึกภาพลงเครื่องแล้ว'));
  $('detail-studio').addEventListener('click', () => {
    sessionStorage.setItem('luma.studio-handoff', JSON.stringify({ runId: selected.id }));
    location.href = 'studio.html';
  });
  $('detail-follow').addEventListener('click', () => {
    location.href = 'generate.html?run=' + selected.id;
  });
  $('detail-reuse').addEventListener('click', reuseSettings);
  $('detail-delete').addEventListener('click', deleteSelected);

  await loadPage();

  // เปิดด้วย history.html?id=... → เลือกงานนั้นให้เลย
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    const run = runs.find((item) => item.id === id) || (await apiRequest('/generations/' + id).catch(() => null));
    if (run) select(run);
  }
}

start();
