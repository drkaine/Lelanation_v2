#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
LOCK="$FRONTEND/.deploy-frontend.lock"

# Node version from .nvmrc, whatever the calling shell's PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  \. "$NVM_DIR/nvm.sh"
  nvm use --silent "$(cat "$ROOT/.nvmrc")"
  set -u
fi

cleanup() {
  local code=$?
  rm -f "$LOCK"
  # A failed deploy must not leave the site down when a usable build exists.
  if [[ $code -ne 0 && -f "$FRONTEND/.output/server/index.mjs" ]]; then
    echo "[deploy-frontend] Failed (exit $code): restarting frontend on the current build." >&2
    pm2 restart lelanation-frontend >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[deploy-frontend] Stopping PM2 app..."
pm2 stop lelanation-frontend >/dev/null 2>&1 || true

# Laisser PM2 terminer le processus avant de supprimer .output (évite autorestart → ENOENT).
for _ in $(seq 1 30); do
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
  if [[ "$status" != "online" && "$status" != "launching" ]]; then
    break
  fi
  sleep 0.5
done

touch "$LOCK"

echo "[deploy-frontend] Building Nuxt…"
bash "$ROOT/scripts/build-frontend.sh"

echo "[deploy-frontend] Starting PM2 app..."
if pm2 describe lelanation-frontend >/dev/null 2>&1; then
  pm2 restart lelanation-frontend --update-env
else
  pm2 start "$ROOT/ecosystem.config.js" --only lelanation-frontend
fi

echo "[deploy-frontend] Done."
