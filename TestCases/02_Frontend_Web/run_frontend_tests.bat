@echo off
title LUMA Frontend Automated Test Runner
cd /d "%~dp0\..\.."
echo =======================================================================
echo   LUMA Web Client - Frontend Test Suite Runner (Node 2)
echo =======================================================================
echo.
python TestCases\02_Frontend_Web\test_frontend_web.py
echo.
pause
