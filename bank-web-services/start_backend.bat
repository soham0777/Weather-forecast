@echo off
REM ==========================================================================
REM  National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
REM  Starts the FastAPI backend (REST + SOAP) on http://localhost:8000
REM ==========================================================================
setlocal
cd /d "%~dp0backend"

if not exist venv\Scripts\python.exe (
    echo Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Could not create the virtual environment. Is Python 3.10+ installed and on PATH?
        pause
        exit /b 1
    )
)

call venv\Scripts\activate.bat

echo Installing / checking Python dependencies...
python -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
)

python seed.py

echo.
echo   Backend  : http://localhost:8000
echo   Swagger  : http://localhost:8000/api-docs
echo   ReDoc    : http://localhost:8000/redoc
echo   SOAP     : http://localhost:8000/soap    (WSDL: http://localhost:8000/soap?wsdl)
echo.
uvicorn app.main:app --reload --port 8000
