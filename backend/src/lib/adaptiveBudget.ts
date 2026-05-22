import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import { bullmqJobId } from "../queues/bullmq-job-id.js";
import { rankQueue } from "../queues/index.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";

const TARGET_PCT = 0.95;

/** Budget total req/120s — marge ~5 % sous la limite Riot. */
const REF_BUDGET = 90;

export function totalBudgetReq120s(
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  return Math.max(30, Math.floor(rateLimitPer120s * TARGET_PCT));
}

export type Pipeline = "discovery" | "hydration" | "rank";

export type PipelineConstraints = {
  min: number;
  max: number;
  costPerJob: number;
};

export function pipelineConstraintsForBudget(
  totalBudget = totalBudgetReq120s(),
): Record<Pipeline, PipelineConstraints> {
  const scale = Math.max(1, totalBudget / REF_BUDGET);
  return {
    discovery: { min: 4, max: Math.max(20, Math.floor(20 * scale)), costPerJob: 1 },
    hydration: { min: 10, max: Math.max(35, Math.floor(35 * scale)), costPerJob: 2 },
    rank: { min: 6, max: Math.max(35, Math.floor(35 * scale)), costPerJob: 1 },
  };
}

const HYDRATION_QUEUE = {
  STARVED: 20,
  HEALTHY_LO: 50,
  HEALTHY_HI: 200,
  OVERLOADED: 400,
} as const;

const RANK_QUEUE = {
  EMPTY: 0,
  BACKLOG: 20,
  CRITICAL: 100,
} as const;

export interface PipelineSnapshot {
  queueWaiting: number;
  queueActive: number;
  tokensUsed120s: number;
  currentAlloc: number;
  /** Jobs hydration bloqués en attente de rank enfants (BullMQ waiting-children). */
  hydrationWaitingChildren?: number;
}

export interface BudgetAllocation {
  discovery: number;
  hydration: number;
  rank: number;
  totalReq: number;
}

export const DEFAULT_INITIAL_ALLOCATION: BudgetAllocation = {
  discovery: 8,
  hydration: 20,
  rank: 14,
  totalReq: 8 + 20 * 2 + 14,
};

export const MIN_ALLOC_CHANGE = 2;

/** Req/120s idle minimum avant d'enfiler des rank fills. */
export const RANK_FILL_IDLE_THRESHOLD = 10;

const RANK_FILL_JOB_OPTS = {
  attempts: 2,
  backoff: { type: "fixed" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
} as const;

type RankFillTarget = {
  puuid: string;
  region: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeUsedReq120s(snapshots: Record<Pipeline, PipelineSnapshot>): number {
  return (
    snapshots.discovery.tokensUsed120s +
    snapshots.hydration.tokensUsed120s +
    snapshots.rank.tokensUsed120s
  );
}

export function computeIdleBudgetReq120s(
  snapshots: Record<Pipeline, PipelineSnapshot>,
  totalBudget = totalBudgetReq120s(),
): number {
  return totalBudget - computeUsedReq120s(snapshots);
}

export function shouldTriggerRankFill(
  snapshots: Record<Pipeline, PipelineSnapshot>,
  idleBudget: number,
  fillThreshold = RANK_FILL_IDLE_THRESHOLD,
): boolean {
  const hydrationIdle =
    snapshots.hydration.queueWaiting < HYDRATION_QUEUE.STARVED &&
    snapshots.hydration.queueActive < 4;
  const rankIdle =
    snapshots.rank.queueWaiting === 0 && snapshots.rank.queueActive < 2;
  return hydrationIdle && rankIdle && idleBudget >= fillThreshold;
}

export function computeRankFillCount(
  idleBudget: number,
  alloc: BudgetAllocation,
): number {
  return Math.max(0, Math.floor(Math.min(idleBudget / 2, alloc.rank)));
}

export async function selectRankFillTargets(limit: number): Promise<RankFillTarget[]> {
  if (limit <= 0) {
    return [];
  }

  const today = todayIsoDate();
  return sql<RankFillTarget[]>`
    SELECT p.puuid, p.region
    FROM players p
    WHERE LENGTH(TRIM(p.puuid)) > 0
      AND LENGTH(TRIM(p.region)) > 0
      AND p.last_seen > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM player_rank_history prh
        WHERE prh.puuid = p.puuid
          AND prh.region = p.region
          AND prh.date = ${today}::date
      )
    ORDER BY p.last_seen DESC NULLS LAST
    LIMIT ${limit}
  `;
}

export async function enqueueRankFillJobs(
  targets: RankFillTarget[],
  today = todayIsoDate(),
): Promise<number> {
  const jobs: Array<{
    name: string;
    data: { puuid: string; region: string; matchDate: string };
    opts: {
      jobId: string;
      priority: number;
      attempts: number;
      backoff: { type: "fixed"; delay: number };
      removeOnComplete: { count: number };
      removeOnFail: { count: number };
    };
  }> = [];

  for (const target of targets) {
    const puuid = String(target.puuid ?? "").trim();
    const region = normalizePlatformRegion(target.region);
    if (!puuid || !region) continue;

    const jobId = bullmqJobId("rank", region, puuid, today);
    const existing = await rankQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== "failed") {
        continue;
      }
      await existing.remove().catch(() => undefined);
    }

    jobs.push({
      name: "fetch-rank",
      data: { puuid, region, matchDate: today },
      opts: {
        jobId,
        priority: 10,
        ...RANK_FILL_JOB_OPTS,
      },
    });
  }

  if (jobs.length === 0) {
    return 0;
  }

  await rankQueue.addBulk(jobs);
  return jobs.length;
}

export async function maybeFillRankBudget(
  snapshots: Record<Pipeline, PipelineSnapshot>,
  alloc: BudgetAllocation,
): Promise<number> {
  const idleBudget = computeIdleBudgetReq120s(snapshots);
  if (!shouldTriggerRankFill(snapshots, idleBudget)) {
    return 0;
  }

  const fillCount = computeRankFillCount(idleBudget, alloc);
  if (fillCount <= 0) {
    return 0;
  }

  const targets = await selectRankFillTargets(fillCount);
  if (targets.length === 0) {
    return 0;
  }

  const enqueued = await enqueueRankFillJobs(targets);
  if (enqueued <= 0) {
    return 0;
  }

  console.log(
    JSON.stringify({
      msg: "rank_fill_triggered",
      idleBudget,
      fillCount: enqueued,
      hydrationQ: snapshots.hydration.queueWaiting,
      rankQ: snapshots.rank.queueWaiting,
    }),
  );

  return enqueued;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function scorePipelines(
  snapshots: Record<Pipeline, PipelineSnapshot>,
): Record<Pipeline, number> {
  const { hydration, rank } = snapshots;
  const waitingChildren = hydration.hydrationWaitingChildren ?? 0;

  let discoveryScore: number;
  if (hydration.queueWaiting < HYDRATION_QUEUE.STARVED) {
    discoveryScore = 1.0;
  } else if (hydration.queueWaiting < HYDRATION_QUEUE.HEALTHY_LO) {
    discoveryScore = 0.6;
  } else if (hydration.queueWaiting < HYDRATION_QUEUE.HEALTHY_HI) {
    discoveryScore = 0.3;
  } else if (hydration.queueWaiting < HYDRATION_QUEUE.OVERLOADED) {
    discoveryScore = 0.1;
  } else {
    discoveryScore = 0.05;
  }

  let hydrationScore: number;
  if (hydration.queueWaiting > HYDRATION_QUEUE.HEALTHY_LO) {
    hydrationScore = 0.9;
  } else if (hydration.queueWaiting > 0) {
    hydrationScore = 0.5;
  } else {
    hydrationScore = 0.1;
  }

  let rankScore: number;
  if (waitingChildren > 30) {
    rankScore = 1.0;
  } else if (waitingChildren > 10) {
    rankScore = 0.75;
  } else if (waitingChildren > 3) {
    rankScore = 0.5;
  } else if (rank.queueWaiting > RANK_QUEUE.BACKLOG) {
    rankScore = 0.7;
  } else if (rank.queueWaiting > RANK_QUEUE.EMPTY) {
    rankScore = 0.3;
  } else {
    rankScore = 0.1;
  }

  return {
    discovery: discoveryScore,
    hydration: hydrationScore,
    rank: rankScore,
  };
}

export function computeAllocation(
  snapshots: Record<Pipeline, PipelineSnapshot>,
  totalBudget = totalBudgetReq120s(),
): BudgetAllocation {
  const constraints = pipelineConstraintsForBudget(totalBudget);
  const scores = scorePipelines(snapshots);

  const min = {
    discovery: constraints.discovery.min,
    hydration: constraints.hydration.min,
    rank: constraints.rank.min,
  };
  const max = {
    discovery: constraints.discovery.max,
    hydration: constraints.hydration.max,
    rank: constraints.rank.max,
  };

  const minReqTotal = min.discovery + min.hydration * 2 + min.rank;
  const remainingBudget = totalBudget - minReqTotal;

  const totalScore = scores.discovery + scores.hydration + scores.rank;
  const discoveryExtra = Math.floor((scores.discovery / totalScore) * remainingBudget);
  const hydrationExtra = Math.floor((scores.hydration / totalScore) * remainingBudget / 2);
  const rankExtra = Math.floor((scores.rank / totalScore) * remainingBudget);

  let discovery = clamp(min.discovery + discoveryExtra, min.discovery, max.discovery);
  let hydration = clamp(min.hydration + hydrationExtra, min.hydration, max.hydration);
  let rank = clamp(min.rank + rankExtra, min.rank, max.rank);

  let totalReq = discovery + hydration * 2 + rank;
  if (totalReq > totalBudget) {
    const overflow = totalReq - totalBudget;
    hydration = Math.max(min.hydration, hydration - Math.ceil(overflow / 2));
    totalReq = discovery + hydration * 2 + rank;
  }

  return { discovery, hydration, rank, totalReq };
}

export function isSignificantAllocationChange(
  prev: BudgetAllocation,
  next: BudgetAllocation,
  minDelta = MIN_ALLOC_CHANGE,
): boolean {
  return (
    Math.abs(next.discovery - prev.discovery) >= minDelta ||
    Math.abs(next.hydration - prev.hydration) >= minDelta ||
    Math.abs(next.rank - prev.rank) >= minDelta
  );
}

export class AdaptiveBudgetScheduler {
  private currentAllocation: BudgetAllocation;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastRebalanceAtMs: number | null = null;
  private rebalanceTimestampsMs: number[] = [];
  private rankFillTimestampsMs: number[] = [];
  private lastRankFillCount = 0;
  private lastRankFillAtMs: number | null = null;
  private lastHydrationWaitingChildren = 0;

  constructor(
    private readonly getSnapshots: () => Promise<Record<Pipeline, PipelineSnapshot>>,
    private readonly applyAllocation: (alloc: BudgetAllocation) => Promise<void>,
    private readonly tickMs = 30_000,
    initialAllocation: BudgetAllocation = DEFAULT_INITIAL_ALLOCATION,
  ) {
    this.currentAllocation = { ...initialAllocation };
  }

  getCurrentAllocation(): BudgetAllocation {
    return { ...this.currentAllocation };
  }

  getObservabilityState(nowMs = Date.now()): {
    discovery_alloc: number;
    hydration_alloc: number;
    rank_alloc: number;
    total_req: number;
    rebalances_last_1h: number;
    last_rebalance_ago_s: number | null;
    rank_fills_last_1h: number;
    last_rank_fill_count: number;
    last_rank_fill_ago_s: number | null;
    hydration_waiting_children: number;
  } {
    const oneHourAgo = nowMs - 3_600_000;
    this.rebalanceTimestampsMs = this.rebalanceTimestampsMs.filter((ts) => ts >= oneHourAgo);
    this.rankFillTimestampsMs = this.rankFillTimestampsMs.filter((ts) => ts >= oneHourAgo);
    return {
      discovery_alloc: this.currentAllocation.discovery,
      hydration_alloc: this.currentAllocation.hydration,
      rank_alloc: this.currentAllocation.rank,
      total_req: this.currentAllocation.totalReq,
      rebalances_last_1h: this.rebalanceTimestampsMs.length,
      last_rebalance_ago_s:
        this.lastRebalanceAtMs == null
          ? null
          : Math.max(0, Math.floor((nowMs - this.lastRebalanceAtMs) / 1000)),
      rank_fills_last_1h: this.rankFillTimestampsMs.length,
      last_rank_fill_count: this.lastRankFillCount,
      last_rank_fill_ago_s:
        this.lastRankFillAtMs == null
          ? null
          : Math.max(0, Math.floor((nowMs - this.lastRankFillAtMs) / 1000)),
      hydration_waiting_children: this.lastHydrationWaitingChildren,
    };
  }

  recordRankFill(count: number, nowMs = Date.now()): void {
    if (count <= 0) return;
    this.lastRankFillCount = count;
    this.lastRankFillAtMs = nowMs;
    this.rankFillTimestampsMs.push(nowMs);
  }

  start(): void {
    console.log(
      JSON.stringify({
        msg: "adaptive_budget_scheduler_started",
        tickMs: this.tickMs,
        initial: this.currentAllocation,
      }),
    );

    void this.applyAllocation(this.currentAllocation).catch((error) => {
      console.error("[adaptive-budget] initial allocation failed", error);
    });

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.tickMs);
  }

  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const snapshots = await this.getSnapshots();
      this.lastHydrationWaitingChildren = snapshots.hydration.hydrationWaitingChildren ?? 0;
      const newAlloc = computeAllocation(snapshots);
      const scores = scorePipelines(snapshots);
      const prev = this.currentAllocation;

      if (isSignificantAllocationChange(prev, newAlloc)) {
        await this.applyAllocation(newAlloc);
        this.currentAllocation = newAlloc;
        const now = Date.now();
        this.lastRebalanceAtMs = now;
        this.rebalanceTimestampsMs.push(now);

        console.log(
          JSON.stringify({
            msg: "adaptive_budget_rebalanced",
            prev: {
              discovery: prev.discovery,
              hydration: prev.hydration,
              rank: prev.rank,
              totalReq: prev.totalReq,
            },
            next: {
              discovery: newAlloc.discovery,
              hydration: newAlloc.hydration,
              rank: newAlloc.rank,
              totalReq: newAlloc.totalReq,
            },
            signals: {
              hydrationWaiting: snapshots.hydration.queueWaiting,
              hydrationWaitingChildren: this.lastHydrationWaitingChildren,
              rankWaiting: snapshots.rank.queueWaiting,
              hydrationActive: snapshots.hydration.queueActive,
              rankScore: scores.rank,
              discoveryScore: scores.discovery,
            },
          }),
        );
      }

      await maybeFillRankBudget(snapshots, newAlloc).then((filled) => {
        this.recordRankFill(filled);
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "adaptive_budget_tick_failed",
          err: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
