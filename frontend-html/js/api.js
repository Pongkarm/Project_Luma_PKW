/*
 * api.js — ทุกการคุยกับ backend ผ่านไฟล์นี้
 *
 * หลักการ:
 *  - หลังล็อกอิน backend ให้ "token" มา เราเก็บไว้ใน localStorage
 *    แล้วแนบไปกับทุกคำขอในหัว Authorization: Bearer <token>
 *  - ถ้า backend ตอบ 401 แปลว่า token หมดอายุ → ลบ token แล้วพาไปหน้าล็อกอิน
 *  - ทุกข้อผิดพลาดถูกแปลงเป็นข้อความภาษาไทยที่อ่านเข้าใจได้
 *
 * ฟังก์ชันในไฟล์นี้:
 *   getToken() / setToken()   อ่าน / เก็บ / ลบ token ใน localStorage
 *   authHeaders()             หัว Authorization ของคำขอ (ว่างถ้ายังไม่ล็อกอิน)
 *   ApiError                  error ที่มี status ติดมา ให้หน้าเว็บตัดสินใจต่อได้
 *   errorMessage()            รหัส HTTP → ข้อความภาษาไทย
 *   readDetail()              อ่าน detail ของ FastAPI ทั้งแบบข้อความและแบบรายการ
 *   handleUnauthorized()      token ใช้ไม่ได้ → ลบ แล้วพาไปหน้าล็อกอิน
 *   apiRequest()              ส่งคำขอ JSON / ฟอร์ม แล้วคืน JSON ที่ตอบกลับ
 *   apiUpload()               อัปโหลดไฟล์ (multipart) พร้อมแจ้งความคืบหน้า
 *   apiBlob() / apiImageUrl() ดึงภาพที่ต้องล็อกอินก่อนดู แล้วคืนเป็น Blob / URL
 *   toServerPath()            ตัด URL เต็มจาก backend เหลือแค่ path
 *
 * เชื่อมกับ:
 *   ใช้ของ     config.js (API_BASE_URL)
 *   ถูกใช้โดย  ทุกหน้า — ไม่มีไฟล์อื่นเรียก fetch เอง
 *   backend    ทุก endpoint ผ่านไฟล์นี้ ดูรายชื่อ endpoint ได้ที่หัวไฟล์ของแต่ละหน้า
 */

const TOKEN_KEY = 'luma.token';

/* token ที่ได้ตอนล็อกอิน (null = ยังไม่ล็อกอิน) */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/* เก็บ token ใหม่ หรือส่ง null เพื่อลบ (ออกจากระบบ) */
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/* หัว Authorization ของคำขอ (ว่างถ้ายังไม่ล็อกอิน — ไม่ส่ง "Bearer null") */
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

/* ข้อผิดพลาดจาก API — เก็บ status ไว้ให้หน้าเว็บตัดสินใจได้ */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* แปลงรหัสสถานะ HTTP เป็นข้อความภาษาไทย */
function errorMessage(status, detail) {
  if (status === 0) return 'ติดต่อ backend ไม่ได้ — ตรวจ IP ใน js/config.js และการเชื่อมต่อเครือข่าย';
  if (status === 401) return 'เซสชันหมดอายุ หรือชื่อผู้ใช้/รหัสผ่านไม่ถูกต้อง';
  if (status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
  if (status === 404) return detail || 'ไม่พบข้อมูลที่ขอ';
  if (status === 409) return detail || 'รายการนี้เปลี่ยนสถานะไปแล้ว';
  if (status === 413) return 'ไฟล์ใหญ่เกินไป (สูงสุด 10 MB และไม่เกิน 4096 พิกเซล)';
  if (status === 415) return 'รองรับเฉพาะไฟล์ PNG, JPEG และ WEBP';
  if (status >= 500) return detail || 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง';
  return detail || 'เกิดข้อผิดพลาด (รหัส ' + status + ')';
}

/*
 * FastAPI ส่ง detail กลับมาได้ 2 แบบ:
 *   { "detail": "ข้อความ" }  หรือ  { "detail": [ { "loc": [...], "msg": "..." } ] }
 */
function readDetail(body) {
  if (!body || !body.detail) return null;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    const first = body.detail[0];
    const field = (first.loc || []).filter((p) => p !== 'body' && p !== 'query').join('.');
    return field ? field + ': ' + first.msg : first.msg;
  }
  return null;
}

/* token ใช้ไม่ได้แล้ว → ลบทิ้ง แล้วพาไปหน้าล็อกอินพร้อมข้อความ "เซสชันหมดอายุ" */
function handleUnauthorized() {
  setToken(null);
  const here = location.pathname.split('/').pop();
  if (here !== 'login.html' && here !== 'register.html') {
    location.href = 'login.html?expired=1';
  }
}

/*
 * ส่งคำขอไป backend
 *   path    เช่น '/generations'
 *   options { method, json, form, auth (ค่าเริ่มต้น true), quiet401 }
 * คืนค่า: ข้อมูล JSON ที่ backend ตอบ
 */
async function apiRequest(path, options = {}) {
  const headers = options.auth === false ? {} : authHeaders();
  let body;

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    // หน้าล็อกอินของ backend รับแบบฟอร์ม ไม่ใช่ JSON
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, { method: options.method || 'GET', headers, body });
  } catch (networkError) {
    throw new ApiError(0, errorMessage(0));
  }

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch (ignored) {
      // บางครั้ง error ไม่มีเนื้อหา — ใช้แค่ status ก็พอ
    }
    if (response.status === 401 && !options.quiet401) handleUnauthorized();
    throw new ApiError(response.status, errorMessage(response.status, readDetail(data)));
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/*
 * อัปโหลดไฟล์ภาพแบบ multipart/form-data
 *   fields — ค่าอื่นที่ส่งไปพร้อมไฟล์ เช่น { blur_ksize: '21' }
 *   onProgress(0..1) — แจ้งความคืบหน้าของการอัปโหลด (ไม่ใส่ก็ได้)
 * ใช้ XMLHttpRequest เพราะ fetch ไม่บอกความคืบหน้าตอนอัปโหลด
 */
function apiUpload(path, fileBlob, fileName, fields = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', fileBlob, fileName);
    for (const key in fields) form.append(key, fields[key]);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + path);
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (ignored) {
        // ไม่ใช่ JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      if (xhr.status === 401) handleUnauthorized();
      reject(new ApiError(xhr.status, errorMessage(xhr.status, readDetail(data))));
    };
    xhr.onerror = () => reject(new ApiError(0, errorMessage(0)));
    xhr.send(form);
  });
}

/*
 * ดึงไฟล์ภาพที่ต้องล็อกอินก่อนถึงจะดูได้ (เช่น /generations/{id}/image)
 * แท็ก <img src> แนบ token ไม่ได้ จึงต้องดึงเป็น Blob เองแล้วค่อยแสดง
 */
async function apiBlob(path) {
  let response;
  try {
    response = await fetch(API_BASE_URL + path, { headers: authHeaders() });
  } catch (networkError) {
    throw new ApiError(0, errorMessage(0));
  }
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    throw new ApiError(response.status, errorMessage(response.status));
  }
  return response.blob();
}

/* เหมือน apiBlob แต่คืนเป็น URL ที่เอาไปใส่ <img src> ได้ทันที */
async function apiImageUrl(path) {
  const blob = await apiBlob(path);
  return URL.createObjectURL(blob);
}

/*
 * backend บางครั้งตอบที่อยู่ไฟล์เป็น URL เต็ม (มี IP ของเครื่อง backend)
 * ฟังก์ชันนี้ตัดเหลือแค่ path เช่น '/api/tools/results/sketch_x.png'
 * แล้วเราจะไปขอจาก API_BASE_URL เสมอ
 */
function toServerPath(url) {
  try {
    return new URL(url, API_BASE_URL).pathname;
  } catch (ignored) {
    return url;
  }
}
