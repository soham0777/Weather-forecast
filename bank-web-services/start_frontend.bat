@echo off
REM ==========================================================================
REM  National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
REM  Starts the React UI on http://localhost:5173
REM ==========================================================================
setlocal
cd /d "%~dp0frontend"

where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js 20.19+ is required. Download it from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing frontend dependencies - first run only...
    call npm install
    if errorlevel 1 (
        pause
        exit /b 1
    )
)

echo.
echo   Frontend : http://localhost:5173   (the backend must be running on port 8000)
echo.
call npm run dev
