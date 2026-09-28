@echo off
REM ==========================================================================
REM  National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
REM  Starts the FastAPI backend (REST + SOAP) on http://localhost:8000
REM
REM  The virtual environment's python.exe is called directly (no "activate"),
REM  so packages always go into backend\venv - never into a global Python.
REM ==========================================================================
setlocal
cd /d "%~dp0backend"

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
    echo Python 3.10 or newer was not found. Install it from https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" during installation.
    pause
    exit /b 1
)

if not exist venv\Scripts\python.exe (
    echo Creating Python virtual environment in backend\venv ...
    python -m venv venv
    if errorlevel 1 (
        echo Could not create the virtual environment.
        pause
        exit /b 1
    )
)
set "VENV_PY=%~dp0backend\venv\Scripts\python.exe"

"%VENV_PY%" -m pip --version >nul 2>nul
if errorlevel 1 "%VENV_PY%" -m ensurepip --upgrade >nul

echo Installing / checking Python dependencies - the first run takes a minute...
"%VENV_PY%" -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 (
    echo Dependency installation failed - check your internet connection and try again.
    pause
    exit /b 1
)

"%VENV_PY%" seed.py

echo.
echo   Backend  : http://localhost:8000
echo   Swagger  : http://localhost:8000/api-docs
echo   ReDoc    : http://localhost:8000/redoc
echo   SOAP     : http://localhost:8000/soap    (WSDL: http://localhost:8000/soap?wsdl)
echo.
echo   Keep this window open while you use the simulator.
echo.
"%VENV_PY%" -m uvicorn app.main:app --reload --port 8000
