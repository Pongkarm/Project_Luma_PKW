/*
 * admin/audit.js — บันทึกการกระทำของแอดมิน (GET /admin/audit) และหน้า Activity
 *
 * ฟังก์ชันในไฟล์นี้:
 *   drawActivity()     หน้า Activity (ยังไม่ได้ทำ แสดงข้อความแจ้งไว้)
 *   drawAudit()        บันทึกการกระทำ 100 รายการล่าสุด เขียนเป็นประโยค
 *   VERBS              คำกริยาของแต่ละการกระทำ
 *
 * เชื่อมกับ:
 *   ใช้ของ     main.js (main, header, me, notice, skeleton, unavailable), api.js (apiRequest), ui.js
 *   backend    GET /admin/audit?page=1&page_size=100
 */

/* ---------- Activity (ยังไม่ได้ทำ เหมือนเวอร์ชัน React) ---------- */

/* หน้า Activity ยังไม่ได้ทำ (เหมือนเวอร์ชัน React) — แสดงข้อความแจ้งไว้ */
function drawActivity() {
  main(header('Activity') + notice('info', 'Activity is not built yet',
    'The shell, the guard and the API behind this page are in place. Signed in as ' + escapeHtml(me.username) + ' (' + me.role + ').'));
}

/* ---------- Audit ---------- */

const VERBS = { 'user.disable': 'disabled', 'user.enable': 'enabled' };

/* รายการล่าสุด 100 รายการ เขียนเป็นประโยค "ใครทำอะไรกับใคร" */
async function drawAudit() {
  main(header('Audit', 'Read-only') + skeleton(6, 32));
  let data;
  try {
    data = await apiRequest('/admin/audit?page=1&page_size=100');
  } catch (error) {
    return main(header('Audit') + unavailable(error));
  }
  if (data.items.length === 0) {
    return main(header('Audit', 'Read-only') + notice('info', 'Nothing has been recorded yet', 'Actions that change an account will appear here as they happen.'));
  }
  // เขียนเป็นประโยค "ใครทำอะไรกับใคร" อ่านง่ายกว่าตารางรหัส
  main(
    header('Audit', data.total + ' recorded actions · read-only') +
    '<ol class="adm-audit">' +
    data.items.map((e) => {
      const target = (e.detail && e.detail.username) || (e.target_id ? e.target_id.slice(0, 8) : '—');
      const reason = e.detail && e.detail.reason ? '<em> — ' + escapeHtml(e.detail.reason) + '</em>' : '';
      return '<li><span class="adm-audit__when">' + formatDate(e.created_at) + '</span>' +
        '<span class="adm-audit__what"><strong>' + escapeHtml(e.actor_username) + '</strong> ' + escapeHtml(VERBS[e.action] || e.action) + ' <strong>' + escapeHtml(target) + '</strong>' + reason + '</span></li>';
    }).join('') +
    '</ol>',
  );
}
