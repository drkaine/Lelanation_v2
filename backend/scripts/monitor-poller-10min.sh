#!/usr/bin/env bash
set -euo pipefail
OUT_LOG="/home/ubuntu/dev/Lelanation_v2/logs/poller-10min-monitor.log"
POLLER_LOG="/home/ubuntu/dev/Lelanation_v2/logs/poller-v2-out.log"
SNAPSHOT="/home/ubuntu/dev/Lelanation_v2/backend/poller-observability.json"
START_LINE=$(wc -l < "$POLLER_LOG" 2>/dev/null || echo 0)

echo "=== Poller 10min monitor started $(date -Is) ===" | tee "$OUT_LOG"
echo "baseline_log_line=$START_LINE" | tee -a "$OUT_LOG"

for i in $(seq 1 20); do
  sleep 30
  echo "--- checkpoint $i/20 @ $(date -Is) ---" | tee -a "$OUT_LOG"
  pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="lelanation-poller-v2") | "pm2_status=\(.pm2_env.status) uptime=\(.pm2_env.pm_uptime) restarts=\(.pm2_env.restart_time)"' 2>/dev/null | tee -a "$OUT_LOG" || true
  tail -n +"$START_LINE" "$POLLER_LOG" 2>/dev/null | rg -c '"component":"live-tokens"' || echo "live_tokens=0" | tee -a "$OUT_LOG"
  tail -n +"$START_LINE" "$POLLER_LOG" 2>/dev/null | rg '"poll session complete"' | tail -1 | tee -a "$OUT_LOG" || true
  tail -n +"$START_LINE" "$POLLER_LOG" 2>/dev/null | rg '"component":"AlertDetector"' | tail -2 | tee -a "$OUT_LOG" || true
done

echo "=== Summary $(date -Is) ===" | tee -a "$OUT_LOG"
SEGMENT=$(tail -n +"$START_LINE" "$POLLER_LOG" 2>/dev/null || true)
echo "live_tokens_count=$(echo "$SEGMENT" | rg -c '"component":"live-tokens"' || true)" | tee -a "$OUT_LOG"
echo "poll_sessions=$(echo "$SEGMENT" | rg -c 'poll session complete' || true)" | tee -a "$OUT_LOG"
echo "aggregate_reports=$(echo "$SEGMENT" | rg -c 'aggregate snapshot' || true)" | tee -a "$OUT_LOG"
echo "alerts=$(echo "$SEGMENT" | rg -c '"component":"AlertDetector"' || true)" | tee -a "$OUT_LOG"
echo "ingestion_queued=$(echo "$SEGMENT" | rg -c 'match queued for ingestion' || true)" | tee -a "$OUT_LOG"
echo "matches_fetched=$(echo "$SEGMENT" | rg 'poll session complete' | rg -o 'matchesFetched":[0-9]+' | awk -F: '{s+=$2} END {print s+0}')" | tee -a "$OUT_LOG"
if [[ -f "$SNAPSHOT" ]]; then
  echo "snapshot_bytes=$(wc -c < "$SNAPSHOT")" | tee -a "$OUT_LOG"
  jq -r '.window, .gateway.total_requests, .poll.players_polled, .poll.matches_fetched_success, .ingestion.matches_ingested, (.active_alerts | length)' "$SNAPSHOT" 2>/dev/null | paste - - - - - - | head -3 | tee -a "$OUT_LOG" || true
fi
echo "last_live_token:" | tee -a "$OUT_LOG"
echo "$SEGMENT" | rg '"component":"live-tokens"' | tail -1 | tee -a "$OUT_LOG" || true
echo "last_session:" | tee -a "$OUT_LOG"
echo "$SEGMENT" | rg 'poll session complete' | tail -1 | tee -a "$OUT_LOG" || true
echo "=== Monitor finished $(date -Is) ===" | tee -a "$OUT_LOG"
