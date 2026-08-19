@echo off
title LUMA - WebUI Forge GPU Engine (Port 7861)
echo ========================================================
echo   Starting Stable Diffusion WebUI Forge API Engine
echo   Target Port: 7861 (Headless API Mode)
echo ========================================================

cd /d "D:\StabilityMatrix-win-x64\Data\Packages\Stable Diffusion WebUI Forge - Neo"

set COMMANDLINE_ARGS=--nowebui --api --port 7861 --listen --cors-allow-origins "*" --cuda-malloc --cuda-stream --skip-prepare-environment

call webui.bat
