@echo off
title LUMA AI Server (PC3: 192.168.1.30:7860)
cd /d "%~dp0"
echo ========================================================
echo   LUMA AI Inference Node - Starting FastAPI Server
echo   Project Path: %~dp0
echo   GPU: NVIDIA GeForce RTX 3070 Laptop (8GB VRAM)
echo ========================================================

set PYTHON_EXEC=D:\StabilityMatrix-win-x64\Data\Packages\Stable Diffusion WebUI Forge - Neo\venv\Scripts\python.exe
set PYTHONPATH=%~dp0

"%PYTHON_EXEC%" -m uvicorn ai_server.server:app --app-dir "%~dp0" --host 0.0.0.0 --port 7860 --reload
pause
