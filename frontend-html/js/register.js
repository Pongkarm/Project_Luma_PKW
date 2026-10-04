/*
 * register.js — หน้าสมัครสมาชิก
 * 1) ตรวจรหัสผ่านในเบราว์เซอร์ก่อน (แสดงเป็นรายการติ๊กถูก)
 * 2) POST /auth/register
 * 3) สมัครสำเร็จแล้วล็อกอินให้อัตโนมัติ
 *
 * ฟังก์ชันในไฟล์นี้:
 *   updateRules()      ติ๊กเงื่อนไขรหัสผ่าน และเปิด/ปิดปุ่มสมัคร
 *   (โค้ดที่เหลือรันทันทีตอนโหลด: ผูกฟอร์มสมัคร)
 *
 * เชื่อมกับ:
 *   ใช้ของ     api.js (apiRequest, getToken, setToken), ui.js ($, showAlert),
 *              widgets.js (renderPasswordRules, setupPasswordToggles)
 *   backend    POST /auth/register → POST /auth/login
 *   ไปต่อที่   generate.html เมื่อสมัครสำเร็จ
 */

if (getToken()) location.href = 'generate.html';

setupPasswordToggles();

/* อัปเดตเครื่องหมายถูกของแต่ละเงื่อนไขรหัสผ่าน และเปิด/ปิดปุ่มสมัคร */
function updateRules() {
  const allMet = renderPasswordRules($('password').value, $('password-confirm').value);
  const filled = $('username').value.trim().length >= 3 && $('email').value.trim();
  $('register-button').disabled = !(allMet && filled);
}

for (const id of ['username', 'email', 'password', 'password-confirm']) {
  $(id).addEventListener('input', updateRules);
}
updateRules();

$('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = $('username').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;

  const button = $('register-button');
  button.disabled = true;
  button.textContent = 'กำลังสมัคร…';
  showAlert($('register-alert'), '');

  try {
    await apiRequest('/auth/register', { method: 'POST', json: { username, email, password }, auth: false });
    const login = await apiRequest('/auth/login', {
      method: 'POST',
      form: { username, password },
      auth: false,
      quiet401: true,
    });
    setToken(login.access_token);
    location.href = 'generate.html';
  } catch (error) {
    showAlert($('register-alert'), error.message);
    button.textContent = 'สมัครบัญชี';
    updateRules();
  }
});
