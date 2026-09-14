// Does any page scroll sideways, reach under the phone tab bar, log an error,
// or return a 4xx — across roles, languages and screen sizes.
const m = await import(process.env.SCRATCH + '/cdp.mjs');

const APP = 'http://localhost:5173';

// 402x740 is an iPhone 17 / 17 Pro with Safari's toolbars showing — the
// height people actually get, and the one where the controls first went under.
const SIZES = [[1440, 900], [834, 1000], [390, 844], [402, 740]];
const LANGUAGES = ['en', 'th'];
const ROLES = [[process.env.OWNER, 'owner'], [process.env.REV, 'reviewer']];
const PAGES = ['/generate', '/history', '/account', '/admin', '/admin/users', '/admin/activity'];
const OWNER_PAGES = ['/admin/audit', '/admin/admins'];

// ── probes, evaluated inside the page ──────────────────────────────────

const SIDEWAYS = `(() => {
  const d = document.documentElement;
  return d.scrollWidth - d.clientWidth;
})()`;

// The app shell is exactly one screen tall and scrolls inside itself. On a phone,
// if the document scrolls or the workspace reaches under the tab bar, the
// controls are behind it — horizontal overflow alone never showed that.
const UNDER_TABBAR = `(() => {
  const d = document.documentElement;
  const tab = document.querySelector('.tabbar');
  if (!tab || getComputedStyle(tab).display === 'none') return [];

  const top = tab.getBoundingClientRect().top;
  const bad = [];
  if (d.scrollHeight - d.clientHeight > 1) bad.push('หน้าเลื่อนลง ' + (d.scrollHeight - d.clientHeight));
  for (const selector of ['.main', '.controls', '.controls__foot']) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const below = Math.round(el.getBoundingClientRect().bottom - top);
    if (below > 1) bad.push(selector + ' อยู่ใต้แถบแท็บ ' + below);
  }
  return bad;
})()`;

// ── helpers ────────────────────────────────────────────────────────────

const setToken = (token) =>
  m.evaluate(`localStorage.setItem('luma.token', ${JSON.stringify(token)})`);

const setLanguage = (language) =>
  m.evaluate(`(() => {
    const raw = localStorage.getItem('luma.preferences');
    const prefs = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    prefs.state = { ...prefs.state, language: ${JSON.stringify(language)} };
    localStorage.setItem('luma.preferences', JSON.stringify(prefs));
  })()`);

// The dev server has no favicon, so the first load of each fresh browser logs a
// 404 for it — once on the network and once in the console. It says nothing
// about the page, so both halves are dropped before judging it.
function withoutFavicon(drained) {
  let favicons = drained.net.filter((x) => x.url.endsWith('/favicon.ico')).length;
  return {
    net: drained.net.filter((x) => !x.url.endsWith('/favicon.ico')),
    console: drained.console.filter(
      (x) => !(favicons > 0 && /Failed to load resource.*404/.test(x.text) && favicons--),
    ),
  };
}

const consoleText = (drained) => drained.console.map((x) => x.text.slice(0, 70)).join('|');

let checks = 0;
let problems = 0;

function report(line) {
  problems++;
  console.log(`  ❌ ${line}`);
}

// ── checks ─────────────────────────────────────────────────────────────

async function checkPage(path, label) {
  await m.go(APP + path, 1200);
  checks++;

  const drained = withoutFavicon(m.drain());
  const sideways = await m.evaluate(SIDEWAYS);
  const under = await m.evaluate(UNDER_TABBAR);
  const failedRequests = drained.net.filter((x) => x.status !== 403);

  if (sideways > 1 || under.length || drained.console.length || failedRequests.length) {
    report(
      `${path} ${label}: ล้น ${sideways} · ${under.join(' · ')} · ` +
        `console ${consoleText(drained)} · net ${JSON.stringify(drained.net)}`,
    );
  }
}

// A finished image is what pushed the controls off a phone, and no page load
// shows one. RUN=1 presses Generate once per phone size (owner, English) — it
// creates a real run, so it is opt-in.
async function checkAfterGenerate(size) {
  await m.go(APP + '/generate', 1500);
  await m.evaluate(`(() => {
    const prompt = document.querySelector('.controls textarea');
    if (prompt && !prompt.value.trim()) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        .set.call(prompt, 'sweep: a lighthouse at dusk');
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.controls__foot .btn--primary')?.click();
  })()`);

  let shown = false;
  for (let second = 0; second < 90 && !shown; second++) {
    await m.wait(1000);
    shown = await m.evaluate("!!document.querySelector('.result')");
  }
  checks++;

  const under = await m.evaluate(UNDER_TABBAR);
  const drained = withoutFavicon(m.drain());

  if (!shown || under.length || drained.console.length) {
    report(
      `/generate หลังกด Generate ${size}: ` +
        `${shown ? '' : 'ไม่มีภาพผลลัพธ์ภายใน 90 วิ · '}${under.join(' · ')} · console ${consoleText(drained)}`,
    );
  }
}

// ── run ────────────────────────────────────────────────────────────────

for (const [token, role] of ROLES) {
  for (const language of LANGUAGES) {
    for (const [w, h] of SIZES) {
      await m.viewport(w, h);
      await m.go(APP + '/', 500);
      await setToken(token);
      await setLanguage(language);

      const pages = role === 'owner' ? [...PAGES, ...OWNER_PAGES] : PAGES;
      for (const path of pages) await checkPage(path, `${role} ${language} ${w}x${h}`);

      if (process.env.RUN && w < 768 && role === 'owner' && language === 'en') {
        await checkAfterGenerate(`${w}x${h}`);
      }
    }
  }
}

console.log(
  `\n  ตรวจ ${checks} ชุด (2 สิทธิ์ × 2 ภาษา × ${SIZES.length} ขนาดจอ × 6-8 หน้า` +
    `${process.env.RUN ? ' + กด Generate' : ''}) · พบปัญหา ${problems}`,
);
await m.done();
process.exit(0);
