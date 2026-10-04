/*
 * tests/lib.mjs — เครื่องมือกลางของการทดสอบ (ใช้ร่วมกันโดย e2e.mjs และ responsive.mjs)
 *
 * สิ่งที่ไฟล์นี้ทำให้:
 *  1) เปิดเว็บเซิร์ฟเวอร์เล็ก ๆ เสิร์ฟโฟลเดอร์ frontend-html (ไม่ต้องเปิด python เอง)
 *  2) เปิด Chrome แบบไม่มีหน้าต่าง (headless) แล้วสั่งงานผ่าน DevTools Protocol
 *  3) ชี้หน้าเว็บไปที่ backend สำหรับทดสอบ โดยแก้ js/config.js "ระหว่างทาง" ในเบราว์เซอร์เท่านั้น
 *     — ไฟล์จริงบนดิสก์ไม่ถูกแก้
 *  4) เก็บ error ที่เกิดในหน้าเว็บ และสรุปผล ผ่าน/ไม่ผ่าน
 *
 * ตั้งค่าผ่านตัวแปรแวดล้อม (ไม่ใส่ก็ได้ ใช้ค่าเริ่มต้น):
 *   LUMA_API        backend ที่ใช้ทดสอบ          ค่าเริ่มต้น http://localhost:8000
 *   LUMA_USER       บัญชีที่มีสิทธิ์ owner         ค่าเริ่มต้น alice
 *   LUMA_PASS       รหัสผ่านของบัญชีนั้น          ค่าเริ่มต้น SecurePassword123!
 *   CHROME          ที่อยู่โปรแกรม Chrome          ค่าเริ่มต้น ตำแหน่งปกติบน macOS
 *   LUMA_TEST_ALLOW_REMOTE=1   ยอมให้ทดสอบกับ backend เครื่องอื่น (ระวัง: การทดสอบสร้างบัญชีและลบงาน)
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(TESTS_DIR, '..'); // โฟลเดอร์ frontend-html
export const OUTPUT = join(TESTS_DIR, 'output'); // ภาพหน้าจอที่ได้จากการทดสอบ
export const SAMPLE_IMAGE = join(TESTS_DIR, 'fixtures', 'sample.png');

export const API = (process.env.LUMA_API || 'http://localhost:8000').replace(/\/+$/, '');
export const USER = process.env.LUMA_USER || 'alice';
export const PASS = process.env.LUMA_PASS || 'SecurePassword123!';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- ตรวจความพร้อมก่อนเริ่ม ---------- */

/*
 * การทดสอบสร้างบัญชีใหม่ สร้างงาน และลบงาน จึงไม่ควรรันกับ backend ของคนอื่นโดยไม่ตั้งใจ
 * และต้องมี backend ที่ทำงานอยู่ + บัญชี owner ที่ล็อกอินได้
 */
export async function preflight() {
  const host = new URL(API).hostname;
  if (!['localhost', '127.0.0.1'].includes(host) && process.env.LUMA_TEST_ALLOW_REMOTE !== '1') {
    fail(`LUMA_API ชี้ไปที่ ${API} ซึ่งไม่ใช่เครื่องนี้\n` +
      'การทดสอบจะสร้างบัญชีและลบงานในฐานข้อมูลนั้น ถ้าตั้งใจจริงให้ตั้ง LUMA_TEST_ALLOW_REMOTE=1');
  }
  if (!existsSync(CHROME)) fail(`ไม่พบ Chrome ที่ ${CHROME} — ตั้งตัวแปร CHROME ให้ชี้ไปที่โปรแกรม Chrome`);
  try {
    await fetch(API + '/healthz');
  } catch {
    fail(`ติดต่อ backend ที่ ${API} ไม่ได้ — เปิด backend ก่อน (ดู README หัวข้อ "การทดสอบ")`);
  }
  const token = await loginToken();
  if (!token) fail(`ล็อกอินด้วย ${USER} ไม่ได้ — ตั้ง LUMA_USER / LUMA_PASS ให้ตรงกับบัญชีที่มีอยู่`);
  return token;
}

function fail(message) {
  console.error('\n✘ ' + message + '\n');
  process.exit(2);
}

/* ขอ token จาก backend โดยตรง (ใช้ข้ามหน้าล็อกอินในการทดสอบที่ไม่ได้ทดสอบการล็อกอิน) */
export async function loginToken(user = USER, pass = PASS) {
  const response = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: user, password: pass }),
  });
  return response.ok ? (await response.json()).access_token : null;
}

/* ---------- เว็บเซิร์ฟเวอร์สำหรับหน้าเว็บ ---------- */

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.md': 'text/plain' };

/* เสิร์ฟไฟล์ในโฟลเดอร์ frontend-html บนพอร์ตว่างพอร์ตไหนก็ได้ คืนค่า URL เช่น http://127.0.0.1:53211/ */
export function startStaticServer() {
  const server = createServer((request, response) => {
    let path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    response.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` }));
  });
}

/* ---------- Chrome ---------- */

/*
 * เปิด Chrome แบบไม่มีหน้าต่าง ใช้โปรไฟล์ชั่วคราว (ไม่ยุ่งกับ Chrome ที่ใช้งานอยู่)
 * แล้วคืนตัวควบคุมหน้าเว็บ (Page) กลับไป
 */
export async function launchBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'luma-test-'));
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

  // Chrome เขียนพอร์ตที่ใช้ลงไฟล์นี้เมื่อพร้อม
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 80 && !existsSync(portFile); i++) await wait(100);
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    } catch {}
    if (!target) await wait(100);
  }
  const page = new Page(new WebSocket(target.webSocketDebuggerUrl));
  await page.ready();

  page.close = () => {
    chrome.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  };
  return page;
}

/* ตัวควบคุมหน้าเว็บหนึ่งแท็บ */
class Page {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.problems = []; // error ที่เกิดในหน้าเว็บ
    this.base = '';
  }

  async ready() {
    await new Promise((resolve) => (this.ws.onopen = resolve));
    this.ws.onmessage = (event) => this.onMessage(JSON.parse(event.data));
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('DOM.enable');
    // ดักไฟล์ config.js ทุกครั้งที่หน้าเว็บโหลด เพื่อเปลี่ยนที่อยู่ backend เป็นของการทดสอบ
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*js/config.js*' }] });
  }

  onMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      this.pending.get(message.id)(message);
      this.pending.delete(message.id);
    }
    if (message.method === 'Fetch.requestPaused') this.serveConfig(message.params.requestId);
    if (message.method === 'Runtime.exceptionThrown') {
      this.problems.push('JS error: ' + (message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text).split('\n')[0]);
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      this.problems.push(message.params.entry.text + ' ' + (message.params.entry.url || ''));
    }
  }

  /* ส่ง config.js ฉบับที่ API_BASE_URL ชี้ไปที่ backend ของการทดสอบ */
  serveConfig(requestId) {
    const original = readFileSync(join(ROOT, 'js', 'config.js'), 'utf8');
    const body = original.replace(/^const API_BASE_URL = .*$/m, `const API_BASE_URL = ${JSON.stringify(API)};`);
    this.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }],
      body: Buffer.from(body).toString('base64'),
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.pending.set(id, (message) => (message.error ? reject(new Error(method + ': ' + message.error.message)) : resolve(message.result))),
    );
  }

  /* รันโค้ด JavaScript ในหน้าเว็บ (ใช้ await ได้) แล้วคืนผลลัพธ์ */
  async js(code) {
    const result = await this.send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text).split('\n')[0]);
    return result.result.value;
  }

  /* รอจนเงื่อนไข (โค้ด JS ที่คืนค่า true/false) เป็นจริง ไม่งั้นแจ้งว่ารอไม่ไหว */
  async until(condition, label, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.js(`return Boolean(${condition})`).catch(() => false)) return;
      await wait(250);
    }
    throw new Error('รอนานเกินไป: ' + label);
  }

  /*
   * เปิดหน้า แล้วรอจนหน้าเว็บพร้อมจริง (โหลดสคริปต์ครบ) — ไม่ใช้การรอเวลาตายตัว
   * เพราะเครื่องช้า/เร็วไม่เท่ากัน ถ้ารอแค่ไม่กี่วินาทีบางครั้งจะกดปุ่มก่อนหน้าเว็บพร้อม
   */
  async go(path) {
    await this.send('Page.navigate', { url: this.base + path });
    await this.waitForApp();
  }

  /* รอจนหน้าเว็บโหลดเสร็จ และฟังก์ชันของเรา ($ จาก ui.js) พร้อมใช้ */
  async waitForApp() {
    await wait(300);
    await this.until("document.readyState === 'complete' && typeof $ === 'function'", 'หน้าเว็บโหลดเสร็จ');
    await wait(500); // ให้คำขอแรก ๆ ของหน้า (เช่น ข้อมูลผู้ใช้) ตอบกลับก่อน
  }

  /* ใส่ข้อความลงช่องกรอก แบบเดียวกับที่คนพิมพ์ (หน้าเว็บจะได้รับ event input) */
  type(id, value) {
    return this.js(`$('${id}').value = ${JSON.stringify(value)}; $('${id}').dispatchEvent(new Event('input', { bubbles: true }));`);
  }

  async setSize(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  }

  /* เลือกไฟล์ให้ <input type="file"> */
  async setFile(selector, path) {
    const doc = await this.send('DOM.getDocument');
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    await this.send('DOM.setFileInputFiles', { nodeId, files: [path] });
  }

  /* กด-ลาก-ปล่อยเมาส์ตามจุดที่กำหนด (ใช้ระบาย mask) — จุดเป็นสัดส่วน 0–1 ของกรอบ element */
  async drag(selector, points) {
    const box = await this.js(`const b = document.querySelector('${selector}').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };`);
    const at = ([fx, fy]) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy, button: 'left', buttons: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', clickCount: 1, ...at(points[0]) });
    for (const point of points.slice(1)) await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(point) });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', clickCount: 1, ...at(points[points.length - 1]) });
  }

  async screenshot(name) {
    mkdirSync(OUTPUT, { recursive: true });
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUTPUT, name + '.png'), Buffer.from(data, 'base64'));
  }

  /* ล็อกอินโดยใส่ token ตรง ๆ (ข้ามหน้าล็อกอิน) */
  async signInWith(token) {
    await this.go('login.html');
    await this.js(`localStorage.setItem('luma.token', ${JSON.stringify(token)});`);
  }
}

/* ---------- ตัวรันขั้นทดสอบ ---------- */

/*
 * เก็บผลของแต่ละขั้น: step('ชื่อ', async () => { ... })
 * ขั้นที่ throw error = ไม่ผ่าน (ถ่ายภาพหน้าจอไว้ให้ดูใน tests/output/)
 */
export function createRunner(page) {
  const results = [];
  async function step(name, fn) {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  ✔ ${name} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      console.log(`  ✘ ${name}\n      ${error.message}`);
      await page.screenshot('FAIL-' + name.replace(/[^\p{L}\p{N}]+/gu, '_')).catch(() => {});
    }
  }

  /*
   * สรุปผล — error ที่ "ตั้งใจให้เกิด" (เช่น ใส่รหัสผิดได้ 401) ส่งชื่อมาใน expected
   * error อื่นที่เกิดในหน้าเว็บถือว่าไม่ผ่าน
   */
  function finish(expected = []) {
    const unexpected = [...new Set(page.problems)].filter((p) => !expected.some((pattern) => pattern.test(p)));
    const failed = results.filter((r) => !r.ok);
    console.log(`\nผล: ผ่าน ${results.length - failed.length}/${results.length} ขั้น`);
    if (unexpected.length) console.log('error ที่ไม่คาดคิดในหน้าเว็บ:\n  ' + unexpected.join('\n  '));
    const ok = failed.length === 0 && unexpected.length === 0;
    console.log(ok ? '✔ ทั้งหมดผ่าน' : '✘ มีบางอย่างไม่ผ่าน — ดูภาพหน้าจอใน tests/output/');
    return ok;
  }

  return { step, finish };
}
