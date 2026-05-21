import { config } from "../config/index.js";

/** Fenêtre glissante Riot (ms) — partagée avec rate-scheduler. */
export const WINDOW_MS = 120_000;

/** Matchlist calls (1 Riot req each). */
export const DISCOVERY_BUDGET_RATIO = 0.05;
/** Hydration share of 120s window; each match job costs 2 Riot reqs (match + timeline). */
export const HYDRATION_BUDGET_RATIO = 0.57;
/** League-v4 rank snapshots (1 Riot req each). */
export const RANK_BUDGET_RATIO = 0.38;

export type EffectiveBudgetBreakdown = {
  /** Matchlist API calls per 120s (1 req each). */
  discoverySlots: number;
  /** Hydration jobs per 120s (2 Riot reqs each). */
  hydrationSlots: number;
  /** Rank snapshot API calls per 120s (1 req each). */
  rankSlots: number;
  totalReqPer120s: number;
};

export type DripBudgetConfig = EffectiveBudgetBreakdown & {
  budget: number;
  /** Job interval for hydration (1 job = 2 API tokens). */
  hydrationIntervalMs: number;
  /** Token drip interval per pipeline. */
  discoveryIntervalMs: number;
  rankIntervalMs: number;
  hydrationTokenIntervalMs: number;
};

export type SlotPipeline = "discovery" | "hydration" | "rank";

export const SLOT_COSTS = {
  discovery: 1,
  hydration: 2,
  rank: 1,
} as const;

/**
 * Single source of truth for drip buckets + display (ratio split on RATE_LIMIT_PER_120S).
 *
 *   discoverySlots   = floor(budget × 0.05)
 *   hydrationMatches = floor(budget × 0.57 ÷ 2)
 *   rankSlots        = floor(budget × 0.38)
 *   totalReq         = discovery + hydrationMatches×2 + rank
 */
export function computeDripBudgetConfig(
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): DripBudgetConfig {
  const budget = Math.max(1, Math.trunc(rateLimitPer120s));
  const discoverySlots = Math.max(1, Math.floor(budget * DISCOVERY_BUDGET_RATIO));
  const hydrationMatches = Math.max(1, Math.floor((budget * HYDRATION_BUDGET_RATIO) / 2));
  const rankSlots = Math.max(1, Math.floor(budget * RANK_BUDGET_RATIO));
  const totalReqPer120s =
    discoverySlots + hydrationMatches * SLOT_COSTS.hydration + rankSlots;

  if (totalReqPer120s > budget) {
    throw new Error(`Budget overflow: ${totalReqPer120s} > ${budget}`);
  }

  const discoveryIntervalMs = Math.ceil(WINDOW_MS / discoverySlots);
  const hydrationIntervalMs = Math.ceil(WINDOW_MS / hydrationMatches);
  const rankIntervalMs = Math.ceil(WINDOW_MS / rankSlots);
  const hydrationTokenIntervalMs = Math.ceil(
    WINDOW_MS / (hydrationMatches * SLOT_COSTS.hydration),
  );

  return {
    budget,
    discoverySlots,
    hydrationSlots: hydrationMatches,
    rankSlots,
    totalReqPer120s,
    discoveryIntervalMs,
    hydrationIntervalMs,
    rankIntervalMs,
    hydrationTokenIntervalMs,
  };
}

/** @deprecated alias — use computeDripBudgetConfig(). */
export function getEffectiveBudgetBreakdown(
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): EffectiveBudgetBreakdown {
  const cfg = computeDripBudgetConfig(rateLimitPer120s);
  return {
    discoverySlots: cfg.discoverySlots,
    hydrationSlots: cfg.hydrationSlots,
    rankSlots: cfg.rankSlots,
    totalReqPer120s: cfg.totalReqPer120s,
  };
}

export function apiTokenBudgetForPipeline(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  const cfg = computeDripBudgetConfig(rateLimitPer120s);
  switch (pipeline) {
    case "discovery":
      return cfg.discoverySlots;
    case "hydration":
      return cfg.hydrationSlots * SLOT_COSTS.hydration;
    case "rank":
      return cfg.rankSlots;
  }
}

export function dripIntervalMsForPipeline(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  const cfg = computeDripBudgetConfig(rateLimitPer120s);
  switch (pipeline) {
    case "discovery":
      return cfg.discoveryIntervalMs;
    case "hydration":
      return cfg.hydrationTokenIntervalMs;
    case "rank":
      return cfg.rankIntervalMs;
  }
}

export function hydrationJobIntervalMs(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return computeDripBudgetConfig(rateLimitPer120s).hydrationIntervalMs;
}
