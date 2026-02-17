#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/isometric-city"

MODE="${1:-prod}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not on PATH." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "Error: expected app directory not found: $APP_DIR" >&2
  exit 1
fi

install_if_needed() {
  if [[ ! -d "$APP_DIR/node_modules" ]]; then
    echo "Installing dependencies..."
    (cd "$APP_DIR" && npm install)
  fi
}

run_build() {
  echo "Building CityLife..."
  (cd "$APP_DIR" && npm run build)
}

run_dev() {
  echo "Starting CityLife in development mode at http://localhost:3000/citylife"
  (cd "$APP_DIR" && npm run dev)
}

run_prod() {
  run_build
  echo "Starting CityLife in production mode at http://localhost:3000/citylife"
  (cd "$APP_DIR" && npm start)
}

usage() {
  cat <<'EOF'
Usage: ./run_citylife.sh [dev|prod|build]

Modes:
  dev    Install deps if needed, then run Next.js dev server (shows compile logs)
  prod   Install deps if needed, run a fresh production build, then start server (default)
  build  Install deps if needed, then run production build only
EOF
}

install_if_needed

case "$MODE" in
  dev)
    run_dev
    ;;
  prod)
    run_prod
    ;;
  build)
    run_build
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage
    exit 1
    ;;
esac
