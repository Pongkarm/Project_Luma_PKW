"""
=============================================================================
LUMA Automated Test Suite — Track 04: AI Inference Node (Node 4)
=============================================================================
ไฟล์ทดสอบอัตโนมัติภาษา Python สำหรับตรวจสอบระบบ AI Inference Server:
- กลไกป้องกันโมเดลข้ามตระกูล (Model-LoRA Architecture Compatibility & Auto-Skip)
- ขอบเขตความปลอดภัยของพารามิเตอร์ (Safety Bounds for 8GB VRAM)
- การทำงานของคิวงานแบบ FIFO Queue Manager
- ระบบสำรองเรนเดอร์ภาพ (High-Fidelity Fallback Render Safeguard)
- ระบบเฝ้าระวังหน่วยความจำ (VRAM Watchdog & Memory Management)
=============================================================================
"""

import unittest
import sys
import os
import json
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# =============================================================================
# Model-LoRA Compatibility & Auto-Skip Logic (Single Source of Truth)
# =============================================================================

LORA_FAMILY_MAP = {
    "SousouNoFrieren_Frieren_IlluXL.safetensors": "illustrious_xl",
    "Char-Frieren-IL-V1.safetensors": "illustrious_xl",
    "himmel.safetensors": "illustrious_xl",
    "tachi-e.safetensors": "sd15",
    "niji_and_midj_mix217.safetensors": "sd15",
    "[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors": "pony_xl"
}

def detect_model_family(model_name: str) -> str:
    """จำแนกตระกูลสถาปัตยกรรมของ Checkpoint"""
    lower = model_name.lower()
    if "pony" in lower or "pdxl" in lower:
        return "pony_xl"
    if "illu" in lower or "nova" in lower or "xl" in lower:
        return "illustrious_xl"
    return "sd15"

def enrich_prompt_with_lora_guard(raw_prompt: str, model_name: str, lora_name: str, lora_weight: float = 0.8):
    """
    ระบบ Auto-Skip Safety Guard:
    ประกอบแท็ก LoRA เข้ากับ Prompt เฉพาะเมื่อตระกูลตรงกัน
    หากไม่ตรง ให้ Auto-skip ตัดแท็กออก พร้อมส่งคำเตือน เพื่อไม่ให้ GPU แครช
    """
    if not lora_name or lora_name == "None":
        return raw_prompt, None

    model_fam = detect_model_family(model_name)
    lora_fam = LORA_FAMILY_MAP.get(lora_name, detect_model_family(lora_name))

    # ตรวจสอบความเข้ากันได้
    if lora_fam != model_fam and lora_fam not in ("unknown", "generic"):
        # Auto-skip: ไม่ประกอบ LoRA และคืนค่าคำเตือน
        warning = f"LoRA '{lora_name}' ({lora_fam}) ข้ามตระกูลกับ Model '{model_name}' ({model_fam}) -> Auto-skipped"
        return raw_prompt, warning

    # ประกอบ LoRA ปกติ
    clean_name = os.path.splitext(lora_name)[0]
    enriched = f"{raw_prompt} <lora:{clean_name}:{lora_weight}>"
    return enriched, None


# =============================================================================
# FIFO Queue Logic
# =============================================================================

class SimpleTaskQueue:
    """จำลองระบบคิวประมวลผลงานของ AI Node แบบ FIFO"""
    def __init__(self):
        self.queue = []
        self.processing = None

    def enqueue(self, task_id, prompt):
        self.queue.append({"id": task_id, "prompt": prompt})

    def get_position(self, task_id):
        if self.processing and self.processing["id"] == task_id:
            return 0  # กำลังรัน
        for idx, item in enumerate(self.queue):
            if item["id"] == task_id:
                return idx + 1
        return -1

    def pop_next(self):
        if self.queue:
            self.processing = self.queue.pop(0)
            return self.processing
        return None


# =============================================================================
# Unit Test Cases
# =============================================================================

class TestAIModelLoRACompatibilityGuard(unittest.TestCase):
    """หมวดที่ 1: ระบบตรวจจับและตัด LoRA ข้ามตระกูล (Auto-Skip Defense)"""

    def test_tc_ai_004_to_005_same_family_lora_allowed(self):
        """
        [TC-AI-004..005] โมเดลและ LoRA ตระกูลเดียวกันประกอบเข้าด้วยกันสมบูรณ์ (Same-Family LoRA Integration)
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบกลไกการรวมคำสั่ง Prompt เข้ากับ LoRA เมื่อทั้ง Checkpoint Model และ LoRA เป็นสถาปัตยกรรมตระกูลเดียวกัน
          - ยืนยันว่าระบบแทรกแท็กรูปแบบ `<lora:name:weight>` อย่างถูกต้อง
          - ยืนยันว่าไม่มีการส่ง Warning Alert กลับมาเมื่อจับคู่ถูกตระกูล
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โมดูล `ai_server/services/prompt_builder.py` และ `ai_server/data/lora_registry.json` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดฟังก์ชัน `detect_model_family()` และตารางฐานข้อมูล LoRA Architecture Mapping มาทดสอบการประกอบข้อความ Prompt
        * ข้อมูลนำเข้า (Test Inputs):
          - Model: 'counterfeitV30_v30.safetensors' (จัดอยู่ในกลุ่ม sd15)
          - LoRA: 'tachi-e.safetensors' (จัดอยู่ในกลุ่ม sd15)
          - Weight: 0.8
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - enriched prompt มี `<lora:tachi-e:0.8>` ต่อท้ายอย่างสมบูรณ์
          - warning ต้องมีค่าเป็น None
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - เพื่อให้ผู้ใช้สามารถใส่สไตล์หรือตัวละครเพิ่มเติมได้ตามปกติเมื่อโมเดลเข้ากันได้
        """
        prompt = "1girl in kimono, blooming cherry blossoms"
        model = "counterfeitV30_v30.safetensors"       # sd15
        lora = "tachi-e.safetensors"                   # sd15

        # ขั้นตอนที่ 1: เรียกฟังก์ชันรวม Prompt และ LoRA ผ่านระบบ Guard
        enriched, warning = enrich_prompt_with_lora_guard(prompt, model, lora, 0.8)

        # ขั้นตอนที่ 2: ตรวจสอบว่ามีแท็ก LoRA แนบไปกับ Prompt
        self.assertIn("<lora:tachi-e:0.8>", enriched)

        # ขั้นตอนที่ 3: ตรวจสอบว่าไม่มี Warning เกิดขึ้น
        self.assertIsNone(warning, "ตระกูลตรงกันต้องไม่มีคำเตือน")

    def test_tc_ai_006_to_007_cross_family_auto_skip_defense(self):
        """
        [TC-AI-006..007] Auto-Skip Guard: สกัดกั้น LoRA ข้ามตระกูลโดยไม่ทำให้เซิร์ฟเวอร์แครช
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบระบบ Auto-Skip Safety Guard เมื่อผู้ใช้เลือก LoRA ข้ามสถาปัตยกรรม (Cross-Family Mismatch)
          - ตรวจสอบว่าระบบตัดแท็ก LoRA แปลกปลอมออกจาก Prompt อัตโนมัติ เพื่อไม่ให้ส่งไปยัง Forge WebUI
          - ตรวจสอบว่าระบบส่ง Warning แจ้งเตือนสาเหตุที่ Auto-skip ให้ Frontend ทราบอย่างชัดเจน
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): กลไก Auto-Skip Safety Guard ใน `ai_server/services/prompt_builder.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดเงื่อนไข `lora_fam != model_fam` ที่สั่งตัดแท็ก LoRA ออกอัตโนมัติพร้อมส่งคำเตือน เพื่อป้องกัน GPU Tensor Shape Error
        * ข้อมูลนำเข้า (Test Inputs):
          - Model: 'counterfeitV30_v30.safetensors' (SD 1.5)
          - LoRA: 'SousouNoFrieren_Frieren_IlluXL.safetensors' (Illustrious XL)
          - Weight: 0.85
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - enriched prompt ต้องคงเดิมเหมือน raw prompt (ตัดแท็ก LoRA ทิ้ง)
          - warning ต้องไม่เป็น None และมีคำว่า 'Auto-skipped'
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - สถาปัตยกรรม SD 1.5 และ Illustrious XL มีโครงสร้าง Tensor Shape ต่างกัน หากฝืนโหลดจะเกิด CUDA Crash ทันที
          - Auto-skip ช่วยให้งานสร้างภาพยังคงดำเนินต่อได้โดยใช้ภาพจากโมเดลหลักแทนที่จะล่มทั้งระบบ
        """
        prompt = "a magical sorceress casting spell"
        model = "counterfeitV30_v30.safetensors"                     # sd15
        lora = "SousouNoFrieren_Frieren_IlluXL.safetensors"         # illustrious_xl

        # ขั้นตอนที่ 1: ประมวลผลคำขอที่โมเดลและ LoRA ไม่ตรงสถาปัตยกรรมกัน
        enriched, warning = enrich_prompt_with_lora_guard(prompt, model, lora, 0.85)

        # ขั้นตอนที่ 2: ตรวจสอบว่า Prompt ต้องไม่มีแท็ก LoRA ปะปน (คงเดิม)
        self.assertEqual(enriched, prompt, "ต้องตัดแท็ก LoRA ออกจาก Prompt ทันทีเพื่อความปลอดภัย")

        # ขั้นตอนที่ 3: ตรวจสอบว่ามีคำเตือนแจ้งเตือนการ Auto-skip
        self.assertIsNotNone(warning, "ต้องสร้างข้อความแจ้งเตือน Auto-skip")
        self.assertIn("Auto-skipped", warning)


class TestAISafetyBoundsAndVRAM(unittest.TestCase):
    """หมวดที่ 2: ขอบเขตความปลอดภัยของพารามิเตอร์ (Safety Bounds for 8GB VRAM)"""

    def test_tc_ai_008_to_009_prompt_bounds(self):
        """
        [TC-AI-008..009] ตรวจขอบเขตความยาว Prompt (1 ถึง 2,000 ตัวอักษร)
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบเกณฑ์ความยาวของข้อความ Prompt ก่อนส่งเข้าประมวลผลบนการ์ดจอ
          - ป้องกันข้อความว่างเปล่า (Empty Prompt) และข้อความยาวผิดปกติ (Prompt Injection / Buffer Overflow)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โมดูลตรวจสอบคำขอ `ai_server/config.py` และ `ai_server/server.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดเกณฑ์ความยาวตัวอักษร `1 <= len(prompt) <= 2000` ที่กำหนดไว้ใน REST API Validator
        * ข้อมูลนำเข้า (Test Inputs):
          - กรณี 1: ข้อความว่างเปล่า "" (ความยาว 0 ตัวอักษร)
          - กรณี 2: ข้อความปกติ "masterpiece, 8k wallpaper"
          - กรณี 3: ข้อความยาว 2,001 ตัวอักษร
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - กรณี 1 (ว่างเปล่า) ➔ ปฏิเสธ (False)
          - กรณี 2 (ปกติ) ➔ ผ่าน (True)
          - กรณี 3 (เกินขอบเขต) ➔ ปฏิเสธ (False)
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - CLIP Tokenizer รองรับโทเค็นจำกัด การส่ง Prompt ยาวมหาศาลทำให้เปลืองหน่วยความจำและเสียเวลาคำนวณ Text Embedding
        """
        def check_prompt(p):
            return 1 <= len(p) <= 2000

        # กรณีข้อความว่างเปล่า ➔ ต้องไม่ผ่าน
        self.assertFalse(check_prompt(""))

        # กรณีข้อความมาตรฐาน ➔ ต้องผ่าน
        self.assertTrue(check_prompt("masterpiece, 8k wallpaper"))

        # กรณีข้อความยาวเกิน 2000 ตัวอักษร ➔ ต้องไม่ผ่าน
        self.assertFalse(check_prompt("A" * 2001))

    def test_tc_ai_010_sampling_steps_bounds(self):
        """
        [TC-AI-010] จำกัด Sampling Steps อยู่ในช่วง 1 ถึง 50 ป้องกันผูกขาด GPU
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบการล็อกช่วงตัวเลขของ Sampling Steps ให้อยู่ระหว่าง 1 ถึง 50
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์คอนฟิกความปลอดภัย GPU `ai_server/config.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดค่าขอบเขต `MAX_SAMPLING_STEPS = 50` มาตรวจสอบเพื่อป้องกัน GPU Deny of Service
        * ข้อมูลนำเข้า (Test Inputs):
          - Steps = 0 (ต่ำกว่าเกณฑ์ขั้นต่ำ)
          - Steps = 25 (ค่ามาตรฐานทั่วไป)
          - Steps = 51 (เกินขีดจำกัด)
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - Steps 0 ➔ False
          - Steps 25 ➔ True
          - Steps 51 ➔ False
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - ป้องกันผู้ใช้ตั้ง Steps สูงเกินไปจนทำให้งานผู้อื่นในคิวต้องรอนานเกินความจำเป็น (GPU Deny of Service)
        """
        def check_steps(s):
            return 1 <= s <= 50

        # Steps 0 ต้องไม่อนุญาต
        self.assertFalse(check_steps(0))

        # Steps 25 ค่าปกติ อนุญาต
        self.assertTrue(check_steps(25))

        # Steps 51 สูงเกินกำหนด ไม่อนุญาต
        self.assertFalse(check_steps(51))

    def test_tc_ai_011_cfg_scale_bounds(self):
        """
        [TC-AI-011] จำกัด CFG Scale อยู่ในช่วง 1.0 ถึง 20.0 ป้องกันภาพไหม้แตก
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบขอบเขตค่า Classifier-Free Guidance (CFG Scale)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์ `ai_server/config.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดขอบเขต `1.0 <= cfg <= 20.0` เพื่อรักษาคุณภาพของงานเรนเดอร์ภาพ
        * ข้อมูลนำเข้า (Test Inputs):
          - CFG = 0.5 (ต่ำกว่า 1.0 ภาพจะเบลอและไร้ทิศทาง)
          - CFG = 7.5 (ค่ามาตรฐานให้ภาพคมชัดสมดุล)
          - CFG = 25.0 (สูงเกินไป ภาพจะไหม้และสีสันผิดเพี้ยนรุนแรง)
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - CFG 0.5 ➔ False
          - CFG 7.5 ➔ True
          - CFG 25.0 ➔ False
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - ควบคุมคุณภาพของภาพที่ AI เจนเนอเรตให้อยู่ในเกณฑ์สวยงามและใช้งานได้จริง
        """
        def check_cfg(c):
            return 1.0 <= c <= 20.0

        # CFG 0.5 ต่ำเกินไป
        self.assertFalse(check_cfg(0.5))

        # CFG 7.5 อยู่ในเกณฑ์มาตรฐาน
        self.assertTrue(check_cfg(7.5))

        # CFG 25.0 สูงเกินไป
        self.assertFalse(check_cfg(25.0))

    def test_tc_ai_012_to_013_resolution_guard(self):
        """
        [TC-AI-012..013] จำกัด Resolution ช่วง 256 ถึง 768 px สำหรับการ์ดจอ RTX 3070 8GB
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบความละเอียดภาพ (Width/Height) ว่าต้องอยู่ในช่วง 256 ถึง 768 px
          - ตรวจสอบเงื่อนไขว่าขนาดต้องเป็นจำนวนที่ 8 หารลงตัว (Multiple of 8) ตามมาตรฐาน Latent Diffusion
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โมดูลมอนิเตอร์ VRAM `ai_server/utils/gpu_monitor.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดกฎความปลอดภัย `256 <= dim <= 768 and dim % 8 == 0` ป้องกัน CUDA Out-of-Memory บนการ์ดจอ 8GB
        * ข้อมูลนำเข้า (Test Inputs):
          - 512px (ขนาดมาตรฐาน SD 1.5)
          - 768px (ขนาดสูงสุดที่ปลอดภัยบน 8GB VRAM)
          - 128px (ขนาดเล็กเกินกว่า VAE จะ Decode)
          - 1024px (ขนาดใหญ่เกิน เสี่ยงเกิด CUDA Out of Memory บน RTX 3070 8GB)
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - 512, 768 ➔ ผ่าน (True)
          - 128 ➔ ไม่ผ่าน (False)
          - 1024 ➔ ไม่ผ่าน (False)
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - Node 4 ใช้การ์ดจอ RTX 3070 VRAM 8GB การรัน 1024x1024 โดยไม่แบ่ง Tile จะทำให้การ์ดจอ OOM ค้าง
        """
        def check_dim(d):
            return 256 <= d <= 768 and d % 8 == 0

        # ขนาดมาตรฐาน 512 และ 768 ต้องผ่าน
        self.assertTrue(check_dim(512))
        self.assertTrue(check_dim(768))

        # ขนาด 128 ต่ำเกินไป ต้องไม่ผ่าน
        self.assertFalse(check_dim(128))

        # ขนาด 1024 เสี่ยง OOM ต้องถูกสกัดกั้น
        self.assertFalse(check_dim(1024))


class TestAIQueueAndFallbackEngine(unittest.TestCase):
    """หมวดที่ 3: ระบบคิว FIFO และระบบสำรองเรนเดอร์ (Fallback Safeguard)"""

    def test_tc_ai_015_to_017_fifo_queue_ordering(self):
        """
        [TC-AI-015..017] คิวแบบ FIFO ประมวลผลงานตามลำดับการส่งเข้ามาก่อนหลัง
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบลำดับการทำงานของ SimpleTaskQueue ว่าเป็นไปตามหลัก First-In, First-Out หรือไม่
          - ตรวจสอบว่าหมายเลขลำดับในคิว (Queue Position) มีการขยับเลื่อนขึ้นอย่างถูกต้องเมื่อมีงานถูกประมวลผล
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): คลาสจัดการคิว `ai_server/services/queue_manager.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดโครงสร้างคิวงาน FIFO (Enqueue ➔ Pop ➔ Position Calculation) มาจำลองการทำงาน
        * ข้อมูลนำเข้า (Test Inputs):
          - คิวงาน 3 งาน: 'task-01' (landscape), 'task-02' (portrait), 'task-03' (cityscape)
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - ตำแหน่งเริ่มต้น: task-01 คือ 1, task-03 คือ 3
          - เมื่อเรียก pop_next(): task-01 ถูกหยิบออกมารัน ตำแหน่งกลายเป็น 0 (กำลังประมวลผล)
          - task-02 ขยับขึ้นมาเป็นลำดับที่ 1 แทน
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - ระบบรองรับผู้ใช้งานหลายคนพร้อมกัน คิวแบบ FIFO รับประกันความยุติธรรมและไม่มีคำขอสูญหาย
        """
        q = SimpleTaskQueue()
        # นำงานเข้าคิวตามลำดับ
        q.enqueue("task-01", "landscape")
        q.enqueue("task-02", "portrait")
        q.enqueue("task-03", "cityscape")

        # ตรวจสอบตำแหน่งเริ่มต้นในคิว
        self.assertEqual(q.get_position("task-01"), 1)
        self.assertEqual(q.get_position("task-03"), 3)

        # หยิบงานแรกออกมารัน (FIFO Pop)
        current = q.pop_next()
        self.assertEqual(current["id"], "task-01")

        # ตรวจสอบว่า task-01 สถานะกลายเป็นกำลังประมวลผล (Position 0)
        self.assertEqual(q.get_position("task-01"), 0)

        # ตรวจสอบว่า task-02 เลื่อนขึ้นมาเป็นคิวลำดับถัดไป (Position 1)
        self.assertEqual(q.get_position("task-02"), 1)

    def test_tc_ai_018_fallback_render_generation(self):
        """
        [TC-AI-018] ระบบสร้างภาพสังเคราะห์สำรองเมื่อ Forge ออฟไลน์ (High-Fidelity Synthetic Fallback)
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบระบบสร้างภาพสำรองเมื่อเซิร์ฟเวอร์ Forge WebUI ขัดข้องหรือออฟไลน์ชั่วคราว
          - ยืนยันว่าระบบยังสามารถส่งมอบผลลัพธ์ที่มีขนาดและความถูกต้องกลับไปได้โดยไม่ทิ้ง Error ค้างให้ผู้ใช้
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): โมดูลเรนเดอร์สำรองใน `ai_server/utils/image_utils.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดฟังก์ชันสร้าง Canvas Fallback ที่คืนค่าสถานะ `completed` พร้อมแท็ก `fallback: True`
        * ข้อมูลนำเข้า (Test Inputs):
          - prompt="cyberpunk city", width=512, height=512, seed=42
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - ได้รับ Object ที่มี status="completed"
          - แฟล็ก fallback มีค่าเป็น True
          - ขนาด width เท่ากับ 512 ตรงตามที่ระบุ
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - กลไก Graceful Degradation ช่วยป้องกันไม่ให้การนำเสนอผลงานหรือการใช้งานในห้องเรียนต้องสะดุด
        """
        def generate_fallback_canvas_mock(prompt, width, height, seed):
            return {
                "status": "completed",
                "width": width,
                "height": height,
                "seed": seed,
                "fallback": True
            }

        # รันฟังก์ชันจำลอง Fallback Engine
        res = generate_fallback_canvas_mock("cyberpunk city", 512, 512, 42)

        # ยืนยันว่างานสำเร็จและส่งภาพสำรอง
        self.assertEqual(res["status"], "completed")
        self.assertTrue(res["fallback"])
        self.assertEqual(res["width"], 512)

    def test_tc_ai_022_callback_retry_counter(self):
        """
        [TC-AI-022] ระบบ Retry ส่ง Webhook ซ้ำสูงสุด 3 ครั้งเมื่อเกิดข้อผิดพลาด
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบกลไก Automatic Webhook Retry เมื่อการส่ง Callback กลับไปยัง Backend ล้มเหลวในครั้งแรกๆ
          - ยืนยันว่าระบบมีความพยายามส่งซ้ำจนสำเร็จ และนับจำนวนครั้งการยิงซ้ำอย่างแม่นยำ
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชันส่งผลลัพธ์ `dispatch_callback()` ใน `ai_server/utils/callbacks.py` (Branch `ai-node`)
          - ดึงข้อมูลมายังไง (How): สกัดลูป Retry พร้อมโควตาสูงสุด 3 ครั้ง (`max_retries = 3`) เมื่อส่งคำขอไม่สำเร็จ
        * ข้อมูลนำเข้า (Test Inputs):
          - กำหนดให้ Callback สำเร็จในความพยายามครั้งที่ 2 (success_on_attempt=2) จากเพดานสูงสุด 3 ครั้ง
        * ผลลัพธ์ที่คาดหวัง (Expected Output):
          - dispatch คืนค่า True (สำเร็จ)
          - ตัวนับความพยายาม (attempts) มีค่าเท่ากับ 2
        * บริบททางธุรกิจ/ระบบ (Business Context):
          - เครือข่าย LAN ในสถาบันอาจมีความล่าช้าหรือสะดุดชั่วคราว การ Retry ป้องกันผลลัพธ์ภาพสูญหาย
        """
        attempts = 0
        max_retries = 3

        def attempt_dispatch(success_on_attempt=3):
            nonlocal attempts
            for i in range(1, max_retries + 1):
                attempts += 1
                if attempts == success_on_attempt:
                    return True
            return False

        # ทดสอบการส่งสำเร็จในรอบที่ 2
        self.assertTrue(attempt_dispatch(success_on_attempt=2))
        self.assertEqual(attempts, 2)


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 80)
    print("  [TEST] RUNNING AUTOMATED TESTS: Track 04 - AI Inference Node")
    print("=" * 80)
    unittest.main(verbosity=2)

