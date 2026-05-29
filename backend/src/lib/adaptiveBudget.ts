import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import { bullmqJobId } from "../queues/bullmq-job-id.js";
import { rankQueue } from "../queues/index.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";

const TARGET_PCT = 0.98;

function parseOptionalPositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

const DISCOVERY_ALLOC_OVERRIDE = parseOptionalPositiveInt(process.env.DISCOVERY_ALLOC_OVERRIDE) ?? 6;
const HYDRATION_ALLOC_OVERRIDE = parseOptionalPositiveInt(process.env.HYDRATION_ALLOC_OVERRIDE) ?? 7;
const RANK_ALLOC_OVERRIDE = parseOptionalPositiveInt(process.env.RANK_ALLOC_OVERRIDE) ?? 70;
const FORCE_ALLOC_OVERRIDE = process.env.FORCE_ALLOC_OVERRIDE === "1";

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
  /**
   * Floors choisis pour respecter la cible 94-98 req/120s **constant** :
   *  - rank min=15 : couvre ~7 ranks/match × 2 matches/cycle, et absorbe les
   *    pics sans dépendre de signaux de saturation (la queue rank se vide
   *    rapidement avec 6 workers, donc `queueWaiting` est un mauvais signal).
   *  - hydration min=10 : ≥ 5 workers actifs en continu.
   *  - discovery min=4 : 2 cycles/min suffisent pour drainer le pool players.
   * Total mins = 4 + 20 + 15 = 39, laisse 56 req/120s en flex pour l'adaptive.
   */
  return {
    discovery: { min: 4, max: Math.max(20, Math.floor(20 * scale)), costPerJob: 1 },
    hydration: { min: 10, max: Math.max(35, Math.floor(35 * scale)), costPerJob: 2 },
    rank: { min: 22, max: Math.max(40, Math.floor(40 * scale)), costPerJob: 1 },
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

export const DEFAULT_INITIAL_ALLOCATION: BudgetAllocation = (() => {
  const totalReq = totalBudgetReq120s();
  const discovery = FORCE_ALLOC_OVERRIDE ? DISCOVERY_ALLOC_OVERRIDE : 10;
  const hydration = FORCE_ALLOC_OVERRIDE ? HYDRATION_ALLOC_OVERRIDE : 18;
  const rank = FORCE_ALLOC_OVERRIDE ? RANK_ALLOC_OVERRIDE : 22;
  if (FORCE_ALLOC_OVERRIDE) {
    return {
      discovery,
      hydration,
      rank,
      totalReq: discovery + hydration * 2 + rank,
    };
  }
  return { discovery, hydration, rank, totalReq };
})();

export const MIN_ALLOC_CHANGE = 2;
export const MIN_REBALANCE_INTERVAL_MS = 3 * 60_000;
export const MIN_ALLOC_CHANGE_PCT = 0.2;
export const SIGNAL_EMA_ALPHA = 0.3;

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

/**
 * Idle-fill : déclenché dès qu'on a du slack budget pour viser une consommation
 * constante 94-98 req/120s. Le fill enfile des rank prefetch pour des joueurs
 * sans snapshot today → bénéfice immédiat sur les prochains matches (gate rank
 * passe sans fetch supplémentaire).
 *
 * Gardes (anti-overload) :
 *  - hydration pas en backlog significatif (sinon on prive le rank gate)
 *  - rank queue pas déjà saturée (sinon les jobs s'accumulent sans drainage)
 */
export function shouldTriggerRankFill(
  snapshots: Record<Pipeline, PipelineSnapshot>,
  idleBudget: number,
  fillThreshold = RANK_FILL_IDLE_THRESHOLD,
): boolean {
  // Tant que hydration a du backlog, ne pas voler le budget rank pour du fill idle.
  if (snapshots.hydration.queueWaiting > 0) {
    return false;
  }
  if (snapshots.rank.queueWaiting >= RANK_QUEUE.CRITICAL) {
    return false;
  }
  // Ne pas brûler le budget rank en backfill quand le pipeline match est totalement
  // à l'arrêt (discovery ne produit plus de hydration jobs).
  if (
    snapshots.hydration.queueWaiting === 0 &&
    snapshots.hydration.queueActive === 0 &&
    (snapshots.hydration.hydrationWaitingChildren ?? 0) === 0
  ) {
    return false;
  }
  return idleBudget >= fillThreshold;
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
  const rankSaturated = rank.tokensUsed120s >= Math.max(1, rank.currentAlloc * 0.8);
  const hydrationStarvedByRank =
    hydration.queueWaiting > HYDRATION_QUEUE.HEALTHY_LO &&
    hydration.tokensUsed120s < Math.max(2, hydration.currentAlloc * 0.2) &&
    rankSaturated;

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

  // When hydration backlog is high and rank budget is saturated,
  // rank becomes the hidden bottleneck even if rank queue is near zero.
  if (hydration.queueWaiting > HYDRATION_QUEUE.HEALTHY_LO && rankSaturated) {
    rankScore = Math.max(rankScore, 0.9);
  }
  if (hydrationStarvedByRank) {
    rankScore = Math.max(rankScore, 1.1);
    hydrationScore = Math.min(hydrationScore, 0.35);
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

  if (FORCE_ALLOC_OVERRIDE) {
    discovery = DISCOVERY_ALLOC_OVERRIDE;
    hydration = HYDRATION_ALLOC_OVERRIDE;
    rank = RANK_ALLOC_OVERRIDE;
    totalReq = discovery + hydration * 2 + rank;
    if (totalReq > totalBudget) {
      const overflow = totalReq - totalBudget;
      const hydrationReduce = Math.ceil(overflow / 2);
      hydration = Math.max(1, hydration - hydrationReduce);
      totalReq = discovery + hydration * 2 + rank;
      if (totalReq > totalBudget) {
        const remainingOverflow = totalReq - totalBudget;
        discovery = Math.max(1, discovery - remainingOverflow);
        totalReq = discovery + hydration * 2 + rank;
      }
    }
  }

  // If rank queue is empty and rank throughput is far below its allocation,
  // shift budget back to hydration so backlog can drain.
  // Exception : `waitingChildren > 3` (BullMQ parent-child pattern) signale rank
  // différé, pas underused.
  const rankUnderused = snapshots.rank.tokensUsed120s < rank * 0.3;
  const hydrationBlockedByRank = (snapshots.hydration.hydrationWaitingChildren ?? 0) > 3;
  if (
    !FORCE_ALLOC_OVERRIDE &&
    !hydrationBlockedByRank &&
    snapshots.rank.queueWaiting === 0 &&
    snapshots.rank.queueActive === 0 &&
    rankUnderused &&
    snapshots.hydration.queueWaiting > 0
  ) {
    const targetRank = Math.max(min.rank, Math.min(rank, Math.ceil(snapshots.rank.tokensUsed120s * 1.5)));
    const freed = Math.max(0, rank - targetRank);
    if (freed > 0) {
      rank -= freed;
      const hydrationAdd = Math.floor(freed / 2);
      hydration = clamp(hydration + hydrationAdd, min.hydration, max.hydration);
      totalReq = discovery + hydration * 2 + rank;
      if (totalReq > totalBudget) {
        const overflow = totalReq - totalBudget;
        hydration = Math.max(min.hydration, hydration - Math.ceil(overflow / 2));
        totalReq = discovery + hydration * 2 + rank;
      }
    }
  }

  // If discovery is significantly underused while hydration has backlog,
  // reclaim part of discovery budget for hydration throughput.
  const discoveryUnderused = snapshots.discovery.tokensUsed120s < discovery * 0.5;
  if (
    !FORCE_ALLOC_OVERRIDE &&
    discoveryUnderused &&
    snapshots.hydration.queueWaiting > HYDRATION_QUEUE.HEALTHY_LO
  ) {
    const targetDiscovery = Math.max(
      min.discovery,
      Math.min(discovery, Math.ceil(snapshots.discovery.tokensUsed120s * 1.5)),
    );
    const freed = Math.max(0, discovery - targetDiscovery);
    if (freed > 0) {
      discovery -= freed;
      const hydrationAdd = Math.floor(freed / 2);
      hydration = clamp(hydration + hydrationAdd, min.hydration, max.hydration);
      totalReq = discovery + hydration * 2 + rank;
      if (totalReq > totalBudget) {
        const overflow = totalReq - totalBudget;
        hydration = Math.max(min.hydration, hydration - Math.ceil(overflow / 2));
        totalReq = discovery + hydration * 2 + rank;
      }
    }
  }

  // Consommer le budget restant quand hydration a du backlog (gate rank inclus).
  if (!FORCE_ALLOC_OVERRIDE && snapshots.hydration.queueWaiting > 0 && totalReq < totalBudget) {
    let spareReq = totalBudget - totalReq;

    if (spareReq > 0) {
      const rankHeadroom = Math.max(0, max.rank - rank);
      const rankAdd = Math.min(spareReq, rankHeadroom);
      if (rankAdd > 0) {
        rank += rankAdd;
        spareReq -= rankAdd;
      }
    }

    if (spareReq > 0) {
      const hydrationHeadroomReq = Math.max(0, (max.hydration - hydration) * 2);
      const hydrationReqAdd = Math.min(spareReq, hydrationHeadroomReq);
      const hydrationJobsAdd = Math.floor(hydrationReqAdd / 2);
      if (hydrationJobsAdd > 0) {
        hydration = clamp(hydration + hydrationJobsAdd, min.hydration, max.hydration);
        spareReq -= hydrationJobsAdd * 2;
      }
    }

    if (spareReq > 0) {
      const discoveryHeadroom = Math.max(0, max.discovery - discovery);
      const discoveryAdd = Math.min(spareReq, discoveryHeadroom);
      if (discoveryAdd > 0) {
        discovery += discoveryAdd;
      }
    }

    totalReq = discovery + hydration * 2 + rank;
  }

  return { discovery, hydration, rank, totalReq };
}

export function smoothPipelineSnapshots(
  raw: Record<Pipeline, PipelineSnapshot>,
  ema: Record<Pipeline, Partial<PipelineSnapshot>>,
  alpha = SIGNAL_EMA_ALPHA,
): Record<Pipeline, PipelineSnapshot> {
  const smooth = (prev: number, next: number): number =>
    alpha * next + (1 - alpha) * prev;

  const out = {} as Record<Pipeline, PipelineSnapshot>;
  for (const pipeline of ["discovery", "hydration", "rank"] as const) {
    const prev = ema[pipeline] ?? {};
    const snap = raw[pipeline];
    const queueWaiting = smooth(prev.queueWaiting ?? snap.queueWaiting, snap.queueWaiting);
    const hydrationWaitingChildren = smooth(
      prev.hydrationWaitingChildren ?? snap.hydrationWaitingChildren ?? 0,
      snap.hydrationWaitingChildren ?? 0,
    );
    ema[pipeline] = {
      queueWaiting,
      hydrationWaitingChildren,
      queueActive: snap.queueActive,
    };
    out[pipeline] = {
      ...snap,
      queueWaiting: Math.round(queueWaiting),
      hydrationWaitingChildren: Math.round(hydrationWaitingChildren),
    };
  }
  return out;
}

export function isSignificantAllocationChange(
  prev: BudgetAllocation,
  next: BudgetAllocation,
  minDelta = MIN_ALLOC_CHANGE,
  minPct = MIN_ALLOC_CHANGE_PCT,
): boolean {
  const pctChanged = (field: keyof Pick<BudgetAllocation, "discovery" | "hydration" | "rank">) => {
    const base = Math.max(1, prev[field]);
    return Math.abs(next[field] - prev[field]) / base >= minPct;
  };

  return (
    pctChanged("discovery") ||
    pctChanged("hydration") ||
    pctChanged("rank") ||
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
  private readonly emaSignals: Record<Pipeline, Partial<PipelineSnapshot>> = {
    discovery: {},
    hydration: {},
    rank: {},
  };

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
        forceOverride: FORCE_ALLOC_OVERRIDE
          ? {
              discovery: DISCOVERY_ALLOC_OVERRIDE,
              hydration: HYDRATION_ALLOC_OVERRIDE,
              rank: RANK_ALLOC_OVERRIDE,
            }
          : null,
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
      const rawSnapshots = await this.getSnapshots();
      this.lastHydrationWaitingChildren = rawSnapshots.hydration.hydrationWaitingChildren ?? 0;
      const snapshots = smoothPipelineSnapshots(rawSnapshots, this.emaSignals);
      const newAlloc = computeAllocation(snapshots);
      const scores = scorePipelines(snapshots);
      const prev = this.currentAllocation;
      const now = Date.now();
      const rebalanceDue =
        this.lastRebalanceAtMs == null ||
        now - this.lastRebalanceAtMs >= MIN_REBALANCE_INTERVAL_MS;

      if (rebalanceDue && isSignificantAllocationChange(prev, newAlloc)) {
        await this.applyAllocation(newAlloc);
        this.currentAllocation = newAlloc;
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
