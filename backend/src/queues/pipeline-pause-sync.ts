import type { Worker } from "bullmq";
import { rankQueue } from "./index.js";
import { shouldPauseMatchPipelines } from "./rank-backlog-policy.js";

/** Pause hydration/ingestion pendant le drain rank (évite locks BullMQ + enqueue inutile). */
export async function syncMatchPipelinePause(
  hydrationWorker: Worker,
  ingestionWorker: Worker,
): Promise<boolean> {
  const rankWaiting = await rankQueue.getWaitingCount();
  const pause = shouldPauseMatchPipelines(rankWaiting);

  if (pause) {
    if (!hydrationWorker.isPaused()) await hydrationWorker.pause(true);
    if (!ingestionWorker.isPaused()) await ingestionWorker.pause(true);
  } else {
    if (hydrationWorker.isPaused()) await hydrationWorker.resume();
    if (ingestionWorker.isPaused()) await ingestionWorker.resume();
  }

  return pause;
}
