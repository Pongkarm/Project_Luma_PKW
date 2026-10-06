@echo off
chcp 65001 >nul
title LUMA Distributed System - Automated Backup
cd /d "%~dp0"
python backup_system.py
echo.
pause
