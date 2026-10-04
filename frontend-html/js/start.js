/*
 * start.js — หน้าแรก (index.html): ล็อกอินแล้วไปหน้าสร้างภาพ ยังไม่ล็อกอินไปหน้าเข้าสู่ระบบ
 *
 * เชื่อมกับ:
 *   โหลดใน index.html เท่านั้น · อ่านคีย์ luma.token ที่ api.js เขียนไว้ตอนล็อกอิน
 */
location.replace(localStorage.getItem('luma.token') ? 'generate.html' : 'login.html');
