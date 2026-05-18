import { Worker } from "bullmq";
import { sql } from "../db/client.js";
import type { RankJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { RANK_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { waitForRankSlot } from "../redis/rate-scheduler.js";
import { RiotClient } from "../riot/client.js";

const riotClient = new RiotClient();
const RANK_WORKER_CONCURRENCY = 2;

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

async function hasRankSnapshotToday(puuid: string, region: string): Promise<boolean> {
  const rows = await sql<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM player_rank_history
    WHERE puuid = ${puuid}
      AND date = CURRENT_DATE
      AND region = ${region}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function runRankJob(data: RankJobData): Promise<void> {
  const puuid = String(data.puuid ?? "").trim();
  const region = String(data.region ?? "").trim().toLowerCase();
  if (!puuid || !region) {
    return;
  }

  if (await hasRankSnapshotToday(puuid, region)) {
    return;
  }

  const rankSlot = await waitForRankSlot();
  if (rankSlot === "budget_exhausted") {
    throw new Error("rank_slot_budget_exhausted");
  }

  let rankTier: string | null = null;
  let rankDivision: string | null = null;
  let rankLp: number | null = null;

  try {
    const rank = await riotClient.getRank(puuid, region);
    const normalizedTier = normalizeTier(rank?.tier);
    if (normalizedTier) {
      rankTier = normalizedTier;
      rankDivision = String(rank?.rank ?? "").trim().toUpperCase() || null;
      rankLp = clampRankLp(rank?.leaguePoints ?? 0);
    }
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
      ${todayIsoDate()}::date,
      ${region},
      ${rankTier ?? "UNRANKED"},
      ${rankDivision ?? "UNRANKED"},
      ${rankLp ?? 0}
    )
    ON CONFLICT (puuid, date, region) DO NOTHING
  `;
}

export const rankWorker = new Worker<RankJobData>(
  RANK_QUEUE,
  async (job) => {
    pollerV2Observability.recordRankJobStart();
    try {
      await runRankJob(job.data);
      pollerV2Observability.recordRankJobSuccess();
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
