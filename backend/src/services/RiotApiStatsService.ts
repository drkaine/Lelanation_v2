/**
 * Riot API usage stats: requests per second/minute, 429 count.
 * Used by RiotApiService and admin /riot-api-stats.
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const PUUID_MIGRATION_REQUEST_FILE = join(process.cwd(), 'data', 'cron', 'puuid-migration-requested.json')
const WINDOW_MS = 60 * 60 * 1000 // 1 hour for requests
const MAX_ENTRIES = 100_000

let inMemoryRequests: number[] = []
let inMemory429Count = 0

export function recordRiotApiRequest(): void {
  const now = Date.now()
  inMemoryRequests.push(now)
  const cutoff = now - WINDOW_MS
  inMemoryRequests = inMemoryRequests.filter((t) => t > cutoff)
  if (inMemoryRequests.length > MAX_ENTRIES) {
    inMemoryRequests = inMemoryRequests.slice(-MAX_ENTRIES)
  }
}

export function recordRiotApi429(): void {
  inMemory429Count++
}

export interface RiotApiStats {
  requestsLastHour: number
  requestsLastMinute: number
  requestsLastSecond: number
  count429LastHour: number
  count429Total: number
  /** @deprecated Use limits.perRoute - kept for admin UI */
  limitPerHour?: number
  limitPerTwoMin?: number
  rateLimitExceededCount?: number
  limits: Record<string, unknown>
}

export async function getRiotApiStats(): Promise<RiotApiStats> {
  const now = Date.now()
  const oneHourAgo = now - WINDOW_MS
  const oneMinAgo = now - 60 * 1000
  const oneSecAgo = now - 1000

  const lastHour = inMemoryRequests.filter((t) => t > oneHourAgo)
  const lastMin = inMemoryRequests.filter((t) => t > oneMinAgo)
  const lastSec = inMemoryRequests.filter((t) => t > oneSecAgo)

  return {
    requestsLastHour: lastHour.length,
    requestsLastMinute: lastMin.length,
    requestsLastSecond: lastSec.length,
    count429LastHour: inMemory429Count,
    count429Total: inMemory429Count,
    limitPerHour: 3000,
    limitPerTwoMin: 2000,
    rateLimitExceededCount: inMemory429Count,
    limits: {
      perRoute: true,
      match: '2000/10s',
      matchIds: '2000/10s',
      account: '1000/1min',
      summoner: '1600/1min',
      leagueEntries: '50/10s',
      leagueChallenger: '30/10s',
    },
  }
}

export function reset429Count(): void {
  inMemory429Count = 0
}

/** Request PUUID migration when "Exception decrypting" is detected (Riot encrypts IDs per API key). */
export async function requestPuuidMigration(): Promise<void> {
  try {
    await fs.mkdir(join(process.cwd(), 'data', 'cron'), { recursive: true })
    await fs.writeFile(
      PUUID_MIGRATION_REQUEST_FILE,
      JSON.stringify({ requestedAt: new Date().toISOString(), reason: 'Exception decrypting' }, null, 0),
      'utf-8'
    )
  } catch {
    // ignore
  }
}
