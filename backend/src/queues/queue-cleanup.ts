import {
  discoveryQueue,
  hydrationQueue,
  ingestionQueue,
  rankQueue,
} from "./index.js";

const TRIM_GRACE_MS = 5 * 60_000;
const TRIM_BATCH = 1000;

/** Purge les jobs completed/failed anciens pour limiter la pression Redis. */
export async function trimCompletedQueueJobs(): Promise<void> {
  await Promise.all([
    discoveryQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "completed"),
    discoveryQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "failed"),
    hydrationQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "completed"),
    hydrationQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "failed"),
    ingestionQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "completed"),
    ingestionQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "failed"),
    rankQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "completed"),
    rankQueue.clean(TRIM_GRACE_MS, TRIM_BATCH, "failed"),
  ]);
}
