/**
 * Lane score of a duo (synergy tab): z-scores of six lane axes against the other champions
 * playing with the same ally, from per-game averages of the `sum_*` columns.
 */
import type { ChampionMatchupCoreDominanceKey } from './championMatchupLaneProfile.js'
import { meanStd } from './championMatchupScoreCompute.js'

/**
 * Unlike the matchup z-score, not clamped and a flat cohort divides by 1e-9 (kept as is:
 * the synergy lane scores depend on it).
 */
function synergyZscore(v: number, mean: number, std: number): number {
  if (!Number.isFinite(v) || !Number.isFinite(mean)) return 0
  const s = std > 1e-9 ? std : 1e-9
  return (v - mean) / s
}

export type SynergyLaneSums = {
  games: number | bigint
  sum_level: number
  sum_kill_def: number
  sum_cs: number
  sum_vision: number
  sum_laning: number
  sum_early: number
}

/** Axis value per game (`kills` is negated deaths: higher is better). */
const AXES: Array<[ChampionMatchupCoreDominanceKey, (r: SynergyLaneSums, games: number) => number]> = [
  ['level', (r, g) => Number(r.sum_level) / g],
  ['kills', (r, g) => -Number(r.sum_kill_def) / g],
  ['cs', (r, g) => Number(r.sum_cs) / g],
  ['vision', (r, g) => Number(r.sum_vision) / g],
  ['laneEconomy', (r, g) => Number(r.sum_laning) / g],
  ['early', (r, g) => Number(r.sum_early) / g],
]

const MIN_PEER_GAMES = 3

/** z-score per axis vs peers (self and peers under 3 games excluded) and the cohort size. */
export function synergyLaneZ(
  my: SynergyLaneSums,
  peers: Array<SynergyLaneSums & { champion_id: number }>,
  championId: number
): { z: Record<ChampionMatchupCoreDominanceKey, number>; cohortSize: number } {
  const cohort = peers.filter(
    (p) => Number(p.champion_id) !== championId && Number(p.games ?? 0) >= MIN_PEER_GAMES
  )
  const games = Number(my.games ?? 0)
  const z = {} as Record<ChampionMatchupCoreDominanceKey, number>
  for (const [key, axis] of AXES) {
    const myValue = games > 0 ? axis(my, games) : 0
    const peerValues = cohort.map((p) => {
      const gg = Number(p.games ?? 0)
      return gg > 0 ? axis(p, gg) : 0
    })
    const m = meanStd(peerValues)
    z[key] = synergyZscore(myValue, m.mean, m.std)
  }
  return { z, cohortSize: cohort.length }
}

/** Mean of the axis z-scores, 2 decimals (0 when none is finite). */
export function synergyLaneScore(z: Record<ChampionMatchupCoreDominanceKey, number>): number {
  const components = AXES.map(([key]) => z[key]).filter(Number.isFinite)
  if (components.length === 0) return 0
  return Number((components.reduce((a, b) => a + b, 0) / components.length).toFixed(2))
}
