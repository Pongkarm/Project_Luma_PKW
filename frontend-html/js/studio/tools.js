/*
 * studio/tools.js — เรียกเครื่องมือของ backend และรับ/ส่งภาพกับหน้าอื่น
 */

/* ---------- ใช้เครื่องมือ ---------- */

/* ใช้เครื่องมือกับเวอร์ชันที่แสดงอยู่ → ได้เวอร์ชันใหม่ (ตัดฉากได้ mask มาด้วย) */
async function applyTool() {
  if (!current || busy) return;
  const mySession = session;
  const sourceVersion = current;
  const fields = {};
  let detail = null;
  if (tool === 'sketch') {
    detail = String(oddKernel(Number($('blur').value)));
    fields.blur_ksize = detail;
  }
  if (tool === 'color-splash') {
    detail = color;
    fields.target_color = color;
  }

  busy = true;
  showAlert($('tool-alert'), '');
  render();

  try {
    // ส่งตัวไฟล์ภาพไปเสมอ (ไม่ส่งเป็นที่อยู่ไฟล์) เพื่อให้ใช้เครื่องมือต่อกันได้
    const result = await apiUpload('/api/tools/' + tool, sourceVersion.blob, 'source.png', fields);
    const blob = await apiBlob(toServerPath(result.result_image_url));
    const maskPath = tool === 'remove-bg' ? toServerPath(result.mask_image_url) : null;
    const maskBlob = maskPath ? await apiBlob(maskPath) : null;
    if (mySession !== session) return; // ผู้ใช้เปลี่ยน/ปิดภาพไปแล้ว — ทิ้งผลนี้

    const version = { blob, url: URL.createObjectURL(blob), tool, detail, parent: sourceVersion };
    if (tool === 'pose') version.landmarks = result.landmarks || [];
    if (maskBlob) version.mask = { blob: maskBlob, url: URL.createObjectURL(maskBlob), path: maskPath };
    busy = false;
    await addVersion(version);
  } catch (error) {
    if (mySession !== session) return;
    busy = false;
    if (error.status === 404 || error.status === 405) {
      showAlert($('tool-alert'), 'เซิร์ฟเวอร์นี้ยังไม่มีเครื่องมือสตูดิโอ จะมาพร้อมอัปเดต backend รอบหน้า ภาพของคุณไม่ได้มีปัญหาอะไร', 'note');
    } else {
      showAlert($('tool-alert'), error.message || 'เครื่องมือทำงานไม่สำเร็จ ลองอีกครั้ง');
    }
    render();
  }
}

/* ---------- ส่งต่อไปหน้าสร้างภาพ ---------- */

/*
 * อัปโหลดภาพ (blob) ไปที่ /uploads แล้วฝากข้อมูลไว้ใน sessionStorage
 * หน้า generate.html จะอ่านไปใช้ตอนเปิด
 */
async function sendToGenerate(blob, extra, button) {
  button.disabled = true;
  try {
    const uploaded = await apiUpload('/uploads', blob, 'studio.png');
    sessionStorage.setItem(
      'luma.handoff',
      JSON.stringify({
        mode: 'img2img',
        source: { url: uploaded.url, width: uploaded.width, height: uploaded.height, name: 'ภาพจากสตูดิโอ.png', sizeBytes: uploaded.size_bytes },
        ...extra,
      }),
    );
    location.href = 'generate.html';
  } catch (error) {
    toast('ส่งภาพไปหน้าสร้างภาพไม่ได้');
    button.disabled = false;
  }
}

/*
 * ส่งภาพตัดฉากไปวาดใหม่ในโหมดแก้เฉพาะจุด
 * ใช้ภาพ "ก่อนตัดฉาก" เป็นต้นฉบับ และ mask ที่ backend ให้มา (ขาว = ตัวแบบ)
 *   invert = true  → ระบายฉากหลัง (วาดฉากหลังใหม่)
 *   invert = false → ระบายตัวแบบ (วาดตัวแบบใหม่)
 */
function sendCutout(invert, button) {
  sendToGenerate(current.parent.blob, { mode: 'inpaint', maskPath: current.mask.path, invertMask: invert }, button);
}

/* ---------- เปิดภาพ ---------- */

/* เปิดภาพจากเครื่อง (ตรวจชนิด/ขนาดก่อน) */
function openFile(file) {
  if (!LIMITS.uploadTypes.includes(file.type)) return toast('รองรับเฉพาะไฟล์ PNG, JPEG และ WebP');
  if (file.size > LIMITS.uploadMaxBytes) return toast('ไฟล์ใหญ่เกินขีดจำกัด 10 MB');
  startWith(file, file.name);
}

/* เปิดภาพผลลัพธ์ของงานที่สร้างไว้ */
async function openRun(runId) {
  try {
    const blob = await apiBlob('/generations/' + runId + '/image');
    startWith(blob, 'ภาพที่สร้าง ' + runId.slice(0, 8));
  } catch (error) {
    toast('เปิดภาพนี้ไม่ได้');
  }
}

/* ภาพที่เพิ่งสร้าง 8 ภาพล่าสุด ให้กดเปิดได้เลย */
async function loadRecent() {
  let data;
  try {
    data = await apiRequest('/generations?page=1&page_size=' + PAGE_SIZES.recent);
  } catch (ignored) {
    return;
  }
  const done = data.items.filter((item) => item.status === 'completed').slice(0, PAGE_SIZES.studioRecent);
  if (done.length === 0) return;
  $('recent-box').hidden = false;
  $('recent-row').innerHTML = done
    .map((item) => '<button type="button" class="thumb" data-run="' + item.id + '" title="' + escapeHtml(item.prompt) + '"><span class="skeleton fill"></span></button>')
    .join('');
  for (const item of done) {
    apiImageUrl('/generations/' + item.id + '/image')
      .then((url) => {
        const thumb = $('recent-row').querySelector('[data-run="' + item.id + '"]');
        if (thumb) thumb.innerHTML = '<img class="img-in" alt="" src="' + url + '" />';
      })
      .catch(() => {});
  }
}
