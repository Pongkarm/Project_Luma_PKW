/*
 * login.js — หน้าเข้าสู่ระบบ
 * ส่งชื่อผู้ใช้ + รหัสผ่านไป POST /auth/login แล้วเก็บ token ที่ได้กลับมา
 *
 * ฟังก์ชันในไฟล์นี้:
 *   updateButton()     เปิดปุ่มเข้าสู่ระบบเมื่อกรอกครบ
 *   (โค้ดที่เหลือรันทันทีตอนโหลด: ผูกฟอร์ม และพาไปหน้าสร้างภาพถ้าล็อกอินอยู่แล้ว)
 *
 * เชื่อมกับ:
 *   ใช้ของ     api.js (apiRequest, getToken, setToken), ui.js ($, showAlert),
 *              widgets.js (setupPasswordToggles)
 *   backend    POST /auth/login (ส่งแบบฟอร์ม ไม่ใช่ JSON)
 *   ไปต่อที่   generate.html เมื่อล็อกอินสำเร็จ
 */

// ล็อกอินอยู่แล้ว → ไปหน้าสร้างภาพเลย
if (getToken()) location.href = 'generate.html';

setupPasswordToggles();

// ถูกส่งมาที่นี่เพราะ token หมดอายุ
if (new URLSearchParams(location.search).has('expired')) {
  showAlert($('login-alert'), 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง', 'info');
}

// ปุ่มกดได้เมื่อกรอกครบทั้งสองช่อง
function updateButton() {
  $('login-button').disabled = !$('username').value.trim() || !$('password').value;
}
$('username').addEventListener('input', updateButton);
$('password').addEventListener('input', updateButton);

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); // ไม่ให้ฟอร์มรีโหลดหน้า
  const button = $('login-button');
  button.disabled = true;
  button.textContent = 'กำลังเข้าสู่ระบบ…';
  showAlert($('login-alert'), '');

  try {
    // backend รับข้อมูลล็อกอินแบบฟอร์ม (form) ไม่ใช่ JSON
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      form: { username: $('username').value.trim(), password: $('password').value },
      auth: false,
      quiet401: true, // 401 ตรงนี้แปลว่ารหัสผิด ไม่ใช่ token หมดอายุ
    });
    setToken(result.access_token);
    location.href = 'generate.html';
  } catch (error) {
    showAlert($('login-alert'), error.status === 401 ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : error.message);
    button.textContent = 'เข้าสู่ระบบ';
    updateButton();
  }
});
