import { promises as fs } from "fs";
import { join } from "path";
import { maxRankBacklogBeforePipelinePause, rankWorkerConcurrency } from "../queues/rank-backlog-policy.js";
import { currentBudgetAllocationRef } from "../redis/budget-allocation-ref.js";
import { SLOT_COSTS, type SlotPipeline } from "../redis/rate-budget.js";
import {
  countAggregatedMatchesSince,
  fetchIngestionThroughputMetrics,
  type IngestionThroughputMetrics,
} from "../redis/ingestion-metrics.js";
import { getRiotTokenBucketSnapshot } from "../redis/riot-token-bucket.js";

function allocatedTokensForPipeline(pipeline: SlotPipeline): number {
  const alloc = currentBudgetAllocationRef;
  if (pipeline === "discovery") return Math.max(1, alloc.discovery);
  if (pipeline === "hydration") return Math.max(1, alloc.hydration * SLOT_COSTS.hydration);
  return Math.max(1, alloc.rank);
}

type QueueSlice = {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
};

type Totals = {
  discoveryCycles: number;
  discoveryNoPlayerCycles: number;
  playersPolled: number;
  playersUpdated: number;
  playersAdded: number;
  matchIdsFetched: number;
  matchesQueuedHydration: number;
  hydrationJobsStarted: number;
  hydrationCacheHits: number;
  hydrationCacheMisses: number;
  hydrationJobsSucceeded: number;
  hydrationJobsSkippedOldPatch: number;
  hydrationJobsNotFound: number;
  hydrationJobsFailed: number;
  ingestionJobsStarted: number;
  ingestionJobsSucceeded: number;
  ingestionJobsDuplicate: number;
  ingestionJobsFailed: number;
  matchesIngested: number;
  participantsIngested: number;
  rankJobsStarted: number;
  rankJobsSucceeded: number;
  rankJobsFailed: number;
  /** Appels League v4 `entries/by-puuid` (refresh rang du jour). */
  rankLeagueFetchesSucceeded: number;
  rankLeagueFetchesFailed: number;
  apiRequests: number;
  api2xx: number;
  api4xx: number;
  api429: number;
  api5xx: number;
  apiRetries: number;
  rateLimitGrantedCount: number;
  rateLimitGrantedCost: number;
  rateLimitDeniedCount: number;
  rateLimitDeniedCost: number;
  rateLimitWaitMsTotal: number;
  rankGatePassedFirstTry: number;
  rankGateFailedFirstTry: number;
  hydrationRankRetries: number;
  discoveryPlayersSelected: number;
  discoveryPlayersAlreadyRanked: number;
  rankDedupHits: number;
  rankPrefetchHits: number;
  rankCacheL1Hits: number;
  rankCacheRedisHits: number;
  rankPrefetchEnqueued: number;
  rankPrefetchSkippedExisting: number;
};

type DurationKey =
  | "discoveryCycleMs"
  | "hydrationJobMs"
  | "ingestionJobMs"
  | "riotHttpMs"
  | "dbMetricsTickMs";

type DurationStat = {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  slowThresholdMs: number;
};

type TokenEvent = {
  atMs: number;
  granted: boolean;
  cost: number;
  waitMs: number;
  pipeline: SlotPipeline | null;
};

type IngestionEvent = {
  atMs: number;
};

type PipelineCompleteEvent = {
  atMs: number;
  durationSeconds: number;
};

type ApiEvent = {
  atMs: number;
  status: number;
  durationMs: number;
};

type ErrorEvent = {
  atIso: string;
  source: string;
  message: string;
};

type TokenRate10m = {
  tokenRateAvg10m: number;
  tokenRateStdDev10m: number;
  tokenRateMin10m: number;
  tokenRateMax10m: number;
};

type AdaptiveBudgetObservability = {
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
  discovery_actual_req_120s: number;
  hydration_actual_req_120s: number;
  rank_actual_req_120s: number;
};

type Snapshot = {
  atIso: string;
  startedAtIso: string;
  runtimeSeconds: number;
  totals: Totals;
  rolling2m: {
    apiRequests: number;
    api429: number;
    rateLimitGrantedCost: number;
    rateLimitDeniedCount: number;
    rateLimitWaitMsTotal: number;
    tokenBudget120: number;
    tokenUsagePct: number;
  };
  /** Variance du débit token (snapshots rolling2m.tokenUsagePct toutes les 30 s, fenêtre 10 min). */
  tokenRate10m: TokenRate10m;
  durations: Record<DurationKey, DurationStat & { avgMs: number }>;
  queue: {
    discovery: QueueSlice;
    hydration: QueueSlice;
    ingestion: QueueSlice;
    rank: QueueSlice;
    dataLagSeconds: number | null;
    tickDurationMs: number | null;
  };
  /** Dernier snapshot queue rank — `rank.waiting`. */
  rankLeagueFetchesPending: number;
  /** BullMQ worker concurrency configurée (pas `rank.active`). */
  rankWorkerConcurrency: number;
  /** Métriques Phase 5 — diagnostic pipeline match. */
  matches_per_hour: number;
  matchesLastHour: number;
  matchesLast10Min: number;
  projectedMatchesPerHour: number;
  apiEfficiencyPct: number;
  data_lag_seconds: number | null;
  rank_gate_pass_rate_pct: number;
  rank_prefetch_coverage_pct: number;
  hydration_retry_count_30m: number;
  avg_match_pipeline_seconds: number;
  rateLimitAvgWaitMsPerGrant: number;
  req_per_120s_rolling: number;
  discovery_tokens_used_pct: number;
  hydration_tokens_used_pct: number;
  rank_tokens_used_pct: number;
  rank_dedup_hits: number;
  rank_prefetch_hits: number;
  rank_cache_l1_hits: number;
  rank_cache_redis_hits: number;
  hydration_cache_hit_rate_pct: number;
  rank_cache_hit_rate_pct: number;
  bucket_1s_remaining: number;
  bucket_120s_remaining: number;
  adaptive_budget: AdaptiveBudgetObservability | null;
  /** Alias jq spec (`queues.hydration.waiting`). */
  queues: {
    discovery: QueueSlice;
    hydration: QueueSlice;
    ingestion: QueueSlice;
    rank: QueueSlice;
  };
  recentErrors: ErrorEvent[];
  summaries: {
    last30m: Record<string, unknown> | null;
    last1h: Record<string, unknown> | null;
  };
};

function nowMs(): number {
  return Date.now();
}

/** Plafond coût 120 s du limiter Redis (aligné config Riot dev / prod). */
function tokenBudget120ForEnv(): number {
  return Number(process.env.ENV === "prod" ? 28_500 : 95);
}

function emptyTotals(): Totals {
  return {
    discoveryCycles: 0,
    discoveryNoPlayerCycles: 0,
    playersPolled: 0,
    playersUpdated: 0,
    playersAdded: 0,
    matchIdsFetched: 0,
    matchesQueuedHydration: 0,
    hydrationJobsStarted: 0,
    hydrationCacheHits: 0,
    hydrationCacheMisses: 0,
    hydrationJobsSucceeded: 0,
    hydrationJobsSkippedOldPatch: 0,
    hydrationJobsNotFound: 0,
    hydrationJobsFailed: 0,
    ingestionJobsStarted: 0,
    ingestionJobsSucceeded: 0,
    ingestionJobsDuplicate: 0,
    ingestionJobsFailed: 0,
    matchesIngested: 0,
    participantsIngested: 0,
    rankJobsStarted: 0,
    rankJobsSucceeded: 0,
    rankJobsFailed: 0,
    rankLeagueFetchesSucceeded: 0,
    rankLeagueFetchesFailed: 0,
    apiRequests: 0,
    api2xx: 0,
    api4xx: 0,
    api429: 0,
    api5xx: 0,
    apiRetries: 0,
    rateLimitGrantedCount: 0,
    rateLimitGrantedCost: 0,
    rateLimitDeniedCount: 0,
    rateLimitDeniedCost: 0,
    rateLimitWaitMsTotal: 0,
    rankGatePassedFirstTry: 0,
    rankGateFailedFirstTry: 0,
    hydrationRankRetries: 0,
    discoveryPlayersSelected: 0,
    discoveryPlayersAlreadyRanked: 0,
    rankDedupHits: 0,
    rankPrefetchHits: 0,
    rankCacheL1Hits: 0,
    rankCacheRedisHits: 0,
    rankPrefetchEnqueued: 0,
    rankPrefetchSkippedExisting: 0,
  };
}

function cloneTotals(t: Totals): Totals {
  return { ...t };
}

function deltaTotals(current: Totals, baseline: Totals): Totals {
  const out = emptyTotals();
  for (const key of Object.keys(out) as Array<keyof Totals>) {
    out[key] = current[key] - baseline[key];
  }
  return out;
}

class PollerV2Observability {
  private readonly startedAtMs = nowMs();
  private readonly totals: Totals = emptyTotals();
  private readonly tokenEvents: TokenEvent[] = [];
  private readonly apiEvents: ApiEvent[] = [];
  private readonly ingestionEvents: IngestionEvent[] = [];
  private readonly pipelineCompleteEvents: PipelineCompleteEvent[] = [];
  private readonly matchQueuedAtMs = new Map<string, number>();
  private readonly rankGateSeenMatchIds = new Set<string>();
  private readonly recentErrors: ErrorEvent[] = [];
  private readonly durations: Record<DurationKey, DurationStat> = {
    discoveryCycleMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 3_000 },
    hydrationJobMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 6_000 },
    ingestionJobMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 8_000 },
    riotHttpMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 2_000 },
    dbMetricsTickMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 400 },
  };

  private lastRankWorkerConfiguredConcurrency = 0;

  private lastQueue = {
    discovery: { waiting: 0, active: 0, failed: 0, delayed: 0 },
    hydration: { waiting: 0, active: 0, failed: 0, delayed: 0 },
    ingestion: { waiting: 0, active: 0, failed: 0, delayed: 0 },
    rank: { waiting: 0, active: 0, failed: 0, delayed: 0 },
    dataLagSeconds: null as number | null,
    tickDurationMs: null as number | null,
  };

  private baseline30m = cloneTotals(this.totals);
  private baseline1h = cloneTotals(this.totals);
  private last30mSummary: Record<string, unknown> | null = null;
  private last1hSummary: Record<string, unknown> | null = null;
  private adaptiveBudgetStateProvider: (() => AdaptiveBudgetObservability | null) | null = null;

  /** Snapshots tokenUsagePct toutes les 30 s (max 20 = 10 min). */
  private readonly rateHistory: number[] = [];
  private readonly maxRateHistory = 20;

  private readonly snapshotPath = join(process.cwd(), "..", "logs", "poller-v2-observability.json");

  private addError(source: string, message: string): void {
    this.recentErrors.push({ atIso: new Date().toISOString(), source, message });
    if (this.recentErrors.length > 80) this.recentErrors.splice(0, this.recentErrors.length - 80);
  }

  private addDuration(key: DurationKey, durationMs: number): void {
    const d = this.durations[key];
    d.count += 1;
    d.totalMs += durationMs;
    d.maxMs = Math.max(d.maxMs, durationMs);
    if (durationMs >= d.slowThresholdMs) d.slowCount += 1;
  }

  private pruneRollingWindows(now = nowMs()): void {
    const keepFrom = now - 2 * 60 * 60 * 1000;
    const ingestionKeepFrom = now - 2 * 60 * 60 * 1000;
    const pipelineKeepFrom = now - 2 * 60 * 60 * 1000;
    while (this.tokenEvents.length > 0 && this.tokenEvents[0] && this.tokenEvents[0].atMs < keepFrom) {
      this.tokenEvents.shift();
    }
    while (this.apiEvents.length > 0 && this.apiEvents[0] && this.apiEvents[0].atMs < keepFrom) {
      this.apiEvents.shift();
    }
    while (
      this.ingestionEvents.length > 0 &&
      this.ingestionEvents[0] &&
      this.ingestionEvents[0].atMs < ingestionKeepFrom
    ) {
      this.ingestionEvents.shift();
    }
    while (
      this.pipelineCompleteEvents.length > 0 &&
      this.pipelineCompleteEvents[0] &&
      this.pipelineCompleteEvents[0].atMs < pipelineKeepFrom
    ) {
      this.pipelineCompleteEvents.shift();
    }
  }

  private recordRateSnapshot(pct: number): void {
    this.rateHistory.push(pct);
    if (this.rateHistory.length > this.maxRateHistory) {
      this.rateHistory.shift();
    }
  }

  private tokenRate10m(): TokenRate10m {
    if (this.rateHistory.length === 0) {
      return {
        tokenRateAvg10m: 0,
        tokenRateStdDev10m: 0,
        tokenRateMin10m: 0,
        tokenRateMax10m: 0,
      };
    }

    const avg = this.rateHistory.reduce((a, b) => a + b, 0) / this.rateHistory.length;
    const variance =
      this.rateHistory.reduce((acc, value) => acc + (value - avg) ** 2, 0) / this.rateHistory.length;
    const stdDev = Math.sqrt(variance);

    return {
      tokenRateAvg10m: Math.round(avg * 10) / 10,
      tokenRateStdDev10m: Math.round(stdDev * 10) / 10,
      tokenRateMin10m: Math.round(Math.min(...this.rateHistory) * 10) / 10,
      tokenRateMax10m: Math.round(Math.max(...this.rateHistory) * 10) / 10,
    };
  }

  private logTokenRateAlerts(stats: TokenRate10m): void {
    if (stats.tokenRateStdDev10m > 15) {
      console.warn(
        JSON.stringify({
          msg: "token_rate_unstable",
          stdDev: stats.tokenRateStdDev10m,
          avg: stats.tokenRateAvg10m,
        }),
      );
    }
    if (stats.tokenRateMin10m < 70) {
      console.warn(
        JSON.stringify({
          msg: "token_rate_too_low",
          min: stats.tokenRateMin10m,
        }),
      );
    }
    if (stats.tokenRateMax10m > 99) {
      console.warn(
        JSON.stringify({
          msg: "token_rate_over_budget",
          max: stats.tokenRateMax10m,
        }),
      );
    }
  }

  private rolling120sTokenUsage(now = nowMs()): {
    reqTotal: number;
    discovery: number;
    hydration: number;
    rank: number;
  } {
    const from = now - 120_000;
    let discovery = 0;
    let hydration = 0;
    let rank = 0;

    for (const event of this.tokenEvents) {
      if (event.atMs < from || !event.granted) continue;
      if (event.pipeline === "discovery") discovery += event.cost;
      else if (event.pipeline === "hydration") hydration += event.cost;
      else if (event.pipeline === "rank") rank += event.cost;
    }

    return {
      reqTotal: discovery + hydration + rank,
      discovery,
      hydration,
      rank,
    };
  }

  private pctUsed(tokensUsed: number, pipeline: SlotPipeline): number {
    const budget = allocatedTokensForPipeline(pipeline);
    if (budget <= 0) return 0;
    return Math.round((tokensUsed / budget) * 1000) / 10;
  }

  private rankGatePassRatePct(): number {
    const passed = this.totals.rankGatePassedFirstTry;
    const failed = this.totals.rankGateFailedFirstTry;
    const total = passed + failed;
    if (total <= 0) return 0;
    return Math.round((passed / total) * 1000) / 10;
  }

  private rankPrefetchCoveragePct(): number {
    const selected = this.totals.discoveryPlayersSelected;
    const alreadyRanked = this.totals.discoveryPlayersAlreadyRanked;
    if (selected <= 0) return 0;
    return Math.round((alreadyRanked / selected) * 1000) / 10;
  }

  private matchesPerHour(now = nowMs()): number {
    const from = now - 3_600_000;
    let count = 0;
    for (const event of this.ingestionEvents) {
      if (event.atMs >= from) count += 1;
    }
    return count;
  }

  private avgMatchPipelineSeconds(now = nowMs()): number {
    const from = now - 30 * 60_000;
    const durations = this.pipelineCompleteEvents
      .filter((event) => event.atMs >= from)
      .map((event) => event.durationSeconds);
    if (durations.length === 0) return 0;
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return Math.round(avg * 10) / 10;
  }

  private hydrationRetryCount30m(): number {
    const delta = this.totals.hydrationRankRetries - this.baseline30m.hydrationRankRetries;
    return Math.max(0, delta);
  }

  private logIngestionAlerts(metrics: IngestionThroughputMetrics, runtimeSeconds: number): void {
    if (runtimeSeconds < 600) return;

    if (metrics.apiEfficiencyPct < 20) {
      console.warn(
        JSON.stringify({
          msg: "api_efficiency_low",
          apiEfficiencyPct: metrics.apiEfficiencyPct,
          matchesLastHour: metrics.matchesLastHour,
          matchesLast10Min: metrics.matchesLast10Min,
        }),
      );
    }

    if (metrics.matchesLast10Min === 0) {
      console.warn(
        JSON.stringify({
          msg: "ingestion_stalled",
          matchesLast10Min: metrics.matchesLast10Min,
          runtimeSeconds,
        }),
      );
    }
  }

  private async ingestionThroughputMetrics(now = nowMs()): Promise<IngestionThroughputMetrics> {
    return fetchIngestionThroughputMetrics(now);
  }

  private async buildDiagnosticsAsync(
    now = nowMs(),
  ): Promise<
    Pick<
      Snapshot,
      | "matches_per_hour"
      | "matchesLastHour"
      | "matchesLast10Min"
      | "projectedMatchesPerHour"
      | "apiEfficiencyPct"
      | "data_lag_seconds"
      | "rank_gate_pass_rate_pct"
      | "rank_prefetch_coverage_pct"
      | "hydration_retry_count_30m"
      | "avg_match_pipeline_seconds"
      | "rateLimitAvgWaitMsPerGrant"
      | "req_per_120s_rolling"
      | "discovery_tokens_used_pct"
      | "hydration_tokens_used_pct"
      | "rank_tokens_used_pct"
    >
  > {
    const throughput = await this.ingestionThroughputMetrics(now);
    return {
      ...this.buildDiagnostics(now),
      matches_per_hour: throughput.matchesLastHour,
      matchesLastHour: throughput.matchesLastHour,
      matchesLast10Min: throughput.matchesLast10Min,
      projectedMatchesPerHour: throughput.projectedMatchesPerHour,
      apiEfficiencyPct: throughput.apiEfficiencyPct,
    };
  }

  private buildDiagnostics(now = nowMs()): Pick<
    Snapshot,
    | "matches_per_hour"
    | "data_lag_seconds"
    | "rank_gate_pass_rate_pct"
    | "rank_prefetch_coverage_pct"
    | "hydration_retry_count_30m"
    | "avg_match_pipeline_seconds"
    | "rateLimitAvgWaitMsPerGrant"
    | "req_per_120s_rolling"
    | "discovery_tokens_used_pct"
    | "hydration_tokens_used_pct"
    | "rank_tokens_used_pct"
  > {
    const tokenUsage = this.rolling120sTokenUsage(now);
    return {
      matches_per_hour: this.matchesPerHour(now),
      data_lag_seconds: this.lastQueue.dataLagSeconds,
      rank_gate_pass_rate_pct: this.rankGatePassRatePct(),
      rank_prefetch_coverage_pct: this.rankPrefetchCoveragePct(),
      hydration_retry_count_30m: this.hydrationRetryCount30m(),
      avg_match_pipeline_seconds: this.avgMatchPipelineSeconds(now),
      rateLimitAvgWaitMsPerGrant:
        this.totals.rateLimitGrantedCount > 0
          ? Math.round((this.totals.rateLimitWaitMsTotal / this.totals.rateLimitGrantedCount) * 10) / 10
          : 0,
      req_per_120s_rolling: tokenUsage.reqTotal,
      discovery_tokens_used_pct: this.pctUsed(tokenUsage.discovery, "discovery"),
      hydration_tokens_used_pct: this.pctUsed(tokenUsage.hydration, "hydration"),
      rank_tokens_used_pct: this.pctUsed(tokenUsage.rank, "rank"),
    };
  }

  private rolling2m(now = nowMs()): Snapshot["rolling2m"] {
    const from = now - 120_000;
    let apiRequests = 0;
    let api429 = 0;
    let grantedCost = 0;
    let deniedCount = 0;
    let waitMsTotal = 0;

    for (const e of this.apiEvents) {
      if (e.atMs < from) continue;
      apiRequests += 1;
      if (e.status === 429) api429 += 1;
    }
    for (const e of this.tokenEvents) {
      if (e.atMs < from) continue;
      if (e.granted) grantedCost += e.cost;
      else deniedCount += 1;
      waitMsTotal += e.waitMs;
    }

    const tokenBudget120 = tokenBudget120ForEnv();
    /** Part du plafond 120 s « remplie » par la somme des coûts accordés sur les 2 dernières minutes (pic court, pas une moyenne horaire). */
    const tokenUsagePct = tokenBudget120 > 0 ? (grantedCost / tokenBudget120) * 100 : 0;
    return {
      apiRequests,
      api429,
      rateLimitGrantedCost: grantedCost,
      rateLimitDeniedCount: deniedCount,
      rateLimitWaitMsTotal: waitMsTotal,
      tokenBudget120,
      tokenUsagePct: Math.round(tokenUsagePct * 10) / 10,
    };
  }

  incDiscoveryCycle(): void {
    this.totals.discoveryCycles += 1;
  }

  setAdaptiveBudgetStateProvider(
    provider: (() => AdaptiveBudgetObservability | null) | null,
  ): void {
    this.adaptiveBudgetStateProvider = provider;
  }

  getRollingTokenUsage(): {
    reqTotal: number;
    discovery: number;
    hydration: number;
    rank: number;
  } {
    return this.rolling120sTokenUsage();
  }

  incDiscoveryNoPlayerCycle(): void {
    this.totals.discoveryNoPlayerCycles += 1;
  }

  recordPlayersPolled(count: number): void {
    this.totals.playersPolled += Math.max(0, count);
  }

  recordPlayersUpdated(count: number): void {
    this.totals.playersUpdated += Math.max(0, count);
  }

  recordPlayersAdded(count: number): void {
    this.totals.playersAdded += Math.max(0, count);
  }

  recordDiscoveryRankPrefetch(selected: number, prefetched: number): void {
    const safeSelected = Math.max(0, Math.trunc(selected));
    const safePrefetched = Math.max(0, Math.min(Math.trunc(prefetched), safeSelected));
    this.totals.discoveryPlayersSelected += safeSelected;
    this.totals.discoveryPlayersAlreadyRanked += safeSelected - safePrefetched;
  }

  recordRankDedupHit(): void {
    this.totals.rankDedupHits += 1;
  }

  recordRankPrefetchHit(): void {
    this.totals.rankPrefetchHits += 1;
  }

  recordRankCacheL1Hit(): void {
    this.totals.rankCacheL1Hits += 1;
  }

  recordRankCacheRedisHit(): void {
    this.totals.rankCacheRedisHits += 1;
  }

  recordRankPrefetchEnqueued(): void {
    this.totals.rankPrefetchEnqueued += 1;
  }

  recordRankPrefetchSkippedExisting(): void {
    this.totals.rankPrefetchSkippedExisting += 1;
  }

  private hydrationCacheHitRatePct(): number {
    const hits = this.totals.hydrationCacheHits;
    const total = hits + this.totals.hydrationCacheMisses;
    if (total <= 0) return 0;
    return Math.round((hits / total) * 1000) / 10;
  }

  private rankCacheHitRatePct(): number {
    const hits = this.totals.rankCacheL1Hits + this.totals.rankCacheRedisHits;
    const misses = Math.max(0, this.totals.rankPrefetchHits + this.totals.rankDedupHits);
    const total = hits + misses;
    if (total <= 0) return 0;
    return Math.round((hits / total) * 1000) / 10;
  }

  recordMatchQueuedForPipeline(matchId: string): void {
    const id = String(matchId ?? "").trim();
    if (!id) return;
    if (!this.matchQueuedAtMs.has(id)) {
      this.matchQueuedAtMs.set(id, nowMs());
    }
    if (this.matchQueuedAtMs.size > 20_000) {
      const oldest = this.matchQueuedAtMs.keys().next().value;
      if (oldest) this.matchQueuedAtMs.delete(oldest);
    }
  }

  recordMatchIngestedForPipeline(matchId: string): void {
    const id = String(matchId ?? "").trim();
    if (!id) return;
    const queuedAt = this.matchQueuedAtMs.get(id);
    const atMs = nowMs();
    this.ingestionEvents.push({ atMs });
    if (queuedAt != null) {
      this.pipelineCompleteEvents.push({
        atMs,
        durationSeconds: Math.max(0, (atMs - queuedAt) / 1000),
      });
      this.matchQueuedAtMs.delete(id);
      this.rankGateSeenMatchIds.delete(id);
    }
    this.pruneRollingWindows(atMs);
  }

  recordHydrationRankGate(matchId: string, passed: boolean): void {
    const id = String(matchId ?? "").trim();
    if (!id) return;
    const isRetry = this.rankGateSeenMatchIds.has(id);
    if (!passed) {
      this.totals.hydrationRankRetries += 1;
      this.rankGateSeenMatchIds.add(id);
      if (!isRetry) {
        this.totals.rankGateFailedFirstTry += 1;
      }
      return;
    }
    if (!isRetry) {
      this.totals.rankGatePassedFirstTry += 1;
    }
    this.rankGateSeenMatchIds.delete(id);
  }

  recordHydrationRankBacklogDefer(): void {
    this.totals.hydrationRankRetries += 1;
  }

  recordDiscoveryMatches(matchIdsFetched: number, matchesQueuedHydration: number): void {
    this.totals.matchIdsFetched += Math.max(0, matchIdsFetched);
    this.totals.matchesQueuedHydration += Math.max(0, matchesQueuedHydration);
  }

  recordHydrationStart(): void {
    this.totals.hydrationJobsStarted += 1;
  }

  recordHydrationCacheHit(): void {
    this.totals.hydrationCacheHits += 1;
  }

  recordHydrationCacheMiss(): void {
    this.totals.hydrationCacheMisses += 1;
  }

  recordHydrationSuccess(matchesIngested = 1): void {
    this.totals.hydrationJobsSucceeded += 1;
    this.totals.matchesIngested += Math.max(0, matchesIngested);
  }

  recordHydrationSkippedOldPatch(): void {
    this.totals.hydrationJobsSkippedOldPatch += 1;
  }

  recordHydrationNotFound(): void {
    this.totals.hydrationJobsNotFound += 1;
  }

  recordHydrationFailure(error: unknown): void {
    this.totals.hydrationJobsFailed += 1;
    this.addError("hydration", error instanceof Error ? error.message : String(error));
  }

  recordIngestionStart(): void {
    this.totals.ingestionJobsStarted += 1;
  }

  recordIngestionSuccess(participants: number): void {
    this.totals.ingestionJobsSucceeded += 1;
    this.totals.participantsIngested += Math.max(0, participants);
  }

  recordIngestionDuplicate(): void {
    this.totals.ingestionJobsDuplicate += 1;
  }

  recordIngestionFailure(error: unknown): void {
    this.totals.ingestionJobsFailed += 1;
    this.addError("ingestion", error instanceof Error ? error.message : String(error));
  }

  recordRankJobStart(): void {
    this.totals.rankJobsStarted += 1;
  }

  recordRankJobSuccess(): void {
    this.totals.rankJobsSucceeded += 1;
  }

  recordRankJobFailure(error: unknown): void {
    this.totals.rankJobsFailed += 1;
    this.addError("rank", error instanceof Error ? error.message : String(error));
  }

  recordRankLeagueFetchSucceeded(): void {
    this.totals.rankLeagueFetchesSucceeded += 1;
  }

  recordRankLeagueFetchFailed(): void {
    this.totals.rankLeagueFetchesFailed += 1;
  }

  private logRankQueueAlerts(rank: QueueSlice, rankBacklog: number): void {
    const backlogThreshold = maxRankBacklogBeforePipelinePause();
    if (rank.waiting > backlogThreshold) {
      console.warn(
        JSON.stringify({
          msg: "rank_queue_backlog_high",
          rankLeagueFetchesPending: rank.waiting,
          threshold: backlogThreshold,
        }),
      );
    }
    const expectedConcurrency = rankWorkerConcurrency(rankBacklog);
    if (this.lastRankWorkerConfiguredConcurrency !== expectedConcurrency) {
      console.warn(
        JSON.stringify({
          msg: "rank_worker_concurrency_mismatch",
          rankWorkerConcurrency: this.lastRankWorkerConfiguredConcurrency,
          expectedConcurrency,
          rankBacklog,
        }),
      );
    }
  }

  recordRateLimitAttempt(
    cost: number,
    granted: boolean,
    waitMs: number,
    pipeline: SlotPipeline | null = null,
  ): void {
    const safeCost = Math.max(0, Math.trunc(cost));
    const safeWait = Math.max(0, Math.trunc(waitMs));
    if (granted) {
      this.totals.rateLimitGrantedCount += 1;
      this.totals.rateLimitGrantedCost += safeCost;
    } else {
      this.totals.rateLimitDeniedCount += 1;
      this.totals.rateLimitDeniedCost += safeCost;
    }
    this.totals.rateLimitWaitMsTotal += safeWait;
    this.tokenEvents.push({
      atMs: nowMs(),
      granted,
      cost: safeCost,
      waitMs: safeWait,
      pipeline,
    });
    this.pruneRollingWindows();
  }

  recordApiCall(status: number, durationMs: number): void {
    this.totals.apiRequests += 1;
    if (status >= 200 && status < 300) this.totals.api2xx += 1;
    else if (status === 429) this.totals.api429 += 1;
    else if (status >= 400 && status < 500) this.totals.api4xx += 1;
    else if (status >= 500) this.totals.api5xx += 1;
    this.apiEvents.push({ atMs: nowMs(), status, durationMs });
    this.addDuration("riotHttpMs", durationMs);
    this.pruneRollingWindows();
  }

  recordApiRetry(): void {
    this.totals.apiRetries += 1;
  }

  recordApiError(status: number, url: string): void {
    this.addError("riot-api", `status=${status} url=${url}`);
  }

  recordDuration(key: DurationKey, durationMs: number): void {
    this.addDuration(key, Math.max(0, Math.trunc(durationMs)));
  }

  recordQueueSnapshot(payload: {
    discovery: QueueSlice;
    hydration: QueueSlice;
    ingestion: QueueSlice;
    rank: QueueSlice;
    dataLagSeconds: number | null;
    tickDurationMs: number | null;
    rankWorkerConfiguredConcurrency: number;
    rankBacklog: number;
  }): void {
    this.lastQueue = {
      discovery: payload.discovery,
      hydration: payload.hydration,
      ingestion: payload.ingestion,
      rank: payload.rank,
      dataLagSeconds: payload.dataLagSeconds,
      tickDurationMs: payload.tickDurationMs,
    };
    this.lastRankWorkerConfiguredConcurrency = payload.rankWorkerConfiguredConcurrency;
    this.logRankQueueAlerts(payload.rank, payload.rankBacklog);
    if (payload.tickDurationMs != null) {
      this.addDuration("dbMetricsTickMs", payload.tickDurationMs);
    }
    this.recordRateSnapshot(this.rolling2m().tokenUsagePct);
  }

  private rankQueueMetrics(): { rankLeagueFetchesPending: number; rankWorkerConcurrency: number } {
    return {
      rankLeagueFetchesPending: this.lastQueue.rank.waiting,
      rankWorkerConcurrency: this.lastRankWorkerConfiguredConcurrency,
    };
  }

  async buildWindowSummary(window: "30m" | "1h", dbWindow: Record<string, unknown>): Promise<Record<string, unknown>> {
    const nowIso = new Date().toISOString();
    const baseline = window === "30m" ? this.baseline30m : this.baseline1h;
    const delta = deltaTotals(this.totals, baseline);
    const rolling = this.rolling2m();
    const tokenBudget120 = tokenBudget120ForEnv();
    const windowMinutes = window === "30m" ? 30 : 60;
    const intervals2m = windowMinutes / 2;
    const avgGrantedCostPer2m =
      intervals2m > 0 ? delta.rateLimitGrantedCost / intervals2m : 0;
    const avgTokenUsagePctFromWindowDelta =
      tokenBudget120 > 0
        ? Math.round((avgGrantedCostPer2m / tokenBudget120) * 1000) / 10
        : 0;
    const tokenRate10m = this.tokenRate10m();
    this.logTokenRateAlerts(tokenRate10m);
    const rankQueue = this.rankQueueMetrics();
    const diagnostics = await this.buildDiagnosticsAsync();
    const matchesAggregatedWindow = await countAggregatedMatchesSince(Date.now() - windowMinutes * 60_000);
    const payload: Record<string, unknown> = {
      window,
      atIso: nowIso,
      delta,
      dbWindow,
      rolling2m: rolling,
      tokenBudget120,
      /** Moyenne du coût accordé par tranche de 2 min sur la fenêtre (delta / nombre de tranches) / plafond — comparable au % « instantané » rolling2m. */
      avgTokenUsagePctFromWindowDelta,
      tokenRate10m,
      queue: this.lastQueue,
      queues: {
        discovery: this.lastQueue.discovery,
        hydration: this.lastQueue.hydration,
        ingestion: this.lastQueue.ingestion,
        rank: this.lastQueue.rank,
      },
      rankLeagueFetchesPending: rankQueue.rankLeagueFetchesPending,
      rankWorkerConcurrency: rankQueue.rankWorkerConcurrency,
      matchesAggregatedWindow,
      ...diagnostics,
    };
    if (window === "30m") {
      payload.rankFetchesQueued = delta.rankJobsStarted;
      payload.rankFetchesSucceeded = delta.rankJobsSucceeded;
      payload.rankFetchesFailed = delta.rankJobsFailed;
      this.baseline30m = cloneTotals(this.totals);
      this.last30mSummary = payload;
    } else {
      this.baseline1h = cloneTotals(this.totals);
      this.last1hSummary = payload;
    }
    return payload;
  }

  async snapshot(): Promise<Snapshot> {
    const now = nowMs();
    const durations = Object.fromEntries(
      (Object.keys(this.durations) as DurationKey[]).map((key) => {
        const d = this.durations[key];
        const avgMs = d.count > 0 ? Math.round((d.totalMs / d.count) * 10) / 10 : 0;
        return [key, { ...d, avgMs }];
      }),
    ) as Snapshot["durations"];
    const rankQueue = this.rankQueueMetrics();
    const diagnostics = await this.buildDiagnosticsAsync(now);
    const bucket = getRiotTokenBucketSnapshot();
    const queue = { ...this.lastQueue };
    return {
      atIso: new Date(now).toISOString(),
      startedAtIso: new Date(this.startedAtMs).toISOString(),
      runtimeSeconds: Math.max(0, Math.floor((now - this.startedAtMs) / 1000)),
      totals: cloneTotals(this.totals),
      rolling2m: this.rolling2m(now),
      tokenRate10m: this.tokenRate10m(),
      durations,
      queue,
      rankLeagueFetchesPending: rankQueue.rankLeagueFetchesPending,
      rankWorkerConcurrency: rankQueue.rankWorkerConcurrency,
      ...diagnostics,
      rank_dedup_hits: this.totals.rankDedupHits,
      rank_prefetch_hits: this.totals.rankPrefetchHits,
      rank_cache_l1_hits: this.totals.rankCacheL1Hits,
      rank_cache_redis_hits: this.totals.rankCacheRedisHits,
      hydration_cache_hit_rate_pct: this.hydrationCacheHitRatePct(),
      rank_cache_hit_rate_pct: this.rankCacheHitRatePct(),
      bucket_1s_remaining: bucket.bucket_1s_remaining,
      bucket_120s_remaining: bucket.bucket_120s_remaining,
      adaptive_budget: this.adaptiveBudgetStateProvider?.() ?? null,
      queues: {
        discovery: queue.discovery,
        hydration: queue.hydration,
        ingestion: queue.ingestion,
        rank: queue.rank,
      },
      recentErrors: [...this.recentErrors].slice(-20).reverse(),
      summaries: {
        last30m: this.last30mSummary,
        last1h: this.last1hSummary,
      },
    };
  }

  async flushSnapshotToDisk(): Promise<void> {
    const snapshot = await this.snapshot();
    this.logIngestionAlerts(
      {
        matchesLastHour: snapshot.matchesLastHour,
        matchesLast10Min: snapshot.matchesLast10Min,
        projectedMatchesPerHour: snapshot.projectedMatchesPerHour,
        apiEfficiencyPct: snapshot.apiEfficiencyPct,
      },
      snapshot.runtimeSeconds,
    );
    await fs.mkdir(join(process.cwd(), "..", "logs"), { recursive: true });
    await fs.writeFile(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
  }
}

export const pollerV2Observability = new PollerV2Observability();

