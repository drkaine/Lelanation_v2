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
      Array<{ itemList: string; countWin: number; countGame: number; sumTimestampMs: number }>
    >(`
      SELECT
        it.item_list AS "itemList",
        it.count_win AS "countWin",
        it.count_game AS "countGame",
        it.sum_timestamp_ms AS "sumTimestampMs"
      FROM ${itemsFrom}
      WHERE ${whereSql}
    `)

    const byList = new Map<string, { wins: number; games: number; sumMs: number }>()
    for (const row of itemStatRows) {
      const key = row.itemList
      let entry = byList.get(key)
      if (!entry) {
        entry = { wins: 0, games: 0, sumMs: 0 }
        byList.set(key, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
      entry.sumMs += row.sumTimestampMs
    }

    const builds: BuildRow[] = []
    for (const [listStr, entry] of byList.entries()) {
      if (entry.games < minGames) continue
      let items: number[]
      try {
        items = JSON.parse(listStr) as number[]
        if (!Array.isArray(items)) items = []
      } catch {
        items = []
      }
      builds.push({
        items,
        games: entry.games,
        wins: entry.wins,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
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
