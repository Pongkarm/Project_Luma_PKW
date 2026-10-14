@echo off
title LUMA Multi-Node Full Integration Test Runner
cd /d "%~dp0\..\.."
echo =======================================================================
echo   LUMA Full Pipeline - Multi-Node E2E Verification Runner
echo =======================================================================
echo.
python TestCases\05_End_to_End_Integration\test_full_pipeline_e2e.py
echo.
pause
