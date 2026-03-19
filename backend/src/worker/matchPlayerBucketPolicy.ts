/**
 * Politique des lignes `match_player_bucket` : une ligne par palier de jeu en **minutes**,
 * uniquement aux minutes 5, 10, 15, … (pas de minute 0–4, pas de pas d’1 minute).
 * Aligné sur les frames timeline Riot (~1 frame / minute) : on ne garde que les frames
 * dont la minute est multiple de 5 et >= 5.
 */
export const MATCH_PLAYER_BUCKET_FIRST_MINUTE = 5
export const MATCH_PLAYER_BUCKET_STEP_MINUTES = 5

/** Seuil sur `matchs.game_duration` (secondes, API match-v5) : en dessous, aucun bucket 5 min n’est attendu. */
export const MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS = MATCH_PLAYER_BUCKET_FIRST_MINUTE * 60

export function isKeptMatchPlayerDurationBucket(minute: number): boolean {
  if (!Number.isFinite(minute)) return false
  const m = Math.trunc(minute)
  return m >= MATCH_PLAYER_BUCKET_FIRST_MINUTE && m % MATCH_PLAYER_BUCKET_STEP_MINUTES === 0
}

/** timestamp Riot timeline (ms) → minute de jeu entière (0, 1, 2, …). */
export function timelineTimestampMsToGameMinute(timestampMs: number): number {
  if (!Number.isFinite(timestampMs)) return 0
  return Math.floor(Math.trunc(timestampMs) / 60_000)
}
