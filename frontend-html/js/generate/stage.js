/*
 * generate/stage.js — พื้นที่ตรงกลาง
 *
 * วาดตามสถานะของงาน: ว่าง → รอคิว → กำลังสร้าง → เสร็จ (หรือ ล้มเหลว / หยุด / ค้างนาน)
 * ทุกครั้งที่สถานะเปลี่ยน เรียก renderStage() ให้วาดใหม่ทั้งกล่อง
 */

/* ---------- ตรงกลาง: เลือกว่าจะแสดงอะไร ---------- */

/* โหมดแก้เฉพาะจุดที่มีภาพแล้วและไม่ได้เปิดงานไหนอยู่ → แสดงที่ระบาย mask */
function updateView() {
  const showMask = mode === 'inpaint' && source && !run;
  $('mask-view').hidden = !showMask;
  $('stagebar').hidden = showMask;
  $('stage').hidden = showMask;
  $('runstrip').hidden = showMask || $('runstrip-row').children.length === 0;
  if (!showMask) renderStage();
}

/* วาดตรงกลางใหม่ทั้งกล่องตามสถานะของงาน (เรียกทุกรอบที่ถามสถานะ) */
function renderStage() {
  const stage = $('stage');
  $('stage-title').textContent = MODE_TEXT[run ? run.task_type : mode].title;
  $('close-run-button').hidden = !run;

  // ยังไม่มีงาน
  if (!run) {
    $('stage-status').className = 'mono text-meta';
    $('stage-status').textContent = source && mode !== 'txt2img' ? 'มีภาพต้นฉบับแล้ว · ยังไม่ได้สร้าง' : 'ยังไม่ได้สร้าง';
    // มีภาพต้นฉบับแล้ว → แสดงภาพนั้นตรงกลาง
    if (source && mode !== 'txt2img') {
      stage.innerHTML =
        '<div class="stack gap-10 center">' +
        '<img class="source-preview" src="' + $('mask-image').src + '" alt="ภาพต้นฉบับที่ใช้" />' +
        '<span class="mono text-meta">ภาพต้นฉบับ · ' + source.width + ' × ' + source.height + '</span></div>';
      return;
    }
    stage.innerHTML =
      '<div class="centered-note"><div class="empty-mark">' + icon('image', 22) + '</div>' +
      '<h2 class="heading">ยังไม่มีภาพ</h2>' +
      '<p class="text-muted">พิมพ์สิ่งที่อยากได้ทางขวา แล้วกดสร้างภาพ ค่าอื่นตั้งไว้ให้พร้อมใช้แล้ว</p>' +
      '<span class="kbd">⌘ + ↵</span></div>';
    return;
  }

  $('stage-status').outerHTML = '<span id="stage-status">' + statusChip(run.status) + '</span>';

  const elapsed = (Date.now() - watchStartedAt) / 1000;
  const note = (iconHtml, title, body, extra = '') =>
    '<div class="centered-note">' + iconHtml +
    '<h2 class="heading">' + title + '</h2>' +
    '<p class="text-muted">' + body + '</p>' + extra + '</div>';
  const mono = (text, id = '') => '<span class="mono text-meta"' + (id ? ' id="' + id + '"' : '') + '>' + text + '</span>';
  const cancelButton = '<button type="button" class="btn btn--secondary btn--sm" data-action="cancel">' + icon('close', 14) + 'หยุด</button>';
  const retryButton = '<button type="button" class="btn btn--secondary" data-action="retry">' + icon('refresh', 14) + 'ลองอีกครั้ง</button>';
  // กรอบที่กำลังรอภาพ ขนาดตามสัดส่วนที่ขอ
  const frame = '<div class="pending-frame" aria-hidden="true" style="width: 420px; aspect-ratio: ' + run.width + ' / ' + run.height + '"></div>';

  // รอนานเกิน 5 นาที
  if (stalled && !isFinished(run)) {
    stage.innerHTML = note(icon('alert', 22), 'ใช้เวลานานผิดปกติ',
      'งานยังค้างสถานะกำลังสร้าง อาจเสร็จในภายหลัง หรือระบบอาจทำงานหลุดไป เราหยุดตรวจสอบหลังผ่านไปห้านาที',
      '<button type="button" class="btn btn--secondary" data-action="check">' + icon('refresh', 14) + 'ตรวจสอบอีกครั้ง</button>');
    return;
  }

  if (run.status === 'pending') {
    let queue = '';
    if (progress && progress.live && progress.total_queued > 1 && progress.queue_position > 0) {
      queue = mono('คิวที่ ' + progress.queue_position + ' จาก ' + progress.total_queued);
    }
    stage.innerHTML = note(frame + statusIcon('pending', 22), 'รอ GPU ว่าง',
      'ระบบสร้างได้ทีละงาน งานของคุณจะเริ่มทันทีที่ว่าง', queue + mono(formatClock(elapsed), 'run-clock') + cancelButton);
    return;
  }

  if (run.status === 'processing') {
    // มีแถบเปอร์เซ็นต์เฉพาะเมื่อ backend วัดได้จริง (live) ไม่อย่างนั้นแสดงแถบวิ่งเฉย ๆ
    const live = progress && progress.live && progress.progress != null;
    const bar = live
      ? '<div class="track track--md"><div class="track__fill" style="width: ' + progress.progress * 100 + '%"></div></div>'
      : '<div class="track track--md"><div class="track__indeterminate"></div></div>';
    const steps = live && progress.step != null && progress.total_steps
      ? 'ขั้นที่ ' + progress.step + ' จาก ' + progress.total_steps + ' · '
      : 'ผ่านไป ';
    stage.innerHTML = note(frame + statusIcon('processing', 22), 'กำลังสร้างภาพ',
      'ปกติใช้เวลา 30–40 วินาที ออกจากหน้านี้ได้ งานยังทำต่อ',
      bar + mono(steps + '<span id="run-clock">' + formatClock(elapsed) + '</span>') + cancelButton);
    return;
  }

  if (wasCancelled(run)) {
    stage.innerHTML = note(icon('close', 22), 'คุณหยุดงานนี้ไว้', 'ยังไม่ได้สร้างภาพ คำสั่งและค่าที่ตั้งไว้ยังอยู่ครบ', retryButton);
    return;
  }

  if (run.status === 'failed') {
    const detail = run.error_message
      ? '<details class="full error-detail"><summary class="mono">error_message</summary>' +
        '<p class="mono">' + escapeHtml(run.error_message) + '</p></details>'
      : '';
    stage.innerHTML = note(icon('alert', 22), 'ระบบสร้างภาพนี้ไม่สำเร็จ', 'คำอธิบายและค่าที่ตั้งไว้ยังอยู่ ลองใหม่อีกครั้ง หรือลดขนาดภาพลง', retryButton + detail);
    return;
  }

  // เสร็จแล้ว → ภาพ + แถบปุ่ม + แต่งด่วน
  renderResult();
}

/* ---------- ผลลัพธ์ + แต่งด่วน ---------- */

const QUICK_TOOLS = { sketch: 'ลายเส้น', 'color-splash': 'เน้นสี', pose: 'ท่าทาง', 'remove-bg': 'ตัดฉาก' };

/* ภาพผลลัพธ์ + แถบปุ่ม + แถบแต่งด่วน (ถ้าแต่งด่วนอยู่ แสดงภาพที่แต่งแทนภาพเดิม) */
function renderResult() {
  const shown = quick ? quick.url : runImageUrl;
  const duration = run.duration_seconds != null ? run.duration_seconds.toFixed(2) + ' วิ' : '—';
  const editedName = quick ? ' · ' + QUICK_TOOLS[quick.tool] : '';

  const media = shown
    ? '<img class="img-in' + (quick && quick.tool === 'remove-bg' ? ' checker' : '') + '" src="' + shown + '" alt="' + escapeHtml(run.prompt) + '" />'
    : icon('image', 22);
  const busy = quickBusy
    ? '<div class="studio-busy" role="status">' + icon('refresh', 20, 'spin') + '<span>กำลังใช้ ' + QUICK_TOOLS[quickBusy] + '…</span></div>'
    : '';

  // ปุ่มแต่งด่วน — ปุ่มที่ใช้อยู่จะถูกกดค้าง (aria-pressed)
  const pressed = (tool, color) => Boolean(quick && quick.tool === tool && (!color || quick.color === color));
  const quickButton = (tool, iconName) =>
    '<button type="button" class="btn btn--ghost btn--sm" data-quick="' + tool + '" aria-pressed="' + pressed(tool) + '"' + (quickBusy ? ' disabled' : '') + '>' +
    icon(iconName, 14) + QUICK_TOOLS[tool] + '</button>';
  const swatch = (color, text) =>
    '<button type="button" class="quickbar__swatch quickbar__swatch--' + color + '" data-quick="color-splash" data-color="' + color + '"' +
    ' aria-pressed="' + pressed('color-splash', color) + '" title="เน้นสี — เก็บสี' + text + '" aria-label="เน้นสี — เก็บสี' + text + '"' + (quickBusy ? ' disabled' : '') + '></button>';

  const pose = quick && quick.tool === 'pose' ? '<span class="mono text-meta">' + quick.landmarks.length + ' จุดบนร่างกาย</span>' : '';
  const original = quick ? '<button type="button" class="btn btn--ghost btn--sm" data-action="original">' + icon('undo', 14) + 'กลับไปภาพเดิม</button>' : '';

  $('stage').innerHTML =
    '<div class="result">' +
    '<div class="result__media' + (shown ? ' result__media--zoom' : '') + ' relative" data-action="view" title="ดูขนาดเต็ม">' + media + busy + '</div>' +
    '<div class="result__bar">' +
    '<span class="result__meta">' + run.width + ' × ' + run.height + ' · ' + run.steps + ' steps · cfg ' + run.cfg_scale + ' · ' + duration + editedName + '</span>' +
    '<div class="inline gap-8">' +
    (shown
      ? '<a class="btn btn--sm btn--secondary" href="' + shown + '" download="luma-' + run.id.slice(0, 8) + (quick ? '-' + quick.tool : '') + '.png">' + icon('download', 14) + 'บันทึกภาพ</a>'
      : '') +
    '<button type="button" class="btn btn--secondary btn--sm" data-action="use-source">ใช้ภาพนี้เป็นต้นฉบับ</button>' +
    '<button type="button" class="btn btn--danger btn--sm" data-action="delete">' + icon('trash', 14) + 'ลบ</button>' +
    '</div></div>' +
    (runImageUrl
      ? '<div class="quickbar">' +
        '<div class="quickbar__row"><span class="eyebrow">แต่งด่วน</span><div class="quickbar__tools">' +
        quickButton('sketch', 'pencil') +
        '<span class="quickbar__group" role="group" aria-label="เน้นสี">' + icon('droplet', 14) + 'เน้นสี' + swatch('green', 'เขียว') + swatch('red', 'แดง') + '</span>' +
        quickButton('pose', 'pose') + quickButton('remove-bg', 'scissors') +
        '</div></div>' +
        '<div class="quickbar__row"><div class="quickbar__tools">' + original + pose + '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="studio">' + icon('wand', 14) + 'แต่งต่อในสตูดิโอ</button></div>' +
        '</div>'
      : '') +
    '</div>';
}

/* ใช้เครื่องมือแต่งด่วนกับภาพผลลัพธ์ (ไม่สร้างงานใหม่ แค่แสดงภาพที่แต่งแทน) */
async function applyQuick(tool, color) {
  // กดปุ่มเดิมซ้ำ = กลับไปภาพเดิม
  if (quick && quick.tool === tool && (!color || quick.color === color)) {
    URL.revokeObjectURL(quick.url);
    quick = null;
    renderResult();
    return;
  }
  const runId = run.id; // จำไว้ เผื่อผู้ใช้เปิดงานอื่นระหว่างรอ
  const isSameRun = () => run && run.id === runId;
  quickBusy = tool;
  renderResult();
  try {
    const fields = {};
    if (tool === 'sketch') fields.blur_ksize = String(LIMITS.sketchBlur.default);
    if (tool === 'color-splash') fields.target_color = color;
    const result = await apiUpload('/api/tools/' + tool, runImageBlob, 'source.png', fields);
    const blob = await apiBlob(toServerPath(result.result_image_url));
    if (!isSameRun()) return; // เปลี่ยนไปดูงานอื่นแล้ว — ทิ้งผลนี้
    if (quick) URL.revokeObjectURL(quick.url); // ภาพที่แต่งก่อนหน้าไม่ใช้แล้ว
    quick = { tool, color, blob, url: URL.createObjectURL(blob), landmarks: result.landmarks || [] };
  } catch (error) {
    if (isSameRun()) toast('แต่งภาพไม่สำเร็จ: ' + error.message);
  } finally {
    if (isSameRun()) {
      quickBusy = null;
      if (run.status === 'completed') renderResult();
    }
  }
}
