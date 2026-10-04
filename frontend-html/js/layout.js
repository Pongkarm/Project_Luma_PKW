/*
 * layout.js — ส่วนที่ทุกหน้าใช้ร่วมกัน
 *
 *  - requireLogin(): กันคนที่ยังไม่ล็อกอิน แล้ววาดโครงหน้า (แถบบน, เมนูซ้าย, แถบล่างบนมือถือ)
 *  - ธีมมืด/สว่าง
 *
 * หน้าที่ต้องล็อกอินมีโครง HTML แบบนี้ แล้ว layout.js เติมส่วนที่ว่างให้:
 *   <div class="app">
 *     <header class="topbar" id="topbar"></header>
 *     <div class="app__body">
 *       <nav class="rail" id="rail"></nav>
 *       ...เนื้อหาของหน้า...
 *     </div>
 *     <nav class="tabbar" id="tabbar"></nav>
 *   </div>
 */

/* ---------- ธีม ---------- */

/* ธีมที่เลือกไว้ (ค่าเริ่มต้น: มืด) */
function currentTheme() {
  return localStorage.getItem('luma.theme') || 'dark';
}

/* เปลี่ยนธีม: CSS ใน tokens.css อ่านค่า data-theme บน <html> */
function setTheme(theme) {
  localStorage.setItem('luma.theme', theme);
  document.documentElement.dataset.theme = theme;
  $('theme-button').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 14);
}

/* สลับมืด ↔ สว่าง (ปุ่มบนแถบบน) */
function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/* ออกจากระบบ = ลบ token ในเครื่องนี้ (backend ไม่มีปลายทางให้เรียก) */
function signOut() {
  setToken(null);
  location.href = 'login.html';
}

/* ---------- โครงหน้า ---------- */

/* ผู้ใช้ที่ล็อกอินอยู่ — เก็บไว้ให้หน้าอื่นใช้ */
let currentUser = null;

/*
 * เรียกตอนเปิดทุกหน้าที่ต้องล็อกอิน
 *   activePage — เมนูที่จะไฮไลต์: 'generate' | 'studio' | 'history' | 'account' | 'admin'
 * คืนค่า: ข้อมูลผู้ใช้ (จาก GET /auth/me)
 */
async function requireLogin(activePage) {
  if (!getToken()) {
    location.href = 'login.html';
    return new Promise(() => {}); // หยุดรอ เพราะกำลังเปลี่ยนหน้า
  }

  drawShell(activePage);

  try {
    currentUser = await apiRequest('/auth/me');
  } catch (error) {
    // 401 → api.js กำลังพาไปหน้าล็อกอินอยู่แล้ว จึงหยุดรอเฉย ๆ
    if (error.status === 401) return new Promise(() => {});
    toast(error.message);
    throw error;
  }

  updateUserCount(currentUser);
  checkEngine();
  checkAdminLink();
  return currentUser;
}

/* ชื่อผู้ใช้และจำนวนงานบนแถบบน + ตัวเลขข้างเมนูประวัติ */
function updateUserCount(user) {
  $('topbar-user').textContent = user.username;
  $('topbar-count').textContent = user.total_generations;
  $('rail-count').textContent = user.total_generations;
}

/* ขอข้อมูลผู้ใช้ใหม่ (เช่น หลังสร้างภาพเสร็จ จำนวนงานเปลี่ยน) */
async function refreshUser() {
  try {
    currentUser = await apiRequest('/auth/me');
    updateUserCount(currentUser);
  } catch (ignored) {
    // ไม่สำคัญพอจะแจ้งผู้ใช้
  }
}

const NAV_ITEMS = [
  { id: 'generate', href: 'generate.html', text: 'สร้างภาพ', icon: 'generate' },
  { id: 'studio', href: 'studio.html', text: 'สตูดิโอ', icon: 'wand' },
  { id: 'history', href: 'history.html', text: 'ประวัติ', icon: 'clock' },
  { id: 'account', href: 'account.html', text: 'บัญชี', icon: 'user' },
];

/* ลิงก์หนึ่งอันในเมนูซ้าย */
function railLink(item, activePage, extraClass = '', countId = '') {
  const active = item.id === activePage ? ' active" aria-current="page' : '';
  const count = countId ? '<span class="rail__count" id="' + countId + '"></span>' : '';
  return (
    '<a class="rail__link ' + extraClass + active + '" href="' + item.href + '" title="' + item.text + '" data-label="' + item.text + '">' +
    icon(item.icon, 16) + '<span class="rail__label">' + item.text + '</span>' + count + '</a>'
  );
}

/* วาดแถบบน เมนูซ้าย และแถบล่าง (มือถือ) ลงในกล่องว่างของหน้า */
function drawShell(activePage) {
  // แถบบน
  $('topbar').innerHTML =
    '<a class="brand" href="generate.html"><span class="brand__mark" aria-hidden="true">L</span><span class="brand__word">LUMA</span></a>' +
    '<div class="topbar__cluster">' +
    '<span class="status-pill" id="engine-pill" title="เครื่องประมวลผล"><span class="dot" id="engine-dot"></span><span class="status-pill__text" id="engine-text">กำลังตรวจสอบ…</span></span>' +
    '<span class="mono topbar__mode" id="engine-mode"></span>' +
    '<button type="button" class="icobtn" id="theme-button" title="สลับธีมมืด/สว่าง" aria-label="สลับธีมมืด/สว่าง">' + icon(currentTheme() === 'dark' ? 'sun' : 'moon', 14) + '</button>' +
    '<a class="topbar__user" href="account.html">' +
    icon('user', 15) + '<span id="topbar-user"></span><span class="mono text-meta" id="topbar-count"></span></a>' +
    '</div>';

  // เมนูซ้าย (จอใหญ่)
  const [generate, studio, history, account] = NAV_ITEMS;
  const collapsed = localStorage.getItem('luma.railCollapsed') === 'true';
  const rail = $('rail');
  rail.dataset.collapsed = collapsed;
  rail.setAttribute('aria-label', 'เมนูหลัก');
  rail.innerHTML =
    '<div class="rail__section">' + railLink(generate, activePage, 'rail__link--primary') + railLink(studio, activePage) + '</div>' +
    '<div class="rail__section"><span class="rail__sectionLabel">ผลงานของคุณ</span>' + railLink(history, activePage, '', 'rail-count') + '</div>' +
    '<div class="rail__spacer"></div>' +
    '<div class="rail__section">' +
    railLink({ id: 'admin', href: 'admin.html', text: 'แผงแอดมิน', icon: 'node' }, activePage, 'rail__link--minor').replace('<a ', '<a id="admin-rail-link" hidden ') +
    railLink(account, activePage, 'rail__link--minor') + '</div>' +
    '<button type="button" class="rail__collapse" id="rail-collapse" title="ย่อ/ขยายแถบเมนู" aria-label="ย่อ/ขยายแถบเมนู">' +
    icon(collapsed ? 'chevronRight' : 'chevronLeft', 13) + '</button>';

  // แถบล่าง (มือถือ)
  $('tabbar').setAttribute('aria-label', 'เมนูหลัก');
  $('tabbar').innerHTML = NAV_ITEMS.map((item) => {
    const active = item.id === activePage ? ' active" aria-current="page' : '';
    return '<a class="tabbar__link' + active + '" href="' + item.href + '">' + icon(item.icon, 18) + item.text + '</a>';
  }).join('');

  $('theme-button').addEventListener('click', toggleTheme);
  $('rail-collapse').addEventListener('click', () => {
    const next = rail.dataset.collapsed !== 'true';
    rail.dataset.collapsed = next;
    localStorage.setItem('luma.railCollapsed', next);
    $('rail-collapse').innerHTML = icon(next ? 'chevronRight' : 'chevronLeft', 13);
  });
}

/* ไฟสถานะบนแถบบน: backend ออนไลน์หรือไม่ และทำงานโหมดไหน */
async function checkEngine() {
  try {
    const status = await apiRequest('/api/status', { auth: false });
    $('engine-dot').className = 'dot dot--online';
    $('engine-text').textContent = 'พร้อมใช้งาน';
    $('engine-mode').textContent = status.ai_mode ? 'โหมด ' + status.ai_mode.toUpperCase() : '';
  } catch (error) {
    $('engine-dot').className = 'dot dot--offline';
    $('engine-text').textContent = 'เชื่อมต่อระบบไม่ได้';
  }
}

/* เมนู "แผงแอดมิน" แสดงเฉพาะบัญชีที่มีสิทธิ์ (backend ตอบ 403 ถ้าไม่มี) */
async function checkAdminLink() {
  try {
    await apiRequest('/admin/me', { quiet401: true });
    $('admin-rail-link').hidden = false;
  } catch (ignored) {
    // ไม่ใช่แอดมิน
  }
}
