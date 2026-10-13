@echo off
chcp 65001 >nul
title LUMA - Setup Domain (luma.local)

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] ขอสิทธิ์ Administrator เพื่อบันทึกไฟล์ hosts...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Running as Administrator
echo =====================================================================
echo   [LUMA] กำลังบันทึกโดเมน luma.local -^> 10.23.130.212
echo =====================================================================
echo.

set TARGET_IP=10.23.130.212
powershell -NoProfile -Command ^
    "$hosts = \"$env:windir\System32\drivers\etc\hosts\"; " ^
    "$lines = (Get-Content $hosts) | Where-Object { $_ -notmatch 'luma\.local' }; " ^
    "$lines += \"%TARGET_IP% luma.local www.luma.local\"; " ^
    "$lines += \"127.0.0.1 luma.local\"; " ^
    "[System.IO.File]::WriteAllLines($hosts, $lines, [System.Text.Encoding]::UTF8); "

echo [1/2] บันทึกไฟล์ C:\Windows\System32\drivers\etc\hosts สำเร็จ!
echo [2/2] กำลังล้าง DNS Cache...
ipconfig /flushdns >nul
echo.
echo =====================================================================
echo   [SUCCESS] ตั้งค่าเรียบร้อยแล้ว! กำลังเปิดเบราว์เซอร์...
echo =====================================================================
echo.
timeout /t 2 >nul
start http://luma.local
exit
