import type { Worker } from "bullmq";
import { getRankBacklogCount } from "./index.js";
import { shouldPauseMatchPipelines } from "./rank-backlog-policy.js";

/** Pause hydration/ingestion pendant le drain rank (évite locks BullMQ + enqueue inutile). */
export async function syncMatchPipelinePause(
  hydrationWorker: Worker,
  ingestionWorker: Worker,
): Promise<boolean> {
  const rankBacklog = await getRankBacklogCount();
  const pause = shouldPauseMatchPipelines(rankBacklog);

  if (pause) {
    if (!hydrationWorker.isPaused()) await hydrationWorker.pause(true);
    if (!ingestionWorker.isPaused()) await ingestionWorker.pause(true);
  } else {
    if (hydrationWorker.isPaused()) await hydrationWorker.resume();
    if (ingestionWorker.isPaused()) await ingestionWorker.resume();
  }

  return pause;
}
