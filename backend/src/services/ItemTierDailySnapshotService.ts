/**
 * Séries quotidiennes item depuis `item_tier_daily_snapshots` (ingestion poller).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { itemTierRoleBucket } from '../parsers/itemTierDailySnapshotRole.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

export interface ItemTierSnapshotRow {
  dateOfGame: string
  rankTier: string
  role: string
  itemId: number
  games: number
  wins: number
  banRatePct: number
  pickRatePct: number
}

function buildItemSnapshotFilterSql(options: {
  itemId?: number | null
  rankTiers?: string[] | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  alias?: string
}): string {
  const a = options.alias ?? 's'
  const parts: string[] = ['1=1']
  if (options.itemId != null && Number.isFinite(options.itemId)) {
    parts.push(`${a}.item_id = ${options.itemId}`)
  }
  const tiers = (options.rankTiers ?? [])
    .map(t => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)
  if (tiers.length === 1) {
    parts.push(
      `split_part(upper(trim(${a}.rank_tier::text)), '_', 1) = '${tiers[0]!.replace(/'/g, "''")}'`,
    )
  } else if (tiers.length > 1) {
    parts.push(
      `split_part(upper(trim(${a}.rank_tier::text)), '_', 1) IN (${tiers.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')})`,
    )
  } else {
    parts.push(`split_part(upper(trim(${a}.rank_tier::text)), '_', 1) <> 'UNRANKED'`)
  }
  if (options.fromDate) parts.push(`${a}.date_of_game >= '${options.fromDate.replace(/'/g, "''")}'::date`)
  if (options.toDate) parts.push(`${a}.date_of_game <= '${options.toDate.replace(/'/g, "''")}'::date`)
  return parts.join(' AND ')
}

function buildCohortRoleFilter(role: string | null | undefined, alias: string): string {
  const bucket = role ? itemTierRoleBucket(role) : null
  if (!bucket) return 'TRUE'
  const col = bucket === 'mid' ? 'MIDDLE' : bucket === 'adc' ? 'BOTTOM' : bucket.toUpperCase()
  if (col === 'TOP') return `${alias}.role = 'TOP'`
  if (col === 'JUNGLE') return `${alias}.role = 'JUNGLE'`
  if (col === 'MIDDLE') return `${alias}.role = 'MIDDLE'`
  if (col === 'BOTTOM') return `${alias}.role = 'BOTTOM'`
  if (col === 'SUPPORT') return `${alias}.role = 'SUPPORT'`
  return 'TRUE'
}

function itemGamesExpr(role: string | null | undefined, alias: string): string {
  const bucket = role ? itemTierRoleBucket(role) : null
  if (!bucket) return `COALESCE(SUM(${alias}.games), 0)`
  return `COALESCE(SUM(${alias}.${bucket}_game), 0)`
}

function itemWinsExpr(role: string | null | undefined, alias: string): string {
  const bucket = role ? itemTierRoleBucket(role) : null
  if (!bucket) return `COALESCE(SUM(${alias}.wins), 0)`
  return `COALESCE(SUM(${alias}.${bucket}_win), 0)`
}

export async function getItemTierSnapshotsForCharts(options: {
  itemId: number
  rankTier?: string | string[] | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  limit?: number
}): Promise<ItemTierSnapshotRow[]> {
  if (!isDatabaseConfigured()) return []
  const { itemId, fromDate, toDate, limit = 365 } = options
  const rankTiers = toQueryStringArrayParam(options.rankTier)
    .map(t => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)
  let role = options.role
  if (role && role.toUpperCase() === 'UTILITY') role = 'SUPPORT'
  if (role && role.toUpperCase() === 'MID') role = 'MIDDLE'
  if (role && role.toUpperCase() === 'ADC') role = 'BOTTOM'
  const normRole = role ? role.toUpperCase().replace(/'/g, "''") : null

  const cohortWhere = buildItemSnapshotFilterSql({
    itemId: null,
    rankTiers,
    fromDate,
    toDate,
    alias: 'cohort',
  })
  const itemWhere = buildItemSnapshotFilterSql({
    itemId,
    rankTiers,
    fromDate,
    toDate,
    alias: 'item',
  })
  const cohortRoleFilter = buildCohortRoleFilter(normRole, 'cohort')
  const gamesExpr = itemGamesExpr(normRole, 'item')
  const winsExpr = itemWinsExpr(normRole, 'item')

  const rows = await queryRawUnsafe<
    Array<{
      date_of_game: Date
      rank_tier: string
      games: number
      wins: number
      cohort_games: number
    }>
  >(`
    WITH cohort AS (
      SELECT
        date_of_game,
        rank_tier,
        SUM(games)::bigint AS cohort_games
      FROM champion_tier_daily_snapshots cohort
      WHERE ${cohortWhere} AND ${cohortRoleFilter}
      GROUP BY date_of_game, rank_tier
    ),
    item_rows AS (
      SELECT
        date_of_game,
        rank_tier,
        ${gamesExpr}::int AS games,
        ${winsExpr}::int AS wins
      FROM item_tier_daily_snapshots item
      WHERE ${itemWhere}
      GROUP BY date_of_game, rank_tier
    )
    SELECT
      i.date_of_game,
      i.rank_tier,
      i.games,
      i.wins,
      COALESCE(c.cohort_games, 0)::bigint AS cohort_games
    FROM item_rows i
    LEFT JOIN cohort c
      ON c.date_of_game = i.date_of_game
      AND c.rank_tier = i.rank_tier
    ORDER BY i.date_of_game DESC
    LIMIT ${limit}
  `)

  const roleLabel = normRole ?? 'ALL'
  return [...rows].reverse().map(r => {
    const games = Number(r.games ?? 0)
    const cohortGames = Number(r.cohort_games ?? 0)
    const pickRatePct = cohortGames > 0 ? (games / cohortGames) * 100 : 0
    return {
      dateOfGame: r.date_of_game.toISOString().slice(0, 10),
      rankTier: r.rank_tier,
      role: roleLabel,
      itemId,
      games,
      wins: Number(r.wins ?? 0),
      banRatePct: 0,
      pickRatePct,
    }
  })
}
