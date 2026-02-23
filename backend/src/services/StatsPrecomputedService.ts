/**
 * Lecture et écriture des tables stats pré-calculées.
 * Les APIs lisent en priorité quand version est null et rank_tier/role correspondent.
 * Un job horaire appelle refreshAll() pour remplir les tables.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

const RANK_TIERS = ['', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'] as const
/** Rôles pour pré-calcul champions (évite 504 sur /champions?role=JUNGLE etc.) */
const CHAMPION_ROLES = ['', 'TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
let precomputedTablesAvailable: boolean | null = null

function toKey(v: string | null | undefined): string {
  return v != null && v !== '' ? v : ''
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function markPrecomputedTablesUnavailableIfMissing(err: unknown): void {
  const msg = getErrorMessage(err)
  if (msg.includes('stats_precomputed_') && msg.includes('does not exist')) {
    precomputedTablesAvailable = false
  }
}

async function hasPrecomputedTables(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  if (precomputedTablesAvailable != null) return precomputedTablesAvailable
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public.stats_precomputed_champions') IS NOT NULL AS "exists"`
    )
    precomputedTablesAvailable = row[0]?.exists === true
  } catch {
    precomputedTablesAvailable = false
  }
  return precomputedTablesAvailable
}

/** Lit les champions pré-calculés. Retourne null si pas de ligne ou DB non configurée. */
export async function getPrecomputedChampions(
  rankTier: string | null,
  role: string | null
): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_champions WHERE rank_tier = $1 AND role = $2 LIMIT 1',
      toKey(rankTier),
      toKey(role)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit overview pré-calculé. */
export async function getPrecomputedOverview(rankTier: string | null): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_overview WHERE rank_tier = $1 LIMIT 1',
      toKey(rankTier)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit overview-teams pré-calculé. */
export async function getPrecomputedOverviewTeams(rankTier: string | null): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_overview_teams WHERE rank_tier = $1 LIMIT 1',
      toKey(rankTier)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit overview-detail pré-calculé. */
export async function getPrecomputedOverviewDetail(
  rankTier: string | null,
  includeSmite: boolean
): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_overview_detail WHERE rank_tier = $1 AND include_smite = $2 LIMIT 1',
      toKey(rankTier),
      includeSmite
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit duration-winrate pré-calculé. */
export async function getPrecomputedDurationWinrate(rankTier: string | null): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_duration_winrate WHERE rank_tier = $1 LIMIT 1',
      toKey(rankTier)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit sides pré-calculé. */
export async function getPrecomputedSides(rankTier: string | null): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_sides WHERE rank_tier = $1 LIMIT 1',
      toKey(rankTier)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Lit abandons pré-calculé. */
export async function getPrecomputedAbandons(rankTier: string | null): Promise<{ data: unknown } | null> {
  if (!(await hasPrecomputedTables())) return null
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      'SELECT data FROM stats_precomputed_abandons WHERE rank_tier = $1 LIMIT 1',
      toKey(rankTier)
    )
    return row[0] ?? null
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    return null
  }
}

/** Remplit toutes les tables pré-calculées. À appeler par un cron horaire. */
export async function refreshPrecomputedStats(): Promise<{ ok: boolean; error?: string; refreshed?: string[] }> {
  if (!isDatabaseConfigured()) return { ok: true, refreshed: [] }
  if (!(await hasPrecomputedTables())) return { ok: true, refreshed: [] }
  const refreshed: string[] = []
  try {
    const {
      getOverviewStats,
      getOverviewTeamsStats,
      getOverviewDetailStats,
      getOverviewDurationWinrateStats,
      getOverviewSidesStats,
    } = await import('./StatsOverviewService.js')
    const { getOverviewAbandons } = await import('./StatsAbandonsService.js')
    const { RiotStatsAggregator } = await import('./RiotStatsAggregator.js')
    const aggregator = new RiotStatsAggregator()

    // Champions global (rank_tier='') par rôle en premier pour que ?role=JUNGLE etc. réponde tout de suite
    const rolePayloads = CHAMPION_ROLES.map((role) =>
      aggregator.load({ rankTier: null, role: role === '' ? null : role })
    )
    const globalChampResults = await Promise.all(rolePayloads)
    for (let i = 0; i < CHAMPION_ROLES.length; i++) {
      const data = globalChampResults[i]
      const roleKey = CHAMPION_ROLES[i] || ''
      if (data) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_champions (rank_tier, role, data, updated_at) VALUES ('', $1, $2::jsonb, now())
           ON CONFLICT (rank_tier, role) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          roleKey,
          JSON.stringify({
            totalGames: data.totalGames,
            totalMatches: data.totalMatches,
            champions: data.champions,
            generatedAt: data.generatedAt,
          })
        )
        refreshed.push(`champions(global,role=${roleKey || 'all'})`)
      }
    }

    for (const rank of RANK_TIERS) {
      const r = rank || ''
      const pRank = rank === '' ? null : rank

      const [overview, overviewTeams, detailFalse, detailTrue, durationWinrate, sides, abandons] = await Promise.all([
        getOverviewStats(null, pRank),
        getOverviewTeamsStats(null, pRank),
        getOverviewDetailStats(null, pRank, false),
        getOverviewDetailStats(null, pRank, true),
        getOverviewDurationWinrateStats(null, pRank),
        getOverviewSidesStats(null, pRank),
        getOverviewAbandons(null, pRank),
      ])

      if (overview) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_overview (rank_tier, data, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (rank_tier) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(overview)
        )
        refreshed.push(`overview(${r || 'global'})`)
      }
      if (overviewTeams) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_overview_teams (rank_tier, data, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (rank_tier) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(overviewTeams)
        )
        refreshed.push(`overview_teams(${r || 'global'})`)
      }
      if (detailFalse) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_overview_detail (rank_tier, include_smite, data, updated_at) VALUES ($1, false, $2::jsonb, now())
           ON CONFLICT (rank_tier, include_smite) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(detailFalse)
        )
        refreshed.push(`overview_detail(${r || 'global'},smite=false)`)
      }
      if (detailTrue) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_overview_detail (rank_tier, include_smite, data, updated_at) VALUES ($1, true, $2::jsonb, now())
           ON CONFLICT (rank_tier, include_smite) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(detailTrue)
        )
        refreshed.push(`overview_detail(${r || 'global'},smite=true)`)
      }
      if (durationWinrate) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_duration_winrate (rank_tier, data, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (rank_tier) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(durationWinrate)
        )
        refreshed.push(`duration_winrate(${r || 'global'})`)
      }
      if (sides) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_sides (rank_tier, data, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (rank_tier) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(sides)
        )
        refreshed.push(`sides(${r || 'global'})`)
      }
      if (abandons) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stats_precomputed_abandons (rank_tier, data, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (rank_tier) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          r,
          JSON.stringify(abandons)
        )
        refreshed.push(`abandons(${r || 'global'})`)
      }
    }

    for (const rank of RANK_TIERS) {
      if (rank === '') continue // déjà fait en premier (champions global par rôle)
      const r = rank
      const pRank: string | null = rank
      const rolePayloads = CHAMPION_ROLES.map((role) =>
        aggregator.load({ rankTier: pRank, role: role === '' ? null : role })
      )
      const results = await Promise.all(rolePayloads)
      for (let i = 0; i < CHAMPION_ROLES.length; i++) {
        const data = results[i]
        const roleKey = CHAMPION_ROLES[i] || ''
        if (data) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO stats_precomputed_champions (rank_tier, role, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
             ON CONFLICT (rank_tier, role) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            r,
            roleKey,
            JSON.stringify({
              totalGames: data.totalGames,
              totalMatches: data.totalMatches,
              champions: data.champions,
              generatedAt: data.generatedAt,
            })
          )
          refreshed.push(`champions(${r || 'global'},role=${roleKey || 'all'})`)
        }
      }
    }

    return { ok: true, refreshed }
  } catch (err) {
    markPrecomputedTablesUnavailableIfMissing(err)
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[refreshPrecomputedStats]', msg)
    return { ok: false, error: msg, refreshed }
  }
}
