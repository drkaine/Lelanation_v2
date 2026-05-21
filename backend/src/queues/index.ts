import { Queue } from "bullmq";
import { redis } from "../redis/client.js";
import type { DiscoveryJobData, HydrationJobData, IngestionJobData, RankJobData } from "../dto/match.dto.js";
import {
  DISCOVERY_QUEUE,
  DISCOVERY_QUEUE_DEFAULT_JOB_OPTIONS,
  HYDRATION_QUEUE,
  HYDRATION_QUEUE_DEFAULT_JOB_OPTIONS,
  INGESTION_QUEUE,
  INGESTION_QUEUE_DEFAULT_JOB_OPTIONS,
  RANK_QUEUE,
  RANK_QUEUE_DEFAULT_JOB_OPTIONS,
} from "./definitions.js";

export const discoveryQueue = new Queue<DiscoveryJobData>(DISCOVERY_QUEUE, {
  connection: redis,
  defaultJobOptions: DISCOVERY_QUEUE_DEFAULT_JOB_OPTIONS,
});

export const hydrationQueue = new Queue<HydrationJobData>(HYDRATION_QUEUE, {
  connection: redis,
  defaultJobOptions: HYDRATION_QUEUE_DEFAULT_JOB_OPTIONS,
});

export const ingestionQueue = new Queue<IngestionJobData>(INGESTION_QUEUE, {
  connection: redis,
  defaultJobOptions: INGESTION_QUEUE_DEFAULT_JOB_OPTIONS,
});

export const rankQueue = new Queue<RankJobData>(RANK_QUEUE, {
  connection: redis,
  defaultJobOptions: RANK_QUEUE_DEFAULT_JOB_OPTIONS,
});

export async function getRankBacklogCount(): Promise<number> {
  const counts = await rankQueue.getJobCounts("waiting", "prioritized");
  return (counts.waiting ?? 0) + (counts.prioritized ?? 0);
}

export type QueueMetrics = {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
};

export async function getQueueMetrics(): Promise<
  Record<typeof DISCOVERY_QUEUE | typeof HYDRATION_QUEUE | typeof INGESTION_QUEUE | typeof RANK_QUEUE, QueueMetrics>
> {
  const [discoveryCounts, hydrationCounts, ingestionCounts, rankCounts] = await Promise.all([
    discoveryQueue.getJobCounts("waiting", "active", "failed", "delayed"),
    hydrationQueue.getJobCounts("waiting", "active", "failed", "delayed"),
    ingestionQueue.getJobCounts("waiting", "active", "failed", "delayed"),
    rankQueue.getJobCounts("waiting", "active", "failed", "delayed"),
  ]);

  return {
    [DISCOVERY_QUEUE]: {
      waiting: discoveryCounts.waiting ?? 0,
      active: discoveryCounts.active ?? 0,
      failed: discoveryCounts.failed ?? 0,
      delayed: discoveryCounts.delayed ?? 0,
    },
    [HYDRATION_QUEUE]: {
      waiting: hydrationCounts.waiting ?? 0,
      active: hydrationCounts.active ?? 0,
      failed: hydrationCounts.failed ?? 0,
      delayed: hydrationCounts.delayed ?? 0,
    },
    [INGESTION_QUEUE]: {
      waiting: ingestionCounts.waiting ?? 0,
      active: ingestionCounts.active ?? 0,
      failed: ingestionCounts.failed ?? 0,
      delayed: ingestionCounts.delayed ?? 0,
    },
    [RANK_QUEUE]: {
      waiting: rankCounts.waiting ?? 0,
      active: rankCounts.active ?? 0,
      failed: rankCounts.failed ?? 0,
      delayed: rankCounts.delayed ?? 0,
    },
  };
}

export type { DiscoveryJobData, HydrationJobData, IngestionJobData, RankJobData };
