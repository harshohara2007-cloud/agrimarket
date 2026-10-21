@echo off
title KrishiMarket - Smart Market Platform for Farmers
echo ======================================================================
echo    KRISHIMARKET FULL-STACK APPLICATION (LOCALHOST)
echo    Camera & Real Crop Image Upload System
echo ======================================================================
echo.
echo [1/2] Checking Python environment...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+
    pause
    exit /b 1
)

echo.
echo [2/2] Starting KrishiMarket server on http://localhost:8000 ...
echo Press Ctrl+C at any time to stop the server.
echo.
python backend\server.py 8000
pause
