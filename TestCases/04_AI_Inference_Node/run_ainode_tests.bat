@echo off
title LUMA AI Node Automated Test Runner
cd /d "%~dp0\..\.."
echo =======================================================================
echo   LUMA AI Engine - AI Inference Node Test Suite (Node 4)
echo =======================================================================
echo.
python TestCases\04_AI_Inference_Node\test_ai_node.py
echo.
pause
