```
You are a senior backend engineer. The gateway, poller engine, poll orchestration,
and tuner are already implemented. Build a comprehensive observability system
that covers every failure mode identified: 429 spikes, ingestion lag, rank gaps,
token under-utilization, DB slowness, and queue buildup.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 0. INVARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0.1 Zero overhead on the hot path. All metric recording is synchronous
    in-process (no async, no DB call, no network) — just push to a ring buffer.

0.2 All aggregation is LAZY — computed on demand when a snapshot is requested,
    not pre-computed on every event.

0.3 Aggregates are computed over REAL timestamps (event.ts), not artificial buckets.
    Window = events where event.ts >= Date.now() - windowMs.

0.4 The system must survive a process restart. Aggregate snapshots are persisted
    to a JSON file every SNAPSHOT_PERSIST_INTERVAL_MS.
    On startup, the last snapshot is loaded and logged.

0.5 Every alert fires ONCE when the threshold is crossed, then is suppressed
    until the condition clears. No alert spam.

0.6 No external monitoring dependencies (no Prometheus, no Datadog).
    Output is structured pino logs + a local JSON file.
    A future agent can scrape the JSON file if needed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. FILES TO CREATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

backend/src/observability/
├── MetricsStore.ts           # central ring buffer store — all raw events land here
├── CircularBuffer.ts         # generic fixed-size ring buffer with timestamp queries
├── AggregateComputer.ts      # computes stats for any time window from the store
├── LiveTokenDisplay.ts       # reads gateway buckets, logs token state every 5s
├── AggregateReporter.ts      # emits aggregate snapshots at every time window
├── AlertDetector.ts          # watches for anomalies, fires structured WARN/ERROR logs
├── SnapshotPersistence.ts    # load/save JSON snapshot file
├── ObservabilityOrchestrator.ts  # wires everything, single start() / stop()
└── types.ts                  # all metric event types + aggregate types

MODIFY:
  backend/src/main.ts                          # start ObservabilityOrchestrator
  backend/src/workers/ingestion.worker.ts      # emit timing + status events
  backend/src/poll-orchestration/PollerDbConsumer.ts  # emit ingestion outcome events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. TYPES (observability/types.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// ─── Raw metric events (what lands in ring buffers) ───────────────────────

export interface GatewayRequestEvent {
  ts: number;
  latencyMs: number;
  methodKey: string;
  statusCode: number;
  is429: boolean;
  isError: boolean;
  tokensUsed_120s: number;   // x-app-rate-limit-count for 120s window at time of response
  tokensUsed_1s: number;     // x-app-rate-limit-count for 1s window
  limit_120s: number;        // x-app-rate-limit for 120s window
  limit_1s: number;
}

export interface TokenSnapshotEvent {
  ts: number;
  used_120s: number;
  limit_120s: number;
  used_1s: number;
  limit_1s: number;
  pct_120s: number;         // used/limit * 100
  pct_1s: number;
  in_flight: number;
  queue_depth: number;
}

export interface RateLimitSaturationEvent {
  ts: number;
  windowMs: number;         // which window was saturated (1000 or 120000)
  methodKey: string;        // 'app' or specific method
  waitMs: number;           // how long the gateway had to wait
}

export interface PollSessionEvent {
  ts: number;
  sessionId: string;
  durationMs: number;
  playersPolled: number;
  playersCompleted: number;
  playersFailed: number;
}

export interface PlayerEvent {
  ts: number;
  type: 'polled' | 'new_added';   // new_added = upserted into players table
  puuid: string;
  platform: string;
}

export interface RankEvent {
  ts: number;
  type: 'fetched' | 'skipped_db' | 'skipped_cache' | 'failed';
  puuid: string;
  platform: string;
  tier?: string;
}

export interface MatchDiscoveryEvent {
  ts: number;
  puuid: string;
  matchId: string;
  type: 'new' | 'skipped_memory' | 'skipped_db';
  // 'new'          = fetched from Riot API
  // 'skipped_memory' = deduped by processedMatchIds Set
  // 'skipped_db'   = filtered by MatchFilter (already in processed_matches)
}

export interface MatchFetchEvent {
  ts: number;
  matchId: string;
  patch: string;
  success: boolean;
  latencyMs: number;           // time for getMatch + getTimeline combined
  errorType?: 'match_fetch' | 'timeline_fetch' | 'both';
}

export type IngestionSkipReason =
  | 'missing_rank'            // no rank in rankCache and rankFilter returned nothing
  | 'missing_participants'    // participant data incomplete in match DTO
  | 'missing_timeline'        // timeline fetch failed
  | 'conflict_already_done'   // ON CONFLICT — was already in processed_matches as done
  | 'queue_add_failed';       // BullMQ add threw

export interface IngestionQueueEvent {
  ts: number;
  matchId: string;
  patch: string;
  rank: string;
  type: 'queued' | 'skipped';
  skipReason?: IngestionSkipReason;
}

export interface IngestionWorkerEvent {
  ts: number;
  matchId: string;
  patch: string;
  rank: string;
  type: 'started' | 'completed' | 'failed';
  durationMs?: number;         // set on completed/failed
  errorMessage?: string;       // set on failed
  // Table write breakdown (on completed)
  tablesWritten?: {
    champion_stats: number;
    champion_vs_stats: number;
    champion_item_stats: number;
    champion_runes_stats: number;
    champion_spells_stats: number;
    processed_matches_update: number;   // status → 'done'
    [key: string]: number;
  };
}

export interface DbOperationEvent {
  ts: number;
  operation: string;           // e.g. 'insert_rank_history', 'update_last_seen', 'match_filter_query'
  durationMs: number;
  rowsAffected?: number;
  success: boolean;
  errorMessage?: string;
}

export interface QueueDepthEvent {
  ts: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;               // waiting + active
}

// ─── Aggregate output (computed from ring buffers) ────────────────────────

export type WindowLabel = '10m' | '30m' | '1h' | '6h' | '12h' | '24h';

export const WINDOW_MS: Record<WindowLabel, number> = {
  '10m':  10 * 60 * 1000,
  '30m':  30 * 60 * 1000,
  '1h':    1 * 60 * 60 * 1000,
  '6h':    6 * 60 * 60 * 1000,
  '12h':  12 * 60 * 60 * 1000,
  '24h':  24 * 60 * 60 * 1000,
};

export interface GatewayAggregate {
  window: WindowLabel;
  // Token utilization
  avg_req_per_120s: number;      // average requests in any 120s window
  peak_req_per_120s: number;     // max observed in any 120s window
  total_requests: number;
  // Rate limiting
  times_limit_reached: number;   // RateLimitSaturationEvents count
  total_429s: number;
  total_wait_ms_from_429: number;
  // Latency
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  // Token utilization over time
  avg_token_pct_120s: number;    // average % of 120s window used
  avg_token_pct_1s: number;
}

export interface PollAggregate {
  window: WindowLabel;
  // Players
  players_polled: number;
  players_new_added: number;
  // Ranks
  ranks_fetched: number;
  ranks_skipped_db: number;      // rankFilter: already in DB today
  ranks_skipped_cache: number;   // ParticipantRankCache hit
  ranks_failed: number;
  rank_skip_rate_pct: number;    // (skipped_db + skipped_cache) / total * 100
  // Matches discovery
  match_ids_discovered: number;  // all paginated matchIds
  match_ids_skipped_memory: number;
  match_ids_skipped_db: number;
  match_ids_new: number;         // actually fetched from Riot API
  match_skip_rate_pct: number;   // skipped / discovered * 100
  // Matches fetch
  matches_fetched_success: number;
  matches_fetched_failed: number;
  match_fetch_latency_p50_ms: number;
  match_fetch_latency_p95_ms: number;
}

export interface IngestionAggregate {
  window: WindowLabel;
  // Queue
  matches_queued: number;
  matches_skipped_total: number;
  skip_breakdown: Record<IngestionSkipReason, number>;
  queue_skip_rate_pct: number;
  // Worker
  matches_ingested: number;
  matches_failed: number;
  ingestion_success_rate_pct: number;
  ingestion_latency_p50_ms: number;
  ingestion_latency_p95_ms: number;
  ingestion_latency_p99_ms: number;
  // DB operations
  db_op_latency_p50_ms: number;
  db_op_latency_p95_ms: number;
  slowest_db_ops: Array<{ operation: string; p95_ms: number }>;
  // Queue depth (latest snapshot in window)
  queue_depth_avg: number;
  queue_depth_peak: number;
}

export interface FullSnapshot {
  ts: number;
  uptime_ms: number;
  window: WindowLabel;
  gateway: GatewayAggregate;
  poll: PollAggregate;
  ingestion: IngestionAggregate;
  // Derived ratios
  ratios: {
    matches_ingested_vs_fetched_pct: number;    // ingested / fetched * 100 — should be ~100%
    matches_skipped_vs_discovered_pct: number;  // how "up to date" we are
    ranks_coverage_pct: number;                 // fetched / (fetched+skipped_db) * 100
    token_efficiency_pct: number;               // avg_req_per_120s / limit_120s * 100
  };
  // Active alerts
  active_alerts: Alert[];
}

// ─── Alerts ───────────────────────────────────────────────────────────────

export type AlertSeverity = 'warn' | 'error' | 'fatal';
export type AlertType =
  | 'too_many_429s'
  | 'ingestion_lag'            // queue depth growing and not shrinking
  | 'rank_gap'                 // rank fetch failure rate too high
  | 'token_underutilized'      // using < N% of available tokens
  | 'token_near_limit'         // using > N% (approaching 429 territory)
  | 'ingestion_failure_rate'   // too many failed ingestion jobs
  | 'db_slow'                  // DB operations p95 > threshold
  | 'match_skip_rate_high'     // all matches being skipped (possible stall)
  | 'poll_stall'               // no poll session completed in X minutes
  | 'no_new_players'           // player pool exhausted
  | 'ema_not_converging';      // reqPerPlayer EMA still wildly off after warmup

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  since: number;               // epoch ms when alert first fired
  data: Record<string, unknown>;
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. CircularBuffer.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Generic fixed-size ring buffer. Oldest events are evicted automatically.
// All methods are O(1) for push, O(n) for windowed queries.

export class CircularBuffer<T extends { ts: number }> {
  private buf: Array<T | undefined>;
  private head = 0;   // next write position
  private _size = 0;

  constructor(private capacity: number) {
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) this._size++;
  }

  // Return all events where ts >= Date.now() - windowMs, newest first.
  // Does NOT allocate a new array if windowMs covers all events (optimized path).
  inWindow(windowMs: number): T[] {
    const cutoff = Date.now() - windowMs;
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const item = this.buf[idx]!;
      if (item.ts < cutoff) break;
      result.push(item);
    }
    return result;
  }

  // Most recent item (or null if empty)
  latest(): T | null {
    if (this._size === 0) return null;
    return this.buf[(this.head - 1 + this.capacity) % this.capacity] ?? null;
  }

  get size(): number { return this._size; }
  get isFull(): boolean { return this._size === this.capacity; }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. MetricsStore.ts — CENTRAL EVENT STORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Singleton. All events from all components land here.
// Ring buffer sizes are set to hold 24h of data at expected event rates.

export class MetricsStore {
  private static instance: MetricsStore;
  static getInstance(): MetricsStore {}

  // ── Gateway ──────────────────────────────────────────────────────────
  // ~300 req/s max prod → 24h = 25M events — too much. Keep last 10k events (≈5min at prod).
  // For long-window aggregates, use TokenSnapshotEvent (sampled every 5s).
  readonly gateway   = new CircularBuffer<GatewayRequestEvent>(10_000);
  readonly tokenSnap = new CircularBuffer<TokenSnapshotEvent>(8_640);   // 24h at 1/10s

  // ── Rate limits ───────────────────────────────────────────────────────
  readonly saturation = new CircularBuffer<RateLimitSaturationEvent>(500);

  // ── Poll ──────────────────────────────────────────────────────────────
  readonly pollSession      = new CircularBuffer<PollSessionEvent>(500);
  readonly playerEvents     = new CircularBuffer<PlayerEvent>(50_000);
  readonly rankEvents       = new CircularBuffer<RankEvent>(100_000);
  readonly matchDiscovery   = new CircularBuffer<MatchDiscoveryEvent>(100_000);
  readonly matchFetch       = new CircularBuffer<MatchFetchEvent>(50_000);

  // ── Ingestion ─────────────────────────────────────────────────────────
  readonly ingestionQueue   = new CircularBuffer<IngestionQueueEvent>(50_000);
  readonly ingestionWorker  = new CircularBuffer<IngestionWorkerEvent>(50_000);
  readonly dbOperations     = new CircularBuffer<DbOperationEvent>(50_000);
  readonly queueDepth       = new CircularBuffer<QueueDepthEvent>(8_640);   // 24h at 1/10s

  // ── All push methods (called from components) ─────────────────────────
  pushGatewayRequest(e: GatewayRequestEvent): void { this.gateway.push(e); }
  pushTokenSnapshot(e: TokenSnapshotEvent): void { this.tokenSnap.push(e); }
  pushSaturation(e: RateLimitSaturationEvent): void { this.saturation.push(e); }
  pushPollSession(e: PollSessionEvent): void { this.pollSession.push(e); }
  pushPlayer(e: PlayerEvent): void { this.playerEvents.push(e); }
  pushRank(e: RankEvent): void { this.rankEvents.push(e); }
  pushMatchDiscovery(e: MatchDiscoveryEvent): void { this.matchDiscovery.push(e); }
  pushMatchFetch(e: MatchFetchEvent): void { this.matchFetch.push(e); }
  pushIngestionQueue(e: IngestionQueueEvent): void { this.ingestionQueue.push(e); }
  pushIngestionWorker(e: IngestionWorkerEvent): void { this.ingestionWorker.push(e); }
  pushDbOperation(e: DbOperationEvent): void { this.dbOperations.push(e); }
  pushQueueDepth(e: QueueDepthEvent): void { this.queueDepth.push(e); }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. AggregateComputer.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Pure computation — no side effects. Takes store, returns aggregates.
// All methods take a windowMs parameter.

export class AggregateComputer {
  constructor(private store: MetricsStore) {}

  computeGateway(windowMs: number, limit_120s: number): GatewayAggregate {}
  computePoll(windowMs: number): PollAggregate {}
  computeIngestion(windowMs: number): IngestionAggregate {}

  computeFull(window: WindowLabel, limit_120s: number, limit_1s: number): FullSnapshot {}
}
```

### computeGateway() — exact algorithm

```
events = store.gateway.inWindow(windowMs)
tokenSnaps = store.tokenSnap.inWindow(windowMs)
saturations = store.saturation.inWindow(windowMs)

total_requests = events.length
total_429s = events.filter(e => e.is429).length
times_limit_reached = saturations.length
total_wait_ms_from_429 = saturations.reduce((sum, e) => sum + e.waitMs, 0)

// avg_req_per_120s:
// Slide a 120s window through the events and count events per window.
// Use the sliding window max technique: for each event[i], count events
// with ts in [event[i].ts - 120_000, event[i].ts].
// Take the average of all window sizes found.
// IMPORTANT: do NOT compute this naively (O(n²)) — use a two-pointer approach.

// latency percentiles:
latencies = events.map(e => e.latencyMs).sort((a, b) => a - b)
p50 = latencies[Math.floor(latencies.length * 0.50)]
p95 = latencies[Math.floor(latencies.length * 0.95)]
p99 = latencies[Math.floor(latencies.length * 0.99)]

// token utilization:
avg_token_pct_120s = mean(tokenSnaps.map(s => s.pct_120s))
avg_token_pct_1s   = mean(tokenSnaps.map(s => s.pct_1s))
```

### computePoll() — exact algorithm

```
players      = store.playerEvents.inWindow(windowMs)
ranks        = store.rankEvents.inWindow(windowMs)
discoveries  = store.matchDiscovery.inWindow(windowMs)
fetches      = store.matchFetch.inWindow(windowMs)
sessions     = store.pollSession.inWindow(windowMs)

players_polled    = players.filter(e => e.type === 'polled').length
players_new_added = players.filter(e => e.type === 'new_added').length

ranks_fetched        = ranks.filter(e => e.type === 'fetched').length
ranks_skipped_db     = ranks.filter(e => e.type === 'skipped_db').length
ranks_skipped_cache  = ranks.filter(e => e.type === 'skipped_cache').length
ranks_failed         = ranks.filter(e => e.type === 'failed').length
rank_skip_rate_pct   = (ranks_skipped_db + ranks_skipped_cache) / max(1, ranks.length) * 100

match_ids_discovered      = discoveries.length
match_ids_skipped_memory  = discoveries.filter(e => e.type === 'skipped_memory').length
match_ids_skipped_db      = discoveries.filter(e => e.type === 'skipped_db').length
match_ids_new             = discoveries.filter(e => e.type === 'new').length
match_skip_rate_pct       = (skipped_memory + skipped_db) / max(1, discovered) * 100

matches_fetched_success = fetches.filter(e => e.success).length
matches_fetched_failed  = fetches.filter(e => !e.success).length
fetch_latencies = fetches.filter(e => e.success).map(e => e.latencyMs).sort(...)
// p50, p95 from sorted latencies
```

### computeIngestion() — exact algorithm

```
queued   = store.ingestionQueue.inWindow(windowMs)
workers  = store.ingestionWorker.inWindow(windowMs)
dbOps    = store.dbOperations.inWindow(windowMs)
depths   = store.queueDepth.inWindow(windowMs)

matches_queued  = queued.filter(e => e.type === 'queued').length
matches_skipped = queued.filter(e => e.type === 'skipped').length

// Skip breakdown by reason:
skip_breakdown = groupBy(
  queued.filter(e => e.type === 'skipped'),
  e => e.skipReason
).mapValues(arr => arr.length)

completed_workers = workers.filter(e => e.type === 'completed')
failed_workers    = workers.filter(e => e.type === 'failed')
matches_ingested  = completed_workers.length
matches_failed    = failed_workers.length
ingestion_success_rate_pct = ingested / max(1, ingested + failed) * 100

ingestion_latencies = completed_workers.map(e => e.durationMs).sort(...)
// p50, p95, p99

// DB ops by operation type:
slowest_db_ops = groupBy(dbOps, e => e.operation)
  .map(([op, events]) => ({
    operation: op,
    p95_ms: percentile(events.map(e => e.durationMs), 0.95)
  }))
  .sort((a, b) => b.p95_ms - a.p95_ms)
  .slice(0, 5)  // top 5 slowest

queue_depth_avg  = mean(depths.map(e => e.total))
queue_depth_peak = max(depths.map(e => e.total))
```

### computeFull() — ratios

```
ratios.matches_ingested_vs_fetched_pct =
  poll.matches_fetched_success > 0
    ? ingestion.matches_ingested / poll.matches_fetched_success * 100
    : 100

ratios.matches_skipped_vs_discovered_pct = poll.match_skip_rate_pct

ratios.ranks_coverage_pct =
  (poll.ranks_fetched + poll.ranks_skipped_db) > 0
    ? poll.ranks_fetched / (poll.ranks_fetched + poll.ranks_skipped_db) * 100
    : 0

ratios.token_efficiency_pct = gateway.avg_token_pct_120s
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. LiveTokenDisplay.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Reads gateway bucket state directly. Logs every 5s.
// Also pushes TokenSnapshotEvent to MetricsStore.

export class LiveTokenDisplay {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private gateway: RiotGateway,
    private queue: Queue,
    private store: MetricsStore,
    private intervalMs = 5_000
  ) {}

  start(): void {
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const status = this.gateway.getStatus();
    const { waiting, active } = await this.queue.getJobCounts('waiting', 'active');

    const app120 = status.buckets.find(b => b.bucketId.includes('app:120000'));
    const app1s  = status.buckets.find(b => b.bucketId.includes('app:1000'));

    const used_120s = app120?.used ?? 0;
    const limit_120s = app120?.limit ?? 0;
    const used_1s = app1s?.used ?? 0;
    const limit_1s = app1s?.limit ?? 0;
    const pct_120s = limit_120s > 0 ? (used_120s / limit_120s * 100) : 0;
    const pct_1s   = limit_1s   > 0 ? (used_1s   / limit_1s   * 100) : 0;

    const snapshot: TokenSnapshotEvent = {
      ts: Date.now(),
      used_120s, limit_120s, used_1s, limit_1s, pct_120s, pct_1s,
      in_flight: status.inFlight.global,
      queue_depth: waiting + active,
    };

    this.store.pushTokenSnapshot(snapshot);

    // Visual token bar (40 chars wide)
    const bar = (pct: number) => {
      const filled = Math.round(pct / 100 * 40);
      return '[' + '█'.repeat(filled) + '░'.repeat(40 - filled) + ']';
    };

    log.info({
      component: 'live-tokens',
      tokens_120s: `${used_120s}/${limit_120s} ${bar(pct_120s)} ${pct_120s.toFixed(1)}%`,
      tokens_1s:   `${used_1s}/${limit_1s} ${bar(pct_1s)} ${pct_1s.toFixed(1)}%`,
      in_flight: status.inFlight.global,
      queue_depth: waiting + active,
      rps_current: status.metrics.rps.current.toFixed(2),
      rps_avg_60s: status.metrics.rps.avg60s.toFixed(2),
      latency_p50: status.metrics.latency.p50,
      latency_p95: status.metrics.latency.p95,
    });
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. AggregateReporter.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Emits aggregate snapshots at configured intervals.
// Each window has its own independent timer.

const REPORT_INTERVALS: Record<WindowLabel, number> = {
  '10m':  10 * 60 * 1000,
  '30m':  30 * 60 * 1000,
  '1h':    1 * 60 * 60 * 1000,
  '6h':    6 * 60 * 60 * 1000,
  '12h':  12 * 60 * 60 * 1000,
  '24h':  24 * 60 * 60 * 1000,
};

export class AggregateReporter {
  private timers: Map<WindowLabel, NodeJS.Timeout> = new Map();

  constructor(
    private computer: AggregateComputer,
    private persistence: SnapshotPersistence,
    private gateway: RiotGateway
  ) {}

  start(): void {
    for (const [label, intervalMs] of Object.entries(REPORT_INTERVALS)) {
      const timer = setInterval(
        () => this.report(label as WindowLabel),
        intervalMs
      );
      this.timers.set(label as WindowLabel, timer);
    }
  }

  stop(): void { this.timers.forEach(t => clearInterval(t)); }

  private report(window: WindowLabel): void {
    const status = this.gateway.getStatus();
    const limit_120s = this.getLimit(status, 120_000);
    const limit_1s   = this.getLimit(status, 1_000);

    const snapshot = this.computer.computeFull(window, limit_120s, limit_1s);

    // Log the full snapshot — structured for easy grep
    log.info({
      component: 'aggregate-reporter',
      window,
      snapshot,
    });

    // Persist latest snapshot for each window
    this.persistence.save(window, snapshot);
  }
}
```

### Log format per window — what gets logged

```
[INFO] {component:"aggregate-reporter", window:"10m"} {
  gateway: {
    total_requests: 487,
    avg_req_per_120s: 94.2,
    peak_req_per_120s: 98,
    times_limit_reached: 0,
    total_429s: 0,
    avg_token_pct_120s: 78.5,
    latency_p50_ms: 142,
    latency_p95_ms: 312,
  },
  poll: {
    players_polled: 60,
    players_new_added: 4,
    ranks_fetched: 241,
    ranks_skipped_db: 180,
    rank_skip_rate_pct: 42.7,
    match_ids_discovered: 1200,
    match_ids_new: 134,
    match_skip_rate_pct: 88.8,
    matches_fetched_success: 134,
    match_fetch_latency_p95_ms: 287,
  },
  ingestion: {
    matches_queued: 134,
    matches_skipped_total: 0,
    skip_breakdown: {},
    matches_ingested: 131,
    matches_failed: 3,
    ingestion_success_rate_pct: 97.8,
    ingestion_latency_p50_ms: 210,
    ingestion_latency_p95_ms: 580,
    queue_depth_peak: 18,
    slowest_db_ops: [
      { operation: 'runIngestionTransaction', p95_ms: 580 },
      { operation: 'match_filter_query', p95_ms: 45 },
    ]
  },
  ratios: {
    matches_ingested_vs_fetched_pct: 97.8,
    matches_skipped_vs_discovered_pct: 88.8,
    ranks_coverage_pct: 57.3,
    token_efficiency_pct: 78.5,
  },
  active_alerts: []
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 8. AlertDetector.ts — EXACT THRESHOLDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Checks alerts after each 10m aggregate report.
// Fires ONCE when threshold crossed. Clears when condition resolves.

export class AlertDetector {
  private active = new Map<AlertType, Alert>();

  check(snapshot: FullSnapshot, tunerSnapshot: TunerSnapshot): void {
    this.evaluate(snapshot, tunerSnapshot);
  }

  getActive(): Alert[] { return [...this.active.values()]; }
}
```

### Alert rules — implement EXACTLY these:

```
ALERT: too_many_429s
  Trigger:  snapshot.gateway.total_429s > 0 in 10m window
  Severity: WARN if ≤ 5, ERROR if > 5
  Data:     { count: total_429s, total_wait_ms: total_wait_ms_from_429 }
  Clear:    total_429s === 0 in next 10m window
  Log:      WARN/ERROR — "429s detected in last 10 minutes"

ALERT: token_underutilized
  Trigger:  avg_token_pct_120s < 30% AND tunerSnapshot.sessionCount > WARMUP_SESSIONS
  Severity: WARN
  Data:     { avg_pct: avg_token_pct_120s, limit_120s, ema_reqPerPlayer }
  Clear:    avg_token_pct_120s >= 30%
  Log:      WARN — "tokens under-utilized — possible EMA miscalibration or pool exhausted"

ALERT: token_near_limit
  Trigger:  avg_token_pct_120s > 90%
  Severity: WARN
  Data:     { avg_pct, peak_req_per_120s, times_limit_reached }
  Clear:    avg_token_pct_120s < 85%
  Log:      WARN — "approaching rate limit — consider raising SAFETY_MARGIN"

ALERT: ingestion_lag
  Trigger:  queue_depth_peak > BACKPRESSURE_THRESHOLD * 0.8
            AND queue_depth_avg > queue_depth_avg_prev_window * 1.2  (growing)
  Severity: WARN if peak < THRESHOLD, ERROR if peak >= THRESHOLD
  Data:     { queue_depth_peak, queue_depth_avg, matches_queued, matches_ingested }
  Clear:    queue_depth_avg < BACKPRESSURE_THRESHOLD * 0.5
  Log:      "ingestion queue building up — possible worker slowdown"

ALERT: ingestion_failure_rate
  Trigger:  ingestion_success_rate_pct < 95% AND matches_ingested + matches_failed > 10
  Severity: ERROR
  Data:     { success_rate_pct, failures: matches_failed, sample_size }
  Clear:    success_rate_pct >= 98%
  Log:      ERROR — "ingestion failure rate above threshold"

ALERT: rank_gap
  Trigger:  ranks_failed / max(1, ranks_fetched + ranks_failed) > 0.10  (>10% failure rate)
  Severity: WARN
  Data:     { failed: ranks_failed, fetched: ranks_fetched, failure_rate_pct }
  Clear:    failure_rate_pct < 5%
  Log:      WARN — "rank fetch failure rate elevated"

ALERT: match_skip_rate_high
  Trigger:  match_skip_rate_pct > 98% AND match_ids_discovered > 50
            (almost everything is skipped — might be a poll loop stall)
  Severity: WARN
  Data:     { skip_rate_pct, discovered, new: match_ids_new }
  Clear:    skip_rate_pct < 95%
  Log:      WARN — "nearly all matches already in DB — pool may be up to date or stalled"

ALERT: poll_stall
  Trigger:  last PollSessionEvent.ts > 5 minutes ago
  Severity: ERROR
  Data:     { last_session_ago_ms, last_session_id }
  Clear:    new PollSessionEvent received
  Log:      ERROR — "no poll session completed in 5 minutes"

ALERT: db_slow
  Trigger:  any slowest_db_ops entry has p95_ms > DB_SLOW_THRESHOLD_MS (default: 1000)
  Severity: WARN if p95 < 2000ms, ERROR if >= 2000ms
  Data:     { operation, p95_ms }
  Clear:    p95_ms < DB_SLOW_THRESHOLD_MS * 0.8
  Log:      "DB operation slow" { operation, p95_ms }

ALERT: ingestion_missing_data
  Trigger:  any skip_breakdown entry > 0
  Severity: WARN
  Data:     { skip_breakdown, most_common_reason, count }
  Clear:    all skip_breakdown values === 0
  Log:      WARN — "matches skipped from ingestion queue" + breakdown of reasons
            This is the KEY alert for "lesquels" — logs WHICH skip reason dominates
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 9. INSTRUMENTATION — WHERE TO EMIT EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 9.1 RiotGateway.ts (modify existing)

In the post-response handler (after headers parsed), push to store:
```typescript
store.pushGatewayRequest({
  ts: Date.now(),
  latencyMs,
  methodKey,
  statusCode,
  is429: statusCode === 429,
  isError: statusCode >= 400,
  tokensUsed_120s: appCount_120s,   // from parsed header
  tokensUsed_1s:   appCount_1s,
  limit_120s:      appLimit_120s,
  limit_1s:        appLimit_1s,
});
```

When a bucket is saturated (RateLimitSaturationEvent):
```typescript
store.pushSaturation({ ts, windowMs, methodKey, waitMs });
```

### 9.2 PollerDbConsumer.ts (modify existing)

In onPlayerRank():
```typescript
store.pushPlayer({ ts, type: 'polled', puuid, platform });
store.pushRank({ ts, type: 'fetched', puuid, platform, tier });
// If rankFilter said "already known":
store.pushRank({ ts, type: 'skipped_db', puuid, platform });
```

In onParticipantRank():
```typescript
// fromCache=true, entries=[] → skipped_db (rankFilter)
store.pushRank({ ts, type: event.fromCache && entries.length === 0 ? 'skipped_db' : 'fetched', ... });
// fromCache=true, entries present → skipped_cache (ParticipantRankCache)
store.pushRank({ ts, type: 'skipped_cache', ... });
```

In onMatchData():
```typescript
// After match+timeline successfully received:
store.pushMatchFetch({ ts, matchId, patch, success: true, latencyMs });

// Ingestion outcome:
if (wasInserted) {
  store.pushIngestionQueue({ ts, matchId, patch, rank, type: 'queued' });
} else {
  store.pushIngestionQueue({ ts, matchId, patch, rank, type: 'skipped',
    skipReason: 'conflict_already_done' });
}
```

If match fetch failed:
```typescript
store.pushMatchFetch({ ts, matchId, success: false, errorType });
store.pushIngestionQueue({ ts, matchId, type: 'skipped', skipReason: 'missing_timeline' });
```

If rank was missing:
```typescript
store.pushIngestionQueue({ ts, matchId, type: 'skipped', skipReason: 'missing_rank' });
```

In onPlayerComplete():
```typescript
// New players discovered (from ParticipantDiscovery.upsertParticipants):
if (newPlayersCount > 0) {
  store.pushPlayer({ ts, type: 'new_added', puuid: '(batch)', platform });
}
```

### 9.3 MatchIdPaginator.ts (modify existing)

After each page:
```typescript
for (const matchId of newIds) {
  store.pushMatchDiscovery({ ts, puuid, matchId, type: 'new' });
}
```

### 9.4 PlayerPoller.ts (modify existing)

After processedMatchIds dedup:
```typescript
for (const matchId of skippedMemory) {
  store.pushMatchDiscovery({ ts, puuid, matchId, type: 'skipped_memory' });
}
```

After matchFilter dedup:
```typescript
for (const matchId of skippedDb) {
  store.pushMatchDiscovery({ ts, puuid, matchId, type: 'skipped_db' });
}
```

After session:
```typescript
store.pushPollSession({ ts, sessionId, durationMs, playersPolled, playersCompleted, playersFailed });
```

### 9.5 ingestion.worker.ts (modify existing)

Wrap `runIngestionTransaction` with timing:
```typescript
const started = Date.now();
store.pushIngestionWorker({ ts: started, matchId, patch, rank, type: 'started' });

try {
  const result = await runIngestionTransaction(payload, db);
  const durationMs = Date.now() - started;

  store.pushIngestionWorker({
    ts: Date.now(), matchId, patch, rank,
    type: 'completed', durationMs,
    tablesWritten: result.tablesWritten,
  });
} catch (err) {
  store.pushIngestionWorker({
    ts: Date.now(), matchId, patch, rank,
    type: 'failed', durationMs: Date.now() - started,
    errorMessage: err.message,
  });
}
```

### 9.6 All DB operations — wrap with timing

Create a helper:
```typescript
export async function timedDbOp<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    store.pushDbOperation({
      ts: Date.now(), operation,
      durationMs: Date.now() - start,
      success: true,
    });
    return result;
  } catch (err) {
    store.pushDbOperation({
      ts: Date.now(), operation,
      durationMs: Date.now() - start,
      success: false, errorMessage: err.message,
    });
    throw err;
  }
}

// Usage in PollerDbConsumer, MatchFilter, RankFilter, PlayerDiscovery:
const result = await timedDbOp('insert_rank_history', () =>
  db.insert(schema.playerRankHistory).values(...).onConflictDoNothing()
);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 10. SnapshotPersistence.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Saves/loads the latest FullSnapshot per window to a JSON file.
// File: OBSERVABILITY_SNAPSHOT_PATH (default: ./poller-observability.json)
// Format: Record<WindowLabel, FullSnapshot>

export class SnapshotPersistence {
  private filePath: string;
  private data: Partial<Record<WindowLabel, FullSnapshot>> = {};

  load(): void {
    // On startup: read file, log each window's last snapshot at INFO.
    // If file missing: log INFO "no previous snapshot found, starting fresh".
  }

  save(window: WindowLabel, snapshot: FullSnapshot): void {
    this.data[window] = snapshot;
    // Write entire file atomically (write to .tmp, then rename).
    // Catch write errors (log WARN, do NOT throw — observability must not crash the process).
  }

  getLatest(window: WindowLabel): FullSnapshot | null {}
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 11. ObservabilityOrchestrator.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Single entry point. Call start() in main.ts after all components are initialized.

export class ObservabilityOrchestrator {
  private static instance: ObservabilityOrchestrator;

  private liveDisplay:   LiveTokenDisplay;
  private reporter:      AggregateReporter;
  private alertDetector: AlertDetector;
  private persistence:   SnapshotPersistence;
  private queuePoller:   NodeJS.Timeout | null = null;

  start(): void {
    this.persistence.load();          // load previous snapshots, log them
    this.liveDisplay.start();         // token bar every 5s
    this.reporter.start();            // aggregate reports per window

    // Poll BullMQ queue depth every 10s → QueueDepthEvent
    this.queuePoller = setInterval(async () => {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      store.pushQueueDepth({ ts: Date.now(), ...counts, total: counts.waiting + counts.active });
    }, 10_000);

    log.info({ component: 'observability' }, 'observability started');
  }

  stop(): void {
    this.liveDisplay.stop();
    this.reporter.stop();
    if (this.queuePoller) clearInterval(this.queuePoller);
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 12. ENV VARIABLES (.env.example additions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
# Observability
OBSERVABILITY_SNAPSHOT_PATH=./poller-observability.json
LIVE_TOKEN_DISPLAY_INTERVAL_MS=5000    # how often to log token bar
DB_SLOW_THRESHOLD_MS=1000             # alert if any DB op p95 > this
POLL_STALL_THRESHOLD_MS=300000        # alert if no session in 5 min
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 13. UNIT TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/unit/observability/

### CircularBuffer.test.ts
  T1 — push respects capacity (evicts oldest)
  T2 — inWindow returns correct events by timestamp
  T3 — inWindow with windowMs=0 returns []
  T4 — inWindow returns newest first
  T5 — latest() returns last pushed
  T6 — empty buffer: latest()=null, inWindow=[]

### AggregateComputer.test.ts
  Fixtures: generate N events with controlled timestamps

  T1 — total_requests counts correctly
  T2 — total_429s counts correctly
  T3 — avg_req_per_120s: 5 req at t=0, 5 req at t=60s → avg=5 (each in separate 120s window)
  T4 — latency percentiles computed correctly
  T5 — skip_breakdown populated correctly from IngestionQueueEvents
  T6 — match_skip_rate_pct = 0 when all matches are new
  T7 — match_skip_rate_pct = 100 when all skipped
  T8 — ratios.matches_ingested_vs_fetched_pct: 90 ingested / 100 fetched = 90%
  T9 — slowest_db_ops sorted by p95 DESC, max 5 entries
  T10 — empty window (no events): all counts = 0, no divide-by-zero

### AlertDetector.test.ts
  T1 — too_many_429s fires on first 429, clears when 0
  T2 — alert fires ONCE even with 5 consecutive checks in trigger state
  T3 — alert clears correctly when condition resolves
  T4 — token_underutilized: does NOT fire during warmup
  T5 — ingestion_lag: only fires when queue is GROWING (not just high)
  T6 — poll_stall: fires when last session > 5 min ago
  T7 — db_slow: WARN at 1000ms, ERROR at 2000ms
  T8 — ingestion_missing_data: logs correct skip_breakdown

### LiveTokenDisplay.test.ts
  Mock gateway.getStatus(), queue.getJobCounts()
  T1 — pushes TokenSnapshotEvent to store on each tick
  T2 — log contains used/limit/pct for both windows
  T3 — token bar renders correctly for 0%, 50%, 100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 14. SCRIPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"test:observability": "vitest run --project unit --testPathPattern observability"

Update "test:all" to include observability.

Generate in order:
types.ts → CircularBuffer.ts → MetricsStore.ts → AggregateComputer.ts →
LiveTokenDisplay.ts → AlertDetector.ts → SnapshotPersistence.ts →
AggregateReporter.ts → ObservabilityOrchestrator.ts →
timedDbOp helper → instrument gateway + consumer + worker + poller →
unit tests
```

---

## Ce que tu verras dans les logs

**Toutes les 5 secondes — tokens live :**
```
[INFO] tokens_120s: "87/99 [███████████████████████████████░░░░░░░░] 87.9%"
       tokens_1s:   "4/19  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 21.1%"
       in_flight: 8 | rps: 0.73 | p95: 287ms | queue: 12
```

**Toutes les 10 minutes — agrégat complet :**
```
[INFO] window: "10m" | requests: 487 | avg/120s: 94.2 | 429s: 0
       players: 60 polled, 4 new | ranks: 241 fetched, 180 skipped (42.7%)
       matches: 1200 discovered, 134 new (88.8% skip rate)
       ingested: 131/134 (97.8%) | p95 ingestion: 580ms
       token_efficiency: 78.5% | alerts: []
```

**Sur un problème — alerte immédiate :**
```
[WARN] too_many_429s: "3 rate limit hits in last 10 minutes"
       { total_wait_ms: 6000, avg_wait_ms: 2000 }
       → lever: raise SAFETY_MARGIN from 0.05 to 0.10

[WARN] ingestion_missing_data: "12 matches skipped"
       skip_breakdown: { missing_rank: 9, missing_timeline: 3 }
       → lever: check rankFilter + timeline fetch errors
```