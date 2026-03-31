/**
 * Tier list service: one row per champion (all ranks or GM+Challenger slice).
 * Aggregates from mv_champion_core_stats (vue matérialisée); main role = role with max games;
 * tier from tier_score percentiles; PBI = (winrate - bracket_avg_winrate) * 100 * pickrate / (100 - banrate).
 */
import { prisma } from '../db.js'
import { applyRankTierWhere } from '../utils/statsFilters.js'
import { isDatabaseConfigured } from '../db.js'

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
  pbi: number
  games: number
}

export interface GetTierListOptions {
  patch?: string | null
  platformId?: string | null
  rankTier?: 'all' | string | null
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

function assignTier(sortedByTierScore: Array<{ tierScore: number }>): Tier[] {
  const n = sortedByTierScore.length
  if (n === 0) return []
  const tiers: Tier[] = []
  for (let i = 0; i < n; i++) {
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

function computePbi(
  winratePct: number,
  bracketAvgWinratePct: number,
  pickratePct: number,
  banratePct: number
): number {
  const denom = 100 - banratePct
  if (denom <= 0) return 0
  return ((winratePct - bracketAvgWinratePct) * 100 * pickratePct) / denom
}

export const __testables = {
  assignTier,
  computePbi,
  tierScoreFromWinrateAndGames: (winrate: number, games: number) => (winrate - 0.5) * Math.sqrt(games),
}

function buildTierListRows(roleRows: RoleRow[]): TierListRow[] {
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

  for (const [championId, { totalGames, roleRows }] of byChampion) {
    const main = roleRows.reduce((a, b) => (b.games > a.games ? b : a), roleRows[0])
    const mainRolePct = totalGames > 0 ? (100 * main.games) / totalGames : 0
    const tierScore = (main.winrate - 0.5) * Math.sqrt(main.games)
    rows.push({
      championId,
      tier: 'D',
      mainRole: main.role,
      mainRolePct,
      winrate: main.winrate,
      pickrate: main.pickrate,
      banrate: main.banrate,
      pbi: 0,
      games: totalGames,
      tierScore,
      mainRoleGames: main.games,
    })
  }

  const filtered = rows.filter(r => r.games >= MIN_GAMES && r.pickrate >= MIN_PICKRATE)
  const totalMainRoleGames = filtered.reduce((sum, row) => sum + row.mainRoleGames, 0)
  const bracketAvgWinratePct =
    totalMainRoleGames > 0
      ? filtered.reduce((sum, row) => sum + row.winrate * 100 * row.mainRoleGames, 0) /
        totalMainRoleGames
      : 50
  for (const row of filtered) {
    const winratePct = row.winrate * 100
    const pickratePct = row.pickrate * 100
    const banratePct = row.banrate * 100
    row.pbi = computePbi(winratePct, bracketAvgWinratePct, pickratePct, banratePct)
  }
  const sorted = [...filtered].sort((a, b) => b.tierScore - a.tierScore)
  const tiers = assignTier(sorted)
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
  rankFilter: 'all' | 'high_elo' | string | null
): Promise<RoleRow[]> {
  const highEloOnly = rankFilter === 'high_elo'

  const HIGH_ELO_TIERS = ['CHALLENGER', 'GRANDMASTER', 'MASTER']

  // Build where filter for mv_champion_core_stats
  const where: Record<string, unknown> = {}
  if (highEloOnly) {
    where.rankTier = { in: HIGH_ELO_TIERS }
  } else if (rankFilter && rankFilter !== 'all' && rankFilter !== null) {
    applyRankTierWhere(where, rankFilter)
  }
  // Filter by patch prefix (game_version starts with "major.minor")
  if (patch) {
    where.gameVersion = { startsWith: patch }
  }

  const coreRows = await prisma.mvChampionCoreStat.findMany({
    where,
    select: {
      championId: true,
      role: true,
      gameVersion: true,
      region: true,
      countWin: true,
      countGame: true,
      countBan: true,
    },
  })

  if (coreRows.length === 0) return []

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
    entry.bans += row.countBan
    totalGamesAllRoles += row.countGame
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

async function getLatestPatch(): Promise<string | null> {
  const row = await prisma.match.findFirst({
    orderBy: { id: 'desc' },
    select: { gameVersion: true },
  })
  if (!row?.gameVersion) return null
  return normalizePatch(row.gameVersion)
}

export async function getTierList(options: GetTierListOptions): Promise<GetTierListResult | null> {
  if (!isDatabaseConfigured()) return null
  let patch = options.patch?.trim() || null
  if (!patch) {
    patch = await getLatestPatch()
    if (!patch) return null
  }

  const platformId = options.platformId?.trim() || null
  const rankTier = options.rankTier === 'all' || options.rankTier == null || options.rankTier === '' ? 'all' : options.rankTier

  const rankFilter = rankTier === 'all' ? null : rankTier
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

  const rows = buildTierListRows(roleRows)

  let highEloRows: TierListRow[] | undefined
  if (rankTier === 'all') {
    try {
      const highEloRoleRows = await fetchRoleRows(patch, platformId, 'high_elo')
      if (highEloRoleRows.length > 0) {
        highEloRows = buildTierListRows(highEloRoleRows)
      }
    } catch {
      // optional: skip high-elo block on error
    }
  }

  return {
    patch,
    rankTier: rankTier === 'all' ? 'all' : rankTier,
    rows,
    highEloRows,
  }
}
