/**
 * Botlane duo vs duo: tier-style note per (ally ADC+support vs enemy ADC+support),
 * comparing winrate vs the same enemy botlane to other allied duos (delta method, aligned with TierListService).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'
import { deltaToMatchupBaseScore } from './MatchupTierService.js'

export type BotlaneVsTier = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

/** Minimum games per row (duo overall or duo-vs-duo matchup) for tier-list tables. */
export const MIN_BOTLANE_TIERLIST_GAMES = 10

const TIER_PERCENTILES: Array<{ tier: BotlaneVsTier; maxPct: number }> = [
  { tier: 'S+', maxPct: 5 },
  { tier: 'S', maxPct: 10 },
  { tier: 'A', maxPct: 25 },
  { tier: 'B', maxPct: 50 },
  { tier: 'C', maxPct: 75 },
  { tier: 'D', maxPct: 100 },
]

function assignTier(sortedByTierScore: Array<{ tierScore: number }>): BotlaneVsTier[] {
  const n = sortedByTierScore.length
  if (n === 0) return []
  const tiers: BotlaneVsTier[] = []
  const sameScore = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9
  for (let i = 0; i < n; i++) {
    if (i > 0 && sameScore(sortedByTierScore[i]!.tierScore, sortedByTierScore[i - 1]!.tierScore)) {
      tiers.push(tiers[i - 1]!)
      continue
    }
    const pct = ((i + 1) / n) * 100
    let t: BotlaneVsTier = 'D'
    for (const { tier, maxPct } of TIER_PERCENTILES) {
      if (pct <= maxPct) {
        t = tier
        break
      }
    }
    tiers.push(t)
  }
  return tiers
}

function ensureTierCoverage(tiers: BotlaneVsTier[], n: number): BotlaneVsTier[] {
  if (n < 6) return tiers
  const out = [...tiers]
  const desired: BotlaneVsTier[] = ['S+', 'S', 'A', 'B', 'C', 'D']
  const targetIndexForTier = (tier: BotlaneVsTier): number => {
    if (tier === 'S+') return 0
    if (tier === 'S') return Math.min(n - 1, Math.max(1, Math.ceil(n * 0.1) - 1))
    if (tier === 'A') return Math.min(n - 1, Math.max(2, Math.ceil(n * 0.25) - 1))
    if (tier === 'B') return Math.min(n - 1, Math.max(3, Math.ceil(n * 0.5) - 1))
    if (tier === 'C') return Math.min(n - 1, Math.max(4, Math.ceil(n * 0.75) - 1))
    return n - 1
  }
  for (const tier of desired) {
    if (out.includes(tier)) continue
    out[targetIndexForTier(tier)] = tier
  }
  return out
}

function buildBdMatchCond(version?: string | string[] | null, rankTier?: string | string[] | null): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier)
    .map((r) => r.toUpperCase())
    .filter((r) => r && r !== 'ALL' && r !== '*')
  if (versions.length === 1) {
    parts.push(
      `bd.game_version LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`,
    )
  } else if (versions.length > 1) {
    parts.push(`bd.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (ranks.length === 1) parts.push(`bd.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) parts.push(`bd.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  return parts.length > 0 ? parts.join(' AND ') : '1=1'
}

export interface BotlaneVsDuoRow {
  rank: number
  adcId: number
  supportId: number
  oppAdcId: number
  oppSupportId: number
  games: number
  wins: number
  winrate: number
  /** Winrate % minus simple mean of other duos' winrate % vs the same enemy botlane (same-side comparison). */
  deltaVsPeersPp: number | null
  /** Matchup note used for tier (tier-list style: global recenter of deltas, base score × games/ally-duo-total). */
  note: number
  tier: BotlaneVsTier
}

export interface GetBotlaneVsBotlaneResult {
  version: string | null
  rankTier: string | null
  rows: BotlaneVsDuoRow[]
}

export async function getBotlaneDuoVsDuoTierTable(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined,
): Promise<GetBotlaneVsBotlaneResult | null> {
  if (!isDatabaseConfigured()) return null

  const fromSql = await matchVersionedAggFrom('agg_botlane_duo_vs_duo_stats', version, 'bd')
  const whereSql = buildBdMatchCond(version, rankTier)

  const raw = await queryRawUnsafe<
    Array<{
      adc_id: number
      support_id: number
      opp_adc_id: number
      opp_support_id: number
      wins: bigint
      games: bigint
    }>
  >(`
    SELECT
      bd.adc_id,
      bd.support_id,
      bd.opp_adc_id,
      bd.opp_support_id,
      SUM(bd.count_win)::bigint AS wins,
      SUM(bd.count_game)::bigint AS games
    FROM ${fromSql}
    WHERE ${whereSql}
    GROUP BY bd.adc_id, bd.support_id, bd.opp_adc_id, bd.opp_support_id
    HAVING SUM(bd.count_game) >= ${MIN_BOTLANE_TIERLIST_GAMES}
  `)

  type Cell = {
    adcId: number
    supportId: number
    oppAdcId: number
    oppSupportId: number
    games: number
    wins: number
    winrate: number
  }

  const cells: Cell[] = raw
    .map((r) => {
      const g = Number(r.games ?? 0)
      const w = Number(r.wins ?? 0)
      return {
        adcId: Number(r.adc_id),
        supportId: Number(r.support_id),
        oppAdcId: Number(r.opp_adc_id),
        oppSupportId: Number(r.opp_support_id),
        games: g,
        wins: w,
        winrate: g > 0 ? w / g : 0,
      }
    })
    .filter((c) => c.games >= MIN_BOTLANE_TIERLIST_GAMES)

  const allyKey = (c: Cell) => `${c.adcId}:${c.supportId}`
  const oppKey = (c: Cell) => `${c.oppAdcId}:${c.oppSupportId}`

  const allyTotalGames = new Map<string, number>()
  for (const c of cells) {
    const k = allyKey(c)
    allyTotalGames.set(k, (allyTotalGames.get(k) ?? 0) + c.games)
  }

  const byOpp = new Map<string, Cell[]>()
  for (const c of cells) {
    const k = oppKey(c)
    const list = byOpp.get(k) ?? []
    list.push(c)
    byOpp.set(k, list)
  }

  type RawDelta = { cell: Cell; delta: number; games: number }
  const rawDeltas: RawDelta[] = []

  for (const [, group] of byOpp) {
    if (group.length < 2) continue
    for (const cell of group) {
      const peers = group.filter(
        (p) => p.adcId !== cell.adcId || p.supportId !== cell.supportId,
      )
      if (peers.length === 0) continue
      let sum = 0
      for (const p of peers) sum += p.winrate * 100
      const avgPeerWrPct = sum / peers.length
      const delta = cell.winrate * 100 - avgPeerWrPct
      rawDeltas.push({ cell, delta, games: cell.games })
    }
  }

  let recenter = 0
  if (rawDeltas.length > 0) {
    let weightSum = 0
    let weightedDeltaSum = 0
    for (const d of rawDeltas) {
      weightSum += d.games
      weightedDeltaSum += d.delta * d.games
    }
    recenter = weightSum > 0 ? weightedDeltaSum / weightSum : 0
  }

  const deltaByCellKey = new Map<string, number>()
  for (const d of rawDeltas) {
    const key = `${d.cell.adcId}:${d.cell.supportId}:${d.cell.oppAdcId}:${d.cell.oppSupportId}`
    deltaByCellKey.set(key, d.delta)
  }

  const scored: Array<Cell & { deltaVsPeersPp: number | null; note: number; tierScore: number }> = cells.map(
    (cell) => {
      const key = `${cell.adcId}:${cell.supportId}:${cell.oppAdcId}:${cell.oppSupportId}`
      const rawDelta = deltaByCellKey.get(key) ?? null
      const allyTot = allyTotalGames.get(allyKey(cell)) ?? 0
      let note: number
      if (rawDelta != null && allyTot > 0) {
        const centered = rawDelta - recenter
        const base = deltaToMatchupBaseScore(centered)
        note = base * (cell.games / allyTot)
      } else {
        note = (cell.winrate - 0.5) * Math.sqrt(Math.max(1, cell.games))
      }
      return {
        ...cell,
        deltaVsPeersPp: rawDelta,
        note: Number(note.toFixed(4)),
        tierScore: Number(note.toFixed(4)),
      }
    },
  )

  scored.sort((a, b) => b.tierScore - a.tierScore)
  const n = scored.length
  const tiers =
    n >= 6 ? ensureTierCoverage(assignTier(scored.map((r) => ({ tierScore: r.tierScore }))), n) : assignTier(scored.map((r) => ({ tierScore: r.tierScore })))

  const rows: BotlaneVsDuoRow[] = scored.map((r, i) => ({
    rank: i + 1,
    adcId: r.adcId,
    supportId: r.supportId,
    oppAdcId: r.oppAdcId,
    oppSupportId: r.oppSupportId,
    games: r.games,
    wins: r.wins,
    winrate: r.winrate,
    deltaVsPeersPp: r.deltaVsPeersPp,
    note: r.note,
    tier: tiers[i] ?? 'D',
  }))

  const vKey = toQueryStringArrayParam(version).join(',') || null
  const rKey = toQueryStringArrayParam(rankTier).map((x) => x.toUpperCase()).join(',') || null

  return { version: vKey, rankTier: rKey, rows }
}

/**
 * Tier-style ranking of allied botlane duos (ADC + support), aggregated over all enemy botlanes.
 * Delta column = winrate % minus global mean duo winrate % (unrecentered); note/tier use recentered deltas (same spirit as vs-duo).
 */
export async function getBotlaneDuoOverallTierTable(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined,
): Promise<GetBotlaneVsBotlaneResult | null> {
  if (!isDatabaseConfigured()) return null

  const fromSql = await matchVersionedAggFrom('agg_botlane_duo_vs_duo_stats', version, 'bd')
  const whereSql = buildBdMatchCond(version, rankTier)

  const raw = await queryRawUnsafe<
    Array<{
      adc_id: number
      support_id: number
      wins: bigint
      games: bigint
    }>
  >(`
    SELECT
      bd.adc_id,
      bd.support_id,
      SUM(bd.count_win)::bigint AS wins,
      SUM(bd.count_game)::bigint AS games
    FROM ${fromSql}
    WHERE ${whereSql}
    GROUP BY bd.adc_id, bd.support_id
    HAVING SUM(bd.count_game) >= ${MIN_BOTLANE_TIERLIST_GAMES}
  `)

  type DuoCell = {
    adcId: number
    supportId: number
    games: number
    wins: number
    winrate: number
  }

  const cells: DuoCell[] = raw
    .map((r) => {
      const g = Number(r.games ?? 0)
      const w = Number(r.wins ?? 0)
      return {
        adcId: Number(r.adc_id),
        supportId: Number(r.support_id),
        games: g,
        wins: w,
        winrate: g > 0 ? w / g : 0,
      }
    })
    .filter((c) => c.games >= MIN_BOTLANE_TIERLIST_GAMES)

  if (cells.length === 0) {
    const vKey = toQueryStringArrayParam(version).join(',') || null
    const rKey = toQueryStringArrayParam(rankTier).map((x) => x.toUpperCase()).join(',') || null
    return { version: vKey, rankTier: rKey, rows: [] }
  }

  const totalGamesAll = cells.reduce((s, c) => s + c.games, 0)
  const totalWinsAll = cells.reduce((s, c) => s + c.wins, 0)
  const globalWr = totalGamesAll > 0 ? totalWinsAll / totalGamesAll : 0.5

  type RawDelta = { cell: DuoCell; deltaRaw: number; games: number }
  const rawDeltas: RawDelta[] = cells.map((cell) => ({
    cell,
    deltaRaw: cell.winrate * 100 - globalWr * 100,
    games: cell.games,
  }))

  let recenter = 0
  if (rawDeltas.length > 0) {
    let weightSum = 0
    let weightedDeltaSum = 0
    for (const d of rawDeltas) {
      weightSum += d.games
      weightedDeltaSum += d.deltaRaw * d.games
    }
    recenter = weightSum > 0 ? weightedDeltaSum / weightSum : 0
  }

  const scored = rawDeltas.map(({ cell, deltaRaw, games }) => {
    const centered = deltaRaw - recenter
    const base = deltaToMatchupBaseScore(centered)
    const note =
      totalGamesAll > 0 ? Number((base * (games / totalGamesAll)).toFixed(4)) : Number(base.toFixed(4))
    return {
      adcId: cell.adcId,
      supportId: cell.supportId,
      oppAdcId: 0,
      oppSupportId: 0,
      games: cell.games,
      wins: cell.wins,
      winrate: cell.winrate,
      deltaVsPeersPp: deltaRaw,
      note,
      tierScore: note,
    }
  })

  scored.sort((a, b) => b.tierScore - a.tierScore)
  const n = scored.length
  const tiers =
    n >= 6
      ? ensureTierCoverage(assignTier(scored.map((r) => ({ tierScore: r.tierScore }))), n)
      : assignTier(scored.map((r) => ({ tierScore: r.tierScore })))

  const rows: BotlaneVsDuoRow[] = scored.map((r, i) => ({
    rank: i + 1,
    adcId: r.adcId,
    supportId: r.supportId,
    oppAdcId: r.oppAdcId,
    oppSupportId: r.oppSupportId,
    games: r.games,
    wins: r.wins,
    winrate: r.winrate,
    deltaVsPeersPp: r.deltaVsPeersPp,
    note: r.note,
    tier: tiers[i] ?? 'D',
  }))

  const vKey = toQueryStringArrayParam(version).join(',') || null
  const rKey = toQueryStringArrayParam(rankTier).map((x) => x.toUpperCase()).join(',') || null

  return { version: vKey, rankTier: rKey, rows }
}
