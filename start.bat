@echo off
TITLE SmartClass AI Launcher
COLOR 0A
cls

echo ===============================================================
echo          SMARTCLASS AI - ATTENTIVENESS AND ATTENDANCE
echo ===============================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js detected.

:: 3. Check frontend dependencies
if not exist "frontend\node_modules" (
    echo.
    echo [*] Installing frontend dependencies, please wait...
    call npm --prefix frontend install
)

echo.
echo ===============================================================
echo          STARTING SERVICES...
echo ===============================================================

:: 4. Start FastAPI Backend in new window
echo [*] Launching FastAPI Backend on http://localhost:8000 ...
start "SmartClass Backend API" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

:: 5. Wait 3 seconds for backend to initialize
ping 127.0.0.1 -n 4 >nul 2>&1

:: 6. Start Vite Frontend in new window
echo [*] Launching Vite Frontend on http://localhost:5173 ...
start "SmartClass Frontend" cmd /k "npm --prefix frontend run dev"

:: 7. Wait 2 seconds and launch default browser
ping 127.0.0.1 -n 3 >nul 2>&1
echo [*] Opening application in your web browser...
start http://localhost:5173

echo.
echo ===============================================================
echo  SUCCESS! SmartClass is now running:
echo    - Frontend UI:  http://localhost:5173
echo    - Backend API:  http://localhost:8000
echo    - API Docs:     http://localhost:8000/docs
echo ===============================================================
echo.
echo Keep this window open or press any key to close launcher window.
echo Note: The backend and frontend windows will continue running.
pause
