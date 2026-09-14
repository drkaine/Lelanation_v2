/**
 * Cache Redis partagé pour les réponses stats lourdes (tier-list, overview).
 * Fallback mémoire process-local si Redis indisponible.
 */
import { redis } from '../redis/client.js'

const STATS_REDIS_PREFIX = 'stats:cache:'
const REDIS_CACHE_ENABLED = process.env.STATS_REDIS_CACHE !== '0'

const memoryFallback = new Map<string, { value: string; expiresAt: number }>()

function purgeExpiredMemory(now: number): void {
  for (const [key, entry] of memoryFallback) {
    if (entry.expiresAt <= now) memoryFallback.delete(key)
  }
}

export async function statsRedisCacheGet<T>(namespace: string, key: string): Promise<T | null> {
  const fullKey = `${STATS_REDIS_PREFIX}${namespace}:${key}`
  const now = Date.now()

  const mem = memoryFallback.get(fullKey)
  if (mem && mem.expiresAt > now) {
    try {
      return JSON.parse(mem.value) as T
    } catch {
      memoryFallback.delete(fullKey)
    }
  }

  if (!REDIS_CACHE_ENABLED || redis.status !== 'ready') return null

  try {
    const raw = await redis.get(fullKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as T
    memoryFallback.set(fullKey, { value: raw, expiresAt: now + 60_000 })
    return parsed
  } catch {
    return null
  }
}

export async function statsRedisCacheSet(
  namespace: string,
  key: string,
  value: unknown,
  ttlMs: number
): Promise<void> {
  const fullKey = `${STATS_REDIS_PREFIX}${namespace}:${key}`
  const now = Date.now()
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000))

  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    return
  }

  purgeExpiredMemory(now)
  memoryFallback.set(fullKey, { value: json, expiresAt: now + ttlMs })

  if (!REDIS_CACHE_ENABLED || redis.status !== 'ready') return

  try {
    await redis.setex(fullKey, ttlSec, json)
  } catch {
    // Mémoire locale suffit pour ce worker.
  }
}

export async function statsRedisCacheDelNamespace(namespace: string): Promise<void> {
  const prefix = `${STATS_REDIS_PREFIX}${namespace}:`
  for (const key of [...memoryFallback.keys()]) {
    if (key.startsWith(prefix)) memoryFallback.delete(key)
  }
  if (!REDIS_CACHE_ENABLED || redis.status !== 'ready') return
  try {
    const keys = await redis.keys(`${prefix}*`)
    if (keys.length > 0) await redis.del(...keys)
  } catch {
    // ignore
  }
}
