import type { JobsOptions } from "bullmq";
import type { DiscoveryJobData, HydrationJobData, IngestionJobData, RankJobData } from "../dto/match.dto.js";

export const DISCOVERY_QUEUE = "discovery" as const;
export const HYDRATION_QUEUE = "hydration" as const;
export const INGESTION_QUEUE = "ingestion" as const;
export const RANK_QUEUE = "rank" as const;

export type DiscoveryQueueJobData = DiscoveryJobData;
export type HydrationQueueJobData = HydrationJobData;
export type IngestionQueueJobData = IngestionJobData;
export type RankQueueJobData = RankJobData;

export const DISCOVERY_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const HYDRATION_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const INGESTION_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const RANK_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: "fixed", delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};
