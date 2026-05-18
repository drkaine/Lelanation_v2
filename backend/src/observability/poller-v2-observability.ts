import { promises as fs } from "fs";
import { join } from "path";

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
  /** Dernier snapshot queue rank — `rank.active` (doit rester ≤ 2). */
  rankWorkerConcurrency: number;
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
  private readonly recentErrors: ErrorEvent[] = [];
  private readonly durations: Record<DurationKey, DurationStat> = {
    discoveryCycleMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 3_000 },
    hydrationJobMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 6_000 },
    ingestionJobMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 8_000 },
    riotHttpMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 2_000 },
    dbMetricsTickMs: { count: 0, totalMs: 0, maxMs: 0, slowCount: 0, slowThresholdMs: 400 },
  };

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
    while (this.tokenEvents.length > 0 && this.tokenEvents[0] && this.tokenEvents[0].atMs < keepFrom) {
      this.tokenEvents.shift();
    }
    while (this.apiEvents.length > 0 && this.apiEvents[0] && this.apiEvents[0].atMs < keepFrom) {
      this.apiEvents.shift();
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

  recordDiscoveryMatches(matchIdsFetched: number, matchesQueuedHydration: number): void {
    this.totals.matchIdsFetched += Math.max(0, matchIdsFetched);
    this.totals.matchesQueuedHydration += Math.max(0, matchesQueuedHydration);
  }

  recordHydrationStart(): void {
    this.totals.hydrationJobsStarted += 1;
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

  private logRankQueueAlerts(rank: QueueSlice): void {
    if (rank.waiting > 5000) {
      console.warn(
        JSON.stringify({
          msg: "rank_queue_backlog_high",
          rankLeagueFetchesPending: rank.waiting,
          threshold: 5000,
        }),
      );
    }
    if (rank.active > 2) {
      console.error(
        JSON.stringify({
          msg: "rank_worker_concurrency_bug",
          rankWorkerConcurrency: rank.active,
          expectedMax: 2,
        }),
      );
    }
  }

  recordRateLimitAttempt(cost: number, granted: boolean, waitMs: number): void {
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
  }): void {
    this.lastQueue = { ...payload };
    this.logRankQueueAlerts(payload.rank);
    if (payload.tickDurationMs != null) {
      this.addDuration("dbMetricsTickMs", payload.tickDurationMs);
    }
    this.recordRateSnapshot(this.rolling2m().tokenUsagePct);
  }

  private rankQueueMetrics(): { rankLeagueFetchesPending: number; rankWorkerConcurrency: number } {
    return {
      rankLeagueFetchesPending: this.lastQueue.rank.waiting,
      rankWorkerConcurrency: this.lastQueue.rank.active,
    };
  }

  buildWindowSummary(window: "30m" | "1h", dbWindow: Record<string, unknown>): Record<string, unknown> {
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
      rankLeagueFetchesPending: rankQueue.rankLeagueFetchesPending,
      rankWorkerConcurrency: rankQueue.rankWorkerConcurrency,
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

  snapshot(): Snapshot {
    const now = nowMs();
    const durations = Object.fromEntries(
      (Object.keys(this.durations) as DurationKey[]).map((key) => {
        const d = this.durations[key];
        const avgMs = d.count > 0 ? Math.round((d.totalMs / d.count) * 10) / 10 : 0;
        return [key, { ...d, avgMs }];
      }),
    ) as Snapshot["durations"];
    const rankQueue = this.rankQueueMetrics();
    return {
      atIso: new Date(now).toISOString(),
      startedAtIso: new Date(this.startedAtMs).toISOString(),
      runtimeSeconds: Math.max(0, Math.floor((now - this.startedAtMs) / 1000)),
      totals: cloneTotals(this.totals),
      rolling2m: this.rolling2m(now),
      tokenRate10m: this.tokenRate10m(),
      durations,
      queue: { ...this.lastQueue },
      rankLeagueFetchesPending: rankQueue.rankLeagueFetchesPending,
      rankWorkerConcurrency: rankQueue.rankWorkerConcurrency,
      recentErrors: [...this.recentErrors].slice(-20).reverse(),
      summaries: {
        last30m: this.last30mSummary,
        last1h: this.last1hSummary,
      },
    };
  }

  async flushSnapshotToDisk(): Promise<void> {
    const snapshot = this.snapshot();
    await fs.mkdir(join(process.cwd(), "..", "logs"), { recursive: true });
    await fs.writeFile(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
  }
}

export const pollerV2Observability = new PollerV2Observability();

