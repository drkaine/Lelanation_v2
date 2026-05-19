/**
 * Builds stats by champion from champion_item_stats and champion_item_solo_stats aggregate tables.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

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

async function getCoreStatIdsAndTotalGames(options: {
  championId: number
  patch?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
}): Promise<{ statIds: bigint[]; totalGames: number }> {
  const { championId, patch, rankTier, role, region } = options
  const filters: string[] = [`champion_id = ${championId}`]
  if (patch) filters.push(`game_version LIKE '${normalizePatchMajorMinor(patch).replace(/'/g, "''")}%'`)
  if (role) filters.push(`role = '${role.replace(/'/g, "''")}'`)
  if (region) filters.push(`region = '${region.replace(/'/g, "''")}'`)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  } else {
    filters.push(`rank_tier <> 'UNRANKED'`)
  }
  const whereSql = filters.join(' AND ')
  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', patch ?? null, 'cc')
  const coreStats = await queryRawUnsafe<Array<{ id: bigint; countGame: number }>>(`
    SELECT id, count_game AS "countGame"
    FROM ${coreFrom}
    WHERE ${whereSql}
  `)
  return {
    statIds: coreStats.map((s) => s.id),
    totalGames: coreStats.reduce((sum, r) => sum + Number(r.countGame ?? 0), 0),
  }
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

    const { statIds, totalGames } = await getCoreStatIdsAndTotalGames({
      championId,
      patch: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (statIds.length === 0) return { totalGames: 0, builds: [], soloItems: [] }

    const itemsFrom = await matchVersionedAggFrom('agg_champion_item_stats', pPatch, 'it')

    // Item combinations
    const itemStatRows = await queryRawUnsafe<
      Array<{ itemList: string; countWin: number; countGame: number; sumTimestampMs: number }>
    >(`
      SELECT
        item_list AS "itemList",
        count_win AS "countWin",
        count_game AS "countGame",
        sum_timestamp_ms AS "sumTimestampMs"
      FROM ${itemsFrom}
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

    // Aggregate by item_list
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

    // Solo items
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
        item_id AS "itemId",
        count_starter AS "countStarter",
        count_core AS "countCore",
        count_win AS "countWin",
        count_game AS "countGame",
        sum_timestamp_ms AS "sumTimestampMs"
      FROM ${soloFrom}
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

    const bySolo = new Map<
      number,
      { starter: number; core: number; wins: number; games: number; sumMs: number }
    >()
    for (const row of soloRows) {
      const id = row.itemId
      let entry = bySolo.get(id)
      if (!entry) {
        entry = { starter: 0, core: 0, wins: 0, games: 0, sumMs: 0 }
        bySolo.set(id, entry)
      }
      entry.starter += row.countStarter
      entry.core += row.countCore
      entry.wins += row.countWin
      entry.games += row.countGame
      entry.sumMs += row.sumTimestampMs
    }

    const soloItems: ItemSoloRow[] = []
    for (const [itemId, entry] of bySolo.entries()) {
      if (entry.games < minGames) continue
      soloItems.push({
        itemId,
        countStarter: entry.starter,
        countCore: entry.core,
        games: entry.games,
        wins: entry.wins,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
        avgTimestampMs: entry.games > 0 ? Math.round(entry.sumMs / entry.games) : 0,
      })
    }
    soloItems.sort((a, b) => b.games - a.games)

    return { totalGames, builds, soloItems }
  } catch {
    return null
  }
}
