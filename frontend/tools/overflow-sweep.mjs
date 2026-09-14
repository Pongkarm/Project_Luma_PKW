const m = await import(process.env.SCRATCH + '/cdp.mjs');
const OVER = "(() => { const d=document.documentElement; return d.scrollWidth-d.clientWidth; })()";
// The app shell is exactly one screen tall and scrolls inside itself. On a phone,
// if the document scrolls or the workspace reaches under the tab bar, the
// controls are behind it — horizontal overflow alone never showed that.
const UNDER = `(() => {
  const d = document.documentElement, tab = document.querySelector('.tabbar');
  if (!tab || getComputedStyle(tab).display === 'none') return [];
  const top = tab.getBoundingClientRect().top, bad = [];
  if (d.scrollHeight - d.clientHeight > 1) bad.push('หน้าเลื่อนลง ' + (d.scrollHeight - d.clientHeight));
  for (const s of ['.main', '.controls', '.controls__foot']) {
    const e = document.querySelector(s);
    if (!e) continue;
    const below = Math.round(e.getBoundingClientRect().bottom - top);
    if (below > 1) bad.push(s + ' อยู่ใต้แถบแท็บ ' + below);
  }
  return bad;
})()`;
// The dev server has no favicon, so the first load of each fresh browser logs a
// 404 for it — once on the network and once in the console. It says nothing
// about the page, so both halves are dropped before judging it.
const withoutFavicon = (d) => {
  let n = d.net.filter((x) => x.url.endsWith('/favicon.ico')).length;
  return {
    net: d.net.filter((x) => !x.url.endsWith('/favicon.ico')),
    console: d.console.filter((x) => !(n > 0 && /Failed to load resource.*404/.test(x.text) && n--)),
  };
};
const setLang = (l) => m.evaluate("(() => { const raw=localStorage.getItem('luma.preferences');const p=raw?JSON.parse(raw):{state:{},version:0};p.state={...p.state,language:'"+l+"'};localStorage.setItem('luma.preferences',JSON.stringify(p)); })()");
// 402x740 is an iPhone 17 / 17 Pro with Safari's toolbars showing — the
// height people actually get, and the one where the controls first went under.
const SIZES = [[1440,900],[834,1000],[390,844],[402,740]];
let checks = 0, bad = 0;
for (const [tok, who] of [[process.env.OWNER,'owner'], [process.env.REV,'reviewer']]) {
  for (const lang of ['en','th']) {
    for (const [w,h] of SIZES) {
      await m.viewport(w,h);
      await m.go('http://localhost:5173/', 500);
      await m.evaluate(`localStorage.setItem('luma.token', ${JSON.stringify(tok)})`);
      await setLang(lang);
      const paths = ['/generate','/history','/account','/admin','/admin/users','/admin/activity'];
      if (who === 'owner') paths.push('/admin/audit','/admin/admins');
      for (const p of paths) {
        await m.go('http://localhost:5173'+p, 1200);
        checks++;
        const d = withoutFavicon(m.drain()); const over = await m.evaluate(OVER); const under = await m.evaluate(UNDER);
        if (over > 1 || under.length || d.console.length || d.net.filter(n=>n.status!==403).length) {
          bad++;
          console.log(`  ❌ ${p} ${who} ${lang} ${w}x${h}: ล้น ${over} · ${under.join(' · ')} · console ${d.console.map(x=>x.text.slice(0,70)).join('|')} · net ${JSON.stringify(d.net)}`);
        }
      }
      // A finished image is what pushed the controls off a phone, and no page
      // load shows one. RUN=1 presses Generate once per phone size (owner,
      // English) — it creates a real run, so it is opt-in.
      if (process.env.RUN && w < 768 && who === 'owner' && lang === 'en') {
        await m.go('http://localhost:5173/generate', 1500);
        await m.evaluate(`(() => {
          const ta = document.querySelector('.controls textarea');
          if (ta && !ta.value.trim()) {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'sweep: a lighthouse at dusk');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
          }
          document.querySelector('.controls__foot .btn--primary')?.click();
        })()`);
        let shown = false;
        for (let i = 0; i < 90 && !shown; i++) { await m.wait(1000); shown = await m.evaluate("!!document.querySelector('.result')"); }
        checks++;
        const under = await m.evaluate(UNDER); const d = withoutFavicon(m.drain());
        if (!shown || under.length || d.console.length) {
          bad++;
          console.log(`  ❌ /generate หลังกด Generate ${w}x${h}: ${shown ? '' : 'ไม่มีภาพผลลัพธ์ภายใน 90 วิ · '}${under.join(' · ')} · console ${d.console.map(x=>x.text.slice(0,70)).join('|')}`);
        }
      }
    }
  }
}
console.log(`\n  ตรวจ ${checks} ชุด (2 สิทธิ์ × 2 ภาษา × ${SIZES.length} ขนาดจอ × 6-8 หน้า${process.env.RUN ? ' + กด Generate' : ''}) · พบปัญหา ${bad}`);
await m.done(); process.exit(0);
