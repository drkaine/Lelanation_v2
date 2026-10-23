#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"

# Node version from .nvmrc, whatever the calling shell's PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  \. "$NVM_DIR/nvm.sh"
  nvm use --silent "$(cat "$ROOT/.nvmrc")"
  set -u
fi

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

echo "[build-frontend] Verifying server chunk imports..."
# Every relative import of every server chunk must exist (chunk names change between Nuxt versions).
node -e "
const fs = require('fs')
const path = require('path')
const files = fs.readdirSync('.output/server', { recursive: true })
  .filter(f => f.endsWith('.mjs') && !f.startsWith('node_modules'))
  .map(f => path.join('.output/server', f))
const pattern = /(?:import\\(|from )'(\\.\\.?\\/[^']+)'/g
let count = 0
const missing = []
for (const file of files) {
  for (const [, rel] of fs.readFileSync(file, 'utf8').matchAll(pattern)) {
    count++
    if (!fs.existsSync(path.join(path.dirname(file), rel))) missing.push(file + ' -> ' + rel)
  }
}
if (!count) {
  console.error('No relative imports found: server output layout changed?')
  process.exit(1)
}
if (missing.length) {
  console.error('Missing chunks:', missing.slice(0, 10).join(', '))
  process.exit(1)
}
console.log('OK:', count, 'relative imports in', files.length, 'files')
"

echo "[build-frontend] Done."
