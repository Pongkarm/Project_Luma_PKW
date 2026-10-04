/*
 * tests/regressions.mjs — กันบั๊กที่เคยแก้แล้วไม่ให้กลับมา
 *
 * วิธีรัน (ในโฟลเดอร์ frontend-html):   npm run test:regressions
 * ต้องมี: backend + AI (หรือ mock AI) เหมือน e2e และบัญชีนั้นต้องมีงานที่เสร็จแล้วอย่างน้อย 2 งาน
 *         (รัน npm test ก่อนสักครั้งก็พอ)
 *
 * บั๊กเหล่านี้เกิดเมื่อผู้ใช้กดเร็วกว่าที่ backend ตอบ จึงจำลองด้วยการเรียกฟังก์ชันในหน้าเว็บตรง ๆ
 * แทนการกดปุ่ม (กดปุ่มด้วยเมาส์จำลองจังหวะให้ตรงทุกครั้งไม่ได้)
 */

import { preflight, startStaticServer, launchBrowser, createRunner, wait } from './lib.mjs';

const token = await preflight();
const { server, base } = await startStaticServer();
const page = await launchBrowser();
page.base = base;
const { step, finish } = createRunner(page);
const $ = (code) => page.js(code);

console.log(`ทดสอบบั๊กที่เคยแก้ ที่ ${base}\n`);
await page.setSize(1440, 900);
await page.signInWith(token);

// งานที่เสร็จแล้ว 2 งานล่าสุด
const runs = await $(`
  const data = await apiRequest('/generations?page=1&page_size=50');
  return data.items.filter((item) => item.status === 'completed').slice(0, 2);
`);
if (runs.length < 2) {
  console.error('\n✘ บัญชีนี้มีงานที่เสร็จแล้วไม่ถึง 2 งาน — รัน npm test ก่อน\n');
  process.exit(2);
}
const [first, second] = runs;

/* ---------- หน้าสร้างภาพ ---------- */

await step('แต่งด่วนแล้วเปิดงานอื่นระหว่างรอ → ภาพที่แต่งไม่ไปโผล่ในงานใหม่', async () => {
  await page.go('generate.html?run=' + first.id);
  await page.until(`run && run.id === '${first.id}' && runImageBlob`, 'เปิดงานแรก');
  await $(`applyQuick('sketch'); openRecent('${second.id}');`);
  await page.until(`run && run.id === '${second.id}' && runImageBlob`, 'เปิดงานที่สอง');
  await wait(2500); // ให้ผลของเครื่องมือกลับมาก่อน
  const state = await $(`return { quick: Boolean(quick), busy: quickBusy }`);
  if (state.quick) throw new Error('ภาพที่แต่งจากงานแรกไปแสดงในงานที่สอง');
  if (state.busy) throw new Error('ปุ่มแต่งด่วนค้างสถานะ "กำลังทำงาน"');
});

await step('กดหยุดระหว่างที่ถามสถานะอยู่ → สถานะไม่เด้งกลับ', async () => {
  // จำลองงานที่ยังไม่เสร็จ: ถามสถานะ (คำขอออกไปแล้ว) แล้วหยุดทันที
  await $(`
    stopWatching();
    run = { ...run, status: 'processing' };
    poll();
    stopWatching();
    run = { ...run, status: 'failed', error_message: CANCELLED_MESSAGE };
  `);
  await wait(1500);
  const status = await $(`return run.status`);
  if (status !== 'failed') throw new Error('สถานะถูกเขียนทับเป็น ' + status + ' หลังกดหยุด');
});

await step('หน้าสร้างภาพ: ไม่มีลิงก์ "บันทึกภาพ" ถ้ายังไม่มีภาพ', async () => {
  await $(`releaseImages(); renderResult();`);
  if (await $(`return Boolean(document.querySelector('#stage a[download]'))`)) throw new Error('มีลิงก์บันทึกทั้งที่ไม่มีภาพ');
});

await step('แก้เฉพาะจุดกับภาพ 4096×4096: ปุ่มย้อนกลับไม่กินหน่วยความจำเกิน และพิมพ์ไม่หน่วง', async () => {
  await page.go('generate.html');
  await $(`closeRun(); setMode('inpaint'); MaskEditor.resize(4096, 4096);`);
  const undoSteps = await $(`for (let i = 0; i < 10; i++) MaskEditor.saveUndo(); return MaskEditor.undoStack.length;`);
  if (undoSteps > 3) throw new Error('เก็บ undo ' + undoSteps + ' ขั้น (ควรไม่เกิน 3 ที่ภาพขนาดนี้)');
  const ms = await $(`const t = performance.now(); for (let i = 0; i < 50; i++) updateFooter(); return performance.now() - t;`);
  if (ms > 200) throw new Error('อัปเดตปุ่มสร้างภาพ 50 ครั้งใช้ ' + Math.round(ms) + ' ms (ช้าเกิน)');
  await $(`MaskEditor.resize(0, 0); MaskEditor.undoStack = [];`);
});

/* ---------- สตูดิโอ ---------- */

await step('สตูดิโอ: เปลี่ยนภาพระหว่างใช้เครื่องมือ → ผลของภาพเก่าไม่เข้ามาในภาพใหม่', async () => {
  await page.go('studio.html');
  await $(`await openRun('${first.id}')`);
  await page.until(`versions.length === 1 && current`, 'เปิดภาพแรก');
  await $(`applyTool(); await openRun('${second.id}');`);
  await wait(2500);
  const state = await $(`return { count: versions.length, busy, label: sourceLabel }`);
  if (state.count !== 1) throw new Error('ภาพใหม่มี ' + state.count + ' เวอร์ชัน (ควรมีแค่ต้นฉบับ)');
  if (state.busy) throw new Error('สตูดิโอค้างสถานะ "กำลังใช้เครื่องมือ"');
});

await step('สตูดิโอ: ข้อมูลส่งต่อที่เสียไม่ทำให้หน้าพัง', async () => {
  await $(`sessionStorage.setItem('luma.studio-handoff', '{broken')`);
  await page.go('studio.html');
  await page.until(`!$('apply-button').hidden && $('apply-text').textContent.length > 0`, 'หน้าสตูดิโอพร้อม');
});

/* ---------- หน้าประวัติ ---------- */

await step('ประวัติ: งานที่โหลดภาพไม่ได้ → ไม่มีปุ่มบันทึกภาพของงานก่อนหน้า', async () => {
  await page.go('history.html?id=' + first.id);
  await page.until(`!$('detail-save').hidden`, 'ปุ่มบันทึกของงานแรก');
  await $(`select({ ...selected, id: '00000000-0000-0000-0000-000000000000' })`);
  await wait(800);
  if (!(await $(`return $('detail-save').hidden`))) throw new Error('ปุ่มบันทึกยังแสดง (จะบันทึกภาพของงานก่อนหน้า)');
});

await step('ประวัติ: "ใช้ค่าเดิม" เอา LoRA ของงานนั้นไปด้วย', async () => {
  await page.go('history.html?id=' + first.id);
  await page.until(`selected`, 'เปิดงาน');
  const lora = 'tachi-e.safetensors';
  const saved = await $(`
    selected = { ...selected, lora_config: { id: ${JSON.stringify(lora)} } };
    reuseSettings(); // เขียนร่างแล้วเปลี่ยนหน้า — อ่านร่างทันทีก่อนหน้าเปลี่ยน
    return JSON.parse(localStorage.getItem(DRAFT_KEY)).lora;
  `);
  if (saved !== lora) throw new Error('ร่างได้ LoRA "' + saved + '" แทนที่จะเป็น "' + lora + '"');
  await page.waitForApp();
});

// 404 ของงานปลอมในขั้นประวัติ เป็น error ที่ตั้งใจให้เกิด
const ok = finish([/404/]);
page.close();
server.close();
process.exit(ok ? 0 : 1);
