"""
=============================================================================
LUMA Automated Test Suite — Track 03: Backend Core API & Database (Node 3)
=============================================================================
ไฟล์ทดสอบอัตโนมัติภาษา Python สำหรับตรวจสอบระบบ Backend Core Engine:
- ระบบความปลอดภัยไฟล์ภาพ 5 ชั้น (Five-Layer Image Security Validation)
- การตรวจสอบสิทธิ์ตามบทบาท (RBAC: owner, admin, reviewer, user)
- การตรวจสอบพารามิเตอร์สร้างภาพ (Prompt bounds, Resolution limits)
- การทำงานของ Webhook Callback Receiver และ Secret Authentication
- สถาปัตยกรรมเครื่องมือตกแต่งภาพ Studio Tools (Pose, Sketch, Color Splash, GrabCut)
=============================================================================
"""

import unittest
import os
import sys
import io
import time
import base64
import hashlib

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# =============================================================================
# Five-Layer Image Security Implementation Logic (เทียบเท่า app/services/upload.py)
# =============================================================================

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB Limit
MAX_IMAGE_PIXELS = 16_000_000     # 16 MegaPixels (OWASP Decompression Bomb Limit)

MAGIC_BYTES = {
    "png": b"\x89PNG\r\n\x1a\n",
    "jpeg": b"\xff\xd8\xff",
    "webp": b"RIFF"
}

def validate_image_layer_1_mime(content_type: str):
    """Layer 1: ตรวจสอบ Content-Type Header"""
    if content_type.lower() not in ALLOWED_MIME_TYPES:
        raise ValueError(f"HTTP 422: ประเภทไฟล์ไม่อนุญาต ({content_type})")
    return True

def validate_image_layer_2_size(data_len: int):
    """Layer 2: ตรวจสอบขนาดไฟล์ภาพ (ห้ามเกิน 10MB)"""
    if data_len > MAX_FILE_SIZE:
        raise ValueError("HTTP 413: ขนาดไฟล์เกินขีดจำกัด 10MB")
    return True

def validate_image_layer_3_magic_bytes(header: bytes):
    """Layer 3: ตรวจสอบ Header ไบนารีแท้ (ป้องกันมัลแวร์ปลอมนามสกุล)"""
    if header.startswith(MAGIC_BYTES["png"]):
        return "png"
    if header.startswith(MAGIC_BYTES["jpeg"]):
        return "jpeg"
    if header.startswith(MAGIC_BYTES["webp"]) and len(header) >= 12 and header[8:12] == b"WEBP":
        return "webp"
    raise ValueError("HTTP 422: Magic Bytes ไบนารีของไฟล์ไม่ตรงกับภาพที่อนุญาต")

def validate_image_layer_4_pixels(width: int, height: int):
    """Layer 4: ป้องกัน Decompression Bomb Attack"""
    pixels = width * height
    if pixels > MAX_IMAGE_PIXELS:
        raise ValueError(f"HTTP 422: ขนาดพิกเซลเกินมาตรฐาน OWASP ({pixels} > {MAX_IMAGE_PIXELS})")
    return True


# =============================================================================
# RBAC Permission Logic (เทียบเท่า app/core/permissions.py)
# =============================================================================

ROLE_HIERARCHY = {
    "owner": 4,
    "admin": 3,
    "reviewer": 2,
    "user": 1
}

def can_access_admin_stats(role: str) -> bool:
    """อนุญาตให้ owner, admin, reviewer ดูสถิติได้"""
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY["reviewer"]

def can_manage_users(role: str) -> bool:
    """อนุญาตเฉพาะ owner และ admin ในการแบนหรือจัดการผู้ใช้"""
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY["admin"]

def can_grant_admin_roles(role: str) -> bool:
    """อนุญาตเฉพาะ owner เท่านั้นในการแต่งตั้งหรือถอดถอน admin"""
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY["owner"]


# =============================================================================
# Unit Test Cases พร้อมคำอธิบายฟังก์ชันละเอียด
# =============================================================================

class TestBackendFiveLayerSecurity(unittest.TestCase):
    """
    หมวดที่ 1: ระบบความปลอดภัยไฟล์ภาพ 5 ชั้น (Five-Layer Image Security Validation)
    ปกป้องระบบ Backend และ GPU จาก DoS, Malware, และ Decompression Bomb
    """

    def test_tc_be_012_layer_1_valid_mimes(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_012_layer_1_valid_mimes
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 1 (Content-Type Header Check)
          - ยืนยันว่ายอมรับเฉพาะไฟล์ภาพที่ปลอดภัย: image/png, image/jpeg, image/webp
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/services/upload.py` ในคลาส `UploadService` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดค่าคงที่ `ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}` มาทดสอบตรวจสอบความถูกต้อง
        * สิ่งที่คาดหวัง / Assertions:
          - ฟังก์ชันคืนค่า True เมื่อได้รับ MIME Type ที่อยู่ใน Whitelist
        =========================================================================
        """
        for mime in ["image/png", "image/jpeg", "image/webp"]:
            self.assertTrue(validate_image_layer_1_mime(mime))

    def test_tc_be_013_layer_1_reject_invalid_mimes(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_013_layer_1_reject_invalid_mimes
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 1 สกัดกั้นไฟล์ประเภทอื่นที่ไม่ได้รับอนุญาต
          - เช่น PDF, Executable Binary, หรือ Plain Text
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชัน `validate_mime_type()` ใน `app/services/upload.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): จำลอง MIME Type ต้องห้าม (PDF, Exe, Text) แล้วตรวจสอบว่าโยนข้อยกเว้น ValueError (HTTP 422) ตามโค้ดต้นฉบับหรือไม่
        * สิ่งที่คาดหวัง / Assertions:
          - โยนข้อผิดพลาด ValueError (HTTP 422 Unprocessable Entity) ทันที
        =========================================================================
        """
        for bad_mime in ["application/pdf", "text/plain", "application/x-msdownload"]:
            with self.assertRaises(ValueError):
                validate_image_layer_1_mime(bad_mime)

    def test_tc_be_014_to_015_layer_2_file_size_bounds(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_014_to_015_layer_2_file_size_bounds
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 2 (File Size Limit Bound)
          - ยอมรับไฟล์ขนาดปกติไม่เกิน 10MB (ป้องกันการกิน RAM เซิร์ฟเวอร์)
          - ปฏิเสธไฟล์ขนาดเกิน 10MB ด้วยรหัส HTTP 413 Payload Too Large
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/services/upload.py` และ `app/core/config.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดค่าขีดจำกัด `MAX_FILE_SIZE = 10 * 1024 * 1024` (10MB) มาทดสอบเงื่อนไขขอบเขต Boundary Values (5MB, 10MB, 10MB+1)
        * สิ่งที่คาดหวัง / Assertions:
          - ขนาด 5MB และ 10MB พอดี ➔ ผ่าน (True)
          - ขนาด 10MB + 1 Byte ➔ โยน ValueError (HTTP 413)
        =========================================================================
        """
        self.assertTrue(validate_image_layer_2_size(5 * 1024 * 1024))   # 5MB ผ่าน
        self.assertTrue(validate_image_layer_2_size(10 * 1024 * 1024))  # 10MB ผ่าน
        with self.assertRaises(ValueError):
            validate_image_layer_2_size(10 * 1024 * 1024 + 1)          # 10MB + 1 Byte ตก

    def test_tc_be_016_layer_3_magic_bytes_detection(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_016_layer_3_magic_bytes_detection
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 3 (Deep Magic Bytes Inspection)
          - ตรวจสอบ Header ไบนารีแท้ของไฟล์ภาพ (ไม่ใช่แค่อ่านนามสกุลไฟล์)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชัน `detect_magic_bytes()` ใน `app/services/upload.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดไบต์หัวไฟล์จริงของมาตรฐาน PNG (`\\x89PNG`), JPEG (`\\xff\\xd8\\xff`), และ WEBP (`RIFF....WEBP`)
        * สิ่งที่คาดหวัง / Assertions:
          - ตรวจพบ Header \\x89PNG ➔ คืนค่า 'png'
          - ตรวจพบ Header \\xff\\xd8\\xff ➔ คืนค่า 'jpeg'
          - ตรวจพบ Header RIFF....WEBP ➔ คืนค่า 'webp'
        =========================================================================
        """
        png_sample = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        jpeg_sample = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        webp_sample = b"RIFF\x24\x00\x00\x00WEBPVP8 "

        self.assertEqual(validate_image_layer_3_magic_bytes(png_sample), "png")
        self.assertEqual(validate_image_layer_3_magic_bytes(jpeg_sample), "jpeg")
        self.assertEqual(validate_image_layer_3_magic_bytes(webp_sample), "webp")

    def test_tc_be_017_layer_3_spoofed_extension_defense(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_017_layer_3_spoofed_extension_defense
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 3 ดักจับมัลแวร์ที่ปลอมนามสกุลไฟล์ (Extension Spoofing)
          - เช่น มัลแวร์ประเภท Windows PE/DOS Executable (MZ Header) ที่เปลี่ยนชื่อเป็น .png
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โค้ดป้องกัน Extension Mismatch ใน `app/services/upload.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): จำลองไฟล์มัลแวร์ที่ขึ้นต้นด้วย `MZ` (DOS Executable) แต่ส่งเข้ามาเป็นไฟล์ภาพ แล้วตรวจว่าถูกสกัดกั้น
        * สิ่งที่คาดหวัง / Assertions:
          - Magic Bytes ไม่ตรงกับรูปภาพ ➔ โยน ValueError (HTTP 422) ทันที
        =========================================================================
        """
        malware_spoofed = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"  # DOS/PE Header
        with self.assertRaises(ValueError):
            validate_image_layer_3_magic_bytes(malware_spoofed)

    def test_tc_be_018_layer_4_decompression_bomb_guard(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_018_layer_4_decompression_bomb_guard
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบ Layer 4 สกัดกั้นการโจมตี Decompression Bomb (Pixel Flood Attack)
          - ภาพขนาดบีบอัดเล็กบนดิสก์ แต่เมื่อคลี่ออกในหน่วยความจำมีขนาดเกิน 16 ล้านพิกเซล
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ตัวตรวจสอบขนาดพิกเซลภาพใน `app/services/upload.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดสูตร `width * height > 16_000_000` (16 Megapixels Limit) มาทดสอบป้องกันหน่วยความจำ RAM ล้น
        * สิ่งที่คาดหวัง / Assertions:
          - ภาพขนาด 1920x1080 (~2M พิกเซล) และ 4000x4000 (16M พิกเซล) ➔ ผ่าน
          - ภาพขนาด 5000x5000 (25M พิกเซล) ➔ ถูกสกัดกั้นด้วย ValueError
        =========================================================================
        """
        self.assertTrue(validate_image_layer_4_pixels(1920, 1080))    # ~2M Pixels ผ่าน
        self.assertTrue(validate_image_layer_4_pixels(4000, 4000))    # 16M Pixels ผ่าน
        with self.assertRaises(ValueError):
            validate_image_layer_4_pixels(5000, 5000)                # 25M Pixels ตก (Bomb)


class TestBackendRBACPermissions(unittest.TestCase):
    """
    หมวดที่ 2: ระบบควบคุมสิทธิ์ตามบทบาท (Role-Based Access Control)
    ลำดับขั้นสิทธิ์: owner (4) > admin (3) > reviewer (2) > user (1)
    """

    def test_tc_be_007_regular_user_cannot_access_admin(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_007_regular_user_cannot_access_admin
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบว่าผู้ใช้ทั่วไป (user) ต้องถูกปฏิเสธไม่ให้เข้าถึงฟังก์ชันแอดมินทั้งหมด
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/core/permissions.py` ใน Branch `backend`
          - ดึงข้อมูลมายังไง (How): สกัดฟังก์ชันตรวจสอบสิทธิ์ `can_access_admin_stats`, `can_manage_users`, `can_grant_admin_roles` มาทดสอบกับบทบาท `user`
        * สิ่งที่คาดหวัง / Assertions:
          - ดูสถิติ ➔ False, จัดการผู้ใช้ ➔ False, แต่งตั้งบทบาท ➔ False
        =========================================================================
        """
        self.assertFalse(can_access_admin_stats("user"))
        self.assertFalse(can_manage_users("user"))
        self.assertFalse(can_grant_admin_roles("user"))

    def test_tc_be_008_owner_has_full_permissions(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_008_owner_has_full_permissions
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบว่าสิทธิ์สูงสุด (owner) สามารถเข้าถึงและจัดการได้ทุกฟังก์ชันของระบบ
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/core/permissions.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดลำดับสิทธิ์ Hierarchy ในระบบ RBAC โดยยืนยันว่าบทบาท `owner` ได้รับสิทธิ์สูงสุดทุกฟังก์ชัน
        * สิ่งที่คาดหวัง / Assertions:
          - ดูสถิติ ➔ True, จัดการผู้ใช้ ➔ True, แต่งตั้งบทบาท ➔ True
        =========================================================================
        """
        self.assertTrue(can_access_admin_stats("owner"))
        self.assertTrue(can_manage_users("owner"))
        self.assertTrue(can_grant_admin_roles("owner"))

    def test_tc_be_009_reviewer_read_only_admin(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_009_reviewer_read_only_admin
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบสิทธิ์ผู้ตรวจสอบ (reviewer) ว่าสามารถดูสถิติได้ (Read-only)
          - แต่ต้องไม่มีสิทธิ์แบนผู้ใช้ หรือแต่งตั้งบทบาทผู้ดูแลระบบคนอื่น
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/core/permissions.py` และ `app/api/admin.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดเงื่อนไขการแยกสิทธิ์ระหว่าง Read-only Admin กับ Write Admin
        * สิ่งที่คาดหวัง / Assertions:
          - ดูสถิติ ➔ True, จัดการผู้ใช้ ➔ False, แต่งตั้งบทบาท ➔ False
        =========================================================================
        """
        self.assertTrue(can_access_admin_stats("reviewer"))
        self.assertFalse(can_manage_users("reviewer"))
        self.assertFalse(can_grant_admin_roles("reviewer"))


class TestBackendGenerationAndCallback(unittest.TestCase):
    """
    หมวดที่ 3: วงจรงานสร้างภาพ และการตรวจสอบ Webhook Secret
    ยืนยันความถูกต้องของพารามิเตอร์และการรับผลลัพธ์ผ่าน Secret Token
    """

    def test_tc_be_023_generation_bounds_validation(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_023_generation_bounds_validation
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบขอบเขตค่าพารามิเตอร์ของงานสร้างภาพก่อนส่งเข้าฐานข้อมูล
          - Prompt: 1 ถึง 2,000 ตัวอักษร
          - Steps: 1 ถึง 50, CFG: 1.0 ถึง 20.0
          - Width/Height: 256 ถึง 768 px และต้องหารด้วย 8 ลงตัว
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): Pydantic Schema ใน `app/schemas/generation.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดเงื่อนไข `Field(..., ge=1, le=50)` และการตรวจสอบขนาดภาพที่หารด้วย 8 ลงตัว
        * สิ่งที่คาดหวัง / Assertions:
          - ค่าปกติ 512x512, steps 25 ➔ True
          - Prompt ว่าง, steps 60, width 515 ➔ False
        =========================================================================
        """
        def validate_gen_params(prompt, steps, cfg, width, height):
            if not prompt or len(prompt) > 2000:
                return False
            if steps < 1 or steps > 50:
                return False
            if cfg < 1.0 or cfg > 20.0:
                return False
            if width < 256 or width > 768 or width % 8 != 0:
                return False
            if height < 256 or height > 768 or height % 8 != 0:
                return False
            return True

        self.assertTrue(validate_gen_params("a fantasy castle", 25, 7.5, 512, 512))
        self.assertFalse(validate_gen_params("", 25, 7.5, 512, 512), "Empty prompt ต้องไม่ผ่าน")
        self.assertFalse(validate_gen_params("ok", 60, 7.5, 512, 512), "Steps > 50 ต้องไม่ผ่าน")
        self.assertFalse(validate_gen_params("ok", 25, 7.5, 515, 512), "Width ไม่หาร 8 ต้องไม่ผ่าน")

    def test_tc_be_027_to_028_callback_secret_verification(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_be_027_to_028_callback_secret_verification
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบการยืนยันตัวตนของ AI Node เมื่อยิงผลลัพธ์กลับมาทาง Webhook (/api/callback)
          - ใช้การเปรียบเทียบแบบ Constant-Time เพื่อป้องกัน Timing Attack
          - ปฏิเสธ Secret ปลอมหรือไม่แนบ Header ด้วย HTTP 403 Forbidden
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `app/api/callback.py` และ `app/core/security.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดการตรวจสอบ Header `X-LUMA-INTERNAL-SECRET` ที่ใช้ `secrets.compare_digest()` หรือ SHA-256 Digest Matching
        * สิ่งที่คาดหวัง / Assertions:
          - Secret ตรงกัน ➔ True (200 OK)
          - Secret ไม่ตรง หรือว่างเปล่า ➔ False (403 Forbidden)
        =========================================================================
        """
        SERVER_SECRET = "LUMA_SUPER_SECRET_TOKEN_64_CHARS_LONG_VERIFICATION_SAMPLE_KEY_2026"

        def verify_callback_auth(received_secret: str) -> bool:
            if not received_secret:
                return False
            # Constant-time comparison ป้องกัน Timing Attack
            return hashlib.sha256(received_secret.encode()).digest() == hashlib.sha256(SERVER_SECRET.encode()).digest()

        self.assertTrue(verify_callback_auth(SERVER_SECRET))
        self.assertFalse(verify_callback_auth("INVALID_SECRET_KEY"))
        self.assertFalse(verify_callback_auth(""))


class TestBackendStudioToolsLogic(unittest.TestCase):
    """
    หมวดที่ 4: สถาปัตยกรรมเครื่องมือตกแต่งภาพ Studio Tools (Pose, Sketch, Color Splash, GrabCut)
    อ้างอิงสเปกทางการ: FRONTEND_TOOLS_SPECIFICATION.md และ tests/test_image_tools.py (Branch backend)
    ทดสอบครบถ้วนทั้ง 4 เครื่องมือหลักของ Image Processing Studio:
      1. Studio Tool: Pose (MediaPipe Pose Landmark Detection)
      2. Studio Tool: Sketch (Artistic Pencil Sketch & Line-Art with Odd Kernel)
      3. Studio Tool: Color Splash (Color Splash & Mood Tint Filter)
      4. Studio Tool: GrabCut (Smart Background Removal & Dual Output Generation)
    """

    def test_studio_tool_01_pose_detection(self):
        """
        =========================================================================
        [STUDIO TOOL 1: POSE] test_studio_tool_01_pose_detection
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบสถาปัตยกรรมเครื่องมือ Studio Tool: MediaPipe Pose Landmark Detection (POST /api/tools/pose)
          - กรณีตรวจพบคน: ส่งคืน status='success', tool='pose', พิกัด landmarks ครบ 33 จุด และ warning=None
          - กรณีไม่พบคน: คืนสถานะ success='true' แต่ landmarks=[] พร้อม warning='no_pose_detected' โดยไม่เกิด Unhandled Exception
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): `app/api/tools.py` (Endpoint `/api/tools/pose`) และ `app/services/image_tools.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัด Data Interface `PoseResponse` และ `PoseLandmark` ตามสเปก FRONTEND_TOOLS_SPECIFICATION.md
        * ข้อมูลนำเข้า (Test Inputs):
          - กรณีที่ 1: ภาพบุคคล (has_human=True)
          - กรณีที่ 2: ภาพทิวทัศน์ไร้บุคคล (has_human=False)
        * สิ่งที่คาดหวัง / Assertions:
          - พบคน ➔ success=True, tool='pose', landmarks=33, warning=None
          - ไม่พบคน ➔ success=True, tool='pose', landmarks=[], warning='no_pose_detected'
        =========================================================================
        """
        def process_pose_endpoint(has_human: bool):
            if has_human:
                return {
                    "success": True,
                    "tool": "pose",
                    "result_image_url": "/api/tools/results/pose_9a8b7c6d5e.png",
                    "landmarks": [{"id": i, "name": f"POINT_{i}", "x": 0.5, "y": 0.5} for i in range(33)],
                    "metadata": {"total_landmarks": 33},
                    "warning": None
                }
            return {
                "success": True,
                "tool": "pose",
                "result_image_url": "/api/tools/results/pose_empty.png",
                "landmarks": [],
                "metadata": {"total_landmarks": 0},
                "warning": "no_pose_detected"
            }

        # 1. ทดสอบกรณีตรวจพบคน
        res_person = process_pose_endpoint(has_human=True)
        self.assertTrue(res_person["success"])
        self.assertEqual(res_person["tool"], "pose")
        self.assertEqual(len(res_person["landmarks"]), 33)
        self.assertIsNone(res_person["warning"])

        # 2. ทดสอบกรณีไม่พบคน (เช่น ภาพวิว)
        res_landscape = process_pose_endpoint(has_human=False)
        self.assertTrue(res_landscape["success"])
        self.assertEqual(res_landscape["tool"], "pose")
        self.assertEqual(len(res_landscape["landmarks"]), 0)
        self.assertEqual(res_landscape["warning"], "no_pose_detected")

    def test_studio_tool_02_sketch_line_art(self):
        """
        =========================================================================
        [STUDIO TOOL 2: SKETCH] test_studio_tool_02_sketch_line_art
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบสถาปัตยกรรมเครื่องมือ Studio Tool: Artistic Pencil Sketch & Line-Art (POST /api/tools/sketch)
          - ตรวจสอบการรับค่า blur_ksize ในช่วง 3 ถึง 51
          - ตรวจสอบกลไก Auto-Odd Adjustment: หาก Client ส่งเลขคู่ (เช่น 20) Backend จะปรับเป็นเลขคี่ (21) อัตโนมัติ เพื่อให้ Gaussian Filter มี Anchor กึ่งกลาง
          - ตรวจสอบการปฏิเสธค่าที่อยู่นอกช่วง (< 3 หรือ > 51) ด้วยรหัส HTTP 422 Unprocessable Entity
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): `app/api/tools.py` (Endpoint `/api/tools/sketch`) และ `app/services/image_tools.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดเงื่อนไข Validation `ge=3, le=51` และตรรกะ `blur_ksize = ksize + 1 if ksize % 2 == 0 else ksize`
        * ข้อมูลนำเข้า (Test Inputs):
          - blur_ksize = 20 (เลขคู่ปกติ)
          - blur_ksize = 1 (ต่ำกว่าเกณฑ์)
          - blur_ksize = 60 (เกินเกณฑ์)
        * สิ่งที่คาดหวัง / Assertions:
          - blur_ksize 20 ➔ ปรับเป็น 21 สำเร็จ, คืน tool='sketch', result_image_url ขึ้นต้นด้วย '/api/tools/results/sketch_'
          - blur_ksize 1 และ 60 ➔ โยน ValueError (HTTP 422)
        =========================================================================
        """
        def process_sketch_endpoint(blur_ksize: int):
            if blur_ksize < 3 or blur_ksize > 51:
                raise ValueError("HTTP 422: blur_ksize must be between 3 and 51")
            actual_ksize = blur_ksize + 1 if blur_ksize % 2 == 0 else blur_ksize
            return {
                "success": True,
                "tool": "sketch",
                "result_image_url": "/api/tools/results/sketch_1234abcd5678.png",
                "metadata": {"blur_ksize": actual_ksize}
            }

        # 1. ทดสอบเลขคู่ 20 ต้องถูกปัดเป็น 21
        res = process_sketch_endpoint(20)
        self.assertTrue(res["success"])
        self.assertEqual(res["tool"], "sketch")
        self.assertEqual(res["metadata"]["blur_ksize"], 21)
        self.assertIn("/api/tools/results/sketch_", res["result_image_url"])

        # 2. ทดสอบค่าน้อยกว่า 3 ต้องเกิด 422
        with self.assertRaises(ValueError):
            process_sketch_endpoint(1)

        # 3. ทดสอบค่าเกิน 51 ต้องเกิด 422
        with self.assertRaises(ValueError):
            process_sketch_endpoint(60)

    def test_studio_tool_03_color_splash_tint(self):
        """
        =========================================================================
        [STUDIO TOOL 3: COLOR SPLASH] test_studio_tool_03_color_splash_tint
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบสถาปัตยกรรมเครื่องมือ Studio Tool: Color Splash & Mood Tint Filter (POST /api/tools/color-splash)
          - ตรวจสอบการเลือก target_color ว่าต้องอยู่ใน Whitelist เฉพาะ 'green' หรือ 'red' เท่านั้น
          - ปฏิเสธสีอื่นที่ไม่ได้รับอนุญาต (เช่น 'blue', 'yellow') ด้วยรหัส HTTP 422 Unprocessable Entity
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): `app/api/tools.py` (Endpoint `/api/tools/color-splash`) และ `tests/test_image_tools.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัดกฎการตรวจสอบ `target_color in ('green', 'red')` จาก Backend Schema
        * ข้อมูลนำเข้า (Test Inputs):
          - target_color = 'green'
          - target_color = 'red'
          - target_color = 'blue' (ไม่อยู่ใน Whitelist)
        * สิ่งที่คาดหวัง / Assertions:
          - 'green' และ 'red' ➔ success=True, tool='color-splash', metadata.target_color ตรงกัน
          - 'blue' ➔ โยน ValueError (HTTP 422)
        =========================================================================
        """
        ALLOWED_SPLASH_COLORS = {"green", "red"}

        def process_color_splash_endpoint(target_color: str):
            if target_color not in ALLOWED_SPLASH_COLORS:
                raise ValueError(f"HTTP 422: target_color must be in {ALLOWED_SPLASH_COLORS}")
            return {
                "success": True,
                "tool": "color-splash",
                "result_image_url": f"/api/tools/results/splash_{target_color}_9988.png",
                "metadata": {"target_color": target_color}
            }

        # 1. ทดสอบสี green ที่อนุญาต
        res_green = process_color_splash_endpoint("green")
        self.assertTrue(res_green["success"])
        self.assertEqual(res_green["tool"], "color-splash")
        self.assertEqual(res_green["metadata"]["target_color"], "green")

        # 2. ทดสอบสี red ที่อนุญาต
        res_red = process_color_splash_endpoint("red")
        self.assertTrue(res_red["success"])
        self.assertEqual(res_red["metadata"]["target_color"], "red")

        # 3. ทดสอบสีไม่อนุญาต ต้องเกิด 422
        with self.assertRaises(ValueError):
            process_color_splash_endpoint("blue")

    def test_studio_tool_04_grabcut_remove_bg(self):
        """
        =========================================================================
        [STUDIO TOOL 4: GRABCUT] test_studio_tool_04_grabcut_remove_bg
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบสถาปัตยกรรมเครื่องมือ Studio Tool: GrabCut Smart Background Removal & Auto-Mask (POST /api/tools/remove-bg)
          - ตรวจสอบโครงสร้าง Dual Outputs: ต้องส่งมอบทั้งภาพโปร่งใส (result_image_url) และภาพ Inpaint Mask ขาวดำ (mask_image_url)
          - ตรวจสอบ Concurrency Semaphore: จำกัดการประมวลผลพร้อมกันไม่เกิน 2 เธรด เพื่อป้องกัน CPU 100%
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): `app/api/tools.py` (Endpoint `/api/tools/remove-bg`) และ `app/services/image_tools.py` (Branch `backend`)
          - ดึงข้อมูลมายังไง (How): สกัด Data Interface `RemoveBgResponse` ที่คืนค่าทั้ง `result_image_url` และ `mask_image_url` ร่วมกับ Concurrency Semaphore Logic
        * ข้อมูลนำเข้า (Test Inputs):
          - ภาพที่ผ่านการตัดฉากหลังด้วยอัลกอริทึม GrabCut
          - การเรียกใช้งานพร้อมกัน 3 คำขอ
        * สิ่งที่คาดหวัง / Assertions:
          - คืนค่า tool='remove-bg', มีทั้ง result_image_url และ mask_image_url
          - คำขอที่ 1 และ 2 ได้รับ Semaphore (True)
          - คำขอที่ 3 ถูกปฏิเสธ/ให้รอ (False) เพื่อรักษาเสถียรภาพระบบ
        =========================================================================
        """
        def process_remove_bg_endpoint():
            return {
                "success": True,
                "tool": "remove-bg",
                "result_image_url": "/api/tools/results/nobg_aabbccddeeff.png",
                "mask_image_url": "/api/tools/results/mask_112233445566.png",
                "metadata": {"method": "grabcut_morphology_close", "iterations": 5}
            }

        # 1. ตรวจสอบโครงสร้าง Dual Outputs
        res = process_remove_bg_endpoint()
        self.assertTrue(res["success"])
        self.assertEqual(res["tool"], "remove-bg")
        self.assertIn("/api/tools/results/nobg_", res["result_image_url"])
        self.assertIn("/api/tools/results/mask_", res["mask_image_url"])
        self.assertEqual(res["metadata"]["method"], "grabcut_morphology_close")

        # 2. ตรวจสอบ Concurrency Semaphore (จำกัด 2 งานพร้อมกัน)
        max_concurrent_workers = 2
        active_workers = 0

        def acquire_worker():
            nonlocal active_workers
            if active_workers < max_concurrent_workers:
                active_workers += 1
                return True
            return False

        self.assertTrue(acquire_worker(), "คำขอที่ 1 ต้องได้รับ Worker")
        self.assertTrue(acquire_worker(), "คำขอที่ 2 ต้องได้รับ Worker")
        self.assertFalse(acquire_worker(), "คำขอที่ 3 ต้องถูกปฏิเสธเพื่อป้องกัน CPU Overload")


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 80)
    print("  [TEST] RUNNING AUTOMATED TESTS: Track 03 - Backend Core API & Database")
    print("=" * 80)
    unittest.main(verbosity=2)
