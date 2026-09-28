#!/usr/bin/env bash
# National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR)
# Starts the React UI on http://localhost:5173  (macOS / Linux)
set -euo pipefail
cd "$(dirname "$0")/frontend"

command -v npm >/dev/null || { echo "Node.js 20.19+ is required: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install

echo
echo "  Frontend : http://localhost:5173   (the backend must be running on port 8000)"
echo
exec npm run dev
