#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${1:-8999}"
HOST="127.0.0.1"
URL="http://localhost:${PORT}/"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Error: Python is required but was not found in PATH." >&2
  exit 1
fi

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$URL'" >/dev/null 2>&1
  else
    echo "Opened server, but couldn't auto-open a browser. Visit: $URL"
  fi
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting server at $URL"
"$PYTHON_BIN" -m http.server "$PORT" --bind "$HOST" >/dev/null 2>&1 &
SERVER_PID=$!

sleep 0.4
if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  echo "Error: Could not start server on port $PORT (is it already in use?)." >&2
  exit 1
fi

open_browser
echo "Server running. Press Ctrl+C to stop."
wait "$SERVER_PID"
