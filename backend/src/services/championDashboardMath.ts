/**
 * Calculs purs du dashboard champion : percentiles vs les autres champions
 * et scores des 8 axes du radar « Playstyle ».
 */

export const DASHBOARD_METRIC_KEYS = [
  'firstBlood',
  'deaths',
  'kills',
  'assists',
  'damage',
  'kda',
  'turrets',
  'wardsPlaced',
  'visionScore',
  'wardsKilled',
  'dragons',
  'barons',
  'heal',
  'tanked',
  'mitigated',
  'csPerMin',
  'gold',
  'totalCs',
] as const

export type DashboardMetricKey = (typeof DASHBOARD_METRIC_KEYS)[number]

export const DASHBOARD_RADAR_AXES = [
  'damage',
  'tank',
  'sustain',
  'aggro',
  'team',
  'economy',
  'vision',
  'objects',
] as const

export type DashboardRadarAxis = (typeof DASHBOARD_RADAR_AXES)[number]

/** Métriques dont la moyenne des percentiles forme chaque axe. */
export const RADAR_AXIS_METRICS: Record<DashboardRadarAxis, DashboardMetricKey[]> = {
  damage: ['damage'],
  tank: ['tanked', 'mitigated'],
  sustain: ['heal'],
  aggro: ['kills', 'firstBlood'],
  team: ['assists'],
  economy: ['gold', 'csPerMin'],
  vision: ['visionScore', 'wardsPlaced'],
  objects: ['turrets', 'dragons', 'barons'],
}

export type DashboardMetricValues = Record<DashboardMetricKey, number>

/**
 * Percentile (0–100) de `value` parmi `population` : part des valeurs strictement
 * inférieures, les égalités comptant pour moitié. Population vide → 0.
 */
export function percentileRank(population: readonly number[], value: number): number {
  if (population.length === 0) return 0
  let below = 0
  let equal = 0
  for (const v of population) {
    if (v < value) below += 1
    else if (v === value) equal += 1
  }
  return Math.round(((below + equal / 2) / population.length) * 1000) / 10
}

export function metricPercentiles(
  target: DashboardMetricValues,
  population: readonly DashboardMetricValues[]
): DashboardMetricValues {
  const out = {} as DashboardMetricValues
  for (const key of DASHBOARD_METRIC_KEYS) {
    out[key] = percentileRank(
      population.map(p => p[key]),
      target[key]
    )
  }
  return out
}

/** « Deaths » n'entre dans aucun axe : moins de morts n'est pas un style de jeu. */
export function radarScores(percentiles: DashboardMetricValues): Record<DashboardRadarAxis, number> {
  const out = {} as Record<DashboardRadarAxis, number>
  for (const axis of DASHBOARD_RADAR_AXES) {
    const keys = RADAR_AXIS_METRICS[axis]
    const sum = keys.reduce((acc, k) => acc + percentiles[k], 0)
    out[axis] = Math.round((sum / keys.length) * 10) / 10
  }
  return out
}

/** KDA = (K + A) / max(1, D), calculé sur les totaux (pas sur des moyennes de moyennes). */
export function kdaRatio(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(1, deaths)
}

/** Sous-lignes (dropdown) d'une métrique : dégâts par type, kills / morts en gank et dive. */
export type DashboardBreakdownRow = { key: string; value: number }

export type DashboardBreakdowns = {
  kills: DashboardBreakdownRow[]
  deaths: DashboardBreakdownRow[]
  assists: DashboardBreakdownRow[]
  damage: DashboardBreakdownRow[]
  tanked: DashboardBreakdownRow[]
}

type DamageTypeSums = { games: number; physical: number; magic: number; true: number }

export type DashboardBreakdownSums = {
  damage: DamageTypeSums
  tanked: DamageTypeSums
  /** Événements de lane avant 15 min (`champion_vs_stats`) : leur propre nombre de parties. */
  laneEvents: {
    games: number
    killByGank: number
    killByDive: number
    deathByGank: number
    deathByDive: number
  }
}

function avg(sum: number, games: number, digits: number): number {
  if (games <= 0) return 0
  const f = 10 ** digits
  return Math.round((sum / games) * f) / f
}

function damageTypeRows(s: DamageTypeSums): DashboardBreakdownRow[] {
  return [
    { key: 'physical', value: avg(s.physical, s.games, 0) },
    { key: 'magic', value: avg(s.magic, s.games, 0) },
    { key: 'true', value: avg(s.true, s.games, 0) },
  ]
}

/**
 * `kill_by_gank` / `kill_by_dive` comptent les participations (kill ou assist) :
 * la même paire de sous-lignes sert pour Kills et Assists.
 */
export function dashboardBreakdowns(s: DashboardBreakdownSums): DashboardBreakdowns {
  const e = s.laneEvents
  const participations = [
    { key: 'gank', value: avg(e.killByGank, e.games, 2) },
    { key: 'dive', value: avg(e.killByDive, e.games, 2) },
  ]
  return {
    kills: participations,
    assists: participations.map(r => ({ ...r })),
    deaths: [
      { key: 'gank', value: avg(e.deathByGank, e.games, 2) },
      { key: 'dive', value: avg(e.deathByDive, e.games, 2) },
    ],
    damage: damageTypeRows(s.damage),
    tanked: damageTypeRows(s.tanked),
  }
}
