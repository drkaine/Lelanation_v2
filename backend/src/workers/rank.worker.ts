import { Worker } from "bullmq";
import { sql } from "../db/client.js";
import type { RankJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { RANK_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { acquireRankSlot } from "../redis/rate-scheduler.js";
import { RiotClient } from "../riot/client.js";

const riotClient = new RiotClient();
const RANK_WORKER_CONCURRENCY = 2;
const RANK_SLOT_MAX_WAIT_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function waitForRankSlotOrSkip(): Promise<boolean> {
  const deadline = Date.now() + RANK_SLOT_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const { granted, waitMs } = await acquireRankSlot();
    if (granted) {
      return true;
    }
    if (Date.now() + waitMs > deadline) {
      throw new Error("rank_slot_budget_exhausted");
    }
    await sleep(Math.min(waitMs, deadline - Date.now()));
  }

  throw new Error("rank_slot_budget_exhausted");
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
    await waitForRankSlotOrSkip();
  } catch (error) {
    if (error instanceof Error && error.message === "rank_slot_budget_exhausted") {
      console.debug(
        `[rank.worker] rank_job_skipped reason=budget_exhausted puuid=${puuid} region=${region}`,
      );
      return { skipped: true, reason: "budget_exhausted" };
    }
    throw error;
  }

  let rankTier: string | null = null;
  let rankDivision: string | null = null;
  let rankLp: number | null = null;

  try {
    const rank = await riotClient.getRank(puuid, region);
    if (!rank) {
      return { skipped: true, reason: "unranked" };
    }

    const normalizedTier = normalizeTier(rank.tier);
    if (!normalizedTier) {
      return { skipped: true, reason: "unranked" };
    }

    rankTier = normalizedTier;
    rankDivision = String(rank.rank ?? "").trim().toUpperCase() || null;
    rankLp = clampRankLp(rank.leaguePoints ?? 0);
    pollerV2Observability.recordRankLeagueFetchSucceeded();
  } catch (error) {
    pollerV2Observability.recordRankLeagueFetchFailed();
    console.warn(
      `[rank.worker] rank_fetch_failed puuid=${puuid} region=${region} reason=${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  await sql`
    INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
    VALUES (
      ${puuid},
      ${today}::date,
      ${region},
      ${rankTier},
      ${rankDivision ?? "UNRANKED"},
      ${rankLp ?? 0}
    )
    ON CONFLICT (puuid, date, region) DO NOTHING
  `;

  return { success: true };
}

export const rankWorker = new Worker<RankJobData>(
  RANK_QUEUE,
  async (job) => {
    pollerV2Observability.recordRankJobStart();
    try {
      const outcome = await runRankJob(job.data);
      pollerV2Observability.recordRankJobSuccess();
      return outcome;
    } catch (error) {
      pollerV2Observability.recordRankJobFailure(error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: RANK_WORKER_CONCURRENCY,
  },
);
