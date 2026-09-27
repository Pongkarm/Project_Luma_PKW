"""
=============================================================================
LUMA Distributed AI Inference Node — Standalone Server Entry Point
=============================================================================
ไฟล์นี้เป็นจุดเริ่มต้น (Entry Point) สำหรับการบูตระบบ FastAPI AI Node:
1. ทำการคำนวณและแทรก Project Root เข้าสู่ `sys.path` เพื่อให้สามารถ Import โมดูล
   ในแพ็กเกจ `ai_server` ได้อย่างถูกต้องไม่ว่าจะรันสคริปต์จาก Directory ใด
2. ดึงค่า Host (`0.0.0.0`) และ Port (`7860`) จาก `AIConfig`
3. สตาร์ต ASGI Server (Uvicorn) พร้อมเปิดระบบ Hot-Reload สำหรับการพัฒนา
=============================================================================
"""

import os
import sys

# คำนวณ Root Directory ของโปรเจกต์ และเพิ่มเข้าสู่ Python Module Search Path (sys.path)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn
from ai_server.config import AIConfig

if __name__ == "__main__":
    print(f"Starting LUMA AI Server from: {PROJECT_ROOT}")
    print(f"Target Binding: {AIConfig.HOST}:{AIConfig.PORT}")
    
    # รันเซิร์ฟเวอร์ Uvicorn
    # - "ai_server.server:app": ชี้ไปยัง FastAPI Instance ในโมดูล server.py
    # - reload=True: รีโหลดเซิร์ฟเวอร์ให้อัตโนมัติเมื่อตรวจพบการแก้ไขไฟล์โค้ด
    uvicorn.run(
        "ai_server.server:app",
        host=AIConfig.HOST,
        port=AIConfig.PORT,
        app_dir=PROJECT_ROOT,
        reload=True
    )
