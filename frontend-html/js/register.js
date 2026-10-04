/*
 * register.js — หน้าสมัครสมาชิก
 * 1) ตรวจรหัสผ่านในเบราว์เซอร์ก่อน (แสดงเป็นรายการติ๊กถูก)
 * 2) POST /auth/register
 * 3) สมัครสำเร็จแล้วล็อกอินให้อัตโนมัติ
 */

if (getToken()) location.href = 'generate.html';

setupPasswordToggles();

/* เงื่อนไขรหัสผ่าน (backend ไม่ได้บังคับ เราตั้งเองเพื่อความปลอดภัย) */
const RULES = [
  { id: 'rule-length', text: 'อย่างน้อย 8 ตัวอักษร', test: (pw) => pw.length >= 8 },
  { id: 'rule-variety', text: 'มีตัวเลขหรือสัญลักษณ์', test: (pw) => /[^A-Za-z]/.test(pw) },
  { id: 'rule-match', text: 'ตรงกันแล้ว', test: (pw, confirm) => pw.length > 0 && pw === confirm },
];

/* อัปเดตเครื่องหมายถูกของแต่ละเงื่อนไข และเปิด/ปิดปุ่มสมัคร */
function updateRules() {
  const password = $('password').value;
  const confirm = $('password-confirm').value;
  let allMet = true;

  for (const rule of RULES) {
    const met = rule.test(password, confirm);
    if (!met) allMet = false;
    const element = $(rule.id);
    element.className = 'auth__rule' + (met ? ' auth__rule--met' : '');
    // ผ่าน = วงกลมติ๊กถูก, ยังไม่ผ่าน = วงกลมเส้นประ
    let mark = icon(met ? 'checkCircle' : 'queue', 12, 'auth__ruleIcon');
    if (!met) mark = mark.replaceAll('<path ', '<path stroke-dasharray="3 3" ');
    element.innerHTML = mark + rule.text;
  }

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
