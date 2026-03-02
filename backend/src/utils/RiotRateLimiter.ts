/**
 * Per-route rate limiting for Riot API.
 * Limits from Riot Developer Portal (2024): https://developer.riotgames.com/rate-limits
 */
import { recordRiotApiRequest } from '../services/RiotApiStatsService.js'

type WindowSpec = { limit: number; windowMs: number }

const BUCKETS: Record<string, WindowSpec[]> = {
  // champion-rotations: 30/10s, 500/10min
  'champion-rotations': [
    { limit: 30, windowMs: 10_000 },
    { limit: 500, windowMs: 10 * 60_000 },
  ],
  // summoner-v4 by-puuid: 1600/1min
  'summoner-by-puuid': [{ limit: 1600, windowMs: 60_000 }],
  // league challenger/master/grandmaster: 30/10s, 500/10min
  'league-challenger-master-grandmaster': [
    { limit: 30, windowMs: 10_000 },
    { limit: 500, windowMs: 10 * 60_000 },
  ],
  // league entries by queue/tier/division: 50/10s
  'league-entries': [{ limit: 50, windowMs: 10_000 }],
  // league entries by-puuid: 20000/10s, 1200000/10min
  'league-entries-by-puuid': [
    { limit: 20_000, windowMs: 10_000 },
    { limit: 1_200_000, windowMs: 10 * 60_000 },
  ],
  // league entries by-summoner (leagues/{leagueId}): 500/10s
  'league-entries-by-summoner': [{ limit: 500, windowMs: 10_000 }],
  // league-exp: 50/10s
  'league-exp': [{ limit: 50, windowMs: 10_000 }],
  // account-v1: 1000/1min (dev) - prod has 20000/10s
  'account': [{ limit: 1000, windowMs: 60_000 }],
  // match-v5: 2000/10s
  'match': [{ limit: 2000, windowMs: 10_000 }],
  'match-ids': [{ limit: 2000, windowMs: 10_000 }],
  // match replays: 20000/10s, 1200000/10min
  'match-replays': [
    { limit: 20_000, windowMs: 10_000 },
    { limit: 1_200_000, windowMs: 10 * 60_000 },
  ],
  // summoner by-id (not in table, use conservative)
  'summoner-by-id': [{ limit: 1600, windowMs: 60_000 }],
}

const DEFAULT_BUCKET: WindowSpec[] = [{ limit: 100, windowMs: 60_000 }]

const timestampsByRoute = new Map<string, number[]>()
const lastRequestByRoute = new Map<string, number>()
const MIN_DELAY_MS = 5 // minimum 5ms between any requests to avoid bursts

function getTimestamps(route: string): number[] {
  let ts = timestampsByRoute.get(route)
  if (!ts) {
    ts = []
    timestampsByRoute.set(route, ts)
  }
  return ts
}

function computeWaitMs(route: string, windows: WindowSpec[]): number {
  const now = Date.now()
  const ts = getTimestamps(route)
  const maxWindow = Math.max(...windows.map((w) => w.windowMs), 60_000)
  while (ts.length > 0 && ts[0]! <= now - maxWindow) ts.shift()

  let waitMs = 0
  for (const { limit, windowMs } of windows) {
    const cutoff = now - windowMs
    const inWindow = ts.filter((t) => t > cutoff)
    if (inWindow.length >= limit) {
      const sorted = [...inWindow].sort((a, b) => a - b)
      const expireAt = sorted[inWindow.length - limit]! + windowMs
      const w = expireAt - now
      if (w > waitMs) waitMs = w
    }
  }

  const last = lastRequestByRoute.get(route) ?? 0
  const elapsed = now - last
  if (elapsed < MIN_DELAY_MS && waitMs < MIN_DELAY_MS - elapsed) {
    waitMs = MIN_DELAY_MS - elapsed
  }
  return waitMs
}

export async function rateLimitByRoute(route: string): Promise<void> {
  const windows = BUCKETS[route] ?? DEFAULT_BUCKET
  let waitMs = computeWaitMs(route, windows)
  while (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs))
    waitMs = computeWaitMs(route, windows)
  }
  const now = Date.now()
  getTimestamps(route).push(now)
  lastRequestByRoute.set(route, now)
  recordRiotApiRequest()
}
