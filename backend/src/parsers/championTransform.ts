import type { MatchTimelineEventDto } from '../riot/types.js'

/** Riot match-v5 `championTransform`: 0 none, 1 Slayer (Rhaast), 2 Assassin. */
export type ChampionTransform = 0 | 1 | 2

export function normalizeChampionTransform(value: unknown): ChampionTransform {
  const n = Math.trunc(Number(value ?? 0))
  if (n === 1) return 1
  if (n === 2) return 2
  return 0
}

export function championTransformFromEventType(transformType: unknown): ChampionTransform {
  const normalized = String(transformType ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (normalized === 'SLAYER' || normalized === 'RHAAST') return 1
  if (normalized === 'ASSASSIN' || normalized === 'SHADOWASSASSIN') return 2
  return 0
}

export type ChampionTransformInfo = {
  championTransform: ChampionTransform
  /** Ms depuis le début de partie (event CHAMPION_TRANSFORM) ; 0 si aucune transformation. */
  transformTimestampMs: number
}

function truncateMetric(value: unknown): number {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

/**
 * Lit l’event timeline CHAMPION_TRANSFORM ; sinon repli sur `participant.championTransform` (état final).
 */
export function extractChampionTransformInfo(
  events: MatchTimelineEventDto[],
  participantId: number,
  participantEndTransform: unknown
): ChampionTransformInfo {
  let transformTimestampMs = 0
  let transformFromEvent: ChampionTransform | null = null

  for (const event of events) {
    const type = String(event.type ?? '')
      .trim()
      .toUpperCase()
    if (type !== 'CHAMPION_TRANSFORM') continue
    const pid = truncateMetric((event as { participantId?: unknown }).participantId)
    if (pid <= 0 || pid !== participantId) continue
    transformTimestampMs = Math.max(0, truncateMetric(event.timestamp))
    const fromType = championTransformFromEventType(
      (event as { transformType?: unknown }).transformType
    )
    if (fromType > 0) transformFromEvent = fromType
  }

  const endTransform = normalizeChampionTransform(participantEndTransform)
  return {
    championTransform: transformFromEvent ?? endTransform,
    transformTimestampMs,
  }
}
