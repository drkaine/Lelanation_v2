import { config } from "../config/index.js";
import { TARGET_PCT } from "../redis/rate-scheduler.js";

/** Au-delà de ce seuil : pause discovery/hydration, débit rank maximal. */
export function maxRankBacklogBeforePipelinePause(): number {
  return config.MAX_RANK_BACKLOG_PAUSE_PIPELINES;
}

export function shouldPauseMatchPipelines(rankWaiting: number): boolean {
  return rankWaiting > maxRankBacklogBeforePipelinePause();
}

/** Limiter BullMQ en mode drain (~88 % du plafond 120 s). */
export function rankLimiterMaxDrain(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return Math.max(1, Math.floor(rateLimitPer120s * TARGET_PCT * 0.88));
}

export function rankLimiterMaxNormal(): number {
  return config.RANK_LIMITER_MAX_NORMAL;
}

export function rankLimiterMaxForBacklog(rankWaiting: number): number {
  return shouldPauseMatchPipelines(rankWaiting)
    ? rankLimiterMaxDrain()
    : rankLimiterMaxNormal();
}
