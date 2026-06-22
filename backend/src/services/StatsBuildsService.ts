/**
 * Builds stats by champion from champion_item_stats and champion_item_solo_stats aggregate tables.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, sumChampionCoreGames } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

export interface BuildRow {
  items: number[]
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface ItemSoloRow {
  itemId: number
  countStarter: number
  countCore: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  avgTimestampMs: number
}

export interface BuildsByChampionOptions {
  championId: number
  rankTier?: string | string[] | null
  role?: string | null
  patch?: string | null
  region?: string | null
  minGames?: number
  limit?: number
}

function parseItemSetKeyString(key: string): number[] {
  if (!key) return []
  const trimmed = key.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0)
      }
    } catch {
      /* legacy JSON */
    }
  }
  return trimmed
    .split('_')
    .map(x => Number(x.trim()))
    .filter(n => Number.isFinite(n) && n > 0)
}

export async function getBuildsByChampion(
  options: BuildsByChampionOptions
): Promise<{ totalGames: number; builds: BuildRow[]; soloItems?: ItemSoloRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, role, patch, region, minGames = 10, limit = 20 } = options
  try {
    const pRole = role != null && role !== '' ? role : null
    const pPatch = patch != null && patch !== '' ? patch : null
    const pRegion = region != null && region !== '' ? region : null

    const totalGames = await sumChampionCoreGames({
      championId,
      version: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (totalGames <= 0) return { totalGames: 0, builds: [], soloItems: [] }

    const itemsFrom = await matchVersionedAggFrom('agg_champion_item_stats', pPatch, 'it')
    const whereSql = buildChampionScopedWhere('it', {
      championId,
      version: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })

    const itemStatRows = await queryRawUnsafe<
      Array<{ itemList: string; countWin: number; countGame: number }>
    >(`
      SELECT
        it.item_set_key AS "itemList",
        SUM(it.count_win)::integer AS "countWin",
        SUM(it.count_game)::integer AS "countGame"
      FROM ${itemsFrom}
      WHERE ${whereSql}
        AND it.phase = 'final'
        AND it.item_set_key <> ''
      GROUP BY it.item_set_key
    `)

    const builds: BuildRow[] = []
    for (const row of itemStatRows) {
      const games = Number(row.countGame ?? 0)
      const wins = Number(row.countWin ?? 0)
      if (games < minGames) continue
      builds.push({
        items: parseItemSetKeyString(row.itemList),
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
      })
    }
    builds.sort((a, b) => b.games - a.games)
    builds.splice(limit)

    const soloFrom = await matchVersionedAggFrom('agg_champion_item_solo_stats', pPatch, 'iso')
    const soloWhere = buildChampionScopedWhere('iso', {
      championId,
      version: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })

    const soloRows = await queryRawUnsafe<
      Array<{
        itemId: number
        countStarter: number
        countCore: number
        countWin: number
        countGame: number
        sumTimestampMs: number
      }>
    >(`
      SELECT
        iso.item_id AS "itemId",
        SUM(iso.count_starter)::integer AS "countStarter",
        SUM(iso.count_core)::integer AS "countCore",
        SUM(iso.count_win)::integer AS "countWin",
        SUM(iso.count_game)::integer AS "countGame",
        SUM(iso.sum_timestamp_ms)::bigint AS "sumTimestampMs"
      FROM ${soloFrom}
      WHERE ${soloWhere}
      GROUP BY iso.item_id
    `)

    const soloItems: ItemSoloRow[] = []
    for (const row of soloRows) {
      const games = Number(row.countGame ?? 0)
      const wins = Number(row.countWin ?? 0)
      if (games < minGames) continue
      soloItems.push({
        itemId: row.itemId,
        countStarter: Number(row.countStarter ?? 0),
        countCore: Number(row.countCore ?? 0),
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
        avgTimestampMs: games > 0 ? Math.round(Number(row.sumTimestampMs ?? 0) / games) : 0,
      })
    }
    soloItems.sort((a, b) => b.games - a.games)

    return { totalGames, builds, soloItems }
  } catch (err) {
    console.warn('[getBuildsByChampion]', err)
    return null
  }
}
