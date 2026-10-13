#!/usr/bin/env bash

# ย้ายไปยังไดเรกทอรีของสคริปต์นี้
cd "$(dirname "$0")"

echo "==================================================="
echo "  🎨 LUMA AI Platform - Backend API Engine (macOS/Linux)"
echo "==================================================="
echo ""

# 1. ตรวจสอบและดึง Virtual Environment
if [ -f ".venv/bin/activate" ]; then
    echo "⚡ [INFO] กำลังเปิดใช้งาน Virtual Environment (.venv)..."
    source .venv/bin/activate
elif [ -f "venv/bin/activate" ]; then
    echo "⚡ [INFO] กำลังเปิดใช้งาน Virtual Environment (venv)..."
    source venv/bin/activate
else
    echo "⚠️ [WARN] ไม่พบ .venv จะใช้งาน Python ของระบบ..."
fi

# 2. เปิด Browser ไปที่ Swagger Docs ในเบื้องหลัง (หน่วงเวลา 2 วินาที)
(sleep 2 && (open "http://localhost:8000/docs" 2>/dev/null || xdg-open "http://localhost:8000/docs" 2>/dev/null || true)) &

# 3. รันเซิร์ฟเวอร์ FastAPI ด้วย Uvicorn
echo "🚀 [INFO] กำลังเปิดเซิร์ฟเวอร์ที่: http://0.0.0.0:8000"
echo "📖 [INFO] Swagger Interactive Docs: http://localhost:8000/docs"
echo "🛑 [INFO] กด Ctrl + C เพื่อหยุดการทำงาน"
echo "---------------------------------------------------"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
