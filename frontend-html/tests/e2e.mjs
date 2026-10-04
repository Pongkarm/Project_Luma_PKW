/*
 * tests/e2e.mjs — ทดสอบการใช้งานจริงทุกหน้า (กดปุ่ม กรอกฟอร์ม อัปโหลดภาพ เหมือนคนใช้)
 *
 * วิธีรัน (ในโฟลเดอร์ frontend-html):   npm test
 * ต้องมี: backend ที่ทำงานอยู่ (ค่าเริ่มต้น http://localhost:8000) + AI หรือ mock AI
 *         และบัญชีที่มีสิทธิ์ owner (ค่าเริ่มต้น alice) — ดู README หัวข้อ "การทดสอบ"
 *
 * ผลข้างเคียงบน backend: สร้างงานสร้างภาพหลายงาน ลบไป 1 งาน และสมัครบัญชีใหม่ 1 บัญชี
 */

import { preflight, startStaticServer, launchBrowser, createRunner, SAMPLE_IMAGE, USER, PASS, wait } from './lib.mjs';

await preflight();
const { server, base } = await startStaticServer();
const page = await launchBrowser();
page.base = base;
const { step, finish } = createRunner(page);
const $ = (code) => page.js(code);

// เงื่อนไขที่ใช้บ่อย
const RESULT_SHOWN = "document.querySelector('#stage .result img')?.naturalWidth > 0";
const at = (path) => `location.pathname.endsWith('${path}')`;

console.log(`ทดสอบหน้าเว็บที่ ${base}\n`);
await page.setSize(1440, 900);

/* ---------- เข้าสู่ระบบ ---------- */

await step('หน้าแรกพาไปหน้าล็อกอินเมื่อยังไม่ล็อกอิน', async () => {
  await page.go('index.html');
  await $(`localStorage.clear()`);
  await page.go('index.html');
  await page.until(at('login.html'), 'ไปหน้าล็อกอิน');
  await page.waitForApp();
});

await step('ล็อกอิน: ปุ่มกดไม่ได้จนกรอกครบ และรหัสผิดแสดงข้อความเตือน', async () => {
  if (!(await $(`return $('login-button').disabled`))) throw new Error('ปุ่มกดได้ทั้งที่ยังไม่กรอก');
  await page.type('username', USER);
  await page.type('password', 'wrong-password');
  await $(`$('login-form').requestSubmit()`);
  await page.until("!$('login-alert').hidden && $('login-alert').textContent.includes('ไม่ถูกต้อง')", 'ข้อความรหัสผิด');
});

await step('ล็อกอิน: ปุ่มรูปตาสลับแสดง/ซ่อนรหัสผ่าน', async () => {
  await $(`document.querySelector('.pw__toggle').click()`);
  if ((await $(`return $('password').type`)) !== 'text') throw new Error('รหัสผ่านไม่แสดง');
  await $(`document.querySelector('.pw__toggle').click()`);
});

await step('ล็อกอินสำเร็จ → หน้าสร้างภาพ พร้อมเมนูแอดมิน', async () => {
  await page.type('password', PASS);
  await $(`$('login-form').requestSubmit()`);
  await page.until(at('generate.html'), 'ไปหน้าสร้างภาพ');
  await page.until(`$('topbar-user').textContent === ${JSON.stringify(USER)} && $('model').options.length > 0`, 'ชื่อผู้ใช้ + รายชื่อโมเดล');
  await page.until("!$('admin-rail-link').hidden", 'เมนูแอดมิน');
  await page.until("$('engine-text').textContent.includes('พร้อมใช้งาน')", 'ไฟสถานะ backend');
});

/* ---------- หน้าสร้างภาพ ---------- */

await step('สร้างภาพ: ปุ่มกดไม่ได้ถ้ายังไม่มีคำอธิบาย', async () => {
  await $(`localStorage.removeItem('luma.html.draft')`);
  await page.go('generate.html');
  await page.until("$('model').options.length > 0", 'โหลดหน้า');
  await page.until("$('generate-button').disabled && $('generate-text').textContent.includes('คำอธิบาย')", 'ปุ่มถูกล็อก');
});

await step('สร้างภาพ: ปุ่มขนาด 2:3 และปุ่มสลับด้าน', async () => {
  await $(`document.querySelector('#size-presets [data-width="512"]').click()`);
  const meta = await $(`return $('size-meta').textContent`);
  if (meta !== '512 × 768 px · 2:3') throw new Error('ได้ ' + meta);
  await $(`$('swap-button').click()`);
  if (!(await $(`return $('size-meta').textContent.startsWith('768 × 512')`))) throw new Error('สลับด้านไม่ได้');
  await $(`$('size-reset').click()`);
});

await step('สร้างภาพจากข้อความจนเสร็จ แสดงภาพ + แต่งด่วน + แถบงานล่าสุด', async () => {
  await page.type('prompt', 'a cat on a roof');
  await $(`$('lora').selectedIndex = 1; $('generate-button').click()`);
  await page.until(RESULT_SHOWN, 'ภาพผลลัพธ์', 40000);
  await page.until("document.querySelector('.quickbar')", 'แถบแต่งด่วน');
  await page.until("document.querySelectorAll('#runstrip-row .thumb').length > 0", 'แถบงานล่าสุด');
});

await step('แต่งด่วน: ลายเส้น แล้วกลับไปภาพเดิม', async () => {
  await $(`document.querySelector('[data-quick="sketch"]').click()`);
  await page.until(`document.querySelector('[data-quick="sketch"]')?.getAttribute('aria-pressed') === 'true'`, 'ใช้ลายเส้นแล้ว', 30000);
  await $(`document.querySelector('[data-action="original"]').click()`);
  await page.until(`document.querySelector('[data-quick="sketch"]')?.getAttribute('aria-pressed') === 'false'`, 'กลับภาพเดิม');
});

await step('ดูภาพขนาดเต็ม เปิดแล้วปิดได้', async () => {
  await $(`document.querySelector('[data-action="view"]').click()`);
  await page.until("document.querySelector('.viewer')", 'หน้าต่างดูภาพ');
  await $(`document.querySelector('.viewer__close').click()`);
  await page.until("!document.querySelector('.viewer')", 'ปิดหน้าต่าง');
});

await step('ร่างที่กรอกไว้ไม่หายเมื่อรีเฟรช', async () => {
  await page.go('generate.html');
  await page.until("$('prompt').value === 'a cat on a roof'", 'คำอธิบายยังอยู่');
});

await step('สร้างจากภาพ: อัปโหลด แสดงการ์ดภาพ แล้วสร้างจนเสร็จ', async () => {
  await $(`document.querySelector('[data-mode=img2img]').click()`);
  await page.setFile('#source-file', SAMPLE_IMAGE);
  await page.until("!$('source-card').hidden && $('source-meta').textContent.includes('480 × 640')", 'อัปโหลดเสร็จ');
  await page.until("$('submit-hint').textContent.includes('480 × 640')", 'ขนาดผลลัพธ์');
  await $(`$('generate-button').click()`);
  await page.until(RESULT_SHOWN, 'ภาพผลลัพธ์', 40000);
});

await step('ใช้ภาพผลลัพธ์เป็นภาพต้นฉบับ', async () => {
  await $(`document.querySelector('[data-action="use-source"]').click()`);
  await page.until("$('source-name').textContent.startsWith('ภาพที่สร้าง')", 'ตั้งเป็นต้นฉบับ');
});

await step('แก้เฉพาะจุด: ระบาย ย้อนกลับ/ทำซ้ำ ไฟล์ mask ขาวดำถูกต้อง แล้วสร้างจนเสร็จ', async () => {
  await $(`document.querySelector('[data-mode=inpaint]').click()`);
  await page.until("!$('mask-view').hidden", 'ที่ระบาย mask');
  await page.until("$('generate-button').disabled && $('generate-text').textContent.includes('ระบาย')", 'ปุ่มล็อกเมื่อยังไม่ระบาย');

  await page.drag('#mask-canvas', [[0.3, 0.3], [0.4, 0.35], [0.5, 0.4], [0.6, 0.5]]);
  await page.until("$('mask-coverage').textContent.includes('%')", 'แสดง % ที่ระบาย');
  await $(`$('undo-button').click()`);
  if (await $(`return MaskEditor.hasMask()`)) throw new Error('ย้อนกลับไม่ได้');
  await $(`$('redo-button').click()`);
  if (!(await $(`return MaskEditor.hasMask()`))) throw new Error('ทำซ้ำไม่ได้');

  // คลิกจุดเดียว (ไม่ลาก) ต้องระบายได้ แล้วไฟล์ที่ส่งออก: ตรงที่ระบาย = ขาว, ที่เหลือ = ดำ
  await $(`MaskEditor.clear()`);
  await page.drag('#mask-canvas', [[0.4, 0.4]]);
  const pixels = await $(`
    const bitmap = await createImageBitmap(await MaskEditor.exportMask());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    const at = (fx, fy) => [...ctx.getImageData(Math.floor(bitmap.width * fx), Math.floor(bitmap.height * fy), 1, 1).data];
    return { painted: at(0.4, 0.4), blank: at(0.05, 0.95) };`);
  if (pixels.painted[0] !== 255 || pixels.blank[0] !== 0) throw new Error('สีใน mask ผิด ' + JSON.stringify(pixels));

  await $(`$('mask-only-button').click()`);
  await page.screenshot('mask-only');
  await $(`$('mask-only-button').click()`);
  await page.until("!$('generate-button').disabled", 'ปุ่มกดได้');
  await $(`$('generate-button').click()`);
  await page.until(RESULT_SHOWN, 'ภาพผลลัพธ์', 40000);
});

await step('ปุ่มลบถามยืนยันก่อน (กดเก็บไว้ = ไม่ลบ)', async () => {
  await $(`document.querySelector('[data-action="delete"]').click()`);
  await page.until("document.querySelector('.dialog')", 'หน้าต่างยืนยัน');
  await $(`document.querySelector('[data-answer="no"]').click()`);
  if (!(await $(`return ${RESULT_SHOWN}`))) throw new Error('ภาพหายทั้งที่กดเก็บไว้');
});

/* ---------- หน้าประวัติ ---------- */

await step('ประวัติ: การ์ด แผงรายละเอียด และลบพร้อมยืนยัน', async () => {
  await page.go('history.html');
  await page.until("document.querySelectorAll('.runcard img').length > 0", 'การ์ดพร้อมภาพ');
  const before = await $(`return $('total-text').textContent`);
  await $(`document.querySelector('.runcard').click()`);
  await page.until("!$('detail').hidden && $('detail-image').querySelector('img')", 'แผงรายละเอียด');
  if (!(await $(`return location.search.includes('id=')`))) throw new Error('ที่อยู่เว็บไม่เปลี่ยนเป็น ?id=');
  await $(`$('detail-delete').click()`);
  await page.until("document.querySelector('.dialog')", 'หน้าต่างยืนยัน');
  await $(`document.querySelector('[data-answer="yes"]').click()`);
  await page.until(`$('detail').hidden && $('total-text').textContent !== ${JSON.stringify(before)}`, 'จำนวนงานลดลง');
});

await step('ประวัติ: "ใช้ค่าเดิมนี้" เติมค่าในหน้าสร้างภาพ', async () => {
  await $(`document.querySelector('.runcard').click()`);
  await page.until("!$('detail').hidden", 'แผงรายละเอียด');
  const prompt = await $(`return $('detail-prompt').textContent`);
  await $(`$('detail-reuse').click()`);
  await page.until(at('generate.html'), 'ไปหน้าสร้างภาพ');
  await page.until(`$('prompt').value === ${JSON.stringify(prompt)} && document.querySelector('[data-mode=txt2img]').getAttribute('aria-selected') === 'true'`, 'ค่าถูกเติม');
});

await step('ประวัติ: "แต่งในสตูดิโอ" เปิดภาพในสตูดิโอ', async () => {
  await page.go('history.html');
  await page.until("document.querySelectorAll('.runcard img').length > 0", 'การ์ด');
  await $(`document.querySelector('.runcard').click()`);
  await page.until("!$('detail-studio').hidden", 'ปุ่มแต่งในสตูดิโอ');
  await $(`$('detail-studio').click()`);
  await page.until(`${at('studio.html')} && document.querySelectorAll('.vstrip__item').length === 1`, 'เปิดในสตูดิโอ', 15000);
});

/* ---------- สตูดิโอ ---------- */

await step('สตูดิโอ: ใช้ครบ 4 เครื่องมือ + ตารางจุดบนร่างกาย + เทียบก่อน/หลัง', async () => {
  await page.go('studio.html');
  await page.setFile('#studio-file', SAMPLE_IMAGE);
  await page.until("document.querySelectorAll('.vstrip__item').length === 1", 'ภาพต้นฉบับ');
  for (const tool of ['sketch', 'color-splash', 'pose', 'remove-bg']) {
    const count = await $(`return document.querySelectorAll('.vstrip__item').length`);
    await $(`document.querySelector('.vstrip__item').click(); document.querySelector('[data-tool="${tool}"]').click(); $('apply-button').click();`);
    await page.until(`document.querySelectorAll('.vstrip__item').length === ${count + 1} || !$('tool-alert').hidden`, tool, 60000);
    const error = await $(`return $('tool-alert').hidden ? '' : $('tool-alert').textContent`);
    if (error) throw new Error(tool + ': ' + error);
  }
  await $(`document.querySelectorAll('.vstrip__item')[3].click()`);
  await page.until("!$('pose-panel').hidden && $('pose-table').children.length > 0", 'ตารางจุดบนร่างกาย');
  await $(`document.querySelectorAll('.vstrip__item')[4].click()`);
  await page.until("!$('mask-panel').hidden", 'แผง mask ของตัดฉาก');
  await $(`$('compare-button').click()`);
  await page.until("document.querySelector('.compare')", 'โหมดเทียบ');
  await page.screenshot('studio-compare');
});

await step('สตูดิโอ: ใช้เครื่องมือต่อจากผลของเครื่องมืออื่นได้', async () => {
  await $(`document.querySelectorAll('.vstrip__item')[3].click(); document.querySelector('[data-tool="sketch"]').click(); $('apply-button').click();`);
  await page.until("document.querySelectorAll('.vstrip__item').length === 6", 'เวอร์ชันที่ 6', 30000);
});

await step('สตูดิโอ: "วาดฉากหลังใหม่" → หน้าแก้เฉพาะจุดพร้อม mask', async () => {
  await $(`document.querySelectorAll('.vstrip__item')[4].click()`);
  await page.until("!$('mask-panel').hidden", 'แผง mask');
  await $(`$('replace-bg').click()`);
  await page.until(at('generate.html'), 'ไปหน้าสร้างภาพ');
  await page.until("document.querySelector('[data-mode=inpaint]').getAttribute('aria-selected') === 'true' && !$('mask-view').hidden && MaskEditor.hasMask()", 'mask ถูกโหลด', 20000);
});

/* ---------- บัญชี และแอดมิน ---------- */

await step('บัญชี: รหัสปัจจุบันผิดแสดงข้อความ (ไม่ถูกเด้งออก) และสลับธีม', async () => {
  await page.go('account.html');
  await page.until(`$('profile-name').textContent === ${JSON.stringify(USER)}`, 'โปรไฟล์');
  await $(`$('edit-button').click()`);
  await page.type('new-email', 'someone-else@example.com');
  await page.type('current-password', 'wrong-password');
  await $(`$('edit-form').requestSubmit()`);
  await page.until("!$('edit-alert').hidden && $('edit-alert').textContent.includes('ไม่ถูกต้อง')", 'ข้อความรหัสผิด');
  if (!(await $(`return ${at('account.html')}`))) throw new Error('ถูกเด้งออกจากระบบ');
  await $(`$('cancel-edit').click()`);
  await $(`document.querySelector('[data-theme-value=light]').click()`);
  if ((await $(`return document.documentElement.dataset.theme`)) !== 'light') throw new Error('ธีมไม่เปลี่ยน');
  await $(`document.querySelector('[data-theme-value=dark]').click()`);
});

await step('แอดมิน: ภาพรวม ผู้ใช้ (แผงรายละเอียด) บันทึกการกระทำ ผู้ดูแล', async () => {
  await page.go('admin.html');
  await page.until("!$('admin-app').hidden && document.querySelectorAll('.adm-fig').length === 6", 'ภาพรวม');
  await $(`location.hash = '#users'`);
  await page.until("document.querySelectorAll('.adm-table tbody tr').length > 0", 'ตารางผู้ใช้');
  await $(`document.querySelector('.adm-table tbody tr:nth-child(2)').click()`);
  await page.until("document.querySelector('.adm-drawer') && document.querySelector('.adm-runs, .adm-panel__empty')", 'แผงรายละเอียด');
  await $(`$('act-open').click()`);
  await page.type('act-reason', 'ab');
  if (!(await $(`return $('act-confirm').disabled`))) throw new Error('เหตุผลสั้นกว่า 3 ตัวแต่กดยืนยันได้');
  await $(`document.querySelector('[data-close]').click()`);
  await $(`location.hash = '#audit'`);
  await page.until("document.querySelector('.adm-audit, .adm-notice')", 'บันทึกการกระทำ');
  await $(`location.hash = '#admins'`);
  await page.until("$('roles-body') && $('roles-body').children.length > 0", 'ผู้ดูแล');
});

await step('สมัครบัญชีใหม่: ตรวจเงื่อนไขรหัส แล้วบัญชีใหม่ไม่เห็น/เข้าแอดมินไม่ได้', async () => {
  await $(`localStorage.removeItem('luma.token')`);
  await page.go('register.html');
  const name = 'test' + Date.now().toString().slice(-7);
  await page.type('username', name);
  await page.type('email', name + '@example.com');
  await page.type('password', 'abcdefgh');
  await page.type('password-confirm', 'abcdefgh');
  if (!(await $(`return $('register-button').disabled`))) throw new Error('รหัสอ่อนแต่กดสมัครได้');
  await page.type('password', 'Abcdefg1!');
  await page.type('password-confirm', 'Abcdefg1!');
  await $(`$('register-form').requestSubmit()`);
  await page.until(at('generate.html'), 'สมัครแล้วเข้าระบบ', 15000);
  await page.until(`$('topbar-user').textContent === ${JSON.stringify(name)}`, 'ชื่อบัญชีใหม่');
  await wait(1000);
  if (!(await $(`return $('admin-rail-link').hidden`))) throw new Error('บัญชีทั่วไปเห็นเมนูแอดมิน');
  await page.go('admin.html');
  await page.until("document.querySelector('.adm-notice h2')?.textContent.includes('do not have access')", 'ข้อความไม่มีสิทธิ์');
});

await step('token หมดอายุ → กลับหน้าล็อกอินพร้อมข้อความ', async () => {
  await $(`localStorage.setItem('luma.token', 'expired-token')`);
  await page.go('history.html');
  await page.until(`${at('login.html')} && $('login-alert').textContent.includes('หมดอายุ')`, 'ข้อความหมดอายุ');
});

/* ---------- สรุป ---------- */

// error ที่ตั้งใจให้เกิดในการทดสอบ: รหัสผิด (401), บัญชีทั่วไปเปิดแอดมิน (403)
const ok = finish([/status of 401/, /status of 403/]);
page.close();
server.close();
process.exit(ok ? 0 : 1);
