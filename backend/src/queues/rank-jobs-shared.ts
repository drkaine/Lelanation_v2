import { WINDOW_MS } from "../redis/rate-budget.js";
import { bullmqJobId } from "./bullmq-job-id.js";

export const RANK_CHILD_JOB_OPTS = {
  attempts: 2,
  backoff: { type: "fixed" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

export const RANK_PREFETCH_PRIORITY = 5;
export const RANK_GATE_PRIORITY = 1;
export const RANK_FILL_PRIORITY = 10;

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function rankChildJobId(puuid: string, region: string, today: string): string {
  return bullmqJobId("rank", region, puuid, today);
}

export function computeRankExistingJobsDelayMs(
  pendingCount: number,
  rankAlloc: number,
): number {
  const safeCount = Math.max(1, Math.trunc(pendingCount));
  const safeRankAlloc = Math.max(1, Math.trunc(rankAlloc));
  const rankDripMs = WINDOW_MS / safeRankAlloc;
  return Math.max(5_000, Math.min(120_000, Math.floor(safeCount * rankDripMs * 0.5)));
}
