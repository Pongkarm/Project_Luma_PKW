@echo off
cd /d "%~dp0"
start "" nginx.exe -p "%~dp0"
echo [OK] Nginx is running!
pause
