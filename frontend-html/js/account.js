/*
 * account.js — หน้าบัญชี
 *  - แสดงข้อมูลจาก GET /auth/me
 *  - แก้ชื่อผู้ใช้ / อีเมล / รหัสผ่าน ด้วย PATCH /auth/me (ต้องใส่รหัสผ่านปัจจุบันเสมอ)
 *  - เลือกธีม และออกจากระบบ
 *
 * ฟังก์ชันในไฟล์นี้:
 *   drawProfile()               เติมการ์ดโปรไฟล์
 *   openEdit() / closeEdit()    สลับระหว่างการ์ดโปรไฟล์กับฟอร์มแก้ไข
 *   updateForm()                ตรวจฟอร์ม และเปิด/ปิดปุ่มบันทึก
 *   saveProfile()               ส่งเฉพาะค่าที่เปลี่ยนไปที่ backend
 *   drawThemeTabs()             ไฮไลต์ปุ่มธีมที่ใช้อยู่
 *   start()                     เริ่มทำงานหน้า
 *
 * เชื่อมกับ:
 *   ใช้ของ     layout.js (requireLogin, setTheme, currentTheme, signOut, updateUserCount),
 *              api.js (apiRequest), widgets.js (renderPasswordRules, setupPasswordToggles),
 *              ui.js ($, formatDate, showAlert, toast), config.js (API_BASE_URL)
 *   backend    GET /auth/me (ผ่าน requireLogin) · PATCH /auth/me
 */

let user = null;

/* เติมการ์ดโปรไฟล์จากข้อมูลผู้ใช้ (และตัวเลขบนแถบบน) */
function drawProfile() {
  $('avatar').textContent = user.username.slice(0, 1).toUpperCase();
  $('profile-name').textContent = user.username;
  $('profile-email').textContent = user.email;
  $('profile-since').textContent = 'สมัครเมื่อ ' + formatDate(user.created_at);
  $('profile-runs').textContent = user.total_generations;
  updateUserCount(user);
}

/* ---------- แก้ไขโปรไฟล์ ---------- */

/* สลับการ์ดโปรไฟล์เป็นฟอร์มแก้ไข โดยเติมค่าปัจจุบันไว้ให้ */
function openEdit() {
  $('new-username').value = user.username;
  $('new-email').value = user.email;
  $('with-password').checked = false;
  $('password-box').hidden = true;
  $('new-password').value = '';
  $('confirm-password').value = '';
  $('current-password').value = '';
  showAlert($('edit-alert'), '');
  $('profile-card').hidden = true;
  $('edit-card').hidden = false;
  updateForm();
  $('new-username').focus();
}

/* กลับไปแสดงการ์ดโปรไฟล์ */
function closeEdit() {
  $('edit-card').hidden = true;
  $('profile-card').hidden = false;
}

/* อัปเดตเครื่องหมายถูกของรหัสผ่านใหม่ และเปิด/ปิดปุ่มบันทึก */
function updateForm() {
  const withPassword = $('with-password').checked;
  const passwordOk = renderPasswordRules($('new-password').value, $('confirm-password').value);

  const changed =
    $('new-username').value.trim() !== user.username || $('new-email').value.trim() !== user.email || withPassword;
  const filled = $('new-username').value.trim().length >= 3 && $('new-email').value.trim() && $('current-password').value;
  $('save-button').disabled = !(changed && filled && (!withPassword || passwordOk));
}

/* PATCH /auth/me — ส่งเฉพาะค่าที่เปลี่ยน พร้อมรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน */
async function saveProfile(event) {
  event.preventDefault();
  // ส่งเฉพาะค่าที่เปลี่ยน
  const body = { current_password: $('current-password').value };
  const username = $('new-username').value.trim();
  const email = $('new-email').value.trim();
  if (username !== user.username) body.username = username;
  if (email !== user.email) body.email = email;
  if ($('with-password').checked) body.new_password = $('new-password').value;

  $('save-button').disabled = true;
  $('save-button').textContent = 'กำลังบันทึก…';
  try {
    // quiet401: 401 ตรงนี้คือ "รหัสผ่านปัจจุบันผิด" ไม่ใช่หมดเวลาใช้งาน
    user = await apiRequest('/auth/me', { method: 'PATCH', json: body, quiet401: true });
    drawProfile();
    closeEdit();
    toast('บันทึกโปรไฟล์แล้ว');
  } catch (error) {
    showAlert($('edit-alert'), error.status === 401 ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : error.message);
  } finally {
    $('save-button').textContent = 'บันทึก';
    updateForm();
  }
}

/* ---------- ธีม ---------- */

/* ไฮไลต์ปุ่มธีมที่ใช้อยู่ */
function drawThemeTabs() {
  for (const button of document.querySelectorAll('#theme-tabs .seg__item')) {
    button.setAttribute('aria-selected', button.dataset.themeValue === currentTheme());
  }
}

/* ---------- เริ่มทำงาน ---------- */

/* เริ่มทำงาน: ตรวจล็อกอิน แสดงโปรไฟล์ แล้วผูกปุ่มทั้งหมด */
async function start() {
  user = await requireLogin('account');
  drawProfile();
  setupPasswordToggles();
  $('api-url').textContent = API_BASE_URL;

  $('edit-button').addEventListener('click', openEdit);
  $('cancel-edit').addEventListener('click', closeEdit);
  $('edit-form').addEventListener('submit', saveProfile);
  $('edit-form').addEventListener('input', updateForm);
  $('with-password').addEventListener('change', () => {
    $('password-box').hidden = !$('with-password').checked;
    updateForm();
  });

  drawThemeTabs();
  $('theme-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('.seg__item');
    if (!button) return;
    setTheme(button.dataset.themeValue);
    drawThemeTabs();
  });
  // ปุ่มธีมบนแถบบนก็เปลี่ยนธีมได้ → อัปเดตปุ่มในหน้านี้ตาม
  $('theme-button').addEventListener('click', drawThemeTabs);

  $('sign-out').addEventListener('click', signOut);
}

start();
