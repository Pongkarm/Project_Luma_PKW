@echo off
title LUMA Backend Automated Test Runner
cd /d "%~dp0\..\.."
echo =======================================================================
echo   LUMA Core Engine - Backend Pytest & Verification Runner (Node 3)
echo =======================================================================
echo.
python TestCases\03_Backend_API\test_backend_api.py
echo.
pause
