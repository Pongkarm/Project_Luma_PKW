@echo off
chcp 65001 >nul
title LUMA Backend API Server (Port 8000)

:: ย้ายไดเรกทอรีไปยังโฟลเดอร์ที่เก็บไฟล์สคริปต์นี้
cd /d "%~dp0"

echo ===================================================
echo   🎨 LUMA AI Platform - Backend API Engine
echo ===================================================
echo.

:: 1. ตรวจสอบและดึง Virtual Environment
if exist ".venv\Scripts\activate.bat" (
    echo [INFO] ตรวจพบและกำลังเปิดใช้งาน .venv ...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo [INFO] ตรวจพบและกำลังเปิดใช้งาน venv ...
    call venv\Scripts\activate.bat
) else (
    echo [WARN] ไม่พบโฟลเดอร์ .venv ในระบบ
    echo [INFO] จะพยายามรันด้วย Python/Uvicorn ส่วนกลางของเครื่อง...
    echo.
)

:: 2. สั่งเปิด Browser ไปที่ Swagger Docs ในเบื้องหลัง (หน่วงเวลา 2 วินาทีให้เซิร์ฟเวอร์เริ่มทำงานก่อน)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000/docs"

:: 3. เริ่มต้นรันเซิร์ฟเวอร์ FastAPI ด้วย Uvicorn
echo [INFO] กำลังเปิดเซิร์ฟเวอร์ที่: http://0.0.0.0:8000
echo [INFO] Swagger Interactive Docs: http://localhost:8000/docs
echo [INFO] กด Ctrl + C เพื่อหยุดการทำงานของเซิร์ฟเวอร์
echo ---------------------------------------------------
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

:: หากเกิด Error หรือเซิร์ฟเวอร์หยุดทำงานกะทันหัน จะไม่ปิดหน้าต่างทันที
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===================================================
    echo [ERROR] เซิร์ฟเวอร์ปิดตัวลงด้วยรหัสข้อผิดพลาด: %ERRORLEVEL%
    echo ===================================================
    echo กรุณาตรวจสอบข้อความแจ้งเตือนด้านบน
    pause
)
