/** Parties comptées pour les ordres de compétences (aligné surrender stats « avant 15 min »). */
export const CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS = 15 * 60 * 1000

/** Nombre de montées de sort dans une clé `1-2-1-3-…`. */
export function spellOrderLevelCount(spellOrder: string): number {
  const s = String(spellOrder ?? '').trim()
  if (!s) return 0
  return s.split('-').filter((part) => part.length > 0).length
}

/**
 * Estime le timestamp (ms) de la dernière montée Q/W/E/R à partir de la somme des timestamps.
 * Série approximative 0 → T_last : somme ≈ n × T_last / 2 ⇒ T_last ≈ 2 × somme / n.
 */
export function estimatedLastSpellLevelUpMs(
  sumTimestampMs: number,
  levelCount: number
): number {
  const n = Math.max(1, Math.trunc(levelCount))
  const sum = Math.max(0, Number(sumTimestampMs ?? 0))
  return (2 * sum) / n
}

export function spellOrderMeetsMinDuration(
  sumTimestampMs: number,
  games: number,
  spellOrder: string,
  minDurationMs: number = CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS
): boolean {
  const g = Math.max(0, Math.trunc(games))
  if (g <= 0) return false
  const levels = spellOrderLevelCount(spellOrder)
  if (levels <= 0) return false
  const avgSum = Number(sumTimestampMs ?? 0) / g
  return estimatedLastSpellLevelUpMs(avgSum, levels) >= minDurationMs
}
