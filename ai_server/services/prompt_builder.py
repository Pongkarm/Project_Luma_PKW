"""
=============================================================================
LUMA Distributed AI Inference Node — Prompt Engineering & LoRA Auto-Injector
=============================================================================
ไฟล์นี้รับผิดชอบการเตรียม Prompt (Prompt Pre-processing) ก่อนส่งเข้าโมเดล Diffusion:
1. โหลดข้อมูลคอนฟิก LoRA จาก Registry กลาง (`lora_registry.json`)
2. จัดการแทรก LoRA Syntax `<lora:filename:weight>` ตามมาตรฐานของ Stable Diffusion WebUI
3. ตรวจสอบและแทรก Trigger Words (คีย์เวิร์ดกระตุ้นโมเดล) เข้าไปใน Prompt ของผู้ใช้อัตโนมัติ
4. ป้องกันปัญหาคำซ้ำซ้อน (Deduplication) หากผู้ใช้พิมพ์ Trigger Word มาเองแล้ว
=============================================================================
"""

import os
import json
from ai_server.config import AIConfig

# กำหนดเส้นทาง Absolute Path ไปยังไฟล์ฐานข้อมูล LoRA Registry
REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lora_registry.json")


def load_lora_registry() -> dict:
    """
    โหลดข้อมูล LoRA Registry จากไฟล์ JSON
    โครงสร้างข้อมูลประกอบด้วย: trigger_words, weight เริ่มต้น, และตำแหน่งที่ควรแทรก (prefix/suffix)
    หากไม่พบไฟล์หรือไฟล์เสียหาย จะ Fallback เป็น Dictionary ว่าง เพื่อไม่ให้ระบบหยุดทำงาน
    """
    if os.path.exists(REGISTRY_PATH):
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load lora_registry.json: {e}")
    return {}


# โหลด Registry เข้าสู่หน่วยความจำตอนเริ่มต้นระบบ (In-Memory Cache)
LORA_REGISTRY = load_lora_registry()


def build_prompt_with_lora(user_prompt: str, lora_id: str = None) -> tuple[str, str]:
    """
    ฟังก์ชันเสริมพลัง Prompt ด้วย LoRA (Prompt Enrichment):
    
    Parameters:
        user_prompt (str): ข้อความ Prompt ต้นฉบับจากผู้ใช้
        lora_id (str): ชื่อไฟล์ LoRA ที่เลือก เช่น "SousouNoFrieren_Frieren_IlluXL.safetensors"
        
    Returns:
        tuple[str, str]: (Prompt ที่เสริมแต่งสมบูรณ์พร้อมส่งให้ Forge, แท็ก LoRA Syntax)
    """
    # กรณีไม่ได้เลือก LoRA หรือไม่มีชื่อโมเดลนี้ใน Registry ให้คืนค่า Prompt เดิมทันที
    if not lora_id or lora_id not in LORA_REGISTRY:
        return user_prompt.strip(), ""

    # ดึงค่าพารามิเตอร์ของ LoRA แต่ละตัวจาก Registry
    config = LORA_REGISTRY[lora_id]
    trigger = config.get("trigger_words", "")
    weight = config.get("weight", 0.8)
    position = config.get("position", "prefix")
    lora_name = lora_id.replace(".safetensors", "")

    # รูปแบบไวยากรณ์ (Syntax) สำหรับเรียกใช้ LoRA บน Stable Diffusion WebUI Forge / A1111:
    # ตัวอย่าง: <lora:SousouNoFrieren_Frieren_IlluXL:0.85>
    lora_tag = f"<lora:{lora_name}:{weight}>"

    # ระบบตรวจสอบคำซ้ำ (Trigger Word Deduplication):
    # ป้องกันไม่ให้ใส่ Trigger Word เบิ้ล เช่น ถ้าผู้ใช้พิมพ์ "frieren" มาแล้ว จะไม่เติมซ้ำ
    words_to_add = []
    for phrase in [p.strip() for p in trigger.split(",") if p.strip()]:
        if phrase.lower() not in user_prompt.lower():
            words_to_add.append(phrase)
    
    injected_trigger = ", ".join(words_to_add)

    # ประกอบ Prompt ขั้นสุดท้ายตามตำแหน่งที่เหมาะสม:
    # - "prefix": วาง Trigger Word ไว้ด้านหน้าเพื่อให้โมเดลให้น้ำหนักกับตัวละครเป็นหลัก
    # - "suffix": วาง Trigger Word ไว้ด้านหลังเพื่อเน้นสไตล์ภาพโดยรวม
    if position == "prefix" and injected_trigger:
        final_prompt = f"{injected_trigger}, {user_prompt} {lora_tag}".strip()
    elif position == "suffix" and injected_trigger:
        final_prompt = f"{user_prompt}, {injected_trigger} {lora_tag}".strip()
    else:
        final_prompt = f"{user_prompt} {lora_tag}".strip()

    return final_prompt, lora_tag
