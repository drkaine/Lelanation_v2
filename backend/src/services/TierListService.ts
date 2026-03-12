/**
 * Tier list service: one row per champion (all ranks or GM+Challenger slice).
 * Aggregates from participants / match_teams / bans; main role = role with max games;
 * tier from tier_score percentiles; PBI = (winrate - 50) * 100 * pickrate / (100 - banrate).
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

const MIN_GAMES = 10
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

/** Raw row from SQL; pg may return bigint/numeric as string. */
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

function computePbi(winratePct: number, pickratePct: number, banratePct: number): number {
  const denom = 100 - banratePct
  if (denom <= 0) return 0
  return ((winratePct - 50) * pickratePct) / denom
}

export const __testables = {
  assignTier,
  computePbi,
  tierScoreFromWinrateAndGames: (winrate: number, games: number) => (winrate - 0.5) * Math.sqrt(games),
}

/** Build tier list rows from per-(champion, role) rows: pick main role per champion, tier_score, tier, PBI, rank. */
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
  }> = []

  for (const [championId, { totalGames, roleRows }] of byChampion) {
    const main = roleRows.reduce((a, b) => (b.games > a.games ? b : a), roleRows[0])
    const mainRolePct = totalGames > 0 ? (100 * main.games) / totalGames : 0
    const winratePct = main.winrate * 100
    const pickratePct = main.pickrate * 100
    const banratePct = main.banrate * 100
    const tierScore = (main.winrate - 0.5) * Math.sqrt(main.games)
    const pbi = computePbi(winratePct, pickratePct, banratePct)

    rows.push({
      championId,
      tier: 'D', // assigned below
      mainRole: main.role,
      mainRolePct,
      winrate: main.winrate,
      pickrate: main.pickrate,
      banrate: main.banrate,
      pbi,
      games: totalGames,
      tierScore,
    })
  }

  const filtered = rows.filter(r => r.games >= MIN_GAMES && r.pickrate >= MIN_PICKRATE)
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

async function fetchRoleRows(
  patch: string,
  _platformId: string | null,
  rankFilter: 'all' | 'high_elo' | string | null
): Promise<RoleRow[]> {
  const rankOnlyHighElo = rankFilter === 'high_elo'
  const rankValue: string | null = rankOnlyHighElo ? null : rankFilter === 'all' || rankFilter === null ? null : rankFilter

  const rows = await prisma.$queryRaw<RoleRow[]>(
    rankOnlyHighElo
      ? Prisma.sql`
    WITH patch_norm AS (
      SELECT m.id, m.platform_id,
        (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) AS patch
      FROM matches m
      WHERE m.game_version IS NOT NULL AND m.game_duration IS NOT NULL AND m.game_duration > 0
        AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) = ${patch}
    ),
    p_team AS (
      SELECT id, match_id,
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
      FROM participants
    ),
    agg AS (
      SELECT
        pn.patch,
        COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        p.champion_id,
        p.role,
        COUNT(*)::int AS games,
        SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)::int AS wins
      FROM participants p
      JOIN patch_norm pn ON p.match_id = pn.id
      INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
      INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
      WHERE p.role IS NOT NULL AND p.role != ''
        AND p.rank_tier IN ('CHALLENGER', 'GRANDMASTER')
      GROUP BY pn.patch, COALESCE(pn.platform_id, 'GLOBAL'), p.champion_id, p.role
    ),
    role_totals AS (
      SELECT patch, platform_id, role, SUM(games)::bigint AS total_role_games
      FROM agg GROUP BY patch, platform_id, role
    ),
    match_counts AS (
      SELECT patch, platform_id, COUNT(*)::bigint AS total_matches
      FROM patch_norm GROUP BY patch, platform_id
    ),
    bans_agg AS (
      SELECT b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        COUNT(*)::bigint AS champion_bans
      FROM bans b
      JOIN patch_norm pn ON b.match_id = pn.id
      GROUP BY b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL')
    )
    SELECT
      a.patch,
      a.platform_id,
      a.champion_id,
      a.role,
      a.games,
      (a.wins::float / NULLIF(a.games, 0)) AS winrate,
      (a.games::float / NULLIF(rt.total_role_games, 0)) AS pickrate,
      (COALESCE(ba.champion_bans, 0)::float / NULLIF(mc.total_matches, 0)) AS banrate
    FROM agg a
    JOIN role_totals rt ON rt.patch = a.patch AND rt.platform_id = a.platform_id AND rt.role = a.role
    JOIN match_counts mc ON mc.patch = a.patch AND mc.platform_id = a.platform_id
    LEFT JOIN bans_agg ba ON ba.champion_id = a.champion_id AND ba.patch = a.patch AND ba.platform_id = a.platform_id
  `
      : rankValue !== null
        ? Prisma.sql`
    WITH patch_norm AS (
      SELECT m.id, m.platform_id,
        (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) AS patch
      FROM matches m
      WHERE m.game_version IS NOT NULL AND m.game_duration IS NOT NULL AND m.game_duration > 0
        AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) = ${patch}
    ),
    p_team AS (
      SELECT id, match_id,
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
      FROM participants
    ),
    agg AS (
      SELECT
        pn.patch,
        COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        p.champion_id,
        p.role,
        COUNT(*)::int AS games,
        SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)::int AS wins
      FROM participants p
      JOIN patch_norm pn ON p.match_id = pn.id
      INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
      INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
      WHERE p.role IS NOT NULL AND p.role != ''
        AND p.rank_tier = ${rankValue}
      GROUP BY pn.patch, COALESCE(pn.platform_id, 'GLOBAL'), p.champion_id, p.role
    ),
    role_totals AS (
      SELECT patch, platform_id, role, SUM(games)::bigint AS total_role_games
      FROM agg GROUP BY patch, platform_id, role
    ),
    match_counts AS (
      SELECT patch, platform_id, COUNT(*)::bigint AS total_matches
      FROM patch_norm GROUP BY patch, platform_id
    ),
    bans_agg AS (
      SELECT b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        COUNT(*)::bigint AS champion_bans
      FROM bans b
      JOIN patch_norm pn ON b.match_id = pn.id
      GROUP BY b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL')
    )
    SELECT
      a.patch,
      a.platform_id,
      a.champion_id,
      a.role,
      a.games,
      (a.wins::float / NULLIF(a.games, 0)) AS winrate,
      (a.games::float / NULLIF(rt.total_role_games, 0)) AS pickrate,
      (COALESCE(ba.champion_bans, 0)::float / NULLIF(mc.total_matches, 0)) AS banrate
    FROM agg a
    JOIN role_totals rt ON rt.patch = a.patch AND rt.platform_id = a.platform_id AND rt.role = a.role
    JOIN match_counts mc ON mc.patch = a.patch AND mc.platform_id = a.platform_id
    LEFT JOIN bans_agg ba ON ba.champion_id = a.champion_id AND ba.patch = a.patch AND ba.platform_id = a.platform_id
  `
        : Prisma.sql`
    WITH patch_norm AS (
      SELECT m.id, m.platform_id,
        (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) AS patch
      FROM matches m
      WHERE m.game_version IS NOT NULL AND m.game_duration IS NOT NULL AND m.game_duration > 0
        AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) = ${patch}
    ),
    p_team AS (
      SELECT id, match_id,
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
      FROM participants
    ),
    agg AS (
      SELECT
        pn.patch,
        COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        p.champion_id,
        p.role,
        COUNT(*)::int AS games,
        SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)::int AS wins
      FROM participants p
      JOIN patch_norm pn ON p.match_id = pn.id
      INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
      INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
      WHERE p.role IS NOT NULL AND p.role != ''
      GROUP BY pn.patch, COALESCE(pn.platform_id, 'GLOBAL'), p.champion_id, p.role
    ),
    role_totals AS (
      SELECT patch, platform_id, role, SUM(games)::bigint AS total_role_games
      FROM agg GROUP BY patch, platform_id, role
    ),
    match_counts AS (
      SELECT patch, platform_id, COUNT(*)::bigint AS total_matches
      FROM patch_norm GROUP BY patch, platform_id
    ),
    bans_agg AS (
      SELECT b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL') AS platform_id,
        COUNT(*)::bigint AS champion_bans
      FROM bans b
      JOIN patch_norm pn ON b.match_id = pn.id
      GROUP BY b.champion_id, pn.patch, COALESCE(pn.platform_id, 'GLOBAL')
    )
    SELECT
      a.patch,
      a.platform_id,
      a.champion_id,
      a.role,
      a.games,
      (a.wins::float / NULLIF(a.games, 0)) AS winrate,
      (a.games::float / NULLIF(rt.total_role_games, 0)) AS pickrate,
      (COALESCE(ba.champion_bans, 0)::float / NULLIF(mc.total_matches, 0)) AS banrate
    FROM agg a
    JOIN role_totals rt ON rt.patch = a.patch AND rt.platform_id = a.platform_id AND rt.role = a.role
    JOIN match_counts mc ON mc.patch = a.patch AND mc.platform_id = a.platform_id
    LEFT JOIN bans_agg ba ON ba.champion_id = a.champion_id AND ba.patch = a.patch AND ba.platform_id = a.platform_id
  `
  )
  return rows
}

/** Get the most recent patch (major.minor) that has matches in the DB. */
async function getLatestPatch(): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ patch: string }>>`
    SELECT (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS patch
    FROM matches
    WHERE game_version IS NOT NULL AND game_duration IS NOT NULL AND game_duration > 0
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 1
  `
  return rows[0]?.patch ?? null
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
