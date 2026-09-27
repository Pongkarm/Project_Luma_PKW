@echo off
cd /d "%~dp0"
nginx.exe -p "%~dp0" -s reload
echo [OK] Nginx configuration reloaded.
pause
