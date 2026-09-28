#!/usr/bin/env bash
# National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
# Starts the FastAPI backend (REST + SOAP) on http://localhost:8000  (macOS / Linux)
set -euo pipefail
cd "$(dirname "$0")/backend"

if [ ! -x venv/bin/python ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

echo "Installing / checking Python dependencies..."
python -m pip install --disable-pip-version-check -q -r requirements.txt
python seed.py

echo
echo "  Backend  : http://localhost:8000"
echo "  Swagger  : http://localhost:8000/api-docs"
echo "  ReDoc    : http://localhost:8000/redoc"
echo "  SOAP     : http://localhost:8000/soap    (WSDL: http://localhost:8000/soap?wsdl)"
echo
exec uvicorn app.main:app --reload --port 8000
