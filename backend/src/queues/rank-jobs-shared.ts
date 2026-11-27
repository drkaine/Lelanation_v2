import { WINDOW_MS } from "../redis/rate-budget.js";
import { bullmqJobId } from "./bullmq-job-id.js";
import { sweepDay } from "../poll-orchestration/leagueSweep.js";

export const RANK_CHILD_JOB_OPTS = {
  attempts: 2,
  backoff: { type: "fixed" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

export const RANK_PREFETCH_PRIORITY = 5;
export const RANK_GATE_PRIORITY = 1;
export const RANK_FILL_PRIORITY = 10;

/** Jour du balayage (local, 00:01) : même date que les rangs et les cibles. */
export function todayIsoDate(): string {
  return sweepDay(new Date());
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

/** Délai defer hydration = temps drip pour couvrir les ranks manquants restants. */
export function computeRankGateDeferDelayMs(pendingCount: number, rankAlloc: number): number {
  const safeCount = Math.max(1, Math.trunc(pendingCount));
  const safeRankAlloc = Math.max(1, Math.trunc(rankAlloc));
  const rankDripMs = WINDOW_MS / safeRankAlloc;
  return Math.max(15_000, Math.min(120_000, Math.floor(safeCount * rankDripMs * 1.15)));
}

/** Attente courte par rank gate — le job hydration defer si pas prêt (ne pas bloquer 2 min). */
export const RANK_GATE_ENQUEUE_WAIT_MS = 5_000;
export const RANK_GATE_BATCH_POLL_MS = 20_000;

/** Attente max pour un seul rank gate (1 slot drip + marge file). */
export function computeRankSingleGateWaitMs(rankAlloc: number): number {
  const safeRankAlloc = Math.max(1, Math.trunc(rankAlloc));
  const rankDripMs = WINDOW_MS / safeRankAlloc;
  return Math.max(20_000, Math.min(90_000, Math.floor(rankDripMs * 6)));
}

/** Attente max par rank gate (séquentiel) — alignée sur le drip rank courant. */
export function computeRankGateWaitMs(pendingCount: number, rankAlloc: number): number {
  const safeCount = Math.max(1, Math.trunc(pendingCount));
  const safeRankAlloc = Math.max(1, Math.trunc(rankAlloc));
  const rankDripMs = WINDOW_MS / safeRankAlloc;
  return Math.max(45_000, Math.min(120_000, Math.floor(safeCount * rankDripMs * 1.2)));
}
