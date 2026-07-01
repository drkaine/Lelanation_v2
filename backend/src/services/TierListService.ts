/**
 * Tier list service: one row per champion (all ranks or GM+Challenger slice).
 * Aggregates from `agg_champion_core_stats` (live + `archive_agg_*` via matchVersionedAggFrom); stats = rôle le plus joué par défaut.
 * Avec option `role`, stats = ce rôle pour tout champion ayant assez de games dessus (même si ce n’est pas son main).
 * Tier score: somme des scores matchup (WR delta + signaux lane), alignée sur l’onglet matchups champion.
 */
import { queryRawUnsafe } from '../db/query.js'
import { bansPerChampionFromMvRows } from '../utils/statsMvBanAggregate.js'
import { isDatabaseConfigured } from '../db/query.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor, sqlAggUnionAllLiveAndArchives } from './statsAggArchive.js'
import { buildChampionMatchupLaneSumSelect, type LaneSumRow } from './championMatchupLaneProfile.js'
import {
  computeChampionMatchupNotesBatch,
  type MatchupPeerRow,
} from './championMatchupScoreCompute.js'

const MIN_GAMES = 1
const MIN_PICKRATE = 0.0001

const TIER_PERCENTILES: Array<{ tier: Tier; maxPct: number }> = [
  { tier: 'S+', maxPct: 5 },
  { tier: 'S', maxPct: 10 },
  { tier: 'A', maxPct: 25 },
  { tier: 'B', maxPct: 50 },
  { tier: 'C', maxPct: 75 },
  { tier: 'D', maxPct: 100 },
]

export type Tier = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

export interface TierListRow {
  rank: number
  championId: number
  tier: Tier
  mainRole: string
  mainRolePct: number
  winrate: number
  pickrate: number
  banrate: number
  pbi: number // Backward-compatible field name; now stores matchup score note.
  games: number
}

export interface GetTierListOptions {
  patch?: string | null
  platformId?: string | null
  rankTier?: 'all' | string | string[] | null
  /** Si défini (TOP, JUNGLE, MIDDLE, …) : une ligne par champion ayant assez de games sur ce rôle, stats = ce rôle (pas seulement le rôle le plus joué). */
  role?: string | null
}

export interface GetTierListResult {
  patch: string
  rankTier: string
  rows: TierListRow[]
  highEloRows?: TierListRow[]
}

interface RoleRow {
  patch: string
  platform_id: string
  champion_id: number
  role: string
  games: number
  wins: number
  winrate: number
  pickrate: number
  banrate: number
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

/** Aligne les libellés rôle (DB / Riot / front) sur une clé unique. */
function normalizeTierListRole(role: string | null | undefined): string {
  const u = String(role ?? '')
    .trim()
    .toUpperCase()
  if (u === 'MID') return 'MIDDLE'
  if (u === 'ADC' || u === 'BOT') return 'BOTTOM'
  if (u === 'UTILITY') return 'SUPPORT'
  return u
}

function assignTier(sortedByTierScore: Array<{ tierScore: number }>): Tier[] {
  const n = sortedByTierScore.length
  if (n === 0) return []
  const tiers: Tier[] = []
  const sameScore = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9
  for (let i = 0; i < n; i++) {
    if (
      i > 0 &&
      sameScore(sortedByTierScore[i]!.tierScore, sortedByTierScore[i - 1]!.tierScore)
    ) {
      tiers.push(tiers[i - 1]!)
      continue
    }
    const pct = ((i + 1) / n) * 100
    let t: Tier = 'D'
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

function ensureTierCoverage(tiers: Tier[], n: number): Tier[] {
  if (n < 6) return tiers
  const out = [...tiers]
  const desired: Tier[] = ['S+', 'S', 'A', 'B', 'C', 'D']
  const targetIndexForTier = (tier: Tier): number => {
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

export const __testables = {
  assignTier,
  tierScoreFromWinrateAndGames: (winrate: number, games: number) => (winrate - 0.5) * Math.sqrt(games),
}

function computeChampionMatchupScores(
  rows: Array<{
    championId: number
    mainRole: string
    roleGames: number
  }>,
  vsRows: MatchupPeerRow[],
): Map<number, number> {
  return computeChampionMatchupNotesBatch(rows, vsRows, normalizeTierListRole)
}

function buildTierListRows(
  roleRows: RoleRow[],
  vsRows: MatchupPeerRow[],
  focusRole?: string | null
): TierListRow[] {
  const byChampion = new Map<
    number,
    { totalGames: number; roleRows: Array<{ role: string; games: number; wins: number; winrate: number; pickrate: number; banrate: number }> }
  >()
  for (const r of roleRows) {
    const key = toNum(r.champion_id)
    const games = toNum(r.games)
    const wins = toNum(r.wins)
    const winrate = toNum(r.winrate)
    const pickrate = toNum(r.pickrate)
    const banrate = toNum(r.banrate)
    if (!byChampion.has(key)) {
      byChampion.set(key, { totalGames: 0, roleRows: [] })
    }
    const entry = byChampion.get(key)!
    entry.totalGames += games
    entry.roleRows.push({
      role: String(r.role ?? ''),
      games,
      wins,
      winrate,
      pickrate,
      banrate,
    })
  }

  const rows: Array<{
    championId: number
    tier: Tier
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
    tierScore: number
    mainRoleGames: number
  }> = []

  const focus = focusRole?.trim() ? normalizeTierListRole(focusRole) : null

  for (const [championId, { totalGames, roleRows: rrs }] of byChampion) {
    if (!rrs.length) continue
    let selected: (typeof rrs)[0]
    if (focus) {
      const found = rrs.find(r => normalizeTierListRole(r.role) === focus)
      if (!found || found.games < MIN_GAMES) continue
      selected = found
    } else {
      selected = rrs.reduce((a, b) => (b.games > a.games ? b : a), rrs[0]!)
    }

    const mainRolePct = totalGames > 0 ? (100 * selected.games) / totalGames : 0
    const tierScore = (selected.winrate - 0.5) * Math.sqrt(selected.games)
    rows.push({
      championId,
      tier: 'D',
      mainRole: normalizeTierListRole(selected.role),
      mainRolePct,
      winrate: selected.winrate,
      pickrate: selected.pickrate,
      banrate: selected.banrate,
      pbi: 0,
      games: focus ? selected.games : totalGames,
      tierScore,
      mainRoleGames: selected.games,
    })
  }

  const filtered = rows.filter(r => r.games >= MIN_GAMES && r.pickrate >= MIN_PICKRATE)
  const notes = computeChampionMatchupScores(
    filtered.map(r => ({
      championId: r.championId,
      mainRole: r.mainRole,
      roleGames: r.mainRoleGames,
    })),
    vsRows
  )
  const hasMatchupNotes = notes.size > 0
  for (const row of filtered) {
    row.pbi = hasMatchupNotes
      ? (notes.get(row.championId) ?? row.tierScore)
      : row.tierScore
  }
  const sorted = [...filtered].sort((a, b) => b.tierScore - a.tierScore)
  sorted.forEach(r => {
    r.tierScore = Number(r.pbi.toFixed(4))
  })
  sorted.sort((a, b) => b.tierScore - a.tierScore)
  const focusNorm = focus ? normalizeTierListRole(focus) : null
  const shouldEnsureAllTiers = focusNorm == null || focusNorm !== 'BOTTOM'
  const tiers = shouldEnsureAllTiers
    ? ensureTierCoverage(assignTier(sorted), sorted.length)
    : assignTier(sorted)
  sorted.forEach((r, i) => {
    r.tier = tiers[i] ?? 'D'
  })

  return sorted.map((r, i) => ({
    rank: i + 1,
    championId: r.championId,
    tier: r.tier,
    mainRole: r.mainRole,
    mainRolePct: r.mainRolePct,
    winrate: r.winrate,
    pickrate: r.pickrate,
    banrate: r.banrate,
    pbi: r.pbi,
    games: r.games,
  }))
}

/** Normalize patch string to "major.minor" (e.g. "15.10" → "15.10") */
function normalizePatch(gameVersion: string): string {
  const parts = gameVersion.split('.')
  return `${parts[0] ?? '0'}.${parts[1] ?? '0'}`
}

async function fetchRoleRows(
  patch: string,
  _platformId: string | null,
  rankFilter: 'all' | 'high_elo' | string | string[] | null
): Promise<RoleRow[]> {
  const highEloOnly = rankFilter === 'high_elo'

  const HIGH_ELO_TIERS = ['CHALLENGER', 'GRANDMASTER', 'MASTER']

  const filters: string[] = []
  if (highEloOnly) {
    filters.push(`rank_tier IN (${HIGH_ELO_TIERS.map((t) => `'${t}'`).join(',')})`)
  } else if (Array.isArray(rankFilter) && rankFilter.length > 0) {
    const tiers = rankFilter
      .map((t) => String(t).toUpperCase().replace(/'/g, "''"))
      .filter(Boolean)
    if (tiers.length > 0) {
      filters.push(`rank_tier IN (${tiers.map((t) => `'${t}'`).join(',')})`)
    }
  } else if (rankFilter && rankFilter !== 'all' && rankFilter !== null) {
    const rf = String(rankFilter).toUpperCase().replace(/'/g, "''")
    filters.push(`rank_tier = '${rf}'`)
  }
  if (patch) filters.push(`game_version LIKE '${normalizePatchMajorMinor(patch).replace(/'/g, "''")}%'`)
  const whereSql = filters.length > 0 ? filters.join(' AND ') : '1=1'

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', patch, 'ac')

  const coreRows = await queryRawUnsafe<Array<{
    championId: number
    role: string
    gameVersion: string
    region: string
    rankTier: string
    countWin: number
    countGame: number
    countBan: number
  }>>(`
    SELECT
      champion_id AS "championId",
      role,
      game_version AS "gameVersion",
      region,
      rank_tier AS "rankTier",
      count_win AS "countWin",
      count_game AS "countGame",
      count_ban AS "countBan"
    FROM ${coreFrom}
    WHERE ${whereSql}
  `)

  if (coreRows.length === 0) return []

  const banTotalsByChampion = bansPerChampionFromMvRows(coreRows)

  // Aggregate by (champion_id, role) across all versions matching the patch and all regions
  const aggByChampionRole = new Map<
    string,
    { championId: number; role: string; wins: number; games: number; bans: number }
  >()
  let totalGamesAllRoles = 0

  for (const row of coreRows) {
    const key = `${row.championId}::${row.role}`
    let entry = aggByChampionRole.get(key)
    if (!entry) {
      entry = { championId: row.championId, role: row.role, wins: 0, games: 0, bans: 0 }
      aggByChampionRole.set(key, entry)
    }
    entry.wins += row.countWin
    entry.games += row.countGame
    totalGamesAllRoles += row.countGame
  }
  for (const entry of aggByChampionRole.values()) {
    entry.bans = banTotalsByChampion.get(entry.championId) ?? 0
  }

  // Total matches ≈ totalGames / 10 (10 players per match)
  const totalMatches = Math.max(1, Math.round(totalGamesAllRoles / 10))

  // Compute role totals (denominator for pickrate)
  const roleTotal = new Map<string, number>()
  for (const entry of aggByChampionRole.values()) {
    roleTotal.set(entry.role, (roleTotal.get(entry.role) ?? 0) + entry.games)
  }

  const roleRows: RoleRow[] = []
  for (const entry of aggByChampionRole.values()) {
    if (entry.games === 0) continue
    const roleTotalGames = roleTotal.get(entry.role) ?? 1
    roleRows.push({
      patch,
      platform_id: 'GLOBAL',
      champion_id: entry.championId,
      role: entry.role,
      games: entry.games,
      wins: entry.wins,
      winrate: entry.games > 0 ? entry.wins / entry.games : 0,
      pickrate: roleTotalGames > 0 ? entry.games / roleTotalGames : 0,
      banrate: totalMatches > 0 ? entry.bans / totalMatches : 0,
    })
  }

  return roleRows
}

async function fetchMatchupVsRows(
  patch: string,
  rankFilter: 'all' | 'high_elo' | string | string[] | null
): Promise<MatchupPeerRow[]> {
  const highEloOnly = rankFilter === 'high_elo'
  const HIGH_ELO_TIERS = ['CHALLENGER', 'GRANDMASTER', 'MASTER']
  const filters: string[] = []
  if (highEloOnly) {
    filters.push(`rank_tier IN (${HIGH_ELO_TIERS.map((t) => `'${t}'`).join(',')})`)
  } else if (Array.isArray(rankFilter) && rankFilter.length > 0) {
    const tiers = rankFilter
      .map((t) => String(t).toUpperCase().replace(/'/g, "''"))
      .filter(Boolean)
    if (tiers.length > 0) {
      filters.push(`rank_tier IN (${tiers.map((t) => `'${t}'`).join(',')})`)
    }
  } else if (rankFilter && rankFilter !== 'all' && rankFilter !== null) {
    const rf = String(rankFilter).toUpperCase().replace(/'/g, "''")
    filters.push(`rank_tier = '${rf}'`)
  }
  const whereSql = filters.length > 0 ? filters.join(' AND ') : '1=1'

  const vsFrom = await matchVersionedAggFrom('agg_champion_vs_stats', patch, 'vs')
  const laneSumSelect = buildChampionMatchupLaneSumSelect('vs')

  const vsRows = await queryRawUnsafe<Array<
    LaneSumRow & {
      championId: number
      opponentChampionId: number
      role: string
      countGame: number
      countWin: number
    }
  >>(`
    SELECT
      vs.champion_id AS "championId",
      vs.opponent_champion_id AS "opponentChampionId",
      vs.role,
      SUM(vs.count_game)::bigint AS "countGame",
      SUM(vs.count_win)::bigint AS "countWin",
      ${laneSumSelect}
    FROM ${vsFrom}
    WHERE ${whereSql}
    GROUP BY vs.champion_id, vs.opponent_champion_id, vs.role
    HAVING SUM(vs.count_game) >= 3
  `)

  return vsRows.map((row) => {
    const games = toNum(row.countGame)
    const wins = toNum(row.countWin)
    const out: MatchupPeerRow = {
      champion_id: toNum(row.championId),
      opponent_champion_id: toNum(row.opponentChampionId),
      role: String(row.role ?? ''),
      games,
      wins,
    }
    for (const [key, value] of Object.entries(row)) {
      if (
        key === 'championId' ||
        key === 'opponentChampionId' ||
        key === 'role' ||
        key === 'countGame' ||
        key === 'countWin'
      ) {
        continue
      }
      out[key] = value
    }
    return out
  })
}

async function getLatestPatch(): Promise<string | null> {
  const coreFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 'ac')
  const rows = await queryRawUnsafe<Array<{ patch: string; games: bigint }>>(`
    WITH patch_totals AS (
      SELECT
        (split_part(ac.game_version, '.', 1) || '.' || split_part(ac.game_version, '.', 2)) AS patch,
        COALESCE(SUM(ac.count_game), 0)::bigint AS games
      FROM ${coreFrom}
      WHERE ac.rank_tier <> 'UNRANKED'
      GROUP BY 1
      HAVING COALESCE(SUM(ac.count_game), 0) > 0
    )
    SELECT patch, games
    FROM patch_totals
    ORDER BY
      COALESCE(NULLIF(split_part(patch, '.', 1), ''), '0')::int DESC,
      COALESCE(NULLIF(split_part(patch, '.', 2), ''), '0')::int DESC
    LIMIT 1
  `)
  const patch = rows[0]?.patch
  if (!patch) return null
  return patch.includes('.') ? patch : normalizePatch(patch)
}

export async function getTierList(options: GetTierListOptions): Promise<GetTierListResult | null> {
  if (!isDatabaseConfigured()) return null
  let patch = options.patch?.trim() || null
  if (!patch) {
    patch = await getLatestPatch()
    if (!patch) return null
  }

  const platformId = options.platformId?.trim() || null
  const rankTierRaw = options.rankTier
  const rankTier =
    rankTierRaw === 'all' || rankTierRaw == null || rankTierRaw === ''
      ? 'all'
      : Array.isArray(rankTierRaw)
        ? rankTierRaw
            .map((t) => String(t).trim().toUpperCase())
            .filter(Boolean)
        : String(rankTierRaw).trim().toUpperCase()
  const rankFilter =
    rankTier === 'all'
      ? null
      : Array.isArray(rankTier) && rankTier.length === 0
        ? null
        : rankTier
  let roleRows: RoleRow[]
  try {
    roleRows = await fetchRoleRows(patch, platformId, rankFilter)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Tier list fetchRoleRows failed: ${msg}`)
  }

  if (roleRows.length === 0 && options.patch?.trim()) {
    const fallbackPatch = await getLatestPatch()
    if (fallbackPatch && fallbackPatch !== patch) {
      try {
        roleRows = await fetchRoleRows(fallbackPatch, platformId, rankFilter)
        if (roleRows.length > 0) patch = fallbackPatch
      } catch {
        // keep roleRows empty
      }
    }
  }

  const focusRole = options.role?.trim() ? options.role : null

  const matchupVsRows = await fetchMatchupVsRows(patch, rankFilter)
  const rows = buildTierListRows(roleRows, matchupVsRows, focusRole)

  let highEloRows: TierListRow[] | undefined
  try {
    const highEloRoleRows = await fetchRoleRows(patch, platformId, 'high_elo')
    if (highEloRoleRows.length > 0) {
      const highEloMatchupVsRows = await fetchMatchupVsRows(patch, 'high_elo')
      highEloRows = buildTierListRows(highEloRoleRows, highEloMatchupVsRows, focusRole)
    }
  } catch {
    // optional: skip high-elo block on error
  }

  return {
    patch,
    rankTier: rankTier === 'all' ? 'all' : Array.isArray(rankTier) ? rankTier.join(',') : rankTier,
    rows,
    highEloRows,
  }
}
