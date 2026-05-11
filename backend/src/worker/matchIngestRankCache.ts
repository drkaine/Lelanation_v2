// ── Global rank cache (TTL 24 h) ──────────────────────────────────────────────
// Avoids redundant League-v4 calls for players that appear in multiple matches.

import { prisma } from '../db.js'

type CachedRankEntry = {
  data: { rankTier?: string; rankDivision?: string | null; rankLp?: number | null }
  expiresAt: number
}
const globalRankCache = new Map<string, CachedRankEntry>()
const RANK_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RANK_CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000
let lastRankCacheCleanupMs = Date.now()
const priorityPuuidQueue: string[] = []
const priorityPuuidSet = new Set<string>()

export function getCachedRank(puuid: string): CachedRankEntry['data'] | null {
  const entry = globalRankCache.get(puuid)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    globalRankCache.delete(puuid)
    return null
  }
  return entry.data
}

export function setCachedRank(puuid: string, data: CachedRankEntry['data']): void {
  globalRankCache.set(puuid, { data, expiresAt: Date.now() + RANK_CACHE_TTL_MS })
}

export function cleanupGlobalRankCache(): void {
  const now = Date.now()
  if (now - lastRankCacheCleanupMs < RANK_CACHE_CLEANUP_INTERVAL_MS) return
  lastRankCacheCleanupMs = now
  for (const [key, entry] of globalRankCache) {
    if (now > entry.expiresAt) globalRankCache.delete(key)
  }
}

export function enqueuePriorityPuuid(puuid: string): void {
  if (!puuid || priorityPuuidSet.has(puuid)) return
  priorityPuuidSet.add(puuid)
  priorityPuuidQueue.push(puuid)
}

export function dequeuePriorityPuuids(maxCount: number): string[] {
  const out: string[] = []
  while (out.length < maxCount && priorityPuuidQueue.length > 0) {
    const puuid = priorityPuuidQueue.shift()
    if (!puuid) break
    priorityPuuidSet.delete(puuid)
    out.push(puuid)
  }
  return out
}

/** Fenêtre max d’âge du snapshot ladder avant refresh league-v4 (env `MATCH_ASYNC_PRIORITY_RANK_REFRESH_FALLBACK_MAX_AGE_MS`). */
export function priorityRankRefreshFallbackMaxAgeMs(): number {
  const raw = parseInt(process.env.MATCH_ASYNC_PRIORITY_RANK_REFRESH_FALLBACK_MAX_AGE_MS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 60_000) return 6 * 60 * 60 * 1000
  return Math.min(30 * 24 * 60 * 60 * 1000, raw)
}

/** Après agrégation / ingest : file league-v4 pour joueurs sans tier ou snapshot trop vieux (même fenêtre que le refresh async du poller). */
export async function enqueuePriorityPuuidsNeedingLeagueSnapshot(puuids: string[]): Promise<void> {
  const uniq = Array.from(
    new Set(puuids.map((p) => String(p ?? '').trim()).filter((p) => p.length > 0))
  )
  if (uniq.length === 0) return
  const staleBefore = new Date(Date.now() - priorityRankRefreshFallbackMaxAgeMs())
  const rows = await prisma.player.findMany({
    where: {
      puuid: { in: uniq },
      OR: [
        { rankTier: null },
        { rankSnapshotGameDate: null },
        { rankSnapshotGameDate: { lt: staleBefore } },
      ],
    },
    select: { puuid: true },
  })
  for (const r of rows) enqueuePriorityPuuid(r.puuid)
}
