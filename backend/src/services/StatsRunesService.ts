/**
 * Runes stats by champion from champion_runes_stats (combinations) and
 * champion_runes_solo_stats (per-rune) aggregate tables.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { mergeLegacyStatShardAggregates } from '../utils/statShardLegacyMerge.js'
import { buildChampionScopedWhere, sumChampionCoreGames } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

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

export async function getRunesByChampion(
  options: RunesByChampionOptions
): Promise<{ totalGames: number; runes: RuneRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, patch, role, region, minGames = 10, limit = 20 } = options
  try {
    const pPatch = patch != null && patch !== '' ? patch : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    const totalGames = await sumChampionCoreGames({
      championId,
      version: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (totalGames <= 0) return { totalGames: 0, runes: [] }

    const runesFrom = await matchVersionedAggFrom('agg_champion_runes_stats', pPatch, 'rs')
    const whereSql = buildChampionScopedWhere('rs', {
      championId,
      version: pPatch,
      rankTier,
      role: pRole,
      region: pRegion,
    })

    const runeStatRows = await queryRawUnsafe<
      Array<{ runeList: string; shardList: string; countWin: number; countGame: number }>
    >(`
      SELECT
        rs.rune_list AS "runeList",
        rs.shard_list AS "shardList",
        rs.count_win AS "countWin",
        rs.count_game AS "countGame"
      FROM ${runesFrom}
      WHERE ${whereSql}
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
  } catch (err) {
    console.warn('[getRunesByChampion]', err)
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

    const totalGames = await sumChampionCoreGames({
      championId,
      version: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (totalGames <= 0) return { totalGames: 0, runes: [] }

    const soloFrom = await matchVersionedAggFrom('agg_champion_runes_solo_stats', pVersion, 'rs')
    const whereSql = buildChampionScopedWhere('rs', {
      championId,
      version: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })

    const soloRows = await queryRawUnsafe<
      Array<{ perkId: number; countWin: number; countGame: number }>
    >(`
      SELECT
        rs.perk_id AS "perkId",
        SUM(rs.count_win)::integer AS "countWin",
        SUM(rs.count_game)::integer AS "countGame"
      FROM ${soloFrom}
      WHERE ${whereSql}
      GROUP BY rs.perk_id
    `)

    const runes: RuneStatRow[] = []
    for (const row of soloRows) {
      const games = Number(row.countGame ?? 0)
      const wins = Number(row.countWin ?? 0)
      if (games < minGames) continue
      runes.push({
        runeId: row.perkId,
        games,
        wins,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
      })
    }
    runes.sort((a, b) => b.games - a.games)

    return { totalGames, runes }
  } catch (err) {
    console.warn('[getRuneStatsByChampion]', err)
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

    const totalGames = await sumChampionCoreGames({
      championId,
      version: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })
    if (totalGames <= 0) return { totalGames: 0, shards: [] }

    const shardFrom = await matchVersionedAggFrom('agg_champion_shard_solo_stats', pVersion, 'sh')
    const whereSql = buildChampionScopedWhere('sh', {
      championId,
      version: pVersion,
      rankTier,
      role: pRole,
      region: pRegion,
    })

    const shardRows = await queryRawUnsafe<
      Array<{ shardId: number; slot: number; countWin: number; countGame: number }>
    >(`
      SELECT
        sh.shard_id AS "shardId",
        sh.slot,
        SUM(sh.count_win)::integer AS "countWin",
        SUM(sh.count_game)::integer AS "countGame"
      FROM ${shardFrom}
      WHERE ${whereSql}
      GROUP BY sh.shard_id, sh.slot
    `)

    const mergeMap = new Map<string, { wins: number; games: number }>()
    for (const row of shardRows) {
      const key = `${row.shardId}:${row.slot}`
      const prev = mergeMap.get(key) ?? { wins: 0, games: 0 }
      prev.wins += Number(row.countWin ?? 0)
      prev.games += Number(row.countGame ?? 0)
      mergeMap.set(key, prev)
    }
    mergeLegacyStatShardAggregates(mergeMap)

    const shards: ShardStatRow[] = []
    for (const [key, entry] of mergeMap.entries()) {
      if (entry.games < minGames) continue
      const [shardIdStr, slotStr] = key.split(':')
      shards.push({
        shardId: Number(shardIdStr),
        slot: Number(slotStr),
        games: entry.games,
        wins: entry.wins,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
      })
    }
    shards.sort((a, b) => b.games - a.games)

    return { totalGames, shards }
  } catch (err) {
    console.warn('[getShardStatsByChampion]', err)
    return null
  }
}
