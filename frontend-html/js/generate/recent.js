/*
 * generate/recent.js — แถบ "สร้างล่าสุด" ด้านล่าง
 *
 * 12 งานล่าสุด กดแล้วเปิดงานนั้นตรงกลาง
 */

const thumbUrls = {}; // จำภาพที่โหลดแล้ว จะได้ไม่ต้องโหลดซ้ำ

/* GET /generations 12 งานล่าสุด — วาดช่องว่างไว้ก่อน แล้วค่อย ๆ เติมภาพทีละภาพ */
async function loadRecent() {
  let data;
  try {
    data = await apiRequest('/generations?page=1&page_size=12');
  } catch (ignored) {
    return;
  }
  const row = $('runstrip-row');
  row.innerHTML = data.items
    .map((item) => {
      let inner;
      if (thumbUrls[item.id]) inner = '<img class="img-in" alt="" src="' + thumbUrls[item.id] + '" />';
      else if (item.status === 'failed') inner = icon('xCircle', 16);
      else if (item.status === 'completed') inner = '<span class="skeleton fill"></span>';
      else if (item.status === 'processing') inner = icon('refresh', 16, 'spin');
      else inner = icon('queue', 16).replaceAll('<path ', '<path stroke-dasharray="3 3" ');
      return (
        '<button type="button" class="thumb" data-run="' + item.id + '" aria-current="false" title="' +
        escapeHtml(STATUS[item.status].text + ' · ' + item.prompt) + '">' + inner + '</button>'
      );
    })
    .join('');
  markActiveThumb();
  updateView();

  for (const item of data.items) {
    if (item.status !== 'completed' || thumbUrls[item.id]) continue;
    apiImageUrl('/generations/' + item.id + '/image')
      .then((url) => {
        thumbUrls[item.id] = url;
        const thumb = row.querySelector('[data-run="' + item.id + '"]');
        if (thumb) thumb.innerHTML = '<img class="img-in" alt="" src="' + url + '" />';
      })
      .catch(() => {});
  }
}

/* ไฮไลต์ภาพในแถบที่ตรงกับงานที่เปิดอยู่ */
function markActiveThumb() {
  for (const thumb of document.querySelectorAll('#runstrip-row .thumb')) {
    thumb.setAttribute('aria-current', Boolean(run && thumb.dataset.run === run.id));
  }
}

/* เปิดงานจากแถบล่าง (หรือจาก ?run=id) มาแสดงตรงกลาง */
async function openRecent(runId) {
  try {
    watchRun(await apiRequest('/generations/' + runId));
  } catch (error) {
    toast(error.message);
  }
}
