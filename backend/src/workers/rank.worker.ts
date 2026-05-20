import { DelayedError, Worker } from "bullmq";
import { sql } from "../db/client.js";
import type { RankJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { RANK_QUEUE } from "../queues/definitions.js";
import {
  rankLimiterMaxDrain,
  rankWorkerConcurrencyDrain,
  rankWorkerLimiterSmooth,
} from "../queues/rank-backlog-policy.js";
import { redis } from "../redis/client.js";
import { RANK_BULLMQ_LIMITER_DURATION_MS } from "../redis/rate-scheduler.js";
import { RateLimitError, RiotClient } from "../riot/client.js";

const riotClient = new RiotClient();

function normalizeTier(value: string | null | undefined): string | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

function clampRankLp(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(32767, Math.trunc(n)));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type RankJobOutcome =
  | { skipped: true; reason: string }
  | { success: true };

async function upsertTodayRankSnapshot(
  puuid: string,
  region: string,
  rankTier: string,
  rankDivision: string,
  rankLp: number,
): Promise<void> {
  const today = todayIsoDate();
  await sql`
    INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
    VALUES (
      ${puuid},
      ${today}::date,
      ${region},
      ${rankTier},
      ${rankDivision},
      ${rankLp}
    )
    ON CONFLICT (puuid, date, region) DO NOTHING
  `;
}

async function runRankJob(data: RankJobData): Promise<RankJobOutcome> {
  const puuid = String(data.puuid ?? "").trim();
  const region = String(data.region ?? "").trim().toLowerCase();
  if (!puuid || !region) {
    return { skipped: true, reason: "invalid_job" };
  }

  const today = todayIsoDate();
  const existing = await sql<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM player_rank_history
    WHERE puuid = ${puuid}
      AND region = ${region}
      AND date = ${today}::date
    LIMIT 1
  `;
  if (existing.length > 0) {
    return { skipped: true, reason: "already_fetched_today" };
  }

  try {
    const rank = await riotClient.getRank(puuid, region);
    if (!rank) {
      await upsertTodayRankSnapshot(puuid, region, "UNRANKED", "UNRANKED", 0);
      return { skipped: true, reason: "unranked" };
    }

    const normalizedTier = normalizeTier(rank.tier);
    if (!normalizedTier) {
      await upsertTodayRankSnapshot(puuid, region, "UNRANKED", "UNRANKED", 0);
      return { skipped: true, reason: "unranked" };
    }

    const rankDivision = String(rank.rank ?? "").trim().toUpperCase() || "UNRANKED";
    const rankLp = clampRankLp(rank.leaguePoints ?? 0);
    await upsertTodayRankSnapshot(puuid, region, normalizedTier, rankDivision, rankLp);
    pollerV2Observability.recordRankLeagueFetchSucceeded();
    return { success: true };
  } catch (error) {
    if (error instanceof RateLimitError) {
      pollerV2Observability.recordRankLeagueFetchFailed();
      throw error;
    }
    pollerV2Observability.recordRankLeagueFetchFailed();
    console.warn(
      `[rank.worker] rank_fetch_failed puuid=${puuid} region=${region} reason=${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

const drainLimiterMax = rankLimiterMaxDrain();
const drainConcurrency = rankWorkerConcurrencyDrain();
const rankWorkerLimiter = rankWorkerLimiterSmooth(drainLimiterMax, drainConcurrency);

export const rankWorker = new Worker<RankJobData>(
  RANK_QUEUE,
  async (job) => {
    pollerV2Observability.recordRankJobStart();
    try {
      const outcome = await runRankJob(job.data);
      pollerV2Observability.recordRankJobSuccess();
      return outcome;
    } catch (error) {
      if (error instanceof RateLimitError) {
        const delayMs = 120_000;
        await job.moveToDelayed(Date.now() + delayMs, job.token);
        pollerV2Observability.recordRankJobFailure(error);
        throw new DelayedError(
          `rank_rate_limited delay_ms=${delayMs} puuid=${job.data.puuid}`,
        );
      }
      pollerV2Observability.recordRankJobFailure(error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: drainConcurrency,
    limiter: rankWorkerLimiter,
  },
);

console.log(
  `[rank.worker] started limiter=${rankWorkerLimiter.max}/${rankWorkerLimiter.duration}ms (~${drainLimiterMax}/${RANK_BULLMQ_LIMITER_DURATION_MS}ms) concurrency=${drainConcurrency}`,
);
