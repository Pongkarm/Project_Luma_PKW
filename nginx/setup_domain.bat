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
    echo [ERROR] Please run this batch script as Administrator.
    echo.
    pause
    exit /b 1
)

set HOSTS_FILE=%WINDIR%\System32\drivers\etc\hosts
set TARGET_IP=172.20.10.9
set DOMAIN_NAME=luma.local

findstr /i "%DOMAIN_NAME%" "%HOSTS_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] โดเมน %DOMAIN_NAME% ถูกตั้งค่าใน hosts เรียบร้อยแล้วก่อนหน้านี้
) else (
    echo [INFO] กำลังบันทึก %DOMAIN_NAME% เข้าสู่ %HOSTS_FILE% ...
    echo. >> "%HOSTS_FILE%"
    echo # LUMA Distributed System >> "%HOSTS_FILE%"
    echo %TARGET_IP% %DOMAIN_NAME% www.%DOMAIN_NAME% >> "%HOSTS_FILE%"
    echo [SUCCESS] เพิ่มโดเมนเรียบร้อยแล้ว: %DOMAIN_NAME% -^> %TARGET_IP%
)

echo.
echo =====================================================================
echo   ทดสอบการเข้าถึง: เปิดเบราว์เซอร์ไปที่ http://%DOMAIN_NAME%
echo =====================================================================
echo.
pause
