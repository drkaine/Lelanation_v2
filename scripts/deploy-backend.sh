#!/usr/bin/env bash
# Deploy backend + poller: checks, compiled bundle (dist/app), PM2 restart, health verification.
# The processes run a bundle built at deploy time: without this script, new code is never loaded.
# Usage: scripts/deploy-backend.sh [--skip-tests] [--no-poller]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PM2="${PM2:-pm2}"
NPM="${NPM:-npm}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3500/health}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-60}"
ECOSYSTEM="${ECOSYSTEM:-$ROOT/ecosystem.config.js}"

skip_tests=0
apps=(lelanation-backend lelanation-poller-v2)
for arg in "$@"; do
  case "$arg" in
    --skip-tests) skip_tests=1 ;;
    --no-poller) apps=(lelanation-backend) ;;
    *) echo "[deploy-backend] unknown option: $arg" >&2; exit 2 ;;
  esac
done

echo "[deploy-backend] typecheck…"
"$NPM" --prefix "$ROOT/backend" run typecheck

if [[ $skip_tests -eq 0 ]]; then
  echo "[deploy-backend] tests…"
  "$NPM" --prefix "$ROOT/backend" run test:precommit
fi

echo "[deploy-backend] build…"
"$NPM" --prefix "$ROOT/backend" run build

# delete + start (not restart): PM2 only re-reads script/interpreter from the ecosystem on start.
echo "[deploy-backend] restart: ${apps[*]}"
for app in "${apps[@]}"; do
  "$PM2" delete "$app" >/dev/null 2>&1 || true
  "$PM2" start "$ECOSYSTEM" --only "$app" --update-env
done
"$PM2" save >/dev/null

for app in "${apps[@]}"; do
  status="$("$PM2" jlist | node -e "
    let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
      const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?.pm2_env?.status??'missing')})" "$app")"
  if [[ "$status" != "online" ]]; then
    echo "[deploy-backend] ✗ $app status=$status" >&2
    exit 1
  fi
done

echo "[deploy-backend] health check $HEALTH_URL…"
for ((i = 0; i < HEALTH_TIMEOUT_S; i++)); do
  if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy-backend] ✓ deployed ($(git -C "$ROOT" rev-parse --short HEAD))"
    exit 0
  fi
  sleep 1
done
echo "[deploy-backend] ✗ $HEALTH_URL not healthy after ${HEALTH_TIMEOUT_S}s" >&2
exit 1
