import { redis } from "./client.js";

/** Rank snapshot cache TTL — rank change rarely intraday. */
export const RANK_CACHE_REDIS_TTL_SEC = 4 * 60 * 60;

const L1_TTL_MS = 60_000;

export type CachedRankSnapshot = {
  rankTier: string;
  rankDivision: string;
  rankLp: number;
  snapshotDate: string;
  cachedAtMs: number;
};

type L1Entry = {
  value: CachedRankSnapshot;
  expiresAtMs: number;
};

const l1Cache = new Map<string, L1Entry>();

export function rankCacheRedisKey(puuid: string, region: string): string {
  return `rank:cache:${region}:${puuid}`;
}

function l1Key(puuid: string, region: string, snapshotDate: string): string {
  return `${region}:${puuid}:${snapshotDate}`;
}

export function readRankCacheL1(
  puuid: string,
  region: string,
  snapshotDate: string,
): CachedRankSnapshot | null {
  const key = l1Key(puuid, region, snapshotDate);
  const entry = l1Cache.get(key);
  if (!entry) return null;
  if (entry.expiresAtMs <= Date.now()) {
    l1Cache.delete(key);
    return null;
  }
  return entry.value;
}

export function writeRankCacheL1(
  puuid: string,
  region: string,
  snapshot: CachedRankSnapshot,
): void {
  const key = l1Key(puuid, region, snapshot.snapshotDate);
  l1Cache.set(key, { value: snapshot, expiresAtMs: Date.now() + L1_TTL_MS });
  if (l1Cache.size > 10_000) {
    const oldest = l1Cache.keys().next().value;
    if (oldest) l1Cache.delete(oldest);
  }
}

export async function readRankCacheRedis(
  puuid: string,
  region: string,
): Promise<CachedRankSnapshot | null> {
  const raw = await redis.get(rankCacheRedisKey(puuid, region));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedRankSnapshot;
    if (!parsed?.snapshotDate || !parsed?.rankTier) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeRankCacheRedis(
  puuid: string,
  region: string,
  snapshot: CachedRankSnapshot,
): Promise<void> {
  await redis.set(
    rankCacheRedisKey(puuid, region),
    JSON.stringify(snapshot),
    "EX",
    RANK_CACHE_REDIS_TTL_SEC,
  );
  writeRankCacheL1(puuid, region, snapshot);
}

/** Returns cached snapshot if its date is valid for matchDate (date >= matchDateIso). */
export function cachedRankValidForMatchDate(
  snapshot: CachedRankSnapshot,
  matchDateIso: string,
): boolean {
  return snapshot.snapshotDate >= matchDateIso;
}

export function clearRankCacheL1ForTests(): void {
  l1Cache.clear();
}
