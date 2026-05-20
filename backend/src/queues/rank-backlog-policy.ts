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

/** Intervalle entre groupes de jobs (débit lisse ~maxPerWindow / 120 s). */
export function rankLimiterSmoothIntervalMs(maxPerWindow: number): number {
  return Math.max(500, Math.ceil(RANK_BULLMQ_LIMITER_DURATION_MS / maxPerWindow));
}

/** Concurrence rank en mode drain (appels API en parallèle, même débit global). */
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

/** Limiter lisse : jusqu'à `concurrency` jobs démarrent par fenêtre, sans rafale 95 en 1 s. */
export function rankWorkerLimiterSmooth(
  maxPerWindow: number,
  concurrency: number,
): { max: number; duration: number } {
  const c = Math.max(1, concurrency);
  const perJobMs = rankLimiterSmoothIntervalMs(maxPerWindow);
  return { max: c, duration: perJobMs * c };
}
