/*
 * generate/source.js — ภาพต้นฉบับ (โหมดจากภาพ / แก้เฉพาะจุด)
 *
 * ภาพถูกอัปโหลดไป POST /uploads ทันทีที่เลือก งานสร้างภาพจะอ้างถึง url ที่ได้กลับมา
 */

/* ตรวจไฟล์ในเบราว์เซอร์ก่อน (ชนิด/ขนาด) แล้วอัปโหลดพร้อมแถบความคืบหน้าในกล่องลากวาง */
async function uploadSource(file) {
  if (!LIMITS.uploadTypes.includes(file.type)) return showAlert($('form-alert'), 'รองรับเฉพาะไฟล์ PNG, JPEG และ WebP');
  if (file.size > LIMITS.uploadMaxBytes) return showAlert($('form-alert'), 'ไฟล์ใหญ่เกินขีดจำกัด 10 MB');

  showAlert($('form-alert'), '');
  uploading = true;
  $('drop-zone').innerHTML =
    icon('upload', 22) + '<span class="text-strong">กำลังอัปโหลด… <span id="upload-percent">0%</span></span>' +
    '<div class="track track--sm"><div class="track__fill" id="upload-bar" style="width: 0"></div></div>';
  updateFooter();

  try {
    const uploaded = await apiUpload('/uploads', file, file.name, {}, (ratio) => {
      $('upload-percent').textContent = Math.round(ratio * 100) + '%';
      $('upload-bar').style.width = ratio * 100 + '%';
    });
    // ภาพในเครื่องเรามีอยู่แล้ว ใช้แสดงตัวอย่างได้เลย ไม่ต้องโหลดกลับจาก server
    setSource(
      { url: uploaded.url, width: uploaded.width, height: uploaded.height, name: file.name, sizeBytes: uploaded.size_bytes },
      URL.createObjectURL(file),
    );
  } catch (error) {
    showAlert($('form-alert'), error.message);
  } finally {
    uploading = false;
    resetDropZone();
    updateFooter();
  }
}

/* คืนข้อความเดิมของกล่องลากวาง (หลังอัปโหลดเสร็จหรือผิดพลาด) */
function resetDropZone() {
  $('drop-zone').innerHTML =
    icon('upload', 22) +
    '<span class="text-strong" id="drop-text">' +
    (mode === 'inpaint' ? 'ลากภาพที่จะแก้มาวาง หรือกดเลือกไฟล์' : 'ลากภาพมาวาง หรือกดเลือกไฟล์') + '</span>' +
    '<span class="field__hint">PNG, JPEG หรือ WebP · ไม่เกิน 10 MB · ไม่เกิน 4096 พิกเซล</span>';
}

/* ตั้งภาพต้นฉบับ และเตรียมพื้นที่ระบาย mask ให้ขนาดเท่าภาพ */
function setSource(newSource, previewUrl) {
  source = newSource;
  $('drop-zone').hidden = true;
  $('source-card').hidden = false;
  $('source-thumb').src = previewUrl;
  $('source-name').textContent = source.name;
  $('source-name').title = source.name;
  $('source-meta').textContent = source.width + ' × ' + source.height + (source.sizeBytes ? ' · ' + formatBytes(source.sizeBytes) : '');
  $('mask-image').src = previewUrl;
  MaskEditor.resize(source.width, source.height);

  const out = fitToEngine(source.width, source.height);
  $('output-size').textContent = out.width + ' × ' + out.height + ' px';
  $('output-size-hint').textContent =
    out.width === source.width && out.height === source.height
      ? 'ขนาดเท่าภาพที่อัปโหลด'
      : 'ย่อ/ขยายจาก ' + source.width + ' × ' + source.height + ' ให้พอดีกับระบบ (' + LIMITS.size.min + '–' + LIMITS.size.max + ')';
  $('output-size-field').hidden = mode === 'txt2img';

  saveDraft();
  updateView();
  updateFooter();
}

/* เอาภาพต้นฉบับออก กลับไปแสดงกล่องลากวาง */
function removeSource() {
  source = null;
  $('drop-zone').hidden = false;
  $('source-card').hidden = true;
  $('output-size-field').hidden = true;
  saveDraft();
  updateView();
  updateFooter();
}

/*
 * รับภาพที่ส่งมาจากหน้าอื่น (ประวัติ / สตูดิโอ) ผ่าน sessionStorage
 * รูปแบบ: { mode, source: {url,width,height,name}, maskPath?, invertMask? }
 */
async function takeHandoff() {
  const handoff = takeSessionJson('luma.handoff');
  if (!handoff || !handoff.source) return;

  closeRun();
  setMode(handoff.mode || 'img2img');
  try {
    setSource(handoff.source, await apiImageUrl(handoff.source.url));
    if (handoff.maskPath) {
      const maskImage = new Image();
      maskImage.src = await apiImageUrl(handoff.maskPath);
      await maskImage.decode();
      MaskEditor.loadMask(maskImage, Boolean(handoff.invertMask));
    }
  } catch (error) {
    showAlert($('form-alert'), 'โหลดภาพที่ส่งมาไม่สำเร็จ: ' + error.message);
  }
}
