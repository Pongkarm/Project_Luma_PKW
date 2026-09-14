// Is every button, link and field actually visible and inside the viewport.
import { readFileSync } from 'node:fs';

const m = await import(process.env.SCRATCH + '/cdp.mjs');
const probe = readFileSync(process.env.SCRATCH + '/vis.js', 'utf8');

const APP = 'http://localhost:5173';

// 402x740 is an iPhone 17 / 17 Pro with Safari's toolbars showing.
const SIZES = [[1440, 900], [1024, 768], [390, 844], [402, 740]];
const PAGES = [
  '/generate', '/history', '/account',
  '/admin', '/admin/users', '/admin/activity', '/admin/audit', '/admin/admins',
];

const describe = (bad, withBox) =>
  bad.map((b) => `"${b.label}" ${b.why}${withBox ? ` [${b.box}]` : ''}`).join(' · ');

let pages = 0;
let issues = 0;

for (const [w, h] of SIZES) {
  await m.viewport(w, h);
  await m.go(APP + '/', 400);
  await m.evaluate(`localStorage.setItem('luma.token', ${JSON.stringify(process.env.OWNER)})`);

  for (const path of PAGES) {
    await m.go(APP + path, 1500);
    pages++;
    const result = await m.evaluate(probe);
    if (result.bad.length) {
      issues += result.bad.length;
      console.log(`  ${path} @${w}: ${describe(result.bad, true)}`);
    }
  }

  // The user drawer is the element that once came to rest off-screen, so open
  // it and look, rather than trusting that it exists.
  await m.go(APP + '/admin/users', 1600);
  await m.evaluate(`document.querySelector('.adm-table tbody tr')?.click()`);
  await m.wait(1200);
  const drawer = await m.evaluate(probe);
  if (drawer.bad.length) {
    issues += drawer.bad.length;
    console.log(`  drawer @${w}: ${describe(drawer.bad, false)}`);
  }
}

console.log(`\n  ตรวจ ${pages} หน้า + drawer ${SIZES.length} ขนาด · พบ ${issues} จุด`);
await m.done();
process.exit(0);
