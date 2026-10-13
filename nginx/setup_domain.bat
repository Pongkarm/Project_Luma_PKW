@echo off
chcp 65001 >nul
echo =====================================================================
echo   [LUMA DEVOPS] Automated Domain Setup Tool (luma.local)
echo =====================================================================
echo.

:: Check for Administrator permissions
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] กรุณาคลิกขวาที่ไฟล์นี้แล้วเลือก "Run as administrator"
    echo [ERROR] Please right-click this file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

set TARGET_IP=10.23.130.212

echo [INFO] กำลังอัปเดตไฟล์ hosts ให้ชี้ luma.local ไปที่ %TARGET_IP% ...
powershell -NoProfile -Command ^
    "$hosts = \"$env:windir\System32\drivers\etc\hosts\"; " ^
    "$lines = (Get-Content $hosts) | Where-Object { $_ -notmatch 'luma\.local' }; " ^
    "$lines += \"%TARGET_IP% luma.local www.luma.local\"; " ^
    "[System.IO.File]::WriteAllLines($hosts, $lines, [System.Text.Encoding]::UTF8); "

if %errorLevel% equ 0 (
    echo [SUCCESS] อัปเดตไฟล์ hosts สำเร็จ!
    echo           luma.local -^> %TARGET_IP%
    echo           www.luma.local -^> %TARGET_IP%
    echo.
    echo ทำการล้าง DNS Cache (ipconfig /flushdns)...
    ipconfig /flushdns >nul
    echo [SUCCESS] เรียบร้อยแล้ว!
) else (
    echo [ERROR] เกิดข้อผิดพลาดในการเขียนไฟล์ hosts
)

echo.
echo =====================================================================
echo   ทดสอบการเข้าถึง: เปิดเบราว์เซอร์ไปที่ http://luma.local
echo =====================================================================
echo.
pause
