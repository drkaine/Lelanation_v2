import type { Worker } from "bullmq";
import { getRankBacklogCount } from "./index.js";
import { rankWorkerConcurrency, shouldPauseMatchPipelines } from "./rank-backlog-policy.js";

export type MatchPipelineSyncResult = {
  pipelinesPaused: boolean;
  rankWorkerConfiguredConcurrency: number;
  rankBacklog: number;
};

/** Pause hydration/ingestion pendant le drain rank (évite locks BullMQ + enqueue inutile). */
export async function syncMatchPipelinePause(
  hydrationWorker: Worker,
  ingestionWorker: Worker,
  rankWorker: Worker,
): Promise<MatchPipelineSyncResult> {
  const rankBacklog = await getRankBacklogCount();
  const pause = shouldPauseMatchPipelines(rankBacklog);
  const targetRankConcurrency = rankWorkerConcurrency(rankBacklog);

  if (rankWorker.concurrency !== targetRankConcurrency) {
    rankWorker.concurrency = targetRankConcurrency;
  }

  if (pause) {
    if (!hydrationWorker.isPaused()) await hydrationWorker.pause(true);
    if (!ingestionWorker.isPaused()) await ingestionWorker.pause(true);
  } else {
    if (hydrationWorker.isPaused()) await hydrationWorker.resume();
    if (ingestionWorker.isPaused()) await ingestionWorker.resume();
  }

  return {
    pipelinesPaused: pause,
    rankWorkerConfiguredConcurrency: rankWorker.concurrency,
    rankBacklog,
  };
}
