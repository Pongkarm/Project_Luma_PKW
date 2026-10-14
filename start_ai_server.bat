@echo off
title LUMA AI Server (Node 4: 10.23.130.112:7860)
cd /d "%~dp0"
echo ========================================================
echo   LUMA AI Inference Node - Starting FastAPI Server
echo   Project Path: %~dp0
echo   Node: Node 4 (AI Inference Engine)
echo   GPU: NVIDIA GeForce RTX 3070 Laptop (8GB VRAM)
echo ========================================================

set PYTHON_EXEC=D:\StabilityMatrix-win-x64\Data\Packages\Stable Diffusion WebUI Forge - Neo\venv\Scripts\python.exe

if exist "%PYTHON_EXEC%" (
    set PY_CMD="%PYTHON_EXEC%"
) else if exist "%~dp0venv\Scripts\python.exe" (
    set PY_CMD="%~dp0venv\Scripts\python.exe"
) else (
    set PY_CMD=python
)

set PYTHONPATH=%~dp0

echo Using Python runtime: %PY_CMD%
%PY_CMD% -m ai_server.run
pause
