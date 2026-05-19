/**
 * Table globale champions : WR / pick / ban par côté, dégâts moyens, KDA.
 * Runtime source policy: incremental aggregate tables.
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import {
  liveAggRelationExists,
  matchVersionedAggFrom,
  normalizePatchMajorMinor,
  sqlAggOrArchiveRelation,
  sqlAggUnionAllLiveAndArchives,
} from './statsAggArchive.js'

export function buildRawMatchCond(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1)
    parts.push(`m.game_version LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`)
  else if (versions.length > 1)
    parts.push(`m.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  if (ranks.length === 1) parts.push(`m.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) parts.push(`m.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  else parts.push(`m.rank_tier <> 'UNRANKED'`)
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

export type ChampionGlobalTableRow = {
  championId: number
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

export async function getChampionGlobalTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ matchCount: number; rows: ChampionGlobalTableRow[] } | null> {
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
  const hasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName) || !/^[a-z][a-z0-9_]*$/.test(columnName)) return false
    const rows = await queryRawUnsafe<Array<{ ok: number }>>(`
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = '${tableName}'
          AND c.column_name = '${columnName}'
      ) THEN 1 ELSE 0 END AS ok
    `)
    return Number(rows[0]?.ok ?? 0) === 1
  }

  /** Column must exist on every physical table that can appear in `matchVersionedAggFrom` for this version. */
  const normalizeSingleVersionKey = (v: string | string[] | null | undefined): string | null => {
    const arr = toQueryStringArrayParam(v)
    if (arr.length !== 1) return null
    return normalizePatchMajorMinor(arr[0]!)
  }

  const archiveAggExists = async (aggTableName: string): Promise<boolean> => {
    if (!/^[a-z][a-z0-9_]*$/.test(aggTableName)) return false
    const archive = `archive_${aggTableName}`
    const rows = await queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT CASE WHEN to_regclass('public.${archive}') IS NOT NULL THEN 1 ELSE 0 END AS ok`
    )
    return Number(rows[0]?.ok ?? 0) === 1
  }

  const physicalAggTablesForVersion = async (
    aggTableName: string,
    version: string | string[] | null | undefined
  ): Promise<string[]> => {
    if (!/^[a-z][a-z0-9_]*$/.test(aggTableName)) return [aggTableName]
    const single = normalizeSingleVersionKey(version)
    if (single) {
      const rel = await sqlAggOrArchiveRelation(aggTableName, single)
      if (rel?.includes('UNION ALL')) {
        const tables: string[] = []
        if (await archiveAggExists(aggTableName)) tables.push(`archive_${aggTableName}`)
        if (await liveAggRelationExists(aggTableName)) tables.push(aggTableName)
        return tables.length > 0 ? tables : [aggTableName]
      }
      const r = rel ?? aggTableName
      if (r.includes('(')) return [`archive_${aggTableName}`]
      return [aggTableName]
    }
    if (await archiveAggExists(aggTableName)) {
      if (await liveAggRelationExists(aggTableName)) {
        return [`archive_${aggTableName}`, aggTableName]
      }
      return [`archive_${aggTableName}`]
    }
    return [aggTableName]
  }

  const hasColumnOnAllBranches = async (
    aggTableName: string,
    columnName: string
  ): Promise<boolean> => {
    const tables = await physicalAggTablesForVersion(aggTableName, version)
    for (const t of tables) {
      if (!(await hasColumn(t, columnName))) return false
    }
    return true
  }

  type AggRow = {
    team_id: number
    champion_id: number
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
    GROUP BY mv.team_num, mv.champion_id
  `
  const aggRows = await queryRawUnsafe<AggRow[]>(aggSql)

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', version, 'cs')
  const bucketFrom = await matchVersionedAggFrom('agg_champion_bucket', version, 'cb')
  const partFrom = await matchVersionedAggFrom('agg_champion_participant_stats', version, 'ps')
  const coreWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')
  const coreRoleSql = roleFilterSqlValueList ? ` AND cs.role IN (${roleFilterSqlValueList})` : ''
  const coreHasSumKills = await hasColumnOnAllBranches('agg_champion_core_stats', 'sum_kills')
  const coreHasSumDeaths = await hasColumnOnAllBranches('agg_champion_core_stats', 'sum_deaths')
  const coreHasSumAssists = await hasColumnOnAllBranches('agg_champion_core_stats', 'sum_assists')
  const partHasSumKills = await hasColumnOnAllBranches('agg_champion_participant_stats', 'sum_kills')
  const partHasSumAssists = await hasColumnOnAllBranches('agg_champion_participant_stats', 'sum_assists')
  const partHasSumDeaths = await hasColumnOnAllBranches('agg_champion_participant_stats', 'sum_deaths')
  const partHasSumDeathsByEnemy = await hasColumnOnAllBranches(
    'agg_champion_participant_stats',
    'sum_deaths_by_enemy_champs'
  )
  const usePartForKda =
    !coreHasSumKills ||
    !coreHasSumDeaths ||
    !coreHasSumAssists ||
    partHasSumKills ||
    partHasSumAssists ||
    partHasSumDeaths ||
    partHasSumDeathsByEnemy
  const kExpr = coreHasSumKills
    ? 'COALESCE(SUM(cs.sum_kills), 0)::bigint'
    : partHasSumKills
      ? 'COALESCE(SUM(ps.sum_kills), 0)::bigint'
      : '0::bigint'
  const dExpr = coreHasSumDeaths
    ? 'COALESCE(SUM(cs.sum_deaths), 0)::bigint'
    : partHasSumDeaths
      ? 'COALESCE(SUM(ps.sum_deaths), 0)::bigint'
      : partHasSumDeathsByEnemy
        ? 'COALESCE(SUM(ps.sum_deaths_by_enemy_champs), 0)::bigint'
        : '0::bigint'
  const aExpr = coreHasSumAssists
    ? 'COALESCE(SUM(cs.sum_assists), 0)::bigint'
    : partHasSumAssists
      ? 'COALESCE(SUM(ps.sum_assists), 0)::bigint'
      : '0::bigint'
  const kdaJoinSql = usePartForKda ? ` LEFT JOIN ${partFrom} ON ps.champion_stat_id = cs.id` : ''

  const kdaRows = await queryRawUnsafe<
    Array<{ champion_id: number; sum_k: bigint; sum_de: bigint; sum_a: bigint }>
  >(`
    SELECT
      cs.champion_id,
      ${kExpr} AS sum_k,
      ${dExpr} AS sum_de,
      ${aExpr} AS sum_a
    FROM ${coreFrom}
    ${kdaJoinSql}
    WHERE ${coreWhere}
    ${coreRoleSql}
    GROUP BY cs.champion_id
  `)
  const kdaByChampion = new Map<number, { k: number; d: number; a: number }>()
  for (const r of kdaRows) {
    kdaByChampion.set(Number(r.champion_id), {
      k: Number(r.sum_k ?? 0),
      d: Number(r.sum_de ?? 0),
      a: Number(r.sum_a ?? 0),
    })
  }

  const takenRows = await queryRawUnsafe<
    Array<{ champion_id: number; phys_t: bigint; magic_t: bigint; true_t: bigint; total_t: bigint }>
  >(`
    SELECT
      cs.champion_id,
      COALESCE(SUM(cb.sum_physical_damage_taken), 0)::bigint AS phys_t,
      COALESCE(SUM(cb.sum_magic_damage_taken), 0)::bigint AS magic_t,
      COALESCE(SUM(cb.sum_true_damage_taken), 0)::bigint AS true_t,
      COALESCE(SUM(cb.sum_total_damage_taken), 0)::bigint AS total_t
    FROM ${coreFrom}
    JOIN ${bucketFrom} ON cb.champion_stat_id = cs.id
    WHERE ${coreWhere}
    ${coreRoleSql}
    GROUP BY cs.champion_id
  `)
  const takenByChampion = new Map<number, { phys: number; magic: number; true: number; total: number }>()
  for (const r of takenRows) {
    takenByChampion.set(Number(r.champion_id), {
      phys: Number(r.phys_t ?? 0),
      magic: Number(r.magic_t ?? 0),
      true: Number(r.true_t ?? 0),
      total: Number(r.total_t ?? 0),
    })
  }

  const matchCondBans = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const bansFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', version, 'mv')
  const banRows = await queryRawUnsafe<
    Array<{ team_id: number; champion_id: number; cnt: number }>
  >(`
    SELECT
      mv.team_num AS team_id,
      mv.banned_champion_id AS champion_id,
      SUM(mv.ban_count)::int AS cnt
    FROM ${bansFrom}
    WHERE ${matchCondBans} AND mv.team_num IN (100, 200)
    GROUP BY mv.team_num, mv.banned_champion_id
  `)

  const banMap = new Map<string, number>()
  for (const b of banRows) {
    banMap.set(`${Number(b.team_id)}:${Number(b.champion_id)}`, Number(b.cnt))
  }

  const byChamp = new Map<number, { blue: SideAgg; red: SideAgg }>()
  for (const r of aggRows) {
    const cid = Number(r.champion_id)
    let e = byChamp.get(cid)
    if (!e) {
      e = { blue: emptySide(), red: emptySide() }
      byChamp.set(cid, e)
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

  const rows: ChampionGlobalTableRow[] = []
  for (const [championId, sides] of byChamp) {
    const tg = sides.blue.games + sides.red.games
    if (tg === 0) continue

    const totalPhysD = sides.blue.sum_phys_d + sides.red.sum_phys_d
    const totalMagicD = sides.blue.sum_magic_d + sides.red.sum_magic_d
    const totalTrueD = sides.blue.sum_true_d + sides.red.sum_true_d
    const totalDmgToChamps = totalPhysD + totalMagicD + totalTrueD

    const taken = takenByChampion.get(championId)
    const totalPhysT = taken?.phys ?? sides.blue.sum_phys_t + sides.red.sum_phys_t
    const totalMagicT = taken?.magic ?? sides.blue.sum_magic_t + sides.red.sum_magic_t
    const totalTrueT = taken?.true ?? sides.blue.sum_true_t + sides.red.sum_true_t
    const totalTakenT = taken?.total ?? sides.blue.sum_total_t + sides.red.sum_total_t

    const kda = kdaByChampion.get(championId)
    const totalK = kda?.k ?? sides.blue.sum_k + sides.red.sum_k
    const totalDe = kda?.d ?? sides.blue.sum_de + sides.red.sum_de
    const totalA = kda?.a ?? sides.blue.sum_a + sides.red.sum_a

    rows.push({
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
    })
  }

  rows.sort((a, b) => b.totalGames - a.totalGames)
  return { matchCount, rows }
}
