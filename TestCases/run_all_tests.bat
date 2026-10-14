@echo off
title LUMA Master Automated Test Runner (All Tracks)
cd /d "%~dp0\.."
echo =======================================================================
echo   🎨 LUMA Platform - Running All Python Test Suites across ALL Tracks
echo =======================================================================
echo.
python TestCases\run_all_python_tests.py
echo.
pause
