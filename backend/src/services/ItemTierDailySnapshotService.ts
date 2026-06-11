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

const RANK_TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

const ITEM_ROLE_BREAKDOWN = [
  { role: 'TOP', gamesKey: 'top_games', winsKey: 'top_wins' },
  { role: 'JUNGLE', gamesKey: 'jungle_games', winsKey: 'jungle_wins' },
  { role: 'MIDDLE', gamesKey: 'mid_games', winsKey: 'mid_wins' },
  { role: 'BOTTOM', gamesKey: 'adc_games', winsKey: 'adc_wins' },
  { role: 'SUPPORT', gamesKey: 'support_games', winsKey: 'support_wins' },
] as const

export type ItemDivisionWinRow = {
  rankTier: string
  games: number
  wins: number
  winrate: number | null
}

export type ItemRoleWinBreakdown = {
  role: string
  byDivision: ItemDivisionWinRow[]
  totalGames: number
}

export type ItemPurchaseTimingRow = {
  rankTier: string
  games: number
  avgPurchaseMs: number | null
}

export type ItemTierBreakdown = {
  roles: ItemRoleWinBreakdown[]
  roleTrendPoints: ItemTierSnapshotRow[]
  purchaseTiming: ItemPurchaseTimingRow[]
  overallAvgPurchaseMs: number | null
}

export type ItemPurchaseOrderRow = {
  orderPosition: number
  games: number
  wins: number
  winrate: number | null
}

export type ItemPurchaseOrderDailyPoint = {
  dateOfGame: string
  orderPosition: number
  games: number
  wins: number
  winrate: number | null
}

export type ItemPurchaseTimingDailyPoint = {
  dateOfGame: string
  rankTier: string
  games: number
  avgPurchaseMs: number | null
}

export type ItemPurchaseOrderDivisionDailyPoint = {
  dateOfGame: string
  rankTier: string
  games: number
  wins: number
  winrate: number | null
  avgOrderPosition: number | null
}

export type ItemPurchaseOrderStats = {
  byOrder: ItemPurchaseOrderRow[]
  orderTrendPoints: ItemPurchaseOrderDailyPoint[]
  orderDivisionTrendPoints: ItemPurchaseOrderDivisionDailyPoint[]
  timingTrendPoints: ItemPurchaseTimingDailyPoint[]
  purchaseTiming: ItemPurchaseTimingRow[]
  overallAvgPurchaseMs: number | null
}

function sortRankTiers<T extends { rankTier: string }>(rows: T[]): T[] {
  const order = new Map(RANK_TIER_ORDER.map((tier, idx) => [tier, idx]))
  return [...rows].sort((a, b) => {
    const ai = order.get(a.rankTier as (typeof RANK_TIER_ORDER)[number]) ?? 999
    const bi = order.get(b.rankTier as (typeof RANK_TIER_ORDER)[number]) ?? 999
    return ai - bi
  })
}

async function getItemRoleWinrateTrendSnapshots(options: {
  itemId: number
  rankTiers: string[]
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemTierSnapshotRow[]> {
  const itemWhere = buildItemSnapshotFilterSql({
    itemId: options.itemId,
    rankTiers: options.rankTiers,
    fromDate: options.fromDate,
    toDate: options.toDate,
    alias: 'item',
  })

  const roleUnions = ITEM_ROLE_BREAKDOWN.map(def => {
    const gamesCol = def.gamesKey.replace(/_games$/, '_game')
    const winsCol = def.winsKey.replace(/_wins$/, '_win')
    return `
      SELECT
        item.date_of_game,
        split_part(upper(trim(rank_tier::text)), '_', 1) AS rank_tier,
        '${def.role}' AS role,
        COALESCE(SUM(${gamesCol}), 0)::int AS games,
        COALESCE(SUM(${winsCol}), 0)::int AS wins
      FROM item_tier_daily_snapshots item
      WHERE ${itemWhere}
      GROUP BY item.date_of_game, split_part(upper(trim(rank_tier::text)), '_', 1)
    `
  }).join(' UNION ALL ')

  const rows = await queryRawUnsafe<
    Array<{ date_of_game: Date; rank_tier: string; role: string; games: number; wins: number }>
  >(`
    SELECT date_of_game, rank_tier, role, games, wins
    FROM (${roleUnions}) role_rows
    WHERE games > 0
    ORDER BY date_of_game ASC, role ASC, rank_tier ASC
  `)

  return rows.map(row => ({
    dateOfGame: formatSnapshotDate(row.date_of_game),
    rankTier: row.rank_tier,
    role: row.role,
    itemId: options.itemId,
    games: Number(row.games ?? 0),
    wins: Number(row.wins ?? 0),
    banRatePct: 0,
    pickRatePct: 0,
  }))
}

export async function getItemTierBreakdown(options: {
  itemId: number
  rankTier?: string | string[] | null
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemTierBreakdown> {
  if (!isDatabaseConfigured()) {
    return { roles: [], roleTrendPoints: [], purchaseTiming: [], overallAvgPurchaseMs: null }
  }

  const { itemId, fromDate, toDate } = options
  const rankTiers = toQueryStringArrayParam(options.rankTier)
    .map(t => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)

  const itemWhere = buildItemSnapshotFilterSql({
    itemId,
    rankTiers,
    fromDate,
    toDate,
    alias: 'item',
  })

  const [rows, roleTrendPoints] = await Promise.all([
    queryRawUnsafe<
      Array<{
        rank_tier: string
        top_games: number
        top_wins: number
        jungle_games: number
        jungle_wins: number
        mid_games: number
        mid_wins: number
        adc_games: number
        adc_wins: number
        support_games: number
        support_wins: number
        total_games: number
        sum_purchase_ms: number
      }>
    >(`
    SELECT
      split_part(upper(trim(rank_tier::text)), '_', 1) AS rank_tier,
      COALESCE(SUM(top_game), 0)::bigint AS top_games,
      COALESCE(SUM(top_win), 0)::bigint AS top_wins,
      COALESCE(SUM(jungle_game), 0)::bigint AS jungle_games,
      COALESCE(SUM(jungle_win), 0)::bigint AS jungle_wins,
      COALESCE(SUM(mid_game), 0)::bigint AS mid_games,
      COALESCE(SUM(mid_win), 0)::bigint AS mid_wins,
      COALESCE(SUM(adc_game), 0)::bigint AS adc_games,
      COALESCE(SUM(adc_win), 0)::bigint AS adc_wins,
      COALESCE(SUM(support_game), 0)::bigint AS support_games,
      COALESCE(SUM(support_win), 0)::bigint AS support_wins,
      COALESCE(SUM(games), 0)::bigint AS total_games,
      COALESCE(SUM(sum_achat_tmps), 0)::bigint AS sum_purchase_ms
    FROM item_tier_daily_snapshots item
    WHERE ${itemWhere}
    GROUP BY split_part(upper(trim(rank_tier::text)), '_', 1)
  `),
    getItemRoleWinrateTrendSnapshots({ itemId, rankTiers, fromDate, toDate }),
  ])

  const roles: ItemRoleWinBreakdown[] = ITEM_ROLE_BREAKDOWN.map(def => {
    const byDivision: ItemDivisionWinRow[] = []
    let totalGames = 0
    for (const row of rows) {
      const games = Number(row[def.gamesKey] ?? 0)
      const wins = Number(row[def.winsKey] ?? 0)
      if (!Number.isFinite(games) || games <= 0) continue
      totalGames += games
      byDivision.push({
        rankTier: row.rank_tier,
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : null,
      })
    }
    return {
      role: def.role,
      byDivision: sortRankTiers(byDivision),
      totalGames,
    }
  })

  let overallPurchaseMs = 0
  let overallPurchaseGames = 0
  const purchaseTiming: ItemPurchaseTimingRow[] = []
  for (const row of rows) {
    const games = Number(row.total_games ?? 0)
    const sumMs = Number(row.sum_purchase_ms ?? 0)
    if (games <= 0) continue
    overallPurchaseMs += sumMs
    overallPurchaseGames += games
    purchaseTiming.push({
      rankTier: row.rank_tier,
      games,
      avgPurchaseMs: games > 0 ? Math.round(sumMs / games) : null,
    })
  }

  return {
    roles,
    roleTrendPoints,
    purchaseTiming: sortRankTiers(purchaseTiming),
    overallAvgPurchaseMs:
      overallPurchaseGames > 0 ? Math.round(overallPurchaseMs / overallPurchaseGames) : null,
  }
}

async function fetchItemPurchaseTiming(options: {
  itemId: number
  rankTiers: string[]
  fromDate?: string | null
  toDate?: string | null
}): Promise<Pick<ItemPurchaseOrderStats, 'purchaseTiming' | 'overallAvgPurchaseMs'>> {
  const itemWhere = buildItemSnapshotFilterSql({
    itemId: options.itemId,
    rankTiers: options.rankTiers,
    fromDate: options.fromDate,
    toDate: options.toDate,
    alias: 'item',
  })

  const rows = await queryRawUnsafe<
    Array<{ rank_tier: string; total_games: number; sum_purchase_ms: number }>
  >(`
    SELECT
      split_part(upper(trim(rank_tier::text)), '_', 1) AS rank_tier,
      COALESCE(SUM(games), 0)::bigint AS total_games,
      COALESCE(SUM(sum_achat_tmps), 0)::bigint AS sum_purchase_ms
    FROM item_tier_daily_snapshots item
    WHERE ${itemWhere}
    GROUP BY split_part(upper(trim(rank_tier::text)), '_', 1)
  `)

  let overallPurchaseMs = 0
  let overallPurchaseGames = 0
  const purchaseTiming: ItemPurchaseTimingRow[] = []
  for (const row of rows) {
    const games = Number(row.total_games ?? 0)
    const sumMs = Number(row.sum_purchase_ms ?? 0)
    if (games <= 0) continue
    overallPurchaseMs += sumMs
    overallPurchaseGames += games
    purchaseTiming.push({
      rankTier: row.rank_tier,
      games,
      avgPurchaseMs: games > 0 ? Math.round(sumMs / games) : null,
    })
  }

  return {
    purchaseTiming: sortRankTiers(purchaseTiming),
    overallAvgPurchaseMs:
      overallPurchaseGames > 0 ? Math.round(overallPurchaseMs / overallPurchaseGames) : null,
  }
}

function formatSnapshotDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}

async function fetchItemOrderDailyTrend(options: {
  itemId: number
  rankTiers: string[]
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemPurchaseOrderDailyPoint[]> {
  const itemWhere = buildItemSnapshotFilterSql({
    itemId: options.itemId,
    rankTiers: options.rankTiers,
    fromDate: options.fromDate,
    toDate: options.toDate,
    alias: 'item',
  })

  const rows = await queryRawUnsafe<
    Array<{ date_of_game: Date; order_position: number; games: number; wins: number }>
  >(`
    SELECT
      item.date_of_game,
      (ord.key)::int AS order_position,
      COALESCE(SUM((ord.value->>'games')::bigint), 0)::bigint AS games,
      COALESCE(SUM((ord.value->>'wins')::bigint), 0)::bigint AS wins
    FROM item_tier_daily_snapshots item
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(item."order") = 'object' THEN item."order"
        ELSE '{}'::jsonb
      END
    ) AS ord(key, value)
    WHERE ${itemWhere}
      AND ord.key ~ '^[0-9]+$'
    GROUP BY item.date_of_game, (ord.key)::int
    ORDER BY item.date_of_game ASC, (ord.key)::int ASC
  `)

  return rows
    .map(row => {
      const games = Number(row.games ?? 0)
      const wins = Number(row.wins ?? 0)
      return {
        dateOfGame: formatSnapshotDate(row.date_of_game),
        orderPosition: Number(row.order_position),
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : null,
      }
    })
    .filter(
      row =>
        row.dateOfGame &&
        row.games > 0 &&
        Number.isFinite(row.orderPosition) &&
        row.orderPosition > 0,
    )
}

async function fetchItemOrderDivisionDailyTrend(options: {
  itemId: number
  rankTiers: string[]
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemPurchaseOrderDivisionDailyPoint[]> {
  const itemWhere = buildItemSnapshotFilterSql({
    itemId: options.itemId,
    rankTiers: options.rankTiers,
    fromDate: options.fromDate,
    toDate: options.toDate,
    alias: 'item',
  })

  const rows = await queryRawUnsafe<
    Array<{
      date_of_game: Date
      rank_tier: string
      games: number
      wins: number
      position_weighted_sum: number
    }>
  >(`
    SELECT
      item.date_of_game,
      split_part(upper(trim(rank_tier::text)), '_', 1) AS rank_tier,
      COALESCE(SUM((ord.value->>'games')::bigint), 0)::bigint AS games,
      COALESCE(SUM((ord.value->>'wins')::bigint), 0)::bigint AS wins,
      COALESCE(
        SUM((ord.key)::int * (ord.value->>'games')::bigint),
        0
      )::bigint AS position_weighted_sum
    FROM item_tier_daily_snapshots item
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(item."order") = 'object' THEN item."order"
        ELSE '{}'::jsonb
      END
    ) AS ord(key, value)
    WHERE ${itemWhere}
      AND ord.key ~ '^[0-9]+$'
    GROUP BY item.date_of_game, split_part(upper(trim(rank_tier::text)), '_', 1)
    ORDER BY item.date_of_game ASC, rank_tier ASC
  `)

  return rows
    .map(row => {
      const games = Number(row.games ?? 0)
      const wins = Number(row.wins ?? 0)
      const positionWeightedSum = Number(row.position_weighted_sum ?? 0)
      return {
        dateOfGame: formatSnapshotDate(row.date_of_game),
        rankTier: row.rank_tier,
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : null,
        avgOrderPosition:
          games > 0 ? Math.round((positionWeightedSum / games) * 100) / 100 : null,
      }
    })
    .filter(row => row.dateOfGame && row.games > 0 && row.rankTier)
}

async function fetchItemPurchaseTimingDailyTrend(options: {
  itemId: number
  rankTiers: string[]
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemPurchaseTimingDailyPoint[]> {
  const itemWhere = buildItemSnapshotFilterSql({
    itemId: options.itemId,
    rankTiers: options.rankTiers,
    fromDate: options.fromDate,
    toDate: options.toDate,
    alias: 'item',
  })

  const rows = await queryRawUnsafe<
    Array<{ date_of_game: Date; rank_tier: string; games: number; sum_purchase_ms: number }>
  >(`
    SELECT
      item.date_of_game,
      split_part(upper(trim(rank_tier::text)), '_', 1) AS rank_tier,
      COALESCE(SUM(games), 0)::bigint AS games,
      COALESCE(SUM(sum_achat_tmps), 0)::bigint AS sum_purchase_ms
    FROM item_tier_daily_snapshots item
    WHERE ${itemWhere}
    GROUP BY item.date_of_game, split_part(upper(trim(rank_tier::text)), '_', 1)
    ORDER BY item.date_of_game ASC, rank_tier ASC
  `)

  return rows
    .map(row => {
      const games = Number(row.games ?? 0)
      const sumMs = Number(row.sum_purchase_ms ?? 0)
      return {
        dateOfGame: formatSnapshotDate(row.date_of_game),
        rankTier: row.rank_tier,
        games,
        avgPurchaseMs: games > 0 ? Math.round(sumMs / games) : null,
      }
    })
    .filter(row => row.dateOfGame && row.games > 0 && row.rankTier)
}

/** Winrate par position d'achat (ordre starters + légendaires) + timing moyen. */
export async function getItemPurchaseOrderStats(options: {
  itemId: number
  rankTier?: string | string[] | null
  fromDate?: string | null
  toDate?: string | null
}): Promise<ItemPurchaseOrderStats> {
  if (!isDatabaseConfigured()) {
    return {
      byOrder: [],
      orderTrendPoints: [],
      orderDivisionTrendPoints: [],
      timingTrendPoints: [],
      purchaseTiming: [],
      overallAvgPurchaseMs: null,
    }
  }

  const { itemId, fromDate, toDate } = options
  const rankTiers = toQueryStringArrayParam(options.rankTier)
    .map(t => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)

  const itemWhere = buildItemSnapshotFilterSql({
    itemId,
    rankTiers,
    fromDate,
    toDate,
    alias: 'item',
  })

  const orderRows = await queryRawUnsafe<
    Array<{ order_position: number; games: number; wins: number }>
  >(`
    SELECT
      (ord.key)::int AS order_position,
      COALESCE(SUM((ord.value->>'games')::bigint), 0)::bigint AS games,
      COALESCE(SUM((ord.value->>'wins')::bigint), 0)::bigint AS wins
    FROM item_tier_daily_snapshots item
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(item."order") = 'object' THEN item."order"
        ELSE '{}'::jsonb
      END
    ) AS ord(key, value)
    WHERE ${itemWhere}
      AND ord.key ~ '^[0-9]+$'
    GROUP BY (ord.key)::int
    ORDER BY (ord.key)::int
  `)

  const byOrder: ItemPurchaseOrderRow[] = orderRows
    .map(row => {
      const games = Number(row.games ?? 0)
      const wins = Number(row.wins ?? 0)
      return {
        orderPosition: Number(row.order_position),
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : null,
      }
    })
    .filter(row => row.games > 0 && Number.isFinite(row.orderPosition))

  const [timing, orderTrendPoints, orderDivisionTrendPoints, timingTrendPoints] =
    await Promise.all([
      fetchItemPurchaseTiming({ itemId, rankTiers, fromDate, toDate }),
      fetchItemOrderDailyTrend({ itemId, rankTiers, fromDate, toDate }),
      fetchItemOrderDivisionDailyTrend({ itemId, rankTiers, fromDate, toDate }),
      fetchItemPurchaseTimingDailyTrend({ itemId, rankTiers, fromDate, toDate }),
    ])

  return {
    byOrder,
    orderTrendPoints,
    orderDivisionTrendPoints,
    timingTrendPoints,
    ...timing,
  }
}
