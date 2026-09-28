@echo off
REM ==========================================================================
REM  One-click start (Windows): opens the backend and the frontend in two
REM  separate windows, then opens the simulator in your browser.
REM  Close those two windows to stop the application.
REM ==========================================================================
start "NDB Backend (FastAPI :8000)" cmd /k "%~dp0start_backend.bat"
start "NDB Frontend (Vite :5173)" cmd /k "%~dp0start_frontend.bat"
echo Waiting for the servers to start...
timeout /t 15 /nobreak >nul
start "" http://localhost:5173
