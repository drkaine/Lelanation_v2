#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"

if pm2 describe lelanation-frontend >/dev/null 2>&1; then
  status="$(pm2 jlist 2>/dev/null | node -e "
    let s='';
    process.stdin.on('data',d=>s+=d);
    process.stdin.on('end',()=>{
      try {
        const apps=JSON.parse(s);
        const app=apps.find(a=>a.name==='lelanation-frontend');
        console.log(app?.pm2_env?.status ?? 'missing');
      } catch { console.log('missing'); }
    });
  " 2>/dev/null || echo "missing")"
  if [[ "$status" == "online" || "$status" == "launching" ]]; then
    echo "[build-frontend] ERROR: lelanation-frontend is still running (status: $status)." >&2
    echo "[build-frontend] Stop it first with: ./scripts/deploy-frontend.sh  (or: pm2 stop lelanation-frontend)" >&2
    echo "[build-frontend] Building while PM2 serves .output causes ENOENT on /data/game/* until restart." >&2
    exit 1
  fi
fi

echo "[build-frontend] Building Nuxt (clean output + nitro cache)..."
cd "$FRONTEND"
rm -rf .output node_modules/.cache/nuxt
npm run build:no-restart
rm -f .output/public/index.html

echo "[build-frontend] Verifying server chunk manifest..."
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

echo "[build-frontend] Done."
