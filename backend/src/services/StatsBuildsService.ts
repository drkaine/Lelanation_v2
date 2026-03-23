/**
 * Builds stats by champion from champion_item_stats and champion_item_solo_stats aggregate tables.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { applyRankTierWhere } from '../utils/statsFilters.js'

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

    const coreWhere: Record<string, unknown> = { championId }
    applyRankTierWhere(coreWhere, rankTier)
    if (pRole) coreWhere.role = pRole
    if (pPatch) coreWhere.gameVersion = pPatch
    if (pRegion) coreWhere.region = pRegion

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true, countGame: true },
    })
    if (coreStats.length === 0) return { totalGames: 0, builds: [], soloItems: [] }

    const totalGames = coreStats.reduce((sum, r) => sum + r.countGame, 0)
    const statIds = coreStats.map((s) => s.id)

    // Item combinations
    const itemStatRows = await prisma.mvChampionItemStat.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        itemList: true,
        countWin: true,
        countGame: true,
        sumTimestampMs: true,
      },
    })

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

    // Solo items
    const soloRows = await prisma.mvChampionItemSoloStat.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        itemId: true,
        countStarter: true,
        countCore: true,
        countWin: true,
        countGame: true,
        sumTimestampMs: true,
      },
    })

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
