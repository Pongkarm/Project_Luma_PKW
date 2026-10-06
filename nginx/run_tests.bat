@echo off
chcp 65001 >nul
title LUMA Distributed System - Test Suite (4 Nodes)
cd /d "%~dp0"
echo ====================================================================
echo   LUMA DISTRIBUTED SYSTEM - 4 NODES VERIFICATION TEST SUITE
echo ====================================================================
python test_distributed_system.py
echo.
pause
