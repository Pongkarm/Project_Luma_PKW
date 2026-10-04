/*
 * generate/families.js — ตระกูลของโมเดล และ LoRA ที่ใช้คู่กันได้ (GitHub issue #2)
 *
 * LoRA ถูกฝึกมากับโมเดลตระกูลหนึ่ง ถ้าเอาไปใช้กับโมเดลต่างตระกูล ภาพจะเพี้ยนหนัก
 * หน้าเว็บจึงแสดงในช่อง "สไตล์เสริม" เฉพาะ LoRA ที่ตระกูลตรงกับโมเดลที่เลือก
 *
 * หาตระกูลจากที่ไหน (เรียงตามลำดับ):
 *   1) ช่อง family ที่ GET /api/models ส่งมา
 *   2) รายชื่อสำรองใน config.js ที่ id ตรงกัน
 *   3) โมเดล: เดาจากชื่อไฟล์ ด้วยกฎเดียวกับ detect_model_family() ของเครื่อง AI
 *      LoRA: ไม่รู้ตระกูล ('unknown') → แสดงกับทุกโมเดล (เครื่อง AI ก็ปล่อยผ่านเหมือนกัน)
 * เครื่อง AI ตรวจซ้ำอีกชั้นตอนสร้างภาพ (ai_server/services/prompt_builder.py) ถ้าคู่ไม่ตรง จะข้าม LoRA นั้นไป
 *
 * ฟังก์ชันในไฟล์นี้ (คำนวณล้วน ๆ ไม่แตะหน้าเว็บ — ทดสอบใน tests/unit.mjs):
 *   FAMILY_TEXT            ชื่อตระกูลสำหรับแสดงบนหน้าเว็บ
 *   detectModelFamily()    เดาตระกูลของโมเดลจากชื่อไฟล์
 *   modelFamily()          ตระกูลของโมเดลหนึ่งตัว (ใช้ family ที่มี ถ้าไม่มีค่อยเดา)
 *   loraFamily()           ตระกูลของ LoRA หนึ่งตัว ('unknown' ถ้าไม่รู้)
 *   compatibleLoras()      กรองรายชื่อ LoRA ให้เหลือเฉพาะตัวที่ใช้กับโมเดลนี้ได้
 *
 * เชื่อมกับ:
 *   ใช้ของ     config.js (FALLBACK_CHECKPOINTS, FALLBACK_LORAS)
 *   ถูกใช้โดย  settings.js (กรองช่อง LoRA และคำใบ้ใต้ช่อง)
 */

const FAMILY_TEXT = { sd15: 'SD 1.5', illustrious_xl: 'Illustrious XL', pony_xl: 'Pony XL' };

/* เดาตระกูลจากชื่อไฟล์ — ต้องตรงกับ detect_model_family() ของเครื่อง AI ทุกข้อ ลำดับก็สำคัญ */
function detectModelFamily(modelId) {
  const name = String(modelId || '').toLowerCase();
  if (['pdxl', 'pony'].some((key) => name.includes(key))) return 'pony_xl';
  if (['illu', 'nova', 'xl'].some((key) => name.includes(key))) return 'illustrious_xl';
  return 'sd15';
}

/* ตระกูลของโมเดล: { id, family? } → 'sd15' | 'illustrious_xl' | 'pony_xl' */
function modelFamily(model) {
  if (model.family) return model.family;
  const known = FALLBACK_CHECKPOINTS.find((item) => item.id === model.id);
  return known ? known.family : detectModelFamily(model.id);
}

/* ตระกูลของ LoRA: { id, family? } → ตระกูล หรือ 'unknown' */
function loraFamily(lora) {
  if (lora.family) return lora.family;
  const known = FALLBACK_LORAS.find((item) => item.id === lora.id);
  return known ? known.family : 'unknown';
}

/* LoRA ที่ใช้กับโมเดลตระกูลนี้ได้ — ตัวที่ไม่รู้ตระกูลแสดงไว้เสมอ */
function compatibleLoras(loras, family) {
  return loras.filter((lora) => {
    const own = loraFamily(lora);
    return own === 'unknown' || own === family;
  });
}
