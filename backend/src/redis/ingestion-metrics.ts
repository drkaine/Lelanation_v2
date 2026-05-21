import { config } from "../config/index.js";
import { redis } from "./client.js";

export const INGESTED_MATCHES_KEY = "rl:metrics:ingested_matches";

const TWO_HOURS_MS = 2 * 3600 * 1000;

export type IngestionThroughputMetrics = {
  matchesLastHour: number;
  matchesLast10Min: number;
  projectedMatchesPerHour: number;
  apiEfficiencyPct: number;
};

export async function recordAggregatedMatch(matchId?: string): Promise<void> {
  const now = Date.now();
  const member = matchId ? `${now}:${matchId}` : `${now}:${Math.random().toString(36).slice(2, 10)}`;
  await redis.zadd(INGESTED_MATCHES_KEY, now, member);
  await redis.zremrangebyscore(INGESTED_MATCHES_KEY, 0, now - TWO_HOURS_MS);
}

export async function countAggregatedMatchesSince(sinceMs: number, untilMs = Date.now()): Promise<number> {
  return redis.zcount(INGESTED_MATCHES_KEY, sinceMs, untilMs);
}

export async function fetchIngestionThroughputMetrics(
  now = Date.now(),
): Promise<IngestionThroughputMetrics> {
  const [matchesLastHour, matchesLast10Min] = await Promise.all([
    redis.zcount(INGESTED_MATCHES_KEY, now - 3600_000, now),
    redis.zcount(INGESTED_MATCHES_KEY, now - 600_000, now),
  ]);
  const projectedMatchesPerHour = matchesLast10Min * 6;
  const maxMatchesPerHour = config.RATE_LIMIT_PER_120S * 30;
  const apiEfficiencyPct =
    maxMatchesPerHour > 0 ? Math.round((matchesLastHour / maxMatchesPerHour) * 100) : 0;

  return {
    matchesLastHour,
    matchesLast10Min,
    projectedMatchesPerHour,
    apiEfficiencyPct,
  };
}
