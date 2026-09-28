@echo off
REM ==========================================================================
REM  One-click start (Windows)
REM  1. checks that Python 3.10+ and Node.js 20.19+ are installed
REM  2. opens the backend and the frontend in two separate windows
REM  3. waits until BOTH servers answer, then opens the simulator in the browser
REM  Close the two server windows to stop the application.
REM ==========================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   National Digital Bank - Web Services Platform
echo   EDUCATIONAL SIMULATOR - NOT A REAL BANKING SYSTEM
echo ============================================================
echo.

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
    echo [X] Python 3.10 or newer was not found.
    echo     Install it from https://www.python.org/downloads/
    echo     and tick "Add python.exe to PATH" during installation, then run this file again.
    echo.
    pause
    exit /b 1
)
echo [OK] Python found

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)" >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js 20.19+ or 22.12+ was not found.
    echo     Install the LTS version from https://nodejs.org and run this file again.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js found
echo.

echo Starting the backend and the frontend in two new windows...
start "NDB Backend - FastAPI port 8000" cmd /k call "%~dp0start_backend.bat"
start "NDB Frontend - Vite port 5173" cmd /k call "%~dp0start_frontend.bat"

echo.
echo Waiting for both servers to answer.
echo The FIRST run installs dependencies and can take a few minutes - please wait...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $urls='http://127.0.0.1:8000/health','http://localhost:5173/'; for ($i = 0; $i -lt 300; $i++) { $ready = $true; foreach ($u in $urls) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $u | Out-Null } catch { $ready = $false } }; if ($ready) { exit 0 }; Start-Sleep -Seconds 2 }; exit 1"
if errorlevel 1 (
    echo.
    echo [X] The servers did not start within 10 minutes.
    echo     Look at the two server windows for the error message.
    echo     Common causes: no internet during the first install, or port 8000/5173 already in use.
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Backend and frontend are running - opening http://localhost:5173
start "" http://localhost:5173
