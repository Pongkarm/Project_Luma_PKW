import { readFileSync } from 'node:fs';
const m = await import(process.env.SCRATCH + '/cdp.mjs');
const probe = readFileSync(process.env.SCRATCH + '/vis.js', 'utf8');
let issues = 0, pages = 0;
for (const [w,h] of [[1440,900],[1024,768],[390,844]]) {
  await m.viewport(w,h);
  await m.go('http://localhost:5173/', 400);
  await m.evaluate(`localStorage.setItem('luma.token', ${JSON.stringify(process.env.OWNER)})`);
  for (const p of ['/generate','/history','/account','/admin','/admin/users','/admin/activity','/admin/audit','/admin/admins']) {
    await m.go('http://localhost:5173'+p, 1500);
    pages++;
    const r = await m.evaluate(probe);
    if (r.bad.length) {
      issues += r.bad.length;
      console.log(`  ${p} @${w}: ${r.bad.map(b=>`"${b.label}" ${b.why} [${b.box}]`).join(' · ')}`);
    }
  }
  // เปิด drawer แล้วเช็คด้วย
  await m.go('http://localhost:5173/admin/users', 1600);
  await m.evaluate(`document.querySelector('.adm-table tbody tr')?.click()`);
  await m.wait(1200);
  const d = await m.evaluate(probe);
  if (d.bad.length) { issues += d.bad.length; console.log(`  drawer @${w}: ${d.bad.map(b=>`"${b.label}" ${b.why}`).join(' · ')}`); }
}
console.log(`\n  ตรวจ ${pages} หน้า + drawer 3 ขนาด · พบ ${issues} จุด`);
await m.done(); process.exit(0);
