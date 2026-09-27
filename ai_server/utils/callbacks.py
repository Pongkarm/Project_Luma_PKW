"""
=============================================================================
LUMA Distributed AI Inference Node — Asynchronous Webhook Callback Utility
=============================================================================
ไฟล์นี้ทำหน้าที่ส่งผลลัพธ์การสร้างภาพกลับไปยัง Backend Core (Node 2):
1. ประกอบ Payload แจ้งสถานะ: completed, cancelled หรือ failed
2. แนบภาพผลลัพธ์ในรูปแบบ WebP Base64, เวลาประมวลผล (duration) และค่า Seed จริง
3. บันทึกไฟล์ภาพลงใน Local Cache สำรองบนเครื่อง AI เสมอ (Disaster Recovery)
4. ส่ง HTTP POST Webhook พร้อมระบบ Exponential Backoff Retry (3 ครั้ง)
   เพื่อรับประกันความคงทนต่อปัญหาเครือข่าย LAN สะดุดหรือกระตุก (Network Resilience)
=============================================================================
"""

import asyncio
import os
import httpx
from ai_server.config import AIConfig


async def send_callback_with_retry(
    task_id: str,
    status: str,
    image_base64: str = None,
    error_message: str = None,
    generation_time: float = 0.0,
    seed: int = None,
    callback_url: str = AIConfig.BACKEND_CALLBACK_URL
) -> bool:
    """
    ส่งผลลัพธ์ผ่าน Webhook กลับไปยังเซิร์ฟเวอร์ Backend:
    
    Parameters:
        task_id (str): รหัสงานที่ไม่ซ้ำกัน (UUID จาก Backend)
        status (str): สถานะผลลัพธ์ ("completed", "cancelled", "failed")
        image_base64 (str, optional): ข้อมูลรูปภาพ WebP เข้ารหัส Base64
        error_message (str, optional): ข้อความ Error หากการเจนล้มเหลว
        generation_time (float): ระยะเวลาที่ใช้ประมวลผลบน GPU (วินาที)
        seed (int, optional): ตัวเลข Seed จริงที่ใช้ในการสุ่มภาพ
        callback_url (str): ปลายทาง URL ของ Backend สำหรับรับ Webhook
        
    Returns:
        bool: คืนค่า True หากส่งสำเร็จ, คืนค่า False หากลองครบทุกครั้งแล้วยังล้มเหลว
    """
    # -------------------------------------------------------------------------
    # 1. จัดเตรียม Payload และ Header ตาม Data Contract
    # -------------------------------------------------------------------------
    payload = {
        "task_id": task_id,
        "status": status,
        "image_base64": image_base64,
        "error": error_message,
        "generation_time": round(generation_time, 2)
    }
    
    # หากมีค่า Seed ให้ส่งแนบไปด้วยเพื่อให้ Backend บันทึกลงฐานข้อมูล
    # รองรับฟีเจอร์ "Reuse Seed" บนหน้าเว็บ Frontend
    if seed is not None:
        payload["seed"] = seed

    headers = {
        "Content-Type": "application/json",
        "X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET
    }

    # -------------------------------------------------------------------------
    # 2. Local Disaster Recovery Caching (สำรองภาพลงดิสก์)
    # -------------------------------------------------------------------------
    # หากสร้างภาพสำเร็จ ให้เขียนไฟล์ Base64 เก็บไว้ใน Local Storage ของเครื่อง AI เสมอ
    # เผื่อกรณีที่สาย LAN หลุด หรือ Backend ดับกะทันหัน ผู้ใช้ยังสามารถตามกู้ภาพคืนได้
    if image_base64 and status == "completed":
        try:
            os.makedirs(AIConfig.CACHE_DIR, exist_ok=True)
            cache_file = os.path.join(AIConfig.CACHE_DIR, f"{task_id}.webp.b64")
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(image_base64)
        except Exception as e:
            print(f"[CACHE WARN] Failed to write local cache: {e}")

    # -------------------------------------------------------------------------
    # 3. ตรวจสอบปลายทาง Callback URL
    # -------------------------------------------------------------------------
    # หากไม่ได้กำหนด URL หรือระบุเป็น "none" (เช่น ในบาง Unit Test) ให้ข้ามการส่งผ่านเน็ตเวิร์ก
    if not callback_url or str(callback_url).lower() in ["none", "null", ""]:
        print(f"[CALLBACK SKIP] No callback destination specified for task {task_id}.")
        return True

    # -------------------------------------------------------------------------
    # 4. วงรอบการส่งซ้ำแบบ Exponential Backoff (1s, 2s, 4s)
    # -------------------------------------------------------------------------
    # หากเซิร์ฟเวอร์ปลายทางตอบสนองช้า หรือเครือข่ายมี Packet Drop ระบบจะรอและลองใหม่
    delays = [1.0, 2.0, 4.0]
    async with httpx.AsyncClient(timeout=15.0) as client:
        for attempt, delay in enumerate(delays, start=1):
            try:
                print(f"[CALLBACK] Attempt {attempt}/{len(delays)} -> {callback_url} (task: {task_id})")
                response = await client.post(callback_url, json=payload, headers=headers)
                
                # ตรวจสอบ HTTP Status Code: 200, 201 หรือ 204 ถือว่าส่งมอบสำเร็จ
                if response.status_code in [200, 201, 204]:
                    print(f"[CALLBACK SUCCESS] Task {task_id} delivered successfully.")
                    return True
                else:
                    print(f"[CALLBACK WARN] Status {response.status_code}: {response.text}")
                    
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError) as exc:
                print(f"[CALLBACK ERROR] Attempt {attempt} failed: {exc}")

            # เว้นระยะเวลาก่อนลองส่งครั้งถัดไป (1s -> 2s -> 4s)
            if attempt < len(delays):
                await asyncio.sleep(delay)

    print(f"[CALLBACK FAILED] All retry attempts exhausted for task {task_id}.")
    return False
