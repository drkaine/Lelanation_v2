import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, sumChampionCoreGames } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import {
  CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS,
  shouldIncludeSpellOrderAggregateRow,
  spellOrderLevelCount,
} from './championSpellOrderDuration.js'

export { CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS } from './championSpellOrderDuration.js'

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
  minGameDurationMs?: number | null
}): Promise<{ totalGames: number; rows: ChampionSpellOrderRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const championId = options.championId
  const pVersion = norm(options.version ?? null)
  const role = norm(options.role ?? null)
  const minGames = Math.max(1, Math.trunc(Number(options.minGames ?? 10)))
  const minGameDurationMs = Math.max(
    0,
    Math.trunc(Number(options.minGameDurationMs ?? CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS))
  )
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

    const durationHaving =
      minGameDurationMs > 0
        ? ` AND (
            SUM(cs.sum_timestamp_ms) = 0
            OR (2 * SUM(cs.sum_timestamp_ms)::float8) >= ${minGameDurationMs}::float8
              * (LENGTH(cs.spell_order) - LENGTH(REPLACE(cs.spell_order, '-', '')) + 1)
              * SUM(cs.count_game)::float8
          )`
        : ''

    const rows = await queryRawUnsafe<
      Array<{
        key: string
        games: bigint
        wins: bigint
        sumTimestampMs: bigint
      }>
    >(`
      SELECT
        cs.spell_order AS key,
        SUM(cs.count_game)::bigint AS games,
        SUM(cs.count_win)::bigint AS wins,
        SUM(cs.sum_timestamp_ms)::bigint AS "sumTimestampMs"
      FROM ${spellsFrom}
      WHERE ${whereSql}
        AND TRIM(cs.spell_order) <> ''
      GROUP BY cs.spell_order
      HAVING SUM(cs.count_game) >= ${minGames}${durationHaving}
      ORDER BY games DESC
      LIMIT 200
    `)

    const out: ChampionSpellOrderRow[] = []
    for (const r of rows) {
      const games = Number(r.games ?? 0)
      const wins = Number(r.wins ?? 0)
      const key = String(r.key ?? '').trim()
      if (!key) continue
      const sumTs = Number(r.sumTimestampMs ?? 0)
      if (!shouldIncludeSpellOrderAggregateRow(sumTs, games, key, minGameDurationMs)) {
        continue
      }
      const levelCount = spellOrderLevelCount(key)
      if (levelCount <= 0) continue
      const order = key
        .split('-')
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 4)
      if (order.length !== levelCount) continue
      out.push({
        key,
        order,
        games,
        wins,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
      })
    }

    return { totalGames, rows: out }
  } catch (err) {
    console.warn('[getChampionSpellOrders]', err)
    return null
  }
}
