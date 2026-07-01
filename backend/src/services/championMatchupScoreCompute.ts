/**
 * Shared matchup score (WR delta + lane z-scores) used by champion matchups tab and tier list.
 */
import { computeDelta, matchupScoreFromDeltaAndWeight } from './MatchupTierService.js'
import {
  CHAMPION_MATCHUP_DOMINANCE_KEYS,
  computeLaneDominanceValue,
  type ChampionMatchupDominanceKey,
  type LaneSumRow,
} from './championMatchupLaneProfile.js'

export type MatchupPeerRow = LaneSumRow & {
  champion_id: number
  opponent_champion_id: number
  role: string
  games: number | bigint
  wins: number | bigint
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (values.length < 2) return { mean, std: 0 }
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  return { mean, std: Math.sqrt(Math.max(0, variance)) }
}

function zscore(v: number, mean: number, std: number): number {
  if (!Number.isFinite(v) || !Number.isFinite(mean)) return 0
  if (std <= 1e-9) return 0
  const z = (v - mean) / std
  return Math.max(-3, Math.min(3, z))
}

export function laneZscoresFromRow(
  myRow: LaneSumRow,
  games: number,
  cohort: MatchupPeerRow[],
  selfChampionId: number,
  minPeerGames = 3,
): Record<ChampionMatchupDominanceKey, number> {
  const z = {} as Record<ChampionMatchupDominanceKey, number>
  const peers = cohort.filter(
    (p) => Number(p.champion_id) !== selfChampionId && Number(p.games ?? 0) >= minPeerGames,
  )
  for (const key of CHAMPION_MATCHUP_DOMINANCE_KEYS) {
    const myVal = computeLaneDominanceValue(key, myRow, games)
    const peerVals = peers.map((p) =>
      computeLaneDominanceValue(key, p, Number(p.games ?? 0)),
    )
    const m = meanStd(peerVals)
    z[key] = zscore(myVal, m.mean, m.std)
  }
  return z
}

export function matchupScoreFromSignals(
  wrDelta: number,
  gamesInMatchup: number,
  totalGamesChampion: number,
  z: Record<ChampionMatchupDominanceKey, number>,
): number {
  const baseScore = matchupScoreFromDeltaAndWeight({
    delta: wrDelta,
    gamesInMatchup,
    totalGamesChampion: Math.max(1, totalGamesChampion),
  })
  const laneCore =
    ((z.early ?? 0) +
      (z.laneEconomy ?? 0) +
      (z.kills ?? 0) +
      (z.level ?? 0) +
      (z.cs ?? 0) +
      (z.vision ?? 0)) /
    6
  const contextual =
    ((z.items ?? 0) +
      (z.gank ?? 0) +
      (z.dive ?? 0) +
      (z.roam ?? 0) +
      (z.objectives ?? 0) +
      (z.pressure ?? 0)) /
    6
  const laneComposite = laneCore * 0.7 + contextual * 0.3
  const sampleWeight = Math.min(1, Math.max(0.2, gamesInMatchup / 80))
  const blended = baseScore * 0.65 + laneComposite * sampleWeight * 0.35
  if (!Number.isFinite(blended)) return 0
  return Math.max(-10, Math.min(10, blended))
}

export function computeMatchupWrDelta(
  wrPct: number,
  peers: MatchupPeerRow[],
  selfChampionId: number,
): number {
  let sumOtherGames = 0
  let sumOtherWins = 0
  for (const p of peers) {
    if (Number(p.champion_id) === selfChampionId) continue
    sumOtherGames += Number(p.games ?? 0)
    sumOtherWins += Number(p.wins ?? 0)
  }
  const avgOthersWrPct = sumOtherGames > 0 ? (100 * sumOtherWins) / sumOtherGames : wrPct
  return computeDelta(wrPct, avgOthersWrPct)
}

/** Raw matchup score for one duel (same units as champion matchups tab before ×100 display). */
export function computeSingleMatchupScore(params: {
  myRow: MatchupPeerRow
  peers: MatchupPeerRow[]
  selfChampionId: number
  totalRoleGames: number
  minPeerGames?: number
}): number {
  const { myRow, peers, selfChampionId, totalRoleGames, minPeerGames = 3 } = params
  const g = Number(myRow.games ?? 0)
  const w = Number(myRow.wins ?? 0)
  if (g <= 0) return 0
  const wrPct = (100 * w) / g
  const delta = computeMatchupWrDelta(wrPct, peers, selfChampionId)
  const cohort = peers.filter(
    (p) => Number(p.champion_id) !== selfChampionId && Number(p.games ?? 0) >= minPeerGames,
  )
  const z = laneZscoresFromRow(myRow, g, cohort, selfChampionId, minPeerGames)
  return matchupScoreFromSignals(delta, g, totalRoleGames, z)
}

/**
 * Champion note = sum of per-opponent matchup scores on the selected role
 * (raw score; tier list front multiplies by 100 for display).
 */
export function computeChampionMatchupNotesBatch(
  champions: Array<{ championId: number; mainRole: string; roleGames: number }>,
  vsRows: MatchupPeerRow[],
  normalizeRole: (role: string) => string,
): Map<number, number> {
  const champById = new Map(
    champions.map((c) => [
      c.championId,
      { mainRole: normalizeRole(c.mainRole), roleGames: Math.max(1, c.roleGames) },
    ]),
  )

  const byOppRole = new Map<string, MatchupPeerRow[]>()
  for (const row of vsRows) {
    const k = `${Number(row.opponent_champion_id)}|${normalizeRole(String(row.role ?? ''))}`
    const list = byOppRole.get(k) ?? []
    list.push(row)
    byOppRole.set(k, list)
  }

  const notes = new Map<number, number>()
  for (const row of vsRows) {
    const championId = Number(row.champion_id)
    const champ = champById.get(championId)
    if (!champ) continue
    const role = normalizeRole(String(row.role ?? ''))
    if (role !== champ.mainRole) continue

    const opp = Number(row.opponent_champion_id)
    const peers = byOppRole.get(`${opp}|${role}`) ?? []
    const score = computeSingleMatchupScore({
      myRow: row,
      peers,
      selfChampionId: championId,
      totalRoleGames: champ.roleGames,
    })
    notes.set(championId, (notes.get(championId) ?? 0) + score)
  }

  return notes
}

export function computeChampionMatchupNoteFromVsRows(
  championId: number,
  mainRole: string,
  roleGames: number,
  vsRows: MatchupPeerRow[],
  normalizeRole: (role: string) => string,
): number {
  const notes = computeChampionMatchupNotesBatch(
    [{ championId, mainRole, roleGames }],
    vsRows,
    normalizeRole,
  )
  return notes.get(championId) ?? 0
}
