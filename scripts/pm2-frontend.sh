#!/usr/bin/env bash
# Démarre le serveur Nuxt prod. Libère le port si un node orphelin (hors PM2)
# bloque encore :3000 après un restart raté (EADDRINUSE en boucle).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# NITRO_PORT (ecosystem) prime ; ne pas utiliser PORT du shell (souvent 3500 = backend).
FRONTEND_PORT="${NITRO_PORT:-3000}"
export PORT="$FRONTEND_PORT"
export NITRO_PORT="$FRONTEND_PORT"
HOST="${NITRO_HOST:-127.0.0.1}"

free_port_if_orphan() {
  local pid
  pid="$(ss -tlnp "sport = :${FRONTEND_PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  # Ne pas tuer notre propre processus ni un enfant direct.
  if [[ "$pid" == "$$" ]] || [[ "$pid" == "$PPID" ]]; then
    return 0
  fi
  echo "[pm2-frontend] Port ${FRONTEND_PORT} occupé par PID ${pid} (orphelin) — arrêt…" >&2
  kill "$pid" 2>/dev/null || true
  sleep 1
  if ss -tlnp "sport = :${FRONTEND_PORT}" 2>/dev/null | grep -q "pid="; then
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi
}

free_port_if_orphan
cd "$ROOT/frontend"

if [[ ! -f .output/server/index.mjs ]]; then
  echo "[pm2-frontend] .output/server/index.mjs introuvable — lancer: make deploy-frontend" >&2
  exit 1
fi

exec node .output/server/index.mjs
