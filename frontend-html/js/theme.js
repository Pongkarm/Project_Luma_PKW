/*
 * theme.js — ตั้งธีมมืด/สว่างก่อนหน้าเว็บแสดงผล (โหลดใน <head> ก่อนไฟล์ CSS)
 * ถ้าตั้งช้ากว่านี้ หน้าจะกะพริบเป็นธีมมืดก่อนแล้วค่อยเปลี่ยน
 * อยู่เป็นไฟล์แยก (ไม่เขียนใน HTML ตรง ๆ) เพราะ Content-Security-Policy ไม่ยอมให้รันสคริปต์ในหน้า
 *
 * เชื่อมกับ:
 *   โหลดใน <head> ของทุกหน้า (ยกเว้น index.html) · อ่านคีย์ luma.theme ที่ layout.js เขียนไว้
 */
document.documentElement.dataset.theme = localStorage.getItem('luma.theme') || 'dark';
