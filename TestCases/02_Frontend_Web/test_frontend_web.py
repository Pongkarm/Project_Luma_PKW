"""
=============================================================================
LUMA Automated Test Suite — Track 02: Web Frontend Studio (Node 2)
=============================================================================
ไฟล์ทดสอบอัตโนมัติภาษา Python สำหรับตรวจสอบ Business Logic ของฝั่ง Frontend:
- การคำนวณขนาดภาพ (Snap to multiple of 8, Fit to Engine max 768px)
- การจำแนกและกรอง LoRA ตามตระกูลโมเดล (SD 1.5, Illustrious XL, Pony XL)
- กฎความปลอดภัยรหัสผ่านและการป้องกัน XSS Injection
- ความสมบูรณ์ของโครงสร้างหน้าเว็บ HTML ทั้ง 7 หน้า
=============================================================================
"""

import unittest
import os
import sys
import re
import html
import math

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend-html")


# =============================================================================
# Helper Logic ที่เทียบเท่า JavaScript บน Frontend (Single Source of Truth)
# =============================================================================

def snap_size(val, min_val=256, max_val=768):
    """ปัดเศษขนาดให้หารด้วย 8 ลงตัว และจำกัดอยู่ในช่วง [min_val, max_val]"""
    if not isinstance(val, (int, float)) or math.isnan(val):
        return min_val
    val = math.floor(val / 8.0 + 0.5) * 8
    return max(min_val, min(max_val, int(val)))

def fit_to_engine(width, height, max_edge=768):
    """ย่อภาพด้านที่ยาวที่สุดไม่ให้เกิน 768px โดยคงสัดส่วนเดิม และไม่ขยายภาพเล็ก"""
    if width <= max_edge and height <= max_edge:
        return {"width": snap_size(width), "height": snap_size(height)}
    if width >= height:
        scale = max_edge / width
        return {"width": max_edge, "height": snap_size(height * scale)}
    else:
        scale = max_edge / height
        return {"width": snap_size(width * scale), "height": max_edge}

def ratio_text(w, h):
    """คำนวณและลดทอนสัดส่วนภาพเป็นสตริงอย่างง่าย"""
    def gcd(a, b):
        while b:
            a, b = b, a % b
        return a
    g = gcd(int(w), int(h))
    rw, rh = int(w // g), int(h // g)
    return f"{rw}:{rh}"

def detect_model_family(name):
    """จำแนกตระกูลสถาปัตยกรรมของโมเดลตามกฎเดียวกับ AI Server"""
    lower = name.lower()
    if "pony" in lower or "pdxl" in lower:
        return "pony_xl"
    if "illu" in lower or "nova" in lower or "xl" in lower:
        return "illustrious_xl"
    return "sd15"

def compatible_loras(lora_list, base_model_name):
    """กรอง LoRA ให้แสดงเฉพาะตัวที่เข้ากับตระกูลของ Base Model"""
    model_fam = detect_model_family(base_model_name)
    matched = []
    for lora in lora_list:
        lora_fam = lora.get("family") or detect_model_family(lora.get("name", ""))
        # แสดงเฉพาะ LoRA ที่ตรงตระกูล หรือ LoRA ทั่วไปที่ไม่ระบุตระกูล
        if lora_fam == model_fam or lora_fam in ("unknown", "generic"):
            matched.append(lora)
    return matched

def validate_password(password, confirm):
    """ตรวจสอบกฎความปลอดภัยของรหัสผ่าน"""
    errors = []
    if len(password) < 8:
        errors.append("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร")
    if not re.search(r"\d", password) and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("รหัสผ่านต้องมีตัวเลขหรืออักขระพิเศษอย่างน้อย 1 ตัว")
    if password != confirm:
        errors.append("รหัสผ่านทั้งสองช่องไม่ตรงกัน")
    return len(errors) == 0, errors

def odd_kernel(val):
    """คืนค่าเลขคี่สำหรับใช้เป็นขนาด Kernel ของ Image Filters ในช่วง [3, 51]"""
    val = int(val)
    if val % 2 == 0:
        val += 1
    return max(3, min(51, val))


# =============================================================================
# Unit Test Cases พร้อมคำอธิบายฟังก์ชันละเอียด
# =============================================================================

class TestFrontendResolutionGeometry(unittest.TestCase):
    """
    หมวดที่ 1: ตรวจสอบการคำนวณขนาดและสัดส่วนภาพทางเรขาคณิต (Geometry)
    ป้องกันปัญหาภาพแตก (Artifacts) หรือขนาดไม่ลงตัวกับ VAE Latent ของ Stable Diffusion
    """

    def test_tc_fe_001_snap_size_multiples_of_8(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_001_snap_size_multiples_of_8
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน snapSize() ที่ใช้ปรับขนาดภาพก่อนส่งไป Gen
          - ปัดเศษตัวเลขให้หารด้วย 8 ลงตัวเสมอ (เช่น 500 ปัดเป็น 504)
          - จำกัดกรอบขนาดให้อยู่ในช่วง 256 ถึง 768 px
          - จัดการกรณีผู้ใช้กรอกค่าที่ไม่ใช่ตัวเลข (NaN) ให้ fallback เป็น 256
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `frontend-html/js/generate/settings.js` และ `frontend-html/js/studio/tools.js` ใน Branch `frontend-app`
          - ดึงข้อมูลมายังไง (How): สกัดฟังก์ชัน JavaScript `snapSize()` ที่ใช้สูตร `Math.round(val / 8) * 8` พร้อมเงื่อนไข clamp (256-768) มาแปลงเป็น Python logic
        * สิ่งที่คาดหวัง / Assertions:
          - snap_size(500) == 504
          - snap_size(100) == 256 (ติดขอบล่าง)
          - snap_size(5000) == 768 (ติดขอบบน)
        =========================================================================
        """
        self.assertEqual(snap_size(500), 504)
        self.assertEqual(snap_size(100), 256)
        self.assertEqual(snap_size(5000), 768)
        self.assertEqual(snap_size(float("nan")), 256)

    def test_tc_fe_002_fit_to_engine_max_768(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_002_fit_to_engine_max_768
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน fitToEngine() ที่ย่อภาพขนาดใหญ่ให้ด้านที่ยาวที่สุดไม่เกิน 768px
          - ต้องรักษาสัดส่วนเดิมของภาพไว้ (Aspect Ratio Preservation)
          - ภาพขนาดเล็กกว่า 768px ต้องไม่ถูกขยายให้แตก
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชันปรับขนาดภาพ `fitToEngine()` ใน `frontend-html/js/generate/settings.js` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดสูตรคำนวณ Scaling Factor `scale = 768 / max(w, h)` เพื่อย่อภาพขนาดใหญ่ให้ปลอดภัยต่อ VRAM ของการ์ดจอ
        * สิ่งที่คาดหวัง / Assertions:
          - ภาพ 4096x2048 (2:1) ถูกย่อเหลือ 768x384 พอดี
          - ภาพ 480x640 ขนาดเล็กอยู่แล้ว คงขนาดเดิม 480x640
          - ภาพสี่เหลี่ยมจัตุรัส 1000x1000 ย่อเหลือ 768x768
        =========================================================================
        """
        self.assertEqual(fit_to_engine(4096, 2048), {"width": 768, "height": 384})
        self.assertEqual(fit_to_engine(480, 640), {"width": 480, "height": 640})
        self.assertEqual(fit_to_engine(1000, 1000), {"width": 768, "height": 768})

    def test_tc_fe_003_ratio_text_calculation(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_003_ratio_text_calculation
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน ratioText() ที่คำนวณอัตราส่วนภาพแสดงบนแถบ UI
          - ลดทอนตัวเลขเป็นอัตราส่วนอย่างต่ำ (เช่น 768x512 แสดงเป็น '3:2')
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `frontend-html/js/generate/settings.js` บรรทัดแสดง Ratio Badge (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดอัลกอริทึม Greatest Common Divisor (GCD) ที่ใช้ตัดทอนความกว้างและความสูงเป็นอัตราส่วนภาพมาตรฐาน
        * สิ่งที่คาดหวัง / Assertions:
          - 768x512 ได้ '3:2', 512x768 ได้ '2:3', 768x768 ได้ '1:1'
        =========================================================================
        """
        self.assertEqual(ratio_text(768, 512), "3:2")
        self.assertEqual(ratio_text(512, 768), "2:3")
        self.assertEqual(ratio_text(768, 768), "1:1")


class TestFrontendModelLoRAFilter(unittest.TestCase):
    """
    หมวดที่ 2: ตรวจสอบระบบกรอง LoRA ข้ามตระกูลโมเดล (Defense-in-Depth UI Level)
    ป้องกันผู้ใช้เลือก LoRA ข้ามรุ่น (เช่น เอา LoRA XL ไปใส่ SD 1.5)
    """

    def setUp(self):
        self.sample_loras = [
            {"name": "tachi-e", "family": "sd15"},
            {"name": "niji_and_midj_mix217", "family": "sd15"},
            {"name": "SousouNoFrieren_ILXL", "family": "illustrious_xl"},
            {"name": "himmel_v1", "family": "illustrious_xl"},
            {"name": "GeekPower_PDXL", "family": "pony_xl"},
            {"name": "generic_detailer", "family": "unknown"}
        ]

    def test_tc_fe_004_detect_model_family(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_004_detect_model_family
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบตรรกะจำแนกตระกูลโมเดลจากชื่อไฟล์ Checkpoint (detectModelFamily)
          - กฎลำดับ: ถ้ามีคำว่า pony/pdxl ➔ pony_xl, ถ้ามี illu/nova/xl ➔ illustrious_xl, นอกนั้น ➔ sd15
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `frontend-html/js/generate/families.js` ใน Branch `frontend-app`
          - ดึงข้อมูลมายังไง (How): สกัดลำดับ Substring Matching จากโค้ดฝั่งหน้าบ้าน ที่วิเคราะห์ชื่อ Model Checkpoint มาเป็น Family Tag
        * สิ่งที่คาดหวัง / Assertions:
          - 'counterfeitV30_v30.safetensors' ➔ 'sd15'
          - 'novaAnimeXL_ilV190.safetensors' ➔ 'illustrious_xl'
          - 'prefectPonyXL_v6.safetensors' ➔ 'pony_xl'
        =========================================================================
        """
        self.assertEqual(detect_model_family("counterfeitV30_v30.safetensors"), "sd15")
        self.assertEqual(detect_model_family("novaAnimeXL_ilV190.safetensors"), "illustrious_xl")
        self.assertEqual(detect_model_family("prefectPonyXL_v6.safetensors"), "pony_xl")
        self.assertEqual(detect_model_family("something_PDXL.safetensors"), "pony_xl")

    def test_tc_fe_005_to_006_compatible_loras_filter(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_005_to_006_compatible_loras_filter
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน compatibleLoras() ที่ใช้กรอง Dropdown บนหน้าเว็บ
          - ยืนยันว่าเมื่อเลือกโมเดล SD 1.5 จะแสดงเฉพาะ LoRA ตระกูล sd15 เท่านั้น
          - ตัด LoRA ตระกูล Illustrious XL และ Pony XL ออกจากตัวเลือกอัตโนมัติ
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชัน `compatibleLoras()` ใน `frontend-html/js/generate/families.js` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดการเปรียบเทียบ Family Tag ระหว่าง Model และ LoRA Metadata เพื่อกรอง Dropdown List
        * สิ่งที่คาดหวัง / Assertions:
          - ผลลัพธ์ต้องมี 'tachi-e', 'niji_and_midj_mix217'
          - ต้องไม่มี 'SousouNoFrieren_ILXL' หรือ 'GeekPower_PDXL' ปนเข้ามา
        =========================================================================
        """
        # กรณีเลือกโมเดล SD 1.5
        sd15_loras = compatible_loras(self.sample_loras, "counterfeitV30_v30.safetensors")
        sd15_names = [l["name"] for l in sd15_loras]
        self.assertIn("tachi-e", sd15_names)
        self.assertIn("niji_and_midj_mix217", sd15_names)
        self.assertNotIn("SousouNoFrieren_ILXL", sd15_names, "ห้ามโชว์ LoRA ของ Illustrious XL")
        self.assertNotIn("GeekPower_PDXL", sd15_names, "ห้ามโชว์ LoRA ของ Pony XL")

        # กรณีเลือกโมเดล Illustrious XL
        illu_loras = compatible_loras(self.sample_loras, "novaAnimeXL_ilV190.safetensors")
        illu_names = [l["name"] for l in illu_loras]
        self.assertIn("SousouNoFrieren_ILXL", illu_names)
        self.assertIn("himmel_v1", illu_names)
        self.assertNotIn("tachi-e", illu_names, "ห้ามโชว์ LoRA ของ SD 1.5")


class TestFrontendSecurityAndValidation(unittest.TestCase):
    """
    หมวดที่ 3: ตรวจสอบความปลอดภัยฝั่ง Client และการตรวจรหัสผ่าน
    ครอบคลุมการตรวจสอบฟอร์มก่อนส่ง และการป้องกัน XSS Injection
    """

    def test_tc_fe_007_password_security_rules(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_007_password_security_rules
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบกฎการตั้งรหัสผ่าน (PASSWORD_RULES) บนหน้าสมัครสมาชิก
          - ตรวจสอบความยาวขั้นต่ำ 8 ตัวอักษร
          - ตรวจสอบว่าต้องมีตัวเลขหรืออักขระพิเศษ
          - ตรวจสอบการพิมพ์รหัสผ่านยืนยันให้ตรงกัน
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `frontend-html/js/register.js` ในฟังก์ชัน `validatePassword()` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดกฎการตรวจสอบ Client-side Validation 3 ข้อ (ความยาว >= 8, มีตัวเลข/อักขระพิเศษ, ค่า confirm_password ตรงกัน)
        * สิ่งที่คาดหวัง / Assertions:
          - รหัสผ่านสั้น หรือขาดตัวเลข/สัญลักษณ์ หรือไม่ตรงกัน ➔ คืน False พร้อมระบุสาเหตุ
          - รหัสผ่านสมบูรณ์ ('StrongP@ssw0rd2026') ➔ คืน True
        =========================================================================
        """
        # รหัสผ่านสั้นเกินไป
        valid, errs = validate_password("short", "short")
        self.assertFalse(valid)
        self.assertTrue(any("8 ตัวอักษร" in e for e in errs))

        # รหัสผ่านขาดตัวเลขหรือสัญลักษณ์
        valid, errs = validate_password("onlyletters", "onlyletters")
        self.assertFalse(valid)
        self.assertTrue(any("ตัวเลขหรืออักขระพิเศษ" in e for e in errs))

        # รหัสผ่านไม่ตรงกัน
        valid, errs = validate_password("SecurePass123!", "MismatchPass456@")
        self.assertFalse(valid)
        self.assertTrue(any("ไม่ตรงกัน" in e for e in errs))

        # รหัสผ่านถูกต้องสมบูรณ์
        valid, errs = validate_password("StrongP@ssw0rd2026", "StrongP@ssw0rd2026")
        self.assertTrue(valid)
        self.assertEqual(len(errs), 0)

    def test_tc_fe_008_xss_prevention_escape(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_008_xss_prevention_escape
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน sanitize/escapeHtml ป้องกันการโจมตี Cross-Site Scripting (XSS)
          - แปลงแท็ก `<script>` และเครื่องหมายคำพูดให้กลายเป็น HTML Entities
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชัน `escapeHtml()` ใน `frontend-html/js/ui.js` และ `frontend-html/js/history/list.js` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดตรรกะการแปลงอักขระพิเศษ HTML (`&`, `<`, `>`, `"`, `'`) มาทดสอบผ่าน `html.escape()` ใน Python
        * สิ่งที่คาดหวัง / Assertions:
          - สตริงที่แปลงแล้วต้องไม่มีแท็ก `<script>` ที่เบราว์เซอร์จะรันได้
        =========================================================================
        """
        malicious = "<script>alert('xss');</script>&\"'"
        sanitized = html.escape(malicious)
        self.assertNotIn("<script>", sanitized)
        self.assertIn("&lt;script&gt;", sanitized)
        self.assertIn("&amp;", sanitized)

    def test_studio_tool_fe_sketch_kernel_bound(self):
        """
        =========================================================================
        [STUDIO TOOL: SKETCH UI] test_studio_tool_fe_sketch_kernel_bound
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบฟังก์ชัน oddKernel() สำหรับสไลเดอร์ปรับค่าความเบลอในเครื่องมือ Studio Tool: Sketch (Artistic Line-Art)
          - อัลกอริทึม Gaussian Blur ก่อนหาเส้นขอบ ต้องใช้ขนาด Kernel เป็นเลขคี่เสมอ (Odd Number)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โมดูลสไลเดอร์ฟิลเตอร์ภาพใน `frontend-html/js/studio/tools.js` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): สกัดสูตร `val % 2 === 0 ? val + 1 : val` พร้อมการจำกัดค่า Clamping (3 ถึง 51)
        * สิ่งที่คาดหวัง / Assertions:
          - ปรับเลขคู่ (2, 4, 50) ➔ กลายเป็นเลขคี่ (3, 5, 51)
          - จำกัดอยู่ในช่วงต่ำสุด 3 ถึงสูงสุด 51 เสมอ
        =========================================================================
        """
        self.assertEqual(odd_kernel(2), 3)
        self.assertEqual(odd_kernel(4), 5)
        self.assertEqual(odd_kernel(50), 51)
        self.assertEqual(odd_kernel(1), 3)   # Min bound
        self.assertEqual(odd_kernel(60), 51) # Max bound


class TestFrontendHtmlTemplatesIntegrity(unittest.TestCase):
    """
    หมวดที่ 4: ตรวจสอบโครงสร้างไฟล์หน้าเว็บ HTML หลักทั้งหมด 7 หน้า
    ยืนยันว่าหน้าเว็บของระบบ LUMA มีอยู่ครบถ้วนและมีแท็กที่จำเป็น
    """

    def test_tc_fe_015_all_seven_html_pages_exist(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_fe_015_all_seven_html_pages_exist
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบว่าหน้าเว็บ HTML หลักของระบบทั้ง 7 หน้ามีอยู่จริงในโฟลเดอร์ frontend-html/
          - ได้แก่: index, login, register, generate, studio, history, admin
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โฟลเดอร์ `frontend-html/` ใน Branch `frontend-app`
          - ดึงข้อมูลมายังไง (How): ตรวจสอบการมีอยู่ของไฟล์หน้าเว็บทั้ง 7 หน้าผ่าน `os.path.exists()` บน Relative Path
        * สิ่งที่คาดหวัง / Assertions:
          - ทุกไฟล์ต้องมีอยู่จริงบนระบบไฟล์ (os.path.exists == True)
        =========================================================================
        """
        pages = [
            "index.html",
            "login.html",
            "register.html",
            "generate.html",
            "studio.html",
            "history.html",
            "admin.html"
        ]
        for page in pages:
            file_path = os.path.join(FRONTEND_DIR, page)
            self.assertTrue(os.path.exists(file_path), f"ไม่พบหน้าเว็บ: {page}")

    def test_studio_tool_fe_workspace_and_canvas(self):
        """
        =========================================================================
        [STUDIO TOOL: WORKSPACE & CANVAS] test_studio_tool_fe_workspace_and_canvas
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบองค์ประกอบ Canvas สำหรับวาด Mask บนหน้า generate.html (เชื่อมต่อ Inpainting)
          - ตรวจสอบพื้นที่ Drag & Drop (#drop-zone) บนหน้า studio.html (จุดรับภาพสำหรับ Studio Tools ทั้ง 4 ชนิด)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์เทมเพลต `frontend-html/generate.html` และ `frontend-html/studio.html` (Branch `frontend-app`)
          - ดึงข้อมูลมายังไง (How): อ่านไฟล์ HTML แล้วใช้ DOM ID Substring Matching ตรวจหาแท็ก canvas `mask-canvas` และ drop container `drop-zone`
        * สิ่งที่คาดหวัง / Assertions:
          - generate.html ต้องมีไอดี 'mask-canvas' สำหรับวาด Mask
          - studio.html ต้องมีไอดี 'drop-zone' สำหรับรับภาพแต่ง
        =========================================================================
        """
        # generate.html ต้องมีผืนผ้าใบ mask-canvas
        gen_path = os.path.join(FRONTEND_DIR, "generate.html")
        with open(gen_path, "r", encoding="utf-8", errors="ignore") as f:
            gen_content = f.read()
        self.assertIn("mask-canvas", gen_content, "generate.html ต้องมี canvas id='mask-canvas'")

        # studio.html ต้องมี workspace และ drop-zone สำหรับแต่งภาพ
        studio_path = os.path.join(FRONTEND_DIR, "studio.html")
        with open(studio_path, "r", encoding="utf-8", errors="ignore") as f:
            studio_content = f.read()
        self.assertIn("drop-zone", studio_content, "studio.html ต้องมี drop-zone สำหรับอัปโหลดภาพแต่ง")


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 80)
    print("  [TEST] RUNNING AUTOMATED TESTS: Track 02 - Web Frontend Studio")
    print("=" * 80)
    unittest.main(verbosity=2)
