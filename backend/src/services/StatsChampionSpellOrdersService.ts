import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, sumChampionCoreGames } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

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
  const role = norm(options.role ?? null)
  const minGames = Math.max(1, Math.trunc(Number(options.minGames ?? 10)))
  try {
    const totalGames = await sumChampionCoreGames({
      championId,
      version: pVersion,
      rankTier: options.rankTier ?? null,
      role,
    })
    if (totalGames <= 0) return { totalGames: 0, rows: [] }

    const spellsFrom = await matchVersionedAggFrom('agg_champion_spells_stats', pVersion, 'cs')
    const whereSql = buildChampionScopedWhere('cs', {
      championId,
      version: pVersion,
      rankTier: options.rankTier ?? null,
      role,
    })

    const rows = await queryRawUnsafe<
      Array<{
        key: string
        games: bigint
        wins: bigint
      }>
    >(`
      SELECT
        cs.spell_order AS key,
        SUM(cs.count_game)::bigint AS games,
        SUM(cs.count_win)::bigint AS wins
      FROM ${spellsFrom}
      WHERE ${whereSql}
      GROUP BY cs.spell_order
      HAVING SUM(cs.count_game) >= ${minGames}
      ORDER BY games DESC
      LIMIT 200
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
