/*
 * tests/responsive.mjs — ตรวจว่าทุกหน้าแสดงผลได้ทุกขนาดจอ
 *
 * เปิดทุกหน้าและทุกสถานะหลัก ที่ความกว้างจอตั้งแต่มือถือเล็ก (320px) ถึงจอใหญ่ (1920px)
 * แล้วหาว่ามีส่วนไหนล้นออกนอกจอหรือไม่ (ส่วนที่อยู่ในกล่องเลื่อนได้ไม่นับ)
 *
 * วิธีรัน (ในโฟลเดอร์ frontend-html):   npm run test:responsive
 * อยากได้ภาพหน้าจอขนาดอื่น:            SHOTS=320,1024 npm run test:responsive
 * ภาพหน้าจออยู่ใน tests/output/responsive/
 */

import { preflight, startStaticServer, launchBrowser, createRunner, SAMPLE_IMAGE, OUTPUT, API, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const WIDTHS = [320, 390, 600, 768, 900, 1024, 1180, 1440, 1920];
const SHOT_WIDTHS = (process.env.SHOTS || '390,768,1440').split(',').map(Number);

const token = await preflight();
const { server, base } = await startStaticServer();
const page = await launchBrowser();
page.base = base;
const { step, finish } = createRunner(page);
const $ = (code) => page.js(code);

// งานล่าสุดของบัญชีทดสอบ (ใช้เปิดหน้าที่ต้องมีงานอยู่แล้ว เช่น ผลลัพธ์ และรายละเอียด)
const listResponse = await fetch(API + '/generations?page_size=1', { headers: { Authorization: 'Bearer ' + token } });
const latest = (await listResponse.json()).items[0];
if (!latest) {
  console.error('บัญชีทดสอบยังไม่มีงานสักงาน — รัน npm test ก่อนหนึ่งครั้ง');
  process.exit(2);
}

/*
 * หน้าและสถานะที่ตรวจ: [ชื่อ, หน้า, โค้ดที่รันหลังเปิดหน้า, ต้องล็อกอินไหม, ช่องเลือกไฟล์ที่ต้องใส่ภาพ]
 */
const SCREENS = [
  ['login', 'login.html', null, false],
  ['register', 'register.html', null, false],
  ['generate-empty', 'generate.html', `document.querySelector('[data-mode=txt2img]').click()`],
  ['generate-custom-size', 'generate.html', `document.querySelector('[data-mode=txt2img]').click(); document.querySelector('[data-custom]').click()`],
  ['generate-result', 'generate.html?run=' + latest.id, `await new Promise((r) => setTimeout(r, 2500))`],
  ['generate-img2img', 'generate.html', `document.querySelector('[data-mode=img2img]').click()`, true, '#source-file'],
  ['generate-inpaint', 'generate.html', `document.querySelector('[data-mode=inpaint]').click()`, true, '#source-file'],
  ['studio-empty', 'studio.html', null],
  ['studio-pose', 'studio.html', `document.querySelector('[data-tool=pose]').click(); $('apply-button').click(); await new Promise((r) => setTimeout(r, 3000))`, true, '#studio-file'],
  ['studio-compare', 'studio.html', `$('apply-button').click(); await new Promise((r) => setTimeout(r, 3000)); $('compare-button').click()`, true, '#studio-file'],
  ['history', 'history.html', null],
  ['history-detail', 'history.html?id=' + latest.id, `await new Promise((r) => setTimeout(r, 1500))`],
  ['account', 'account.html', null],
  ['account-edit', 'account.html', `$('edit-button').click(); $('with-password').click()`],
  ['admin', 'admin.html', null],
  ['admin-user-drawer', 'admin.html#users', `await new Promise((r) => setTimeout(r, 800)); document.querySelector('.adm-table tbody tr').click(); await new Promise((r) => setTimeout(r, 800))`],
  ['admin-admins', 'admin.html#admins', `await new Promise((r) => setTimeout(r, 800)); $('grant-open').click()`],
  ['confirm-dialog', 'generate.html?run=' + latest.id, `await new Promise((r) => setTimeout(r, 2500)); document.querySelector('[data-action=delete]').click()`],
];

/*
 * หา element ที่ล้นออกนอกจอ — ถ้า element อยู่ในกล่องที่ตั้งใจให้เลื่อนหรือซ่อนส่วนเกินได้
 * (overflow: auto/scroll/hidden) ถือว่าไม่ล้น เพราะผู้ใช้ไม่เห็นหน้าจอเลื่อนไปด้านข้าง
 */
const FIND_OVERFLOW = `
  const width = innerWidth, found = [];
  const insideScrollBox = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height || getComputedStyle(el).position === 'fixed') continue;
    if ((box.right > width + 1 || box.left < -1) && !insideScrollBox(el)) {
      found.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + ' [' + Math.round(box.left) + '..' + Math.round(box.right) + 'px]');
    }
  }
  return { page: document.documentElement.scrollWidth - width, elements: [...new Set(found)].slice(0, 5) };`;

console.log(`ตรวจ ${SCREENS.length} หน้าจอ × ${WIDTHS.length} ขนาด ที่ ${base}\n`);
mkdirSync(join(OUTPUT, 'responsive'), { recursive: true });

for (const width of WIDTHS) {
  await step(`${width}px`, async () => {
    await page.setSize(width, width < 768 ? 800 : 900);
    const problems = [];
    for (const [name, path, setup, needsLogin = true, fileInput] of SCREENS) {
      if (needsLogin) await page.signInWith(token);
      else await page.go('login.html').then(() => $(`localStorage.removeItem('luma.token')`));
      await page.go(path);
      if (fileInput) {
        await page.setFile(fileInput, SAMPLE_IMAGE);
        await wait(1500);
      }
      if (setup) await $(setup);
      await wait(700);
      const result = await $(FIND_OVERFLOW);
      if (result.page > 0 || result.elements.length) problems.push(`${name}: ล้น ${result.page}px ${result.elements.join(' | ')}`);
      if (SHOT_WIDTHS.includes(width)) await page.screenshot(`responsive/${width}-${name}`);
      if (name === 'confirm-dialog') await $(`document.querySelector('[data-answer=no]')?.click()`);
    }
    if (problems.length) throw new Error(problems.join('\n      '));
  });
}

const ok = finish();
page.close();
server.close();
process.exit(ok ? 0 : 1);
