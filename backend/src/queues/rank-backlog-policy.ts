import { config } from "../config/index.js";
import { RANK_BULLMQ_LIMITER_DURATION_MS } from "../redis/rate-scheduler.js";

/** Au-delà de ce seuil : pause discovery/hydration, débit rank maximal. */
export function maxRankBacklogBeforePipelinePause(): number {
  return config.MAX_RANK_BACKLOG_PAUSE_PIPELINES;
}

export function shouldPauseMatchPipelines(rankWaiting: number): boolean {
  return rankWaiting > maxRankBacklogBeforePipelinePause();
}

/** Appels League v4 / 120 s en mode drain (sans rafale → moins de 429). */
export function rankLimiterMaxDrain(): number {
  return config.RANK_LIMITER_MAX_DRAIN;
}

export function rankLimiterMaxNormal(): number {
  return config.RANK_LIMITER_MAX_NORMAL;
}

/** 1 job toutes les N ms → débit lisse (évite 79 jobs en rafale puis idle 80 s). */
export function rankLimiterSmoothIntervalMs(maxPerWindow: number): number {
  return Math.max(500, Math.ceil(RANK_BULLMQ_LIMITER_DURATION_MS / maxPerWindow));
}

export function rankWorkerConcurrency(rankWaiting: number): number {
  return shouldPauseMatchPipelines(rankWaiting) ? 1 : 2;
}
