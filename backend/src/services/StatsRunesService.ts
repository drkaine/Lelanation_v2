/**
 * Runes stats by champion from champion_runes_stats (combinations) and
 * champion_runes_solo_stats (per-rune) aggregate tables.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { mergeLegacyStatShardAggregates } from '../utils/statShardLegacyMerge.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

export interface RuneRow {
  runes: unknown
  /** Stat shards (mp.shards), même ordre que dans les matchs. */
  shards: number[]
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

async function getCoreStatIdsAndTotalGames(options: {
  championId: number
  versionOrPatch?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
}): Promise<{ statIds: bigint[]; totalGames: number }> {
  const { championId, versionOrPatch, rankTier, role, region } = options
  const filters: string[] = [`champion_id = ${championId}`]
  if (versionOrPatch)
    filters.push(`game_version LIKE '${normalizePatchMajorMinor(String(versionOrPatch)).replace(/'/g, "''")}%'`)
  if (role) filters.push(`role = '${String(role).replace(/'/g, "''")}'`)
  if (region) filters.push(`region = '${String(region).replace(/'/g, "''")}'`)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  } else {
    filters.push(`rank_tier <> 'UNRANKED'`)
  }
  const whereSql = filters.join(' AND ')
  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', versionOrPatch ?? null, 'cc')
  const coreStats = await prisma.$queryRawUnsafe<Array<{ id: bigint; countGame: number }>>(`
    SELECT id, count_game AS "countGame"
    FROM ${coreFrom}
    WHERE ${whereSql}
  `)
  return {
    statIds: coreStats.map((s) => s.id),
    totalGames: coreStats.reduce((sum, r) => sum + Number(r.countGame ?? 0), 0),
  }
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

    const { statIds, totalGames } = await getCoreStatIdsAndTotalGames({
      championId,
      versionOrPatch: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (statIds.length === 0) return { totalGames: 0, runes: [] }

    const runesFrom = await matchVersionedAggFrom('agg_champion_runes_stats', pPatch, 'rs')

    const runeStatRows = await prisma.$queryRawUnsafe<
      Array<{ runeList: string; shardList: string; countWin: number; countGame: number }>
    >(`
      SELECT
        rune_list AS "runeList",
        shard_list AS "shardList",
        count_win AS "countWin",
        count_game AS "countGame"
      FROM ${runesFrom}
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

    const aggKeySep = '\u001e'
    const parseShardListCsv = (csv: string | null | undefined): number[] => {
      if (csv == null || csv === '') return []
      return csv
        .split(',')
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    }

    const byList = new Map<string, { wins: number; games: number; shardList: string }>()
    for (const row of runeStatRows) {
      const shard = row.shardList ?? ''
      const key = `${row.runeList}${aggKeySep}${shard}`
      let entry = byList.get(key)
      if (!entry) {
        entry = { wins: 0, games: 0, shardList: shard }
        byList.set(key, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
    }

    const runes: RuneRow[] = []
    for (const [aggKey, entry] of byList.entries()) {
      if (entry.games < minGames) continue
      const sepIdx = aggKey.indexOf(aggKeySep)
      const listStr = sepIdx >= 0 ? aggKey.slice(0, sepIdx) : aggKey
      let parsedRunes: unknown
      try {
        parsedRunes = JSON.parse(listStr)
      } catch {
        parsedRunes = listStr
      }
      runes.push({
        runes: parsedRunes,
        shards: parseShardListCsv(entry.shardList),
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

    const { statIds, totalGames } = await getCoreStatIdsAndTotalGames({
      championId,
      versionOrPatch: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (statIds.length === 0) return { totalGames: 0, runes: [] }

    const soloFrom = await matchVersionedAggFrom('agg_champion_runes_solo_stats', pVersion, 'rs')

    const soloRows = await prisma.$queryRawUnsafe<
      Array<{ perkId: number; style: string; countWin: number; countGame: number }>
    >(`
      SELECT
        perk_id AS "perkId",
        style,
        count_win AS "countWin",
        count_game AS "countGame"
      FROM ${soloFrom}
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

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

    const { statIds, totalGames } = await getCoreStatIdsAndTotalGames({
      championId,
      versionOrPatch: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (statIds.length === 0) return { totalGames: 0, shards: [] }

    const shardFrom = await matchVersionedAggFrom('agg_champion_shard_solo_stats', pVersion, 'sh')

    const shardRows = await prisma.$queryRawUnsafe<
      Array<{ shardId: number; slot: number; countWin: number; countGame: number }>
    >(`
      SELECT
        shard_id AS "shardId",
        slot,
        count_win AS "countWin",
        count_game AS "countGame"
      FROM ${shardFrom}
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

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

    const mergeMap = new Map<string, { wins: number; games: number }>()
    for (const [key, entry] of byShardSlot.entries()) {
      mergeMap.set(key, { wins: entry.wins, games: entry.games })
    }
    mergeLegacyStatShardAggregates(mergeMap)
    byShardSlot.clear()
    for (const [key, e] of mergeMap.entries()) {
      const [shardIdStr, slotStr] = key.split(':')
      const shardId = Number(shardIdStr)
      const slot = Number(slotStr)
      byShardSlot.set(key, { shardId, slot, wins: e.wins, games: e.games })
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
