import type { RiotMatchDto } from '../services/RiotHttpClient.js'

/** Canonical `riot_match_id` used in DB: trimmed queue id, else metadata.matchId, else info.gameId string. */
export function resolveRiotMatchIdForIngest(queueRiotMatchId: string, dto: RiotMatchDto): string {
  const fromMeta = dto.metadata?.matchId?.trim() ?? ''
  const fromGameId = dto.info?.gameId != null ? String(dto.info.gameId) : ''
  return queueRiotMatchId.trim() || fromMeta || fromGameId
}

/**
 * IDs that may appear in `tracked_matches.match_id` vs canonical riot id used in payloads.
 * Prefer the queue / DB `riot_match_id` first so poller-reserved rows get the same key as aggregation.
 */
export function trackedMatchIdAliases(queueMatchId: unknown, canonicalMatchId: string): string[] {
  const queue = String(queueMatchId ?? '').trim()
  const canon = String(canonicalMatchId ?? '').trim()
  const out: string[] = []
  if (queue.length > 0) out.push(queue)
  if (canon.length > 0 && canon !== queue) out.push(canon)
  if (out.length === 0 && canon.length > 0) out.push(canon)
  return out
}
