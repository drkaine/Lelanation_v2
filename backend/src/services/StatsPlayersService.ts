/**
 * Top players / per-player champion stats — requires per-match player graph (removed with ingest pipeline).
 * Returns empty results; use aggregated champion stats APIs instead.
 */
import { isDatabaseConfigured } from '../db/query.js'

export interface PlayerRow {
  puuid: string
  maskedPuid: string
  summonerName: string | null
  region: string
  rankTier: string | null
  totalGames: number
  totalWins: number
  winrate: number
}

export interface ChampionPlayerRow {
  puuid: string
  maskedPuid: string
  summonerName: string | null
  region: string
  rankTier: string | null
  games: number
  wins: number
  winrate: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
}

export async function getTopPlayers(_options: {
  rankTier?: string | string[] | null
  highRankOnly?: boolean
  minGames?: number
  limit?: number
}): Promise<PlayerRow[]> {
  void isDatabaseConfigured()
  return []
}

export interface PlayerChampionStatRow {
  championId: number
  games: number
  wins: number
  winrate: number
}

export async function getPlayerBySummonerName(_summonerName: string): Promise<PlayerRow | null> {
  return null
}

export async function getChampionStatsForPlayer(_puuid: string, _limit = 50): Promise<PlayerChampionStatRow[]> {
  return []
}

export async function getTopPlayersForChampion(_options: {
  championId: number
  rankTier?: string | string[] | null
  role?: string | null
  highRankOnly?: boolean
  minGames?: number
  limit?: number
}): Promise<ChampionPlayerRow[]> {
  return []
}
