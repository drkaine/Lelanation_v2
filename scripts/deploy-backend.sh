#!/usr/bin/env bash
# Deploy backend + poller: checks first, then PM2 restart, then health verification.
# The processes run TypeScript through tsx without watch: without a restart, new code is never loaded.
# Usage: scripts/deploy-backend.sh [--skip-tests] [--no-poller]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PM2="${PM2:-pm2}"
NPM="${NPM:-npm}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3500/health}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-60}"

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

echo "[deploy-backend] restart: ${apps[*]}"
"$PM2" restart "${apps[@]}" --update-env

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
