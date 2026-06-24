import { Worker, type Job } from "bullmq";
import type { RankJobData } from "../dto/match.dto.js";
import { insertRankHistory } from "../db/queries/ranks.js";
import { fetchLeagueEntriesByPUUID } from "../poller/gatewayRoutes.js";
import type { Platform } from "../poller/types.js";
import { RANK_QUEUE } from "../queues/definitions.js";
import { getRankBacklogCount } from "../queues/index.js";
import { rankWorkerConcurrency } from "../queues/rank-backlog-policy.js";
import { redis } from "../redis/client.js";
import { waitForRankSlot } from "../redis/rate-scheduler.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { rankHistoryFromLeagueEntries } from "../services/rankFromLeagueEntries.js";

export async function processRankJob(job: Job<RankJobData>): Promise<void> {
  const puuid = String(job.data.puuid ?? "").trim();
  const region = normalizePlatformRegion(job.data.region);
  if (!puuid || !region) return;

  await waitForRankSlot();
  const entries = await fetchLeagueEntriesByPUUID(puuid, region as Platform, "normal");
  await insertRankHistory(rankHistoryFromLeagueEntries(puuid, region, entries, new Date()));
}

export async function createRankWorker(): Promise<Worker<RankJobData>> {
  const backlog = await getRankBacklogCount();
  return new Worker<RankJobData>(RANK_QUEUE, (job) => processRankJob(job), {
    connection: redis,
    concurrency: rankWorkerConcurrency(backlog),
  });
}
