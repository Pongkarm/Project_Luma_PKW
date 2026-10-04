/*
 * studio/view.js — วาดหน้าจอสตูดิโอ
 *
 * render() วาดใหม่ทั้งหมดจากข้อมูลใน state.js ทุกครั้งที่มีอะไรเปลี่ยน
 * (เลือกเวอร์ชัน, ใช้เครื่องมือเสร็จ, กดเทียบ, เปลี่ยนเครื่องมือ)
 */

/* วาดหน้าจอทั้งหมดใหม่จากข้อมูลปัจจุบัน */
function render() {
  const has = Boolean(current);
  $('studio-empty').hidden = has;
  $('studio-result').hidden = !has;
  $('stage-actions').hidden = !has;
  $('version-strip').hidden = versions.length === 0;
  $('studio-subtitle').textContent = has ? sourceLabel + ' · ' + versionName(current) : 'ยังไม่ได้สร้าง';

  renderTool();
  if (!has) return;

  // ภาพ: ปกติ / เทียบก่อน-หลัง / ดู mask
  const parent = current.parent;
  const checker = current.tool === 'remove-bg' && !showMask ? ' checker' : '';
  const shownUrl = showMask && current.mask ? current.mask.url : current.url;
  $('compare-button').disabled = !parent;
  $('compare-button').setAttribute('aria-pressed', comparing);
  $('compare-button').className = 'btn btn--sm ' + (comparing ? 'btn--primary' : 'btn--secondary');

  const media = $('studio-media');
  media.className = 'result__media' + (comparing ? '' : ' result__media--zoom');
  if (comparing && parent) {
    media.innerHTML =
      '<div class="compare" style="--split: 50%">' +
      '<img class="compare__img" src="' + parent.url + '" alt="" draggable="false" />' +
      '<div class="compare__after' + checker + '"><img class="compare__img" src="' + shownUrl + '" alt="" draggable="false" /></div>' +
      '<span class="compare__line" aria-hidden="true"></span>' +
      '<span class="compare__tag compare__tag--before">ก่อน</span><span class="compare__tag compare__tag--after">หลัง</span>' +
      '<input class="compare__range" type="range" min="0" max="100" value="50" aria-label="ลากเพื่อเทียบก่อนและหลัง" /></div>';
    // ลากแถบ → ขยับเส้นแบ่ง
    const compare = media.querySelector('.compare');
    compare.querySelector('input').addEventListener('input', (event) => {
      compare.style.setProperty('--split', event.target.value + '%');
    });
  } else {
    media.innerHTML = '<img class="img-in' + checker + '" src="' + shownUrl + '" alt="' + escapeHtml(versionName(current)) + '" />';
  }
  if (busy) {
    media.insertAdjacentHTML('beforeend', '<div class="studio-busy" role="status">' + icon('refresh', 20, 'spin') + '<span>กำลังใช้ ' + TOOLS[tool].name + '…</span></div>');
  }

  const detail = versionDetail(current);
  $('studio-caption').textContent = current.width + ' × ' + current.height + ' · ' + versionName(current) + (detail ? ' · ' + detail : '');
  $('save-link').href = current.url;
  $('save-link').download = 'luma-studio-' + (current.tool || 'original') + '-' + (versions.indexOf(current) + 1) + '.png';

  renderVersions();
  renderPose();
  renderMaskPanel();
}

/* แถบเวอร์ชันด้านล่าง */
function renderVersions() {
  $('version-row').innerHTML = versions
    .map((version, index) => {
      const detail = versionDetail(version);
      const name = versionName(version);
      return (
        '<button type="button" class="vstrip__item" data-index="' + index + '" aria-current="' + (version === current) + '" title="' + escapeHtml(detail ? name + ' · ' + detail : name) + '">' +
        '<span class="thumb' + (version.tool === 'remove-bg' ? ' checker' : '') + '"><img src="' + version.url + '" alt="" /></span>' +
        '<span class="vstrip__caption">' + (version.tool ? icon(TOOLS[version.tool].icon, 11) : '') + escapeHtml(name) + '</span></button>'
      );
    })
    .join('');
}

/* แผงขวา: เครื่องมือที่เลือก ตัวเลือก และปุ่มใช้ */
function renderTool() {
  for (const button of document.querySelectorAll('#tool-tabs .seg__item')) {
    button.setAttribute('aria-selected', button.dataset.tool === tool);
  }
  for (const button of document.querySelectorAll('#color-tabs .seg__item')) {
    button.setAttribute('aria-selected', button.dataset.color === color);
  }
  $('tool-about').textContent = TOOLS[tool].about;
  $('sketch-options').hidden = tool !== 'sketch';
  $('splash-options').hidden = tool !== 'color-splash';
  $('no-options').hidden = tool === 'sketch' || tool === 'color-splash';

  const button = $('apply-button');
  button.disabled = !current || busy;
  $('apply-icon').innerHTML = busy ? icon('refresh', 16, 'spin') : icon(TOOLS[tool].icon, 16);
  $('apply-text').textContent = !current ? 'เลือกภาพก่อน' : busy ? 'กำลังใช้ ' + TOOLS[tool].name + '…' : 'ใช้ ' + TOOLS[tool].name;
  $('applies-to').hidden = !current;
  if (current) {
    $('applies-to').innerHTML = 'ใช้กับ: ' + escapeHtml(versionName(current)) + ' <span class="mono kbd-hint">' + icon('info', 11) + ' ⌘↵</span>';
  }
}

/* ตารางจุดบนร่างกาย (เฉพาะเวอร์ชันที่มาจากเครื่องมือท่าทาง) */
function renderPose() {
  const landmarks = current && current.landmarks;
  $('pose-panel').hidden = !landmarks;
  if (!landmarks) return;

  if (landmarks.length === 0) {
    $('pose-count').textContent = '';
    $('pose-table').innerHTML = '<tr><td class="text-dim" colspan="4">ไม่พบคนในภาพนี้</td></tr>';
    return;
  }
  const minVisibility = Number($('min-visibility').value);
  const visible = landmarks.filter((point) => point.visibility >= minVisibility);
  $('pose-count').textContent = 'แสดง ' + visible.length + ' จาก ' + landmarks.length + ' จุด';
  // ชื่อจุดจาก backend เช่น LEFT_SHOULDER → Left shoulder
  const readable = (name) => name.charAt(0) + name.slice(1).toLowerCase().replaceAll('_', ' ');
  $('pose-table').innerHTML = visible
    .map(
      (p) =>
        '<tr><td>' + escapeHtml(readable(p.name)) + '</td><td class="mono">' + p.x.toFixed(3) + '</td>' +
        '<td class="mono">' + p.y.toFixed(3) + '</td><td class="mono">' + p.visibility.toFixed(2) + '</td></tr>',
    )
    .join('');
}

/* mask ของตัดฉาก + ปุ่มส่งไปวาดใหม่ */
function renderMaskPanel() {
  const mask = current && current.mask;
  $('mask-panel').hidden = !mask;
  if (!mask) return;
  $('mask-thumb').src = mask.url;
  $('toggle-mask').textContent = showMask ? 'ดูภาพที่ตัดแล้ว' : 'ดู mask';
}
