const m = await import(process.env.SCRATCH + '/cdp.mjs');
const OVER = "(() => { const d=document.documentElement; return d.scrollWidth-d.clientWidth; })()";
const setLang = (l) => m.evaluate("(() => { const raw=localStorage.getItem('luma.preferences');const p=raw?JSON.parse(raw):{state:{},version:0};p.state={...p.state,language:'"+l+"'};localStorage.setItem('luma.preferences',JSON.stringify(p)); })()");
let checks = 0, bad = 0;
for (const [tok, who] of [[process.env.OWNER,'owner'], [process.env.REV,'reviewer']]) {
  for (const lang of ['en','th']) {
    for (const [w,h] of [[1440,900],[834,1000],[390,844]]) {
      await m.viewport(w,h);
      await m.go('http://localhost:5173/', 500);
      await m.evaluate(`localStorage.setItem('luma.token', ${JSON.stringify(tok)})`);
      await setLang(lang);
      const paths = ['/generate','/history','/account','/admin','/admin/users','/admin/activity'];
      if (who === 'owner') paths.push('/admin/audit','/admin/admins');
      for (const p of paths) {
        await m.go('http://localhost:5173'+p, 1200);
        checks++;
        const d = m.drain(); const over = await m.evaluate(OVER);
        if (over > 1 || d.console.length || d.net.filter(n=>n.status!==403).length) {
          bad++;
          console.log(`  ❌ ${p} ${who} ${lang} ${w}: ล้น ${over} · console ${d.console.map(x=>x.text.slice(0,70)).join('|')} · net ${JSON.stringify(d.net)}`);
        }
      }
    }
  }
}
console.log(`\n  ตรวจ ${checks} ชุด (2 สิทธิ์ × 2 ภาษา × 3 ขนาดจอ × 6-8 หน้า) · พบปัญหา ${bad}`);
await m.done(); process.exit(0);
