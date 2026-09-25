import {
  scoreboardDrakeIconByKey,
  scoreboardDrakeIconCdByKey,
  scoreboardObjectiveIconByKey,
  scoreboardObjectiveIconCdByKey,
} from '~/utils/objectiveScoreboardIcons'

export function matchOutcomePct(part: number, total: number): string {
  if (!total) return '0.00'
  return ((part / total) * 100).toFixed(2)
}

export function objectiveIconSrc(key: string): string | undefined {
  return scoreboardObjectiveIconByKey[key]
}

export function drakeIconSrc(key: string): string | undefined {
  return scoreboardDrakeIconByKey[key]
}

export function onObjectiveIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardObjectiveIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}

export function onDrakeIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardDrakeIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}

export function distributionPercentRows(
  dist: Record<string, number> | undefined,
  total: number,
  objectiveKey?: string
): Array<{ count: number; percent: number }> {
  if (!total) return []
  const aggregated = objectiveKey
    ? aggregateObjectiveHistogramDist(objectiveKey, dist)
    : Object.fromEntries(
        Object.entries(dist ?? {}).map(([k, n]) => [parseInt(k, 10) || 0, Number(n)])
      )
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ count, percent }) => count > 0 && percent > 0)
    .sort((a, b) => a.count - b.count)
}

/** Donut: circumference for r=48 */
export const sidesDonutCircumference = 2 * Math.PI * 48
/** Nombre réel de matchs (1 victoire par match, donc blue.wins + red.wins). matchCount côté API = blue.matches + red.matches = 2× matchs. */

/** Max count for horde (void grubs) in distribution: 3 (fold 4+ into 3). */
export const HORDE_DISPLAY_MAX = 3
/** Max count for Rift Herald: 1 per team per game. */

export const RIFT_HERALD_DISPLAY_MAX = 1

/** Regroupe les buckets histogramme (4+ voidgrubs → 3, etc.). */
export function aggregateObjectiveHistogramDist(
  key: string,
  dist: Record<string, number> | undefined
): Record<number, number> {
  const aggregated: Record<number, number> = {}
  if (!dist || typeof dist !== 'object') return aggregated
  const capHorde = key === 'horde'
  const capRiftHerald = key === 'riftHerald'
  for (const [k, n] of Object.entries(dist)) {
    const raw = parseInt(k, 10) || 0
    let displayCount = raw
    if (capHorde && raw > HORDE_DISPLAY_MAX) displayCount = HORDE_DISPLAY_MAX
    else if (capRiftHerald && raw > RIFT_HERALD_DISPLAY_MAX) displayCount = RIFT_HERALD_DISPLAY_MAX
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return aggregated
}

export function formatObjectiveObtentionPercent(games: number, matchCount: number): string {
  if (!matchCount) return '—'
  const pct = games <= 0 ? 0 : Math.round((games / matchCount) * 10000) / 100
  return `${pct.toFixed(2)}%`
}

/** Ordre d’affichage dans le tableau objectifs (obtention / winrate). */
export const objectiveKeysOrdered = [
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const

/** Objectifs avec répartition par nombre de prises (dropdown). Héraut exclu : max 1 / partie. */
const objectiveKeysWithKillDropdown = new Set<string>([
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'horde',
])

export function objectiveHasKillDropdown(key: string): boolean {
  return objectiveKeysWithKillDropdown.has(key)
}
