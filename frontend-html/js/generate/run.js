/*
 * generate/run.js — ส่งงานและติดตามงาน
 *
 * submit() → POST /generations → watchRun() → poll() ซ้ำจนเสร็จ → onFinished() โหลดภาพ
 */

/* รวมค่าจากฟอร์มเป็นข้อมูลที่ backend ต้องการ (ดู GenerationRequest ของ backend) */
function buildRequest(maskUrl) {
  const seedText = $('seed').value.trim();
  const out = outputSize();
  const request = {
    task_type: mode,
    prompt: $('prompt').value.trim(),
    negative_prompt: $('negative-prompt').value.trim() || null,
    model_name: $('model').value,
    // backend รับ lora_config เป็น object และ AI ใช้แค่ตัวแรก จึงส่งตัวเดียว
    lora_config: $('lora').value ? { id: $('lora').value } : null,
    sampler_name: $('sampler').value,
    steps: Number($('steps').value),
    cfg_scale: Number($('cfg').value),
    seed: seedText === '' || !Number.isFinite(Number(seedText)) ? null : Number(seedText),
    width: out.width,
    height: out.height,
  };
  if (mode !== 'txt2img') {
    request.source_image_path = source.url;
    request.denoising_strength = Number($('denoise').value);
    request.mask_image_path = mode === 'inpaint' ? maskUrl : null;
  }
  return request;
}

/* กดสร้างภาพ: (ถ้าแก้เฉพาะจุด อัปโหลด mask ก่อน) แล้ว POST /generations */
async function submit() {
  if ($('generate-button').disabled) return;
  submitting = true;
  updateFooter();
  showAlert($('form-alert'), '');
  saveDraft();
  try {
    let maskUrl = null;
    if (mode === 'inpaint') {
      // mask ก็อัปโหลดผ่าน /uploads เหมือนภาพทั่วไป
      const maskBlob = await MaskEditor.exportMask();
      maskUrl = (await apiUpload('/uploads', maskBlob, 'mask.png')).url;
    }
    const created = await apiRequest('/generations', { method: 'POST', json: buildRequest(maskUrl) });
    watchRun(created);
    loadRecent();
  } catch (error) {
    showAlert($('form-alert'), error.message);
  } finally {
    submitting = false;
    updateFooter();
  }
}

/* ---------- ติดตามงาน ---------- */

/*
 * ภาพที่โหลดมาแสดงถูกเก็บในหน่วยความจำของเบราว์เซอร์ (object URL)
 * ต้องคืนเมื่อเลิกแสดง ไม่อย่างนั้นเปิดดูงานหลาย ๆ งานแล้วหน่วยความจำจะเต็มขึ้นเรื่อย ๆ
 */
function releaseImages() {
  if (runImageUrl) URL.revokeObjectURL(runImageUrl);
  if (quick) URL.revokeObjectURL(quick.url);
  runImageUrl = null;
  runImageBlob = null;
  quick = null;
  quickBusy = null;
}

/* เริ่มติดตามงาน: ล้างของเก่า, เริ่มนาฬิกานับเวลา, แล้วเริ่มถามสถานะ */
function watchRun(newRun) {
  stopWatching();
  releaseImages();
  run = newRun;
  progress = null;
  stalled = false;
  startClock();
  updateView();
  markActiveThumb();
  if (isFinished(run)) onFinished();
  else poll();
}

/* เริ่มนาฬิกานับเวลาตั้งแต่ตอนนี้ (ตัวเลข "ผ่านไป 0:12" ใต้แถบความคืบหน้า) */
function startClock() {
  clearInterval(clockTimer);
  watchStartedAt = Date.now();
  clockTimer = setInterval(() => {
    const clock = $('run-clock');
    if (clock) clock.textContent = formatClock((Date.now() - watchStartedAt) / 1000);
  }, 1000);
}

/* หยุดถามสถานะและหยุดนาฬิกา — คำตอบของรอบที่ส่งไปแล้วจะถูกทิ้ง (ดู watchToken) */
function stopWatching() {
  watchToken += 1;
  clearTimeout(pollTimer);
  clearInterval(clockTimer);
}

/*
 * ถามสถานะงานซ้ำ ๆ
 *  - นาทีแรก ถามทุก 2 วินาที หลังจากนั้นทุก 5 วินาที
 *  - เกิน 5 นาทีแล้วยังไม่เสร็จ → หยุดถาม และบอกผู้ใช้ตรง ๆ
 */
async function poll() {
  const token = watchToken;
  const runId = run.id;
  try {
    const latest = await apiRequest('/generations/' + runId);
    if (token !== watchToken) return; // ผู้ใช้หยุด/ปิด/เปลี่ยนงานไปแล้ว
    run = latest;
    if (!isFinished(run)) {
      progress = await apiRequest('/generations/' + runId + '/progress').catch(() => null);
      if (token !== watchToken) return;
    }
  } catch (error) {
    if (token !== watchToken) return;
    // เน็ตสะดุด — ลองใหม่รอบหน้า
  }

  if (isFinished(run)) return onFinished();

  const watched = Date.now() - watchStartedAt;
  if (watched > POLL_GIVE_UP_MS) {
    stalled = true;
    clearInterval(clockTimer);
    renderStage();
    return;
  }
  renderStage();
  pollTimer = setTimeout(poll, watched > 60 * 1000 ? 5000 : 2000);
}

/* งานจบแล้ว (สำเร็จ/ล้มเหลว/หยุด): อัปเดตแถบล่าง จำนวนงาน และโหลดภาพผลลัพธ์ */
async function onFinished() {
  clearInterval(clockTimer);
  renderStage();
  loadRecent();
  refreshUser();
  if (run.status !== 'completed') return;

  // ภาพอยู่หลังการล็อกอิน ต้องดึงด้วย token
  const runId = run.id;
  try {
    const blob = await apiBlob('/generations/' + runId + '/image');
    if (!run || run.id !== runId) return;
    runImageBlob = blob;
    runImageUrl = URL.createObjectURL(blob);
  } catch (error) {
    toast('โหลดภาพที่สร้างเสร็จไม่ได้');
  }
  if (run && run.id === runId) renderStage();
}

/* ปิดผลลัพธ์ กลับไปหน้าว่าง (ค่าที่ตั้งไว้ในแผงขวายังอยู่) */
function closeRun() {
  stopWatching();
  releaseImages();
  run = null;
  markActiveThumb();
  updateView();
}

/* POST /generations/{id}/cancel — backend บันทึกเป็น failed + "Cancelled by user" */
async function cancelRun(button) {
  button.disabled = true;
  try {
    run = await apiRequest('/generations/' + run.id + '/cancel', { method: 'POST' });
    stopWatching();
    toast('หยุดงานแล้ว');
    onFinished();
  } catch (error) {
    // 409 = งานเสร็จไปก่อนที่จะหยุดทัน — ไม่ใช่ปัญหา รอผลรอบถัดไป
    toast(error.status === 409 ? 'งานเสร็จก่อนที่จะหยุดทัน' : 'หยุดงานนี้ไม่สำเร็จ');
    button.disabled = false;
  }
}

/* ลบงานและไฟล์ภาพถาวร (ถามยืนยันก่อน) */
async function deleteRun() {
  const ok = await confirmDialog({ title: 'ลบภาพนี้?', body: 'ภาพและประวัติจะถูกลบถาวร กู้คืนไม่ได้', confirmText: 'ลบถาวร', cancelText: 'เก็บไว้' });
  if (!ok) return;
  try {
    await apiRequest('/generations/' + run.id, { method: 'DELETE' });
    toast('ลบภาพแล้ว');
    closeRun();
    loadRecent();
    refreshUser();
  } catch (error) {
    toast('ลบภาพไม่สำเร็จ: ' + error.message);
  }
}

/* เอาภาพที่แสดงอยู่ (หรือภาพที่แต่งด่วนแล้ว) ไปเป็นภาพต้นฉบับของงานถัดไป */
async function useAsSource(button) {
  button.disabled = true;
  try {
    const blob = quick ? quick.blob : runImageBlob;
    const uploaded = await apiUpload('/uploads', blob, 'result.png');
    const name = 'ภาพที่สร้าง ' + run.id.slice(0, 8) + '.png';
    closeRun();
    if (mode === 'txt2img') setMode('img2img');
    setSource({ url: uploaded.url, width: uploaded.width, height: uploaded.height, name, sizeBytes: uploaded.size_bytes }, URL.createObjectURL(blob));
  } catch (error) {
    toast('ใช้ภาพนี้เป็นต้นฉบับไม่ได้');
    button.disabled = false;
  }
}

/* คลิกปุ่มต่าง ๆ ในพื้นที่ตรงกลาง (ปุ่มถูกสร้างใหม่ทุกครั้ง จึงดักที่กล่องแม่ทีเดียว) */
function onStageClick(event) {
  const target = event.target.closest('[data-action], [data-quick]');
  if (!target || target.disabled) return;
  if (target.dataset.quick) return applyQuick(target.dataset.quick, target.dataset.color);

  const action = target.dataset.action;
  if (action === 'cancel') cancelRun(target);
  if (action === 'retry') closeRun();
  if (action === 'check') {
    stalled = false;
    startClock();
    renderStage();
    poll();
  }
  if (action === 'view' && (quick || runImageUrl)) openViewer(quick ? quick.url : runImageUrl, run.prompt);
  if (action === 'use-source') useAsSource(target);
  if (action === 'delete') deleteRun();
  if (action === 'original') {
    URL.revokeObjectURL(quick.url);
    quick = null;
    renderResult();
  }
  if (action === 'studio') {
    sessionStorage.setItem('luma.studio-handoff', JSON.stringify({ runId: run.id }));
    location.href = 'studio.html';
  }
}
