#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[deploy-frontend] Stopping PM2 app..."
pm2 stop lelanation-frontend >/dev/null 2>&1 || true

bash "$ROOT/scripts/build-frontend.sh"

echo "[deploy-frontend] Starting PM2 app..."
if pm2 describe lelanation-frontend >/dev/null 2>&1; then
  pm2 start lelanation-frontend
else
  pm2 start "$ROOT/ecosystem.config.js" --only lelanation-frontend
fi

echo "[deploy-frontend] Done."
