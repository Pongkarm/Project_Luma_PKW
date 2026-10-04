/*
 * admin/main.js — แผงแอดมิน (ข้อความบนหน้าจอเป็นภาษาอังกฤษ เหมือนเวอร์ชัน React)
 *
 * สิทธิ์มี 3 ระดับ (backend เป็นคนตรวจจริง หน้าเว็บแค่ซ่อนส่วนที่ใช้ไม่ได้):
 *   reviewer — ดูภาพรวมและรายชื่อผู้ใช้ (อีเมลถูกปิดบางส่วน)
 *   admin    — ปิด/เปิดบัญชีผู้ใช้ได้ ดูบันทึกการกระทำได้
 *   owner    — ให้/ถอนสิทธิ์ผู้ดูแลได้
 *
 * แต่ละหน้าย่อยเลือกด้วยส่วนท้ายของที่อยู่เว็บ: admin.html#users, #audit, ...
 *
 * ไฟล์ในโฟลเดอร์ js/admin/:
 *   main.js      ตัวกลาง: สิทธิ์, เมนูซ้าย, เลือกหน้าย่อย, ฟังก์ชันวาดที่ใช้ร่วมกัน  ← ไฟล์นี้
 *   overview.js  ตัวเลขสรุป, สาเหตุที่ล้มเหลว, กราฟการใช้งาน
 *   users.js     ตารางผู้ใช้ + แผงรายละเอียด + ปิด/เปิดบัญชี
 *   audit.js     บันทึกการกระทำ (และหน้า Activity ที่ยังไม่ได้ทำ)
 *   admins.js    ให้/ถอนสิทธิ์ผู้ดูแล
 *
 * ฟังก์ชันในไฟล์นี้:
 *   sections() / allowedSections()   รายการหน้าย่อย และหน้าที่สิทธิ์ของเราเปิดได้
 *   main() / header() / skeleton() / notice() / unavailable()   ฟังก์ชันวาดที่ทุกหน้าย่อยใช้
 *   route()              อ่าน # ท้ายที่อยู่เว็บ แล้ววาดเมนูกับหน้าย่อยนั้น
 *   hashParams()         ค่าตัวกรองที่ต่อท้าย # (เช่น #users?status=disabled)
 *   start()              ถามสิทธิ์จาก backend แล้วเปิดแผง
 *
 * เชื่อมกับ:
 *   ใช้ของ     api.js (apiRequest, getToken), ui.js ($, escapeHtml), icons.js (icon)
 *              และ drawOverview / drawUsers / drawActivity / drawAudit / drawAdmins จากไฟล์อื่นในโฟลเดอร์
 *   backend    GET /admin/me
 */

let me = null; // สิทธิ์ของเรา จาก GET /admin/me

/*
 * หน้าย่อยทั้งหมด — draw คือฟังก์ชันวาดหน้านั้น (อยู่ในไฟล์ของแต่ละหน้า)
 * allowed บอกว่าสิทธิ์ของเราเปิดหน้านี้ได้ไหม (ไม่มี = ทุกระดับเปิดได้)
 * เขียนเป็นฟังก์ชัน เพราะต้องรอให้ไฟล์ของทุกหน้าโหลดเสร็จก่อนจึงอ้างถึงได้
 */
function sections() {
  return [
    { id: 'overview', label: 'Overview', icon: 'generate', draw: drawOverview },
    { id: 'users', label: 'Users', icon: 'user', draw: drawUsers },
    { id: 'activity', label: 'Activity', icon: 'clock', draw: drawActivity },
    { id: 'audit', label: 'Audit', icon: 'layers', draw: drawAudit, allowed: () => me.can_view_audit },
    { id: 'admins', label: 'Admins', icon: 'lock', draw: drawAdmins, allowed: () => me.can_manage_admins },
  ];
}

const ROLES = ['reviewer', 'admin', 'owner'];

/* แทนเนื้อหาด้านขวาทั้งหมดด้วย HTML ที่ให้มา */
function main(html) {
  $('admin-main').innerHTML = html;
}

/* หัวข้อของหน้าย่อย + คำอธิบายสั้น */
function header(title, sub = '') {
  return '<header class="adm__head"><h1>' + title + '</h1>' + (sub ? '<p class="adm__sub">' + sub + '</p>' : '') + '</header>';
}

/* แถบสีเทากะพริบระหว่างรอข้อมูล */
function skeleton(rows, height = 40) {
  return '<div class="adm-skel">' + '<span class="skeleton" style="height: ' + height + 'px"></span>'.repeat(rows) + '</div>';
}

/* กล่องข้อความกลางจอ (ไม่มีข้อมูล / ไม่มีสิทธิ์ / ผิดพลาด) */
function notice(iconName, title, body, action = '') {
  return '<div class="adm-notice">' + icon(iconName, 22) + '<h2>' + title + '</h2><p>' + body + '</p>' + action + '</div>';
}

/* backend ไม่ตอบ — ให้กดลองใหม่ได้ */
function unavailable(error) {
  return notice('alert', 'The admin service did not answer', escapeHtml(error.message),
    '<button type="button" class="btn btn--secondary" data-reload>' + icon('refresh', 14) + 'Try again</button>');
}

/* ---------- เปลี่ยนหน้าย่อย ---------- */

/* หน้าย่อยที่สิทธิ์ของเราเปิดได้ */
function allowedSections() {
  return sections().filter((section) => !section.allowed || section.allowed());
}

/* อ่าน # ท้ายที่อยู่เว็บ แล้ววาดเมนูซ้ายและหน้าย่อยนั้น (เรียกทุกครั้งที่ # เปลี่ยน) */
function route() {
  const id = location.hash.slice(1).split('?')[0] || 'overview';
  const section = allowedSections().find((s) => s.id === id) || sections()[0];
  $('admin-nav').innerHTML = allowedSections()
    .map((s) => '<a class="adm__link' + (s === section ? ' adm__link--on' : '') + '" href="#' + s.id + '">' + icon(s.icon, 15) + '<span>' + s.label + '</span></a>')
    .join('');
  section.draw();
}

/* ค่าที่ต่อท้าย # เช่น #users?status=disabled */
function hashParams() {
  return new URLSearchParams(location.hash.split('?')[1] || '');
}

/* ---------- เริ่มทำงาน ---------- */

/* ปุ่ม "Try again" ของ unavailable() — ผูกที่ document เพราะปุ่มถูกสร้างใหม่ได้ทุกเมื่อ */
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-reload]')) location.reload();
});

/* เริ่มทำงาน: ถามสิทธิ์จาก GET /admin/me ก่อน ถ้าไม่มีสิทธิ์แสดงข้อความแทน */
async function start() {
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }
  try {
    me = await apiRequest('/admin/me');
  } catch (error) {
    if (error.status === 401) return; // api.js กำลังพาไปหน้าล็อกอิน
    $('admin-blocked').hidden = false;
    $('admin-blocked').outerHTML =
      error.status === 403
        ? notice('lock', 'You do not have access to the admin console',
            'Your account is signed in but holds no admin role. An owner can grant one from Admin management.',
            '<a class="btn btn--secondary" href="generate.html">Back to LUMA</a>')
        : unavailable(error);
    return;
  }

  $('admin-app').hidden = false;
  $('who-name').textContent = me.username;
  $('who-role').textContent = me.role;
  window.addEventListener('hashchange', route);
  route();
}

start();
