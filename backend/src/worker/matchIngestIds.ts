import type { RiotMatchDto } from '../services/RiotHttpClient.js'

/** Canonical `riot_match_id` used in DB: trimmed queue id, else metadata.matchId, else info.gameId string. */
export function resolveRiotMatchIdForIngest(queueRiotMatchId: string, dto: RiotMatchDto): string {
  const fromMeta = dto.metadata?.matchId?.trim() ?? ''
  const fromGameId = dto.info?.gameId != null ? String(dto.info.gameId) : ''
  return queueRiotMatchId.trim() || fromMeta || fromGameId
}
