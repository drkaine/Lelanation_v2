/**
 * Tracks Riot API request consumption and rate limit exceedances (429).
 * Persists to file for survival across restarts.
 */

import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

const RIOT_API_STATS_FILE = join(process.cwd(), 'data', 'cron', 'riot-api-stats.json')
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_TIMESTAMPS = 5000

type RiotApiStatsFile = {
  requestTimestamps: number[]
  rateLimitExceededCount: number
  lastUpdated: string
}

async function readStats(): Promise<RiotApiStatsFile> {
  const result = await FileManager.readJson<RiotApiStatsFile>(RIOT_API_STATS_FILE)
  if (result.isErr()) {
    return {
      requestTimestamps: [],
      rateLimitExceededCount: 0,
      lastUpdated: new Date().toISOString(),
    }
  }
  const data = result.unwrap()
  return {
    requestTimestamps: Array.isArray(data?.requestTimestamps) ? data.requestTimestamps : [],
    rateLimitExceededCount: typeof data?.rateLimitExceededCount === 'number' ? data.rateLimitExceededCount : 0,
    lastUpdated: data?.lastUpdated ?? new Date().toISOString(),
  }
}

async function writeStats(data: RiotApiStatsFile): Promise<void> {
  await FileManager.ensureDir(join(process.cwd(), 'data', 'cron'))
  await FileManager.writeJson(RIOT_API_STATS_FILE, {
    ...data,
    lastUpdated: new Date().toISOString(),
  })
}

export async function recordRiotApiRequest(): Promise<void> {
  const stats = await readStats()
  const now = Date.now()
  const cutoff = now - 2 * ONE_HOUR_MS
  stats.requestTimestamps = stats.requestTimestamps.filter((t) => t > cutoff)
  stats.requestTimestamps.push(now)
  if (stats.requestTimestamps.length > MAX_TIMESTAMPS) {
    stats.requestTimestamps = stats.requestTimestamps.slice(-MAX_TIMESTAMPS)
  }
  await writeStats(stats)
}

export async function recordRiotApi429(): Promise<void> {
  const stats = await readStats()
  stats.rateLimitExceededCount = (stats.rateLimitExceededCount || 0) + 1
  await writeStats(stats)
}

export interface RiotApiStats {
  requestsLastHour: number
  requestsPerHourAvg: number
  rateLimitExceededCount: number
  limitPerTwoMin: number
  limitPerSecond: number
  limitPerHour: number
}

export async function getRiotApiStats(): Promise<RiotApiStats> {
  const stats = await readStats()
  const now = Date.now()
  const oneHourAgo = now - ONE_HOUR_MS
  const inLastHour = stats.requestTimestamps.filter((t) => t > oneHourAgo)
  return {
    requestsLastHour: inLastHour.length,
    requestsPerHourAvg: inLastHour.length,
    rateLimitExceededCount: stats.rateLimitExceededCount ?? 0,
    limitPerTwoMin: 100,
    limitPerSecond: 20,
    limitPerHour: 3000, // 100 req/2min * 30 = 3000 req/hour
  }
}

/** Count Riot API requests since given timestamp (for worker cycle stats). */
export async function getRiotApiRequestsSince(sinceMs: number): Promise<number> {
  const stats = await readStats()
  return stats.requestTimestamps.filter((t) => t > sinceMs).length
}
