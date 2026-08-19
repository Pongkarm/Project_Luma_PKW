# 🎨 LUMA Frontend Integration Guide (API Contract & Cheat Sheet)

คู่มือการเชื่อมต่อ API สำหรับ **Frontend Developer (PC1: `192.168.1.10`)**  
เชื่อมต่อมายัง **Backend Server (PC2: `http://192.168.1.20:8000`)** หรือ Localhost `http://localhost:8000`

---

## 🌐 1. Network & Base URL

| Service | Environment | Base URL |
|---|---|---|
| **LUMA Backend API** | Localhost | `http://localhost:8000` |
| **LUMA Backend API** | LAN IP (Team) | `http://192.168.1.20:8000` |
| **Swagger Interactive Docs** | Interactive UI | `http://localhost:8000/docs` |
| **OpenAPI Specification** | JSON Spec | `http://localhost:8000/openapi.json` |

---

## 🔐 2. Authentication & User Profile

### A. สมัครสมาชิก (`POST /auth/register`)
- **Request Body (JSON):**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (201 Created):**
```json
{
  "id": "b17d581d-1507-4d39-99f8-b2e876b7d860",
  "username": "alice",
  "email": "alice@example.com",
  "is_active": true,
  "created_at": "2026-08-19T05:37:17Z"
}
```

---

### B. เข้าสู่ระบบ (`POST /auth/login`)
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body (Form URL Encoded):**
```
username=alice&password=SecurePassword123!
```
- **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```
> 💡 **Frontend Best Practice:** บันทึก Token ลงใน `localStorage.setItem('luma_token', data.access_token)`

---

### C. ข้อมูลผู้ใช้ & สถิติภาพ (`GET /auth/me`)
- **Headers:** `Authorization: Bearer <JWT_TOKEN>`
- **Response (200 OK):**
```json
{
  "id": "b17d581d-1507-4d39-99f8-b2e876b7d860",
  "username": "alice",
  "email": "alice@example.com",
  "is_active": true,
  "created_at": "2026-08-19T05:37:17Z",
  "total_generations": 14
}
```
> 💡 ใช้ค่า `total_generations` ไปแสดงเป็น Badge บน Navbar หรือ Profile Drawer ได้ทันที

---

## 📤 3. Image Upload System (`POST /uploads`)

ใช้สำหรับการอัปโหลดภาพต้นฉบับหรือ Mask สำหรับใช้งานใน **img2img** และ **Canvas Inpainting**

- **Endpoint:** `POST /uploads` (หรือ `POST /generations/upload`)
- **Headers:** 
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: multipart/form-data`
- **Form Data:**
  - `file`: `<Binary Image File (PNG, JPEG, WEBP ขนาดไม่เกิน 10MB)>`

- **Response (201 Created):**
```json
{
  "file_id": "a50c46e9-e9b8-4e05-926b-c680e7305f3d",
  "filename": "a50c46e9-e9b8-4e05-926b-c680e7305f3d.png",
  "url": "/uploads/a50c46e9-e9b8-4e05-926b-c680e7305f3d.png",
  "width": 512,
  "height": 512,
  "size_bytes": 104230,
  "format": "PNG"
}
```

### 💡 Code Snippet: แปลง Canvas Mask เป็น Blob แล้วอัปโหลด
```javascript
async function uploadCanvasMask(canvasElement) {
    const blob = await new Promise(resolve => canvasElement.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('file', blob, 'mask.png');

    const token = localStorage.getItem('luma_token');
    const res = await fetch('http://localhost:8000/uploads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    return await res.json(); // ได้ { url: "/uploads/..." }
}
```

---

## 🎨 4. AI Generation System (`POST /generations`)

### A. Text to Image (`task_type: "txt2img"`)
```json
{
  "task_type": "txt2img",
  "prompt": "1girl, solo, silver hair, glowing blue eyes, anime style, highly detailed, 8k",
  "negative_prompt": "blurry, low quality, bad anatomy, distorted",
  "model_name": "novaAnimeXL_ilV190.safetensors",
  "sampler_name": "Euler a",
  "steps": 25,
  "cfg_scale": 7.0,
  "width": 512,
  "height": 512,
  "seed": -1
}
```

### B. Image to Image (`task_type: "img2img"`)
```json
{
  "task_type": "img2img",
  "prompt": "cyberpunk version with neon holographic jacket and rain",
  "source_image_path": "/uploads/a50c46e9-e9b8-4e05-926b-c680e7305f3d.png",
  "denoising_strength": 0.65,
  "model_name": "counterfeitV30_v30.safetensors",
  "steps": 25,
  "cfg_scale": 7.5
}
```

### C. Canvas Inpainting (`task_type: "inpaint"`)
```json
{
  "task_type": "inpaint",
  "prompt": "add a cute magical cat sitting on shoulder",
  "source_image_path": "/uploads/original_image.png",
  "mask_image_path": "/uploads/mask_layer.png",
  "denoising_strength": 0.8,
  "model_name": "counterfeitV30_v30.safetensors"
}
```

- **Response (201 Created):**
```json
{
  "id": "e0ad98df-1468-499a-9154-5b80f6da4325",
  "user_id": "b17d581d-1507-4d39-99f8-b2e876b7d860",
  "task_type": "img2img",
  "prompt": "cyberpunk version...",
  "status": "pending",
  "created_at": "2026-08-19T05:37:24Z",
  "image_url": null
}
```

---

## ⏳ 5. Task Polling & Status Checking (`GET /generations/{id}`)

- **Endpoint:** `GET /generations/{id}`
- **Headers:** `Authorization: Bearer <JWT_TOKEN>`

### 🔄 Status State Flow:
```
[ pending ] ──► [ processing ] ──► [ completed ] (พร้อม image_url)
                                └──► [ failed ] (พร้อม error_message)
```

- **Response เมื่อเสร็จสิ้น (`completed`):**
```json
{
  "id": "e0ad98df-1468-499a-9154-5b80f6da4325",
  "status": "completed",
  "duration_seconds": 2.45,
  "completed_at": "2026-08-19T05:37:26Z",
  "image_url": "/generations/e0ad98df-1468-499a-9154-5b80f6da4325/image",
  "error_message": null
}
```

### 🖼️ ดึงรูปภาพผลลัพธ์:
- ให้แท็ก `<img>` ชี้ `src` ไปที่:
  `http://localhost:8000/generations/{id}/image` พร้อมแนบ Auth Header หรือเรียกผ่าน Fetch Blob

---

## 🏥 6. Health & System Check

- `GET /healthz` $\rightarrow$ เช็คว่า Backend ทำงานปกติหรือไม่
- `GET /api/status` $\rightarrow$ สรุปโหมดการทำงานและ Limits ต่างๆ

---

## 🚨 7. HTTP Error Matrix สำหรับจัดการใน UI

| HTTP Status | ความหมาย | สิ่งที่ Frontend ควรแสดง |
|---|---|---|
| `401 Unauthorized` | Token หมดอายุหรือไม่ได้ส่ง | Redirect ไปหน้า Login |
| `403 Forbidden` | ไม่มีสิทธิ์เข้าถึง Task ของ User คนอื่น | แสดงข้อความ Access Denied |
| `404 Not Found` | ไม่พบ Task หรือไฟล์รูปภาพ | แจ้งเตือน Item not found |
| `413 Payload Too Large` | ไฟล์อัปโหลดเกิน 10MB | แจ้งเตือน "ขนาดไฟล์ต้องไม่เกิน 10MB" |
| `415 Unsupported Media` | นามสกุลไฟล์ไม่ใช่ PNG/JPEG/WEBP | แจ้งเตือน "รองรับเฉพาะ PNG, JPEG, WEBP" |
| `422 Unprocessable` | ไฟล์เสีย / พารามิเตอร์ผิดพลาด | แสดงข้อความ Error ตาม `detail` |
