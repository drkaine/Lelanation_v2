/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique puuids in participants).
 * Uses PostgreSQL views and get_stats_overview() for a single round-trip.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface OverviewStats {
  totalMatches: number
  lastUpdate: string | null
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  /** Match count per game version (16.x only, e.g. 16.1, 16.2, 16.3). */
  matchesByVersion: Array<{ version: string; matchCount: number }>
  /** Distinct puuids in participants (joueurs récupérés = participants uniques). */
  playerCount: number
}

type OverviewRow = Array<{ get_stats_overview: OverviewStats | null }>

/**
 * Load overview stats for the statistics page. Returns null if DB not configured.
 * Single round-trip via get_stats_overview() (views + function in DB).
 */
export async function getOverviewStats(): Promise<OverviewStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const rows = await prisma.$queryRaw<OverviewRow>`SELECT get_stats_overview() AS get_stats_overview`
    const raw = rows[0]?.get_stats_overview
    if (!raw) return null

    const lastUpdate =
      raw.lastUpdate == null ? null : typeof raw.lastUpdate === 'string' ? raw.lastUpdate : String(raw.lastUpdate)

    return {
      totalMatches: Number(raw.totalMatches) ?? 0,
      lastUpdate,
      topWinrateChampions: Array.isArray(raw.topWinrateChampions)
        ? raw.topWinrateChampions.map((c: { championId: number; games: number; wins: number; winrate: number; pickrate: number }) => ({
            championId: Number(c.championId),
            games: Number(c.games),
            wins: Number(c.wins),
            winrate: Number(c.winrate),
            pickrate: Number(c.pickrate),
          }))
        : [],
      matchesByDivision: Array.isArray(raw.matchesByDivision)
        ? raw.matchesByDivision.map((d: { rankTier: string; matchCount: number }) => ({
            rankTier: String(d.rankTier ?? '').trim(),
            matchCount: Number(d.matchCount) ?? 0,
          }))
        : [],
      matchesByVersion: Array.isArray(raw.matchesByVersion)
        ? raw.matchesByVersion.map((v: { version: string; matchCount: number }) => ({
            version: String(v.version ?? '').trim(),
            matchCount: Number(v.matchCount) ?? 0,
          }))
        : [],
      playerCount: Number(raw.playerCount) ?? 0,
    }
  } catch {
    return null
  }
}
