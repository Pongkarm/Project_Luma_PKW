import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const OUT = process.argv[2] || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/luma-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await wait(250);
  }
  throw new Error('Chrome did not expose a page target');
}

const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => pending.set(n, r)).then((m) => {
    if (m.error) throw new Error(`${method}: ${m.error.message}`);
    return m.result;
  });
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' — ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

const consoleLog = [];
const netLog = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(msg.params.type))
    consoleLog.push({ type: msg.params.type, text: msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0,180) });
  if (msg.method === 'Runtime.exceptionThrown')
    consoleLog.push({ type: 'exception', text: (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0,180) });
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error')
    consoleLog.push({ type: 'log', text: msg.params.entry.text.slice(0,180) });
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400)
    netLog.push({ status: msg.params.response.status, url: msg.params.response.url.replace('http://localhost:8000','').slice(0,80) });
});
export const drain = () => { const c = consoleLog.splice(0), n = netLog.splice(0); return { console: c, net: n }; };

export async function viewport(w, h) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile: w < 500,
  });
}
export async function go(url, settle = 1500) {
  await send('Page.navigate', { url });
  await wait(settle);
}
export async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const p = `${OUT}/${name}.png`;
  writeFileSync(p, Buffer.from(data, 'base64'));
  return p;
}
export { evaluate, wait, send };
export async function done() { ws.close(); chrome.kill(); }
