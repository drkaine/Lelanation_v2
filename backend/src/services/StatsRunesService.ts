/**
 * Runes stats by champion from champion_runes_stats (combinations) and
 * champion_runes_solo_stats (per-rune) aggregate tables.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { applyRankTierWhere } from '../utils/statsFilters.js'

export interface RuneRow {
  runes: unknown
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface RunesByChampionOptions {
  championId: number
  rankTier?: string | string[] | null
  patch?: string | null
  role?: string | null
  region?: string | null
  minGames?: number
  limit?: number
}

export async function getRunesByChampion(
  options: RunesByChampionOptions
): Promise<{ totalGames: number; runes: RuneRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, patch, role, region, minGames = 10, limit = 20 } = options
  try {
    const pPatch = patch != null && patch !== '' ? patch : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    const coreWhere: Record<string, unknown> = { championId }
    applyRankTierWhere(coreWhere, rankTier)
    if (pPatch) coreWhere.gameVersion = pPatch
    if (pRole) coreWhere.role = pRole
    if (pRegion) coreWhere.region = pRegion

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true, countGame: true },
    })
    if (coreStats.length === 0) return { totalGames: 0, runes: [] }

    const totalGames = coreStats.reduce((sum, r) => sum + r.countGame, 0)
    const statIds = coreStats.map((s) => s.id)

    const runeStatRows = await prisma.mvChampionRunesStat.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        runeList: true,
        countWin: true,
        countGame: true,
      },
    })

    const byList = new Map<string, { wins: number; games: number }>()
    for (const row of runeStatRows) {
      const key = row.runeList
      let entry = byList.get(key)
      if (!entry) {
        entry = { wins: 0, games: 0 }
        byList.set(key, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
    }

    const runes: RuneRow[] = []
    for (const [listStr, entry] of byList.entries()) {
      if (entry.games < minGames) continue
      let parsedRunes: unknown
      try {
        parsedRunes = JSON.parse(listStr)
      } catch {
        parsedRunes = listStr
      }
      runes.push({
        runes: parsedRunes,
        games: entry.games,
        wins: entry.wins,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
      })
    }
    runes.sort((a, b) => b.games - a.games)
    runes.splice(limit)

    return { totalGames, runes }
  } catch {
    return null
  }
}

/** Per-rune stats for a champion. */
export interface RuneStatRow {
  runeId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

export interface RuneStatsByChampionOptions {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
  minGames?: number
}

export async function getRuneStatsByChampion(
  options: RuneStatsByChampionOptions
): Promise<{ totalGames: number; runes: RuneStatRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, version, rankTier, role, region, minGames = 10 } = options
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    const coreWhere: Record<string, unknown> = { championId }
    if (pVersion) coreWhere.gameVersion = pVersion
    applyRankTierWhere(coreWhere, rankTier)
    if (pRole) coreWhere.role = pRole
    if (pRegion) coreWhere.region = pRegion

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true, countGame: true },
    })
    if (coreStats.length === 0) return { totalGames: 0, runes: [] }

    const totalGames = coreStats.reduce((sum, r) => sum + r.countGame, 0)
    const statIds = coreStats.map((s) => s.id)

    const soloRows = await prisma.mvChampionRunesSoloStat.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        perkId: true,
        style: true,
        countWin: true,
        countGame: true,
      },
    })

    // Aggregate by runeId
    const byRune = new Map<number, { wins: number; games: number }>()
    for (const row of soloRows) {
      const rid = row.perkId
      let entry = byRune.get(rid)
      if (!entry) {
        entry = { wins: 0, games: 0 }
        byRune.set(rid, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
    }

    const runes: RuneStatRow[] = []
    for (const [runeId, entry] of byRune.entries()) {
      if (entry.games < minGames) continue
      runes.push({
        runeId,
        games: entry.games,
        wins: entry.wins,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
      })
    }
    runes.sort((a, b) => b.games - a.games)

    return { totalGames, runes }
  } catch {
    return null
  }
}

/** Shard solo stats (per shard per slot) for a champion. */
export interface ShardStatRow {
  shardId: number
  slot: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

export async function getShardStatsByChampion(options: {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
  minGames?: number
}): Promise<{ totalGames: number; shards: ShardStatRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, version, rankTier, role, region, minGames = 10 } = options
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    const coreWhere: Record<string, unknown> = { championId }
    if (pVersion) coreWhere.gameVersion = pVersion
    applyRankTierWhere(coreWhere, rankTier)
    if (pRole) coreWhere.role = pRole
    if (pRegion) coreWhere.region = pRegion

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true, countGame: true },
    })
    if (coreStats.length === 0) return { totalGames: 0, shards: [] }

    const totalGames = coreStats.reduce((sum, r) => sum + r.countGame, 0)
    const statIds = coreStats.map((s) => s.id)

    const shardRows = await prisma.mvChampionShardSoloStat.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        shardId: true,
        slot: true,
        countWin: true,
        countGame: true,
      },
    })

    const byShardSlot = new Map<string, { shardId: number; slot: number; wins: number; games: number }>()
    for (const row of shardRows) {
      const key = `${row.shardId}:${row.slot}`
      let entry = byShardSlot.get(key)
      if (!entry) {
        entry = { shardId: row.shardId, slot: row.slot, wins: 0, games: 0 }
        byShardSlot.set(key, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
    }

    const shards: ShardStatRow[] = []
    for (const entry of byShardSlot.values()) {
      if (entry.games < minGames) continue
      shards.push({
        shardId: entry.shardId,
        slot: entry.slot,
        games: entry.games,
        wins: entry.wins,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
      })
    }
    shards.sort((a, b) => b.games - a.games)

    return { totalGames, shards }
  } catch {
    return null
  }
}
