/*
 * history/detail.js — แผงรายละเอียดของงานที่เลือก (ด้านขวา)
 */

/* หนึ่งช่องในตารางค่าของงาน: ชื่อ + ค่า */
function fact(label, value) {
  return '<div class="stack"><span class="eyebrow">' + label + '</span><span class="mono text-xs">' + escapeHtml(value) + '</span></div>';
}

/* เปิดแผงรายละเอียดของงาน — ข้อความแสดงทันที ส่วนภาพโหลดตามมา */
async function select(run) {
  selected = run;
  history.replaceState(null, '', 'history.html?id=' + run.id); // ลิงก์นี้ส่งต่อให้คนอื่นเปิดงานเดียวกันได้
  for (const card of document.querySelectorAll('.runcard')) card.setAttribute('aria-current', card.dataset.id === run.id);

  $('detail').hidden = false;
  $('detail-id').textContent = run.id.slice(0, 8);
  $('detail-prompt').textContent = run.prompt;
  $('detail-negative-box').hidden = !run.negative_prompt;
  $('detail-negative').textContent = run.negative_prompt || '';

  // สาเหตุที่ไม่สำเร็จ (งานที่ถูกหยุดเองไม่นับว่าผิดพลาด)
  const failed = run.status === 'failed' && run.error_message;
  $('detail-error-box').hidden = !failed;
  if (failed) {
    $('detail-error-title').textContent = wasCancelled(run) ? 'คุณหยุดงานนี้ไว้' : 'สาเหตุที่ไม่สำเร็จ';
    $('detail-error').textContent = wasCancelled(run) ? 'ยังไม่ได้สร้างภาพ คำสั่งและค่าที่ตั้งไว้ยังอยู่ครบ' : run.error_message;
    $('detail-error').classList.toggle('detail-error--fail', !wasCancelled(run)); // สีแดงเฉพาะที่ล้มเหลวจริง
  }

  $('detail-facts').innerHTML =
    fact('โหมด', run.task_type) +
    fact('โมเดล', run.model_name.replace(/\.safetensors$/, '')) +
    fact('ขนาด', run.width + ' × ' + run.height) +
    fact('รอบ / ความเคร่ง', run.steps + ' · ' + run.cfg_scale) +
    fact('วิธีสุ่ม', run.sampler_name) +
    fact('ใช้เวลา', run.duration_seconds != null ? run.duration_seconds.toFixed(2) + ' วิ' : '—') +
    fact('Seed ที่ส่ง', run.seed === null ? 'สุ่ม' : String(run.seed)) +
    fact('สร้างเมื่อ', formatDate(run.created_at));

  // ปุ่มด้านล่าง: บางปุ่มใช้ได้เฉพาะงานที่เสร็จแล้ว
  const done = run.status === 'completed';
  $('detail-studio').hidden = !done;
  $('detail-follow').hidden = isFinished(run);
  // ปุ่มบันทึกภาพแสดงหลังโหลดภาพของงานนี้สำเร็จเท่านั้น (ไม่อย่างนั้นจะบันทึกภาพของงานก่อนหน้า)
  $('detail-save').hidden = true;
  $('detail-save').removeAttribute('href');

  // ภาพผลลัพธ์
  selectedImageUrl = null;
  if (done) {
    $('detail-image').innerHTML = '<span class="skeleton skeleton--detail"></span>';
    try {
      const url = imageUrls[run.id] || (await apiImageUrl('/generations/' + run.id + '/image'));
      imageUrls[run.id] = url;
      if (selected !== run) return;
      selectedImageUrl = url;
      $('detail-image').innerHTML = '<img class="img-in" src="' + url + '" alt="' + escapeHtml(run.prompt) + '" title="ดูขนาดเต็ม" />';
      $('detail-save').href = url;
      $('detail-save').download = 'luma-' + run.id + '.png';
      $('detail-save').hidden = false;
    } catch (error) {
      if (selected === run) $('detail-image').innerHTML = '<span class="pad-24">โหลดภาพไม่ได้</span>';
    }
  } else {
    $('detail-image').innerHTML = '<div class="pad-24">' + statusChip(run.status) + '</div>';
  }

  // ภาพต้นฉบับที่ใช้ (โหมดจากภาพ / แก้เฉพาะจุด)
  $('detail-source-box').hidden = !run.source_image_path;
  if (run.source_image_path) {
    const filename = run.source_image_path.split(/[\\/]/).pop();
    $('detail-source').removeAttribute('src');
    apiImageUrl('/uploads/' + filename)
      .then((url) => {
        if (selected === run) $('detail-source').src = url;
      })
      .catch(() => {});
  }
}

/* ปิดแผงรายละเอียด */
function closeDetail() {
  selected = null;
  $('detail').hidden = true;
  history.replaceState(null, '', 'history.html');
  for (const card of document.querySelectorAll('.runcard')) card.setAttribute('aria-current', 'false');
}

/* ใช้ค่าเดิม: เขียนค่าของงานนี้ลงร่างของหน้าสร้างภาพ แล้วเปิดหน้านั้น */
function reuseSettings() {
  let draft = {};
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch (ignored) {
    // ร่างเสีย — เขียนใหม่
  }
  Object.assign(draft, {
    mode: 'txt2img',
    prompt: selected.prompt,
    'negative-prompt': selected.negative_prompt || '',
    model: selected.model_name,
    lora: selected.lora_config && selected.lora_config.id ? selected.lora_config.id : '',
    sampler: selected.sampler_name,
    steps: String(selected.steps),
    cfg: String(selected.cfg_scale),
    width: String(selected.width),
    height: String(selected.height),
    // backend ไม่ได้บอก seed ที่สุ่มได้จริง จึงส่งต่อได้เฉพาะ seed ที่ผู้ใช้ตั้งเอง
    seed: selected.seed === null ? '' : String(selected.seed),
  });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  location.href = 'generate.html';
}

/* ลบงานที่เปิดอยู่ (ถามยืนยันก่อน) แล้วโหลดรายการใหม่ */
async function deleteSelected() {
  const ok = await confirmDialog({ title: 'ลบภาพนี้?', body: 'ภาพและประวัติจะถูกลบถาวร กู้คืนไม่ได้', confirmText: 'ลบถาวร', cancelText: 'เก็บไว้' });
  if (!ok) return;
  try {
    await apiRequest('/generations/' + selected.id, { method: 'DELETE' });
    toast('ลบภาพแล้ว');
    closeDetail();
    loadPage();
    refreshUser();
  } catch (error) {
    toast('ลบภาพไม่สำเร็จ: ' + error.message);
  }
}
