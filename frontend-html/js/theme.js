/*
 * theme.js — ตั้งธีมมืด/สว่างก่อนหน้าเว็บแสดงผล (โหลดใน <head> ก่อนไฟล์ CSS)
 * ถ้าตั้งช้ากว่านี้ หน้าจะกะพริบเป็นธีมมืดก่อนแล้วค่อยเปลี่ยน
 * อยู่เป็นไฟล์แยก (ไม่เขียนใน HTML ตรง ๆ) เพราะ Content-Security-Policy ไม่ยอมให้รันสคริปต์ในหน้า
 */
document.documentElement.dataset.theme = localStorage.getItem('luma.theme') || 'dark';
