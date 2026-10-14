@echo off
title LUMA DevOps Automated Verification Runner
cd /d "%~dp0\..\.."
echo =======================================================================
echo   LUMA Distributed System - DevOps & Gateway Test Runner (Node 1)
echo =======================================================================
echo.
python TestCases\01_DevOps_Gateway\test_devops_gateway.py
echo.
pause
