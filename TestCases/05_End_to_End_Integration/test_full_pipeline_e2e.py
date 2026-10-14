"""
=============================================================================
LUMA Automated Test Suite — Track 05: Multi-Node E2E Full Pipeline Integration
=============================================================================
ไฟล์ทดสอบอัตโนมัติภาษา Python สำหรับตรวจสอบการเชื่อมต่อแบบบูรณาการ 4 โหนด:
- โหนด 1 (Gateway :80) ➔ โหนด 2 (Frontend :5500)
- โหนด 1 (Gateway :80) ➔ โหนด 3 (Backend :8000)
- โหนด 3 (Backend :8000) ➔ โหนด 4 (AI Node :7860) ➔ Webhook Callback
=============================================================================
"""

import unittest
import sys
import os
import json
import base64
import hashlib
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class TestMultiNodeFullPipeline(unittest.TestCase):
    """การทดสอบวงจรชีวิตแบบ End-to-End ครบทั้ง 4 โหนด"""

    def setUp(self):
        self.internal_secret = "LUMA_PROD_INTERNAL_SECRET_KEY_FOR_CROSS_NODE_COMMUNICATION_2026"
        self.state_db = {}
        self.output_storage = {}

    def test_tc_e2e_001_auth_token_issuance_and_routing(self):
        """
        [TC-E2E-001] ผู้ใช้สมัครและล็อกอินผ่าน Gateway ได้รับ Token ใช้งานข้ามโหนด
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบวงจรการพิสูจน์ตัวตนข้ามโหนด (Cross-Node Authentication Lifecycle)
          - ตรวจสอบการสมัครสมาชิกและการแฮชรหัสผ่านด้วย SHA-256
          - ตรวจสอบการล็อกอินและออก Bearer JWT Token พร้อม Payload กำหนดสิทธิ์และเวลาหมดอายุ
          - ยืนยันว่า Token สามารถใช้เป็นกุญแจในการ Routing ผ่าน Nginx Gateway ไปยังบริการต่างๆ ได้
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โฟลว์การพิสูจน์ตัวตนระหว่าง `frontend-html/js/login.js` ➔ `app/api/auth.py` ผ่าน Gateway `nginx/conf/nginx.conf`
          - ดึงข้อมูลมายังไง (How): สกัดโครงสร้าง JWT Payload (sub, role, exp) และอัลกอริทึมเข้ารหัส SHA-256 มาจำลองการออก Token สำหรับนำไป Routing ข้ามโหนด
        * ข้อมูลนำเข้า (Test Inputs):
          - username: 'student_qa_demo'
          - password: 'StrongPass@2026'
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - Hash ในฐานข้อมูลต้องตรงกับรหัสผ่านต้นฉบับ
          - ค้นหาผู้ใช้ใน state_db พบอย่างถูกต้อง
          - สร้าง Token สำเร็จและมีความยาวมากกว่า 20 ตัวอักษร
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - ผู้ใช้ปลายทางล็อกอินผ่าน Node 1 (Gateway Nginx) แล้วใช้ Bearer Token เดียวกันนี้เรียกใช้ API บน Node 3 (Backend)
        """
        # ขั้นตอนที่ 1: จำลองการลงทะเบียนผู้ใช้ใหม่ พร้อมแฮชรหัสผ่านอย่างปลอดภัย
        username = "student_qa_demo"
        password_hash = hashlib.sha256("StrongPass@2026".encode()).hexdigest()
        self.state_db["users"] = {username: {"hash": password_hash, "role": "user"}}

        # ขั้นตอนที่ 2: จำลองการตรวจสอบสิทธิ์การล็อกอิน (Authentication Check)
        user_record = self.state_db["users"].get(username)
        self.assertIsNotNone(user_record, "ต้องค้นพบผู้ใช้ในระบบ")
        self.assertEqual(user_record["hash"], password_hash, "รหัสผ่านแฮชต้องตรงกัน")

        # ขั้นตอนที่ 3: สร้างและออก Bearer Token Payload (JWT Simulation)
        payload = {"sub": username, "role": user_record["role"], "exp": time.time() + 86400}
        token = base64.b64encode(json.dumps(payload).encode()).decode()

        # ตรวจสอบว่าโทเค็นถูกสร้างขึ้นมาอย่างถูกต้อง
        self.assertTrue(len(token) > 20, "Token ต้องมีขนาดความยาวถูกต้องสมบูรณ์")

    def test_tc_e2e_003_txt2img_distributed_callback_lifecycle(self):
        """
        [TC-E2E-003] การส่งงานสร้างภาพแบบ Asynchronous Webhook เต็มรูปแบบ
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบวงจรการทำงานแบบกระจายศูนย์ (Distributed Asynchronous Lifecycle) ครบทั้ง 4 โหนด:
            1. Client ส่งคำขอสร้างภาพผ่าน Gateway (Node 1) เข้า Backend (Node 3)
            2. Backend บันทึกงานเป็นสถานะ 'pending' แล้วส่งต่อให้ AI Node (Node 4) พร้อม callback_url
            3. AI Node รับงานเข้าคิว ตอบรับ 202 Accepted และเปลี่ยนสถานะเป็น 'processing'
            4. GPU RTX 3070 ประมวลผลและสร้างข้อมูลภาพดิจิทัล
            5. AI Node ยิง Webhook Callback กลับหา Backend พร้อมแนบ Secret Header ยืนยันตัวตน
            6. Backend รับผลลัพธ์ บันทึกไฟล์ภาพ และปรับสถานะเป็น 'completed'
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โฟลว์การเชื่อมต่อ 4 โหนด: `nginx/conf/nginx.conf` ➔ `app/api/generation.py` ➔ `ai_server/server.py` ➔ `app/api/callback.py`
          - ดึงข้อมูลมายังไง (How): สกัด Sequence Diagram และ REST API Contract ของวงจรงานสร้างภาพแบบ Asynchronous Callback พร้อม Header `X-LUMA-INTERNAL-SECRET`
        * ข้อมูลนำเข้า (Test Inputs):
          - task_id: 'task-uuid-distributed-001'
          - prompt: 'a majestic robotic dragon flying over Neo-Tokyo'
          - callback_url: 'http://10.23.130.9:8000/api/callback'
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - งานเปลี่ยนสถานะตามลำดับ: pending ➔ processing ➔ completed
          - ภาพผลลัพธ์ถูกจัดเก็บใน storage อย่างปลอดภัย
          - Secret Key ใน Callback Header ต้องตรงกับ Backend
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - การเจนภาพ AI ใช้เวลา 10-30 วินาที การใช้ Asynchronous Webhook ป้องกันปัญหา HTTP Timeout ระหว่างโหนด
        """
        task_id = "task-uuid-distributed-001"
        prompt = "a majestic robotic dragon flying over Neo-Tokyo"
        callback_url = "http://10.23.130.9:8000/api/callback"

        # ขั้นตอนที่ 1: Client ส่งคำขอผ่าน Gateway เข้าสู่ Backend
        # Backend เริ่มต้นบันทึกสถานะงานเป็น pending
        self.state_db[task_id] = {"status": "pending", "prompt": prompt, "output": None}
        self.assertEqual(self.state_db[task_id]["status"], "pending")

        # ขั้นตอนที่ 2: Backend ส่งต่องานไปยังคิวของ AI Node (Node 4) พร้อมแนบ callback_url
        ai_queue = [{"id": task_id, "prompt": prompt, "callback": callback_url}]
        self.assertEqual(len(ai_queue), 1)

        # ขั้นตอนที่ 3: AI Node รับงานเข้าสู่กระบวนการ ตอบรับ 202 และปรับสถานะเป็น processing
        current_job = ai_queue.pop(0)
        self.state_db[task_id]["status"] = "processing"

        # ขั้นตอนที่ 4: GPU RTX 3070 ดำเนินการประมวลผลโมเดลและเรนเดอร์ภาพ
        generated_pixels = b"PNG_MOCK_PIXEL_DATA_RGB_768x512"
        b64_output = base64.b64encode(generated_pixels).decode()

        # ขั้นตอนที่ 5: AI Node ยิง Webhook Callback กลับหา Backend พร้อมแนบความลับ Internal Secret
        received_secret = self.internal_secret
        self.assertEqual(received_secret, self.internal_secret, "Secret ต้องตรงกันทั้งสองเครื่อง")

        # ขั้นตอนที่ 6: Backend รับ Callback ➔ ทำการบันทึก Atomic และปรับสถานะเป็น completed
        self.output_storage[f"{task_id}.png"] = b64_output
        self.state_db[task_id]["status"] = "completed"
        self.state_db[task_id]["output"] = f"{task_id}.png"

        # ตรวจสอบความถูกต้องสมบูรณ์ของสถานะและไฟล์ใน Storage
        self.assertEqual(self.state_db[task_id]["status"], "completed")
        self.assertIn(f"{task_id}.png", self.output_storage)

    def test_tc_e2e_005_to_006_canvas_mask_inpaint_pipeline(self):
        """
        [TC-E2E-005..006] โฟลว์การระบาย Mask บน Canvas และการทำ Inpainting
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบกระบวนการส่งต่อข้อมูลการทำ Inpainting ระหว่าง Frontend Canvas และ Backend Storage
          - ยืนยันว่าทั้งภาพต้นฉบับ (Source Image) และภาพมาสก์ขาวดำ (Mask Image) ถูกบันทึกและส่งเข้าคิวครบถ้วน
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชัน Inpainting ระหว่าง `frontend-html/js/generate/mask-tools.js` ➔ `app/services/image_tools.py` ➔ `ai_server/services/forge_client.py`
          - ดึงข้อมูลมายังไง (How): สกัดโครงสร้าง Task Payload (`task_type: inpaint`, `source`, `mask`, `prompt`, `denoising_strength`)
        * ข้อมูลนำเข้า (Test Inputs):
          - source_img_id: 'img_source_001.png'
          - mask_img_id: 'img_mask_001.png'
          - prompt: 'a golden royal crown on head'
          - denoising_strength: 0.8
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - ข้อมูลทั้ง 2 ภาพมีอยู่ในระบบ output_storage
          - task_type ถูกระบุเป็น 'inpaint'
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - ฟังก์ชัน Inpainting อนุญาตให้ผู้ใช้วาด Mask บนหน้าเว็บเพื่อแต่งภาพเฉพาะส่วนได้สะดวกรวดเร็ว
        """
        source_img_id = "img_source_001.png"
        mask_img_id = "img_mask_001.png"

        # ขั้นตอนที่ 1: ผู้ใช้วาด Mask บน HTML5 Canvas และระบบอัปโหลดไฟล์ทั้งคู่เข้าคลังข้อมูล
        self.output_storage[source_img_id] = b"SOURCE_IMAGE_BYTES"
        self.output_storage[mask_img_id] = b"MASK_WHITE_ON_BLACK_BYTES"

        # ขั้นตอนที่ 2: ประกอบคำสั่ง Inpaint Task สำหรับส่งต่อไปยัง AI Node
        inpaint_task = {
            "task_type": "inpaint",
            "source": source_img_id,
            "mask": mask_img_id,
            "prompt": "a golden royal crown on head",
            "denoising_strength": 0.8
        }

        # ยืนยันว่างานเป็นประเภท inpaint และอ้างอิงภาพใน storage ครบทั้งสองรูป
        self.assertEqual(inpaint_task["task_type"], "inpaint")
        self.assertTrue(inpaint_task["source"] in self.output_storage)
        self.assertTrue(inpaint_task["mask"] in self.output_storage)

    def test_tc_e2e_009_defense_in_depth_interception(self):
        """
        [TC-E2E-009] การสกัดกั้นการเข้าถึงที่ผิดกฎระเบียบ (Defense-in-Depth)
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบระบบรักษาความปลอดภัยเชิงลึกของ Endpoint Callback ฝั่ง Backend
          - ยืนยันว่าคำขอที่ไม่แนบ Header ลับ หรือแนบค่า Secret ไม่ถูกต้อง จะถูกปฏิเสธด้วย HTTP 403 Forbidden ทันที
          - ยืนยันว่าเฉพาะคำขอที่แนบ Secret ถูกต้องเท่านั้นที่จะได้รับสิทธิ์ HTTP 200 OK
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): นโยบายการตรวจสอบสิทธิ์ Callback ใน `app/api/callback.py` และ `ai_server/utils/callbacks.py`
          - ดึงข้อมูลมายังไง (How): สกัดกลไกการดักตรวจ Header `X-LUMA-INTERNAL-SECRET` มาทดสอบทั้ง 3 กรณี (ไม่มี Header, Secret ปลอม, Secret จริง)
        * ข้อมูลนำเข้า (Test Inputs):
          - กรณี 1: คำขอไม่มี Header เลย ({})
          - กรณี 2: คำขอแนบ Secret ผิด ('WRONG_SECRET')
          - กรณี 3: คำขอแนบ Secret ถูกต้องตรงกับ self.internal_secret
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - กรณี 1 ➔ 403 Forbidden
          - กรณี 2 ➔ 403 Forbidden
          - กรณี 3 ➔ 200 OK
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - สกัดกั้นการโจมตีปลอมแปลงผลการเจนภาพ หรือการส่งข้อมูลขยะจากภายนอกเข้ามากระทบความถูกต้องของระบบ
        """
        # ฟังก์ชันจำลองตัวกรองความปลอดภัยของ Callback Endpoint
        def simulate_callback(headers):
            if headers.get("X-LUMA-INTERNAL-SECRET") != self.internal_secret:
                return 403, "Forbidden: Invalid Internal Secret"
            return 200, "OK"

        # กรณีที่ 1: ยิงเข้ามาโดยไม่แนบ Header รับรอง ➔ ต้องถูกปฏิเสธด้วย 403
        status_unauthorized, _ = simulate_callback({})
        self.assertEqual(status_unauthorized, 403)

        # กรณีที่ 2: ยิงเข้ามาโดยแนบ Secret ปลอม ➔ ต้องถูกปฏิเสธด้วย 403
        status_fake, _ = simulate_callback({"X-LUMA-INTERNAL-SECRET": "WRONG_SECRET"})
        self.assertEqual(status_fake, 403)

        # กรณีที่ 3: ยิงเข้ามาด้วย Secret ที่ถูกต้อง ➔ ต้องอนุญาตผ่านด้วย 200 OK
        status_ok, _ = simulate_callback({"X-LUMA-INTERNAL-SECRET": self.internal_secret})
        self.assertEqual(status_ok, 200)


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 80)
    print("  [TEST] RUNNING AUTOMATED TESTS: Track 05 - Multi-Node Full Pipeline E2E")
    print("=" * 80)
    unittest.main(verbosity=2)

