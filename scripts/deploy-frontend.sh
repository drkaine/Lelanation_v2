#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"

echo "[deploy-frontend] Stopping PM2 app..."
pm2 stop lelanation-frontend >/dev/null 2>&1 || true

echo "[deploy-frontend] Building Nuxt (clean output + nitro cache)..."
cd "$FRONTEND"
rm -rf .output node_modules/.cache/nuxt
npm run build
rm -f .output/public/index.html

echo "[deploy-frontend] Verifying server chunk manifest..."
node -e "
const fs = require('fs')
const path = require('path')
const dir = '.output/server/chunks/build'
const server = fs.readFileSync(path.join(dir, 'server.mjs'), 'utf8')
const imports = [...server.matchAll(/import\\('\\.\\/([^']+)'\\)/g)].map(m => m[1])
const missing = imports.filter(f => !fs.existsSync(path.join(dir, f)))
if (missing.length) {
  console.error('Missing chunks:', missing.slice(0, 10).join(', '))
  process.exit(1)
}
console.log('OK:', imports.length, 'lazy imports')
"

echo "[deploy-frontend] Starting PM2 app..."
if pm2 describe lelanation-frontend >/dev/null 2>&1; then
  pm2 start lelanation-frontend
else
  pm2 start "$ROOT/ecosystem.config.js" --only lelanation-frontend
fi

echo "[deploy-frontend] Done."
