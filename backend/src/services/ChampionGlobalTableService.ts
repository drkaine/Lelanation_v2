/**
 * Table globale champions : WR / pick / ban par côté, dégâts moyens, KDA.
 * Runtime source policy: incremental aggregate tables.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

export function buildRawMatchCond(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1) parts.push(`m.game_version LIKE '${versions[0].replace(/'/g, "''")}%'`)
  else if (versions.length > 1)
    parts.push(`m.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  if (ranks.length === 1) parts.push(`m.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) parts.push(`m.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  else parts.push(`m.rank_tier <> 'UNRANKED'`)
  return parts.length > 0 ? parts.join(' AND ') : '1=1'
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

  const matchCondMatchOutcome = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')
  const matchCountRows = await prisma.$queryRawUnsafe<Array<{ mc: bigint }>>(`
    SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS mc
    FROM agg_match_outcome_stats mo
    WHERE ${matchCondMatchOutcome}
  `)
  const matchCount = Math.max(0, Number(matchCountRows[0]?.mc ?? 0))
  if (matchCount === 0) {
    return { matchCount: 0, rows: [] }
  }

  const pickDenom = 5 * matchCount

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

  const matchCondSide = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const roleSql =
    roleFilter !== '' ? ` AND mv.role_norm = '${roleFilter.replace(/'/g, "''")}'` : ''
  const aggSql = `
    SELECT
      mv.team_num AS team_id,
      mv.champion_id AS champion_id,
      SUM(mv.count_game)::int AS games,
      SUM(mv.count_win)::int AS wins,
      0::bigint AS sum_phys_d,
      0::bigint AS sum_magic_d,
      0::bigint AS sum_true_d,
      0::bigint AS sum_phys_t,
      0::bigint AS sum_magic_t,
      0::bigint AS sum_true_t,
      0::bigint AS sum_total_t,
      0::bigint AS sum_k,
      0::bigint AS sum_de,
      0::bigint AS sum_a
    FROM agg_champion_side_stats mv
    WHERE ${matchCondSide} AND mv.team_num IN (100, 200)
    ${roleSql}
    GROUP BY mv.team_num, mv.champion_id
  `
  const aggRows = await prisma.$queryRawUnsafe<AggRow[]>(aggSql)

  const matchCondBans = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const banRows = await prisma.$queryRawUnsafe<
    Array<{ team_id: number; champion_id: number; cnt: number }>
  >(`
    SELECT
      mv.team_num AS team_id,
      mv.banned_champion_id AS champion_id,
      SUM(mv.ban_count)::int AS cnt
    FROM agg_champion_bans_by_banner mv
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

    const totalPhysT = sides.blue.sum_phys_t + sides.red.sum_phys_t
    const totalMagicT = sides.blue.sum_magic_t + sides.red.sum_magic_t
    const totalTrueT = sides.blue.sum_true_t + sides.red.sum_true_t
    const totalTakenT = sides.blue.sum_total_t + sides.red.sum_total_t

    const totalK = sides.blue.sum_k + sides.red.sum_k
    const totalDe = sides.blue.sum_de + sides.red.sum_de
    const totalA = sides.blue.sum_a + sides.red.sum_a

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
