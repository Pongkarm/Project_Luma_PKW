@echo off
cd /d "%~dp0"
nginx.exe -p "%~dp0" -s stop
echo [OK] Nginx has stopped.
pause
