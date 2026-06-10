/**
 * Table globale champions : WR / pick / ban par côté, dégâts moyens, KDA.
 * Runtime source policy: incremental aggregate tables.
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import {
  buildRankTierSqlConditions,
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor, sqlAggUnionAllLiveAndArchives } from './statsAggArchive.js'

/** WHERE pour tables partitionnées champion_* (patch → game_version dans les fragments agg). */
export function buildChampionScopedWhere(
  alias: string,
  opts: {
    championId: number
    version?: string | string[] | null
    rankTier?: string | string[] | null
    role?: string | null
    region?: string | null
  },
): string {
  const parts: string[] = [`${alias}.champion_id = ${Number(opts.championId)}`]
  parts.push(buildRawMatchCond(opts.version ?? null, opts.rankTier).replace(/\bm\./g, `${alias}.`))
  if (normalizedRankTiers(opts.rankTier).length === 0) {
    parts.push(`${alias}.rank_tier <> 'UNRANKED'`)
  }
  const roleDb = normalizeStatsRoleForChampion(opts.role ?? null)
  if (roleDb) parts.push(`${alias}.role = '${statsRoleSqlLiteral(roleDb)}'`)
  const region = opts.region?.trim()
  if (region) parts.push(`${alias}.region = '${region.replace(/'/g, "''")}'`)
  return parts.join(' AND ')
}

export async function sumChampionCoreGames(options: {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
}): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const coreFrom = await matchVersionedAggFrom(
    'agg_champion_core_stats',
    options.version ?? null,
    'cc',
  )
  const where = buildChampionScopedWhere('cc', options)
  const rows = await queryRawUnsafe<Array<{ total: bigint }>>(`
    SELECT COALESCE(SUM(cc.count_game), 0)::bigint AS total
    FROM ${coreFrom}
    WHERE ${where}
  `)
  return Number(rows[0]?.total ?? 0)
}

export function buildRawMatchCond(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  if (versions.length === 1)
    parts.push(`m.game_version LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`)
  else if (versions.length > 1)
    parts.push(`m.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  parts.push(...buildRankTierSqlConditions('m', rankTier))
  return parts.length > 0 ? parts.join(' AND ') : '1=1'
}

/**
 * Nombre de parties (`count_match`) depuis `archive_agg_match_outcome_stats`,
 * groupé par (game_version, rank_tier) puis somme sur les divisions du filtre.
 */
export async function sumMatchOutcomeCountUnionLiveArchive(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const moUnion = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'src')
  const where = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'src.')
  const rows = await queryRawUnsafe<Array<{ mc: bigint }>>(`
    SELECT COALESCE(SUM(b.mc), 0)::bigint AS mc
    FROM (
      SELECT src.game_version, src.rank_tier, SUM(src.count_match)::bigint AS mc
      FROM ${moUnion}
      WHERE ${where}
      GROUP BY src.game_version, src.rank_tier
    ) b
  `)
  return Math.max(0, Number(rows[0]?.mc ?? 0))
}

export type ChampionGlobalTableSide = {
  games: number
  wins: number
  winrate: number
  pickrate: number
  banrate: number
}

/** 0 = base, 1 = Darkin, 2 = Assassin (Kayn). */
export type ChampionTransform = 0 | 1 | 2

export type ChampionGlobalTableRow = {
  championId: number
  championTransform?: ChampionTransform
  blue: ChampionGlobalTableSide
  red: ChampionGlobalTableSide
  totalGames: number
  avgDamageToChamps: number
  avgDamageToChampsPhys: number
  avgDamageToChampsMagic: number
  avgDamageToChampsTrue: number
  avgDamageTakenPhys: number
  avgDamageTakenMagic: number
  avgDamageTakenTrue: number
  avgDamageTakenTotal: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
}

type SideAgg = {
  games: number
  wins: number
  sum_phys_d: number
  sum_magic_d: number
  sum_true_d: number
  sum_phys_t: number
  sum_magic_t: number
  sum_true_t: number
  sum_total_t: number
  sum_k: number
  sum_de: number
  sum_a: number
}

function emptySide(): SideAgg {
  return {
    games: 0,
    wins: 0,
    sum_phys_d: 0,
    sum_magic_d: 0,
    sum_true_d: 0,
    sum_phys_t: 0,
    sum_magic_t: 0,
    sum_true_t: 0,
    sum_total_t: 0,
    sum_k: 0,
    sum_de: 0,
    sum_a: 0,
  }
}

function normalizeChampionTransform(value: unknown): ChampionTransform {
  const n = Number(value)
  if (n === 1 || n === 2) return n
  return 0
}

function mergeSideAgg(target: SideAgg, source: SideAgg): void {
  target.games += source.games
  target.wins += source.wins
  target.sum_phys_d += source.sum_phys_d
  target.sum_magic_d += source.sum_magic_d
  target.sum_true_d += source.sum_true_d
  target.sum_phys_t += source.sum_phys_t
  target.sum_magic_t += source.sum_magic_t
  target.sum_true_t += source.sum_true_t
  target.sum_total_t += source.sum_total_t
  target.sum_k += source.sum_k
  target.sum_de += source.sum_de
  target.sum_a += source.sum_a
}

function rowKey(championId: number, transform: ChampionTransform): string {
  return `${championId}:${transform}`
}

export async function getChampionGlobalTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null,
  splitTransform = false
): Promise<{
  matchCount: number
  rows: ChampionGlobalTableRow[]
  transformBreakdown?: ChampionGlobalTableRow[]
} | null> {
  if (!isDatabaseConfigured()) return null
  const roleFilterRaw = String(role ?? '').trim().toUpperCase()
  const roleFilter =
    roleFilterRaw === 'MID'
      ? 'MIDDLE'
      : roleFilterRaw === 'ADC'
        ? 'BOTTOM'
        : roleFilterRaw === 'UTILITY'
          ? 'SUPPORT'
          : roleFilterRaw
  const roleFilterValues =
    roleFilter === 'TOP'
      ? ['TOP', 'TOPLANE']
      : roleFilter === 'JUNGLE'
        ? ['JUNGLE', 'JGL']
        : roleFilter === 'MIDDLE'
          ? ['MIDDLE', 'MID', 'MIDLANE']
          : roleFilter === 'SUPPORT'
            ? ['SUPPORT', 'UTILITY']
      : roleFilter === 'BOTTOM'
        ? ['BOTTOM', 'ADC', 'BOT']
        : roleFilter
          ? [roleFilter]
          : []
  const roleFilterSqlValueList =
    roleFilterValues.length > 0 ? roleFilterValues.map((r) => `'${r.replace(/'/g, "''")}'`).join(',') : ''

  const matchCount = await sumMatchOutcomeCountUnionLiveArchive(version, rankTier)
  if (matchCount === 0) {
    return { matchCount: 0, rows: [] }
  }

  const pickDenom = 5 * matchCount

  type AggRow = {
    team_id: number
    champion_id: number
    champion_transform: number
    games: number
    wins: number
    sum_phys_d: bigint
    sum_magic_d: bigint
    sum_true_d: bigint
    sum_phys_t: bigint
    sum_magic_t: bigint
    sum_true_t: bigint
    sum_total_t: bigint
    sum_k: bigint
    sum_de: bigint
    sum_a: bigint
  }

  const coreRoleFromForSide = await matchVersionedAggFrom('agg_champion_core_stats', version, 'cf')
  const matchCondSide = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const coreWhereForRole = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cf.')
  const sideRoleSql = roleFilterSqlValueList
    ? ` AND upper(mv.role_norm::text) IN (${roleFilterSqlValueList})`
    : ''
  const rolePlayedCond = roleFilterSqlValueList
    ? ` AND EXISTS (
          SELECT 1
          FROM ${coreRoleFromForSide}
          WHERE cf.champion_id = mv.champion_id
            AND ${coreWhereForRole}
            AND cf.role IN (${roleFilterSqlValueList})
            AND cf.count_game > 0
        )`
    : ''
  const sideFrom = await matchVersionedAggFrom('agg_champion_side_stats', version, 'mv')
  const aggSql = `
    SELECT
      mv.team_num AS team_id,
      mv.champion_id AS champion_id,
      COALESCE(mv.champion_transform, 0)::int AS champion_transform,
      SUM(mv.count_game)::int AS games,
      SUM(mv.count_win)::int AS wins,
      COALESCE(SUM(mv.sum_physical_damage_to_champions), 0)::bigint AS sum_phys_d,
      COALESCE(SUM(mv.sum_magic_damage_to_champions), 0)::bigint AS sum_magic_d,
      COALESCE(SUM(mv.sum_true_damage_to_champions), 0)::bigint AS sum_true_d,
      0::bigint AS sum_phys_t,
      0::bigint AS sum_magic_t,
      0::bigint AS sum_true_t,
      0::bigint AS sum_total_t,
      0::bigint AS sum_k,
      0::bigint AS sum_de,
      0::bigint AS sum_a
    FROM ${sideFrom}
    WHERE ${matchCondSide} AND mv.team_num IN (100, 200)
    ${sideRoleSql}
    ${rolePlayedCond}
    GROUP BY mv.team_num, mv.champion_id, mv.champion_transform
  `
  const aggRows = await queryRawUnsafe<AggRow[]>(aggSql)

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', version, 'cs')
  const bucketFrom = await matchVersionedAggFrom('agg_champion_bucket', version, 'cb')
  const coreWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')
  const coreRoleSql = roleFilterSqlValueList ? ` AND cs.role IN (${roleFilterSqlValueList})` : ''

  const kdaRows = await queryRawUnsafe<
    Array<{
      champion_id: number
      champion_transform: number
      sum_k: bigint
      sum_de: bigint
      sum_a: bigint
    }>
  >(`
    SELECT
      cs.champion_id,
      COALESCE(cs.champion_transform, 0)::int AS champion_transform,
      COALESCE(SUM(cs.sum_kills), 0)::bigint AS sum_k,
      COALESCE(SUM(cs.sum_deaths), 0)::bigint AS sum_de,
      COALESCE(SUM(cs.sum_assists), 0)::bigint AS sum_a
    FROM ${coreFrom}
    WHERE ${coreWhere}
    ${coreRoleSql}
    GROUP BY cs.champion_id, cs.champion_transform
  `)
  const kdaByKey = new Map<string, { k: number; d: number; a: number }>()
  for (const r of kdaRows) {
    const transform = normalizeChampionTransform(r.champion_transform)
    kdaByKey.set(rowKey(Number(r.champion_id), transform), {
      k: Number(r.sum_k ?? 0),
      d: Number(r.sum_de ?? 0),
      a: Number(r.sum_a ?? 0),
    })
  }

  const bucketWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cb.')
  const bucketRoleSql = roleFilterSqlValueList ? ` AND cb.role IN (${roleFilterSqlValueList})` : ''
  const takenRows = await queryRawUnsafe<
    Array<{
      champion_id: number
      champion_transform: number
      phys_t: bigint
      magic_t: bigint
      true_t: bigint
      total_t: bigint
    }>
  >(`
    SELECT
      cb.champion_id,
      COALESCE(cb.champion_transform, 0)::int AS champion_transform,
      COALESCE(SUM(cb.sum_physical_damage_taken), 0)::bigint AS phys_t,
      COALESCE(SUM(cb.sum_magic_damage_taken), 0)::bigint AS magic_t,
      COALESCE(SUM(cb.sum_true_damage_taken), 0)::bigint AS true_t,
      COALESCE(
        SUM(cb.sum_physical_damage_taken + cb.sum_magic_damage_taken + cb.sum_true_damage_taken),
        0
      )::bigint AS total_t
    FROM ${bucketFrom}
    WHERE ${bucketWhere}
    ${bucketRoleSql}
    GROUP BY cb.champion_id, cb.champion_transform
  `)
  const takenByKey = new Map<string, { phys: number; magic: number; true: number; total: number }>()
  for (const r of takenRows) {
    const transform = normalizeChampionTransform(r.champion_transform)
    takenByKey.set(rowKey(Number(r.champion_id), transform), {
      phys: Number(r.phys_t ?? 0),
      magic: Number(r.magic_t ?? 0),
      true: Number(r.true_t ?? 0),
      total: Number(r.total_t ?? 0),
    })
  }

  const matchCondBans = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'bb.')
  const bansFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner_core', version, 'bb')
  const banRows = await queryRawUnsafe<
    Array<{ team_id: number; champion_id: number; cnt: number }>
  >(`
    SELECT
      100 AS team_id,
      bb.banned_champion_id AS champion_id,
      SUM(bb.count_banner_team_100)::int AS cnt
    FROM ${bansFrom}
    WHERE ${matchCondBans}
    GROUP BY bb.banned_champion_id
    HAVING SUM(bb.count_banner_team_100) > 0
    UNION ALL
    SELECT
      200 AS team_id,
      bb.banned_champion_id AS champion_id,
      SUM(bb.count_banner_team_200)::int AS cnt
    FROM ${bansFrom}
    WHERE ${matchCondBans}
    GROUP BY bb.banned_champion_id
    HAVING SUM(bb.count_banner_team_200) > 0
  `)

  const banMap = new Map<string, number>()
  for (const b of banRows) {
    banMap.set(`${Number(b.team_id)}:${Number(b.champion_id)}`, Number(b.cnt))
  }

  const byKey = new Map<string, { championId: number; transform: ChampionTransform; blue: SideAgg; red: SideAgg }>()
  for (const r of aggRows) {
    const cid = Number(r.champion_id)
    const transform = normalizeChampionTransform(r.champion_transform)
    const key = rowKey(cid, transform)
    let e = byKey.get(key)
    if (!e) {
      e = { championId: cid, transform, blue: emptySide(), red: emptySide() }
      byKey.set(key, e)
    }
    const side = Number(r.team_id) === 100 ? e.blue : e.red
    side.games = Number(r.games)
    side.wins = Number(r.wins)
    side.sum_phys_d = Number(r.sum_phys_d)
    side.sum_magic_d = Number(r.sum_magic_d)
    side.sum_true_d = Number(r.sum_true_d)
    side.sum_phys_t = Number(r.sum_phys_t)
    side.sum_magic_t = Number(r.sum_magic_t)
    side.sum_true_t = Number(r.sum_true_t)
    side.sum_total_t = Number(r.sum_total_t)
    side.sum_k = Number(r.sum_k)
    side.sum_de = Number(r.sum_de)
    side.sum_a = Number(r.sum_a)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10

  const mkSide = (championId: number, side: SideAgg, team: 100 | 200): ChampionGlobalTableSide => {
    const g = side.games
    const wr = g > 0 ? Math.round((side.wins / g) * 1000) / 10 : 0
    const pr = pickDenom > 0 ? Math.round((g / pickDenom) * 100000) / 1000 : 0
    const bans = banMap.get(`${team}:${championId}`) ?? 0
    const br = pickDenom > 0 ? Math.round((bans / pickDenom) * 100000) / 1000 : 0
    return { games: g, wins: side.wins, winrate: wr, pickrate: pr, banrate: br }
  }

  const sumKdaForChampion = (championId: number): { k: number; d: number; a: number } | undefined => {
    let k = 0
    let d = 0
    let a = 0
    let found = false
    for (const [key, val] of kdaByKey) {
      if (!key.startsWith(`${championId}:`)) continue
      k += val.k
      d += val.d
      a += val.a
      found = true
    }
    return found ? { k, d, a } : undefined
  }

  const sumTakenForChampion = (
    championId: number
  ): { phys: number; magic: number; true: number; total: number } | undefined => {
    let phys = 0
    let magic = 0
    let trueD = 0
    let total = 0
    let found = false
    for (const [key, val] of takenByKey) {
      if (!key.startsWith(`${championId}:`)) continue
      phys += val.phys
      magic += val.magic
      trueD += val.true
      total += val.total
      found = true
    }
    return found ? { phys, magic, true: trueD, total } : undefined
  }

  const buildRow = (
    championId: number,
    transform: ChampionTransform | null,
    sides: { blue: SideAgg; red: SideAgg }
  ): ChampionGlobalTableRow | null => {
    const tg = sides.blue.games + sides.red.games
    if (tg === 0) return null

    const totalPhysD = sides.blue.sum_phys_d + sides.red.sum_phys_d
    const totalMagicD = sides.blue.sum_magic_d + sides.red.sum_magic_d
    const totalTrueD = sides.blue.sum_true_d + sides.red.sum_true_d
    const totalDmgToChamps = totalPhysD + totalMagicD + totalTrueD

    const taken =
      transform == null
        ? sumTakenForChampion(championId)
        : takenByKey.get(rowKey(championId, transform))
    const totalPhysT = taken?.phys ?? sides.blue.sum_phys_t + sides.red.sum_phys_t
    const totalMagicT = taken?.magic ?? sides.blue.sum_magic_t + sides.red.sum_magic_t
    const totalTrueT = taken?.true ?? sides.blue.sum_true_t + sides.red.sum_true_t
    const totalTakenT = taken?.total ?? sides.blue.sum_total_t + sides.red.sum_total_t

    const kda =
      transform == null ? sumKdaForChampion(championId) : kdaByKey.get(rowKey(championId, transform))
    const totalK = kda?.k ?? sides.blue.sum_k + sides.red.sum_k
    const totalDe = kda?.d ?? sides.blue.sum_de + sides.red.sum_de
    const totalA = kda?.a ?? sides.blue.sum_a + sides.red.sum_a

    const row: ChampionGlobalTableRow = {
      championId,
      blue: mkSide(championId, sides.blue, 100),
      red: mkSide(championId, sides.red, 200),
      totalGames: tg,
      avgDamageToChamps: round1(totalDmgToChamps / tg),
      avgDamageToChampsPhys: round1(totalPhysD / tg),
      avgDamageToChampsMagic: round1(totalMagicD / tg),
      avgDamageToChampsTrue: round1(totalTrueD / tg),
      avgDamageTakenPhys: round1(totalPhysT / tg),
      avgDamageTakenMagic: round1(totalMagicT / tg),
      avgDamageTakenTrue: round1(totalTrueT / tg),
      avgDamageTakenTotal: round1(totalTakenT / tg),
      avgKills: round1(totalK / tg),
      avgDeaths: round1(totalDe / tg),
      avgAssists: round1(totalA / tg),
    }
    if (transform != null) row.championTransform = transform
    return row
  }

  const splitRows: ChampionGlobalTableRow[] = []
  for (const entry of byKey.values()) {
    const row = buildRow(entry.championId, entry.transform, entry)
    if (row) splitRows.push(row)
  }
  splitRows.sort((a, b) => b.totalGames - a.totalGames)

  if (splitTransform) {
    return { matchCount, rows: splitRows }
  }

  const aggregatedByChampion = new Map<number, { blue: SideAgg; red: SideAgg }>()
  for (const entry of byKey.values()) {
    let sides = aggregatedByChampion.get(entry.championId)
    if (!sides) {
      sides = { blue: emptySide(), red: emptySide() }
      aggregatedByChampion.set(entry.championId, sides)
    }
    mergeSideAgg(sides.blue, entry.blue)
    mergeSideAgg(sides.red, entry.red)
  }

  const rows: ChampionGlobalTableRow[] = []
  for (const [championId, sides] of aggregatedByChampion) {
    const row = buildRow(championId, null, sides)
    if (row) rows.push(row)
  }
  rows.sort((a, b) => b.totalGames - a.totalGames)

  const breakdownByChampion = new Map<number, ChampionGlobalTableRow[]>()
  for (const r of splitRows) {
    const list = breakdownByChampion.get(r.championId) ?? []
    list.push(r)
    breakdownByChampion.set(r.championId, list)
  }
  const transformBreakdownFiltered: ChampionGlobalTableRow[] = []
  for (const list of breakdownByChampion.values()) {
    if (list.length === 0) continue
    const hasMultipleForms = list.length > 1
    const hasAlternateForm = list.some((r) => (r.championTransform ?? 0) > 0)
    if (!hasMultipleForms && !hasAlternateForm) continue
    list.sort((a, b) => (a.championTransform ?? 0) - (b.championTransform ?? 0))
    transformBreakdownFiltered.push(...list)
  }

  return {
    matchCount,
    rows,
    transformBreakdown:
      transformBreakdownFiltered.length > 0 ? transformBreakdownFiltered : undefined,
  }
}
