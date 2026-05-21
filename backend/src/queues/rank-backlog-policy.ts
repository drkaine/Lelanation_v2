import { config } from "../config/index.js";

/** Au-delà de ce seuil : pause discovery/hydration, débit rank maximal. */
export function maxRankBacklogBeforePipelinePause(): number {
  return config.MAX_RANK_BACKLOG_PAUSE_PIPELINES;
}

export function shouldPauseMatchPipelines(rankWaiting: number): boolean {
  return rankWaiting > maxRankBacklogBeforePipelinePause();
}

/** Concurrence rank en mode drain (appels API en parallèle, budget via drip Redis). */
export function rankWorkerConcurrencyDrain(): number {
  return config.RANK_WORKER_CONCURRENCY_DRAIN;
}

export function rankWorkerConcurrencyNormal(): number {
  return config.RANK_WORKER_CONCURRENCY_NORMAL;
}

export function rankWorkerConcurrency(rankWaiting: number): number {
  return shouldPauseMatchPipelines(rankWaiting)
    ? rankWorkerConcurrencyDrain()
    : rankWorkerConcurrencyNormal();
}
