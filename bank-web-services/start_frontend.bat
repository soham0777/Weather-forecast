@echo off
REM ==========================================================================
REM  National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
REM  Starts the React UI on http://localhost:5173
REM ==========================================================================
setlocal
cd /d "%~dp0frontend"

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)" >nul 2>nul
if errorlevel 1 (
    echo Node.js 20.19+ or 22.12+ is required. Install the LTS version from https://nodejs.org
    pause
    exit /b 1
)

REM Checks for the vite launcher, so a half-finished earlier install is repaired too.
if not exist node_modules\.bin\vite.cmd (
    echo Installing frontend dependencies - first run only, this can take a few minutes...
    call npm install
    if errorlevel 1 (
        echo npm install failed - check your internet connection and try again.
        pause
        exit /b 1
    )
)

echo.
echo   Frontend : http://localhost:5173   (the backend must be running on port 8000)
echo   Keep this window open while you use the simulator.
echo.
call npm run dev
