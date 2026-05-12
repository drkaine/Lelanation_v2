import type { JobsOptions } from "bullmq";
import type { DiscoveryJobData, HydrationJobData, IngestionJobData } from "../dto/match.dto.js";

export const DISCOVERY_QUEUE = "discovery" as const;
export const HYDRATION_QUEUE = "hydration" as const;
export const INGESTION_QUEUE = "ingestion" as const;

export type DiscoveryQueueJobData = DiscoveryJobData;
export type HydrationQueueJobData = HydrationJobData;
export type IngestionQueueJobData = IngestionJobData;

export const DISCOVERY_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 500, age: 3600 },
  removeOnFail: { count: 1000 },
};

export const HYDRATION_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 1000, age: 3600 },
  removeOnFail: { count: 1000 },
};

export const INGESTION_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 200, age: 1800 },
  removeOnFail: { count: 500 },
};
