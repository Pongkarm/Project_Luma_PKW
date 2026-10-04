/*
 * start.js — หน้าแรก (index.html): ล็อกอินแล้วไปหน้าสร้างภาพ ยังไม่ล็อกอินไปหน้าเข้าสู่ระบบ
 */
location.replace(localStorage.getItem('luma.token') ? 'generate.html' : 'login.html');
