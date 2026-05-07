import { isDatabaseConfigured, prisma } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

export type ChampionSpellOrderRow = {
  key: string
  order: number[]
  games: number
  wins: number
  pickrate: number
  winrate: number
}

function norm(value: string | string[] | null | undefined): string | null {
  if (value == null) return null
  const s = Array.isArray(value) ? value[0] : value
  if (typeof s !== 'string' || s === '' || s.startsWith('[')) return null
  return s
}

export async function getChampionSpellOrders(options: {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  minGames?: number | null
}): Promise<{ totalGames: number; rows: ChampionSpellOrderRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const championId = options.championId
  const pVersion = norm(options.version ?? null)
  const role = norm(options.role ?? null)?.toUpperCase() ?? null
  const minGames = Math.max(1, Math.trunc(Number(options.minGames ?? 10)))
  try {
    const filters: string[] = [`cc.champion_id = ${championId}`]
    if (pVersion) {
      filters.push(`cc.game_version LIKE '${normalizePatchMajorMinor(pVersion).replace(/'/g, "''")}%'`)
    }
    const ranks = toQueryStringArrayParam(options.rankTier).map((r) => r.toUpperCase())
    if (ranks.length === 1) filters.push(`cc.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
    else if (ranks.length > 1) {
      filters.push(`cc.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
    } else {
      filters.push(`cc.rank_tier <> 'UNRANKED'`)
    }
    if (role) filters.push(`cc.role = '${role.replace(/'/g, "''")}'`)
    const whereSql = filters.join(' AND ')

    const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'cc')
    const spellsFrom = await matchVersionedAggFrom('agg_champion_spells_stats', pVersion, 'cs')
    const totalRows = await prisma.$queryRawUnsafe<Array<{ totalGames: bigint }>>(`
      SELECT COALESCE(SUM(cc.count_game), 0)::bigint AS "totalGames"
      FROM ${coreFrom}
      WHERE ${whereSql}
    `)
    const totalGames = Number(totalRows[0]?.totalGames ?? 0)
    if (totalGames <= 0) return { totalGames: 0, rows: [] }

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        key: string
        games: bigint
        wins: bigint
      }>
    >(`
      SELECT
        e.key AS key,
        COALESCE(SUM(NULLIF(e.value->>'number_of_games', '')::bigint), 0)::bigint AS games,
        COALESCE(SUM(NULLIF(e.value->>'number_of_wins', '')::bigint), 0)::bigint AS wins
      FROM ${spellsFrom}
      INNER JOIN ${coreFrom} ON cc.id = cs.champion_stat_id
      CROSS JOIN LATERAL jsonb_each(COALESCE(cs.spell_order, '{}'::jsonb)) AS e(key, value)
      WHERE ${whereSql}
      GROUP BY e.key
      HAVING COALESCE(SUM(NULLIF(e.value->>'number_of_games', '')::bigint), 0)::bigint >= ${minGames}
      ORDER BY games DESC
    `)

    const out: ChampionSpellOrderRow[] = rows.map((r) => {
      const games = Number(r.games ?? 0)
      const wins = Number(r.wins ?? 0)
      const order = String(r.key ?? '')
        .split('-')
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 4)
      return {
        key: String(r.key ?? ''),
        order,
        games,
        wins,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
      }
    })

    return { totalGames, rows: out }
  } catch (err) {
    console.warn('[getChampionSpellOrders]', err)
    return null
  }
}
