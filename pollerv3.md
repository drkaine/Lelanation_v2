---

```
You are a senior backend engineer. Build a production-grade Riot Games API Gateway in TypeScript/Node.js.
This gateway is the single entry point for ALL Riot API calls in this project.
It must be bulletproof, self-adaptive to Riot's rate limit headers, maximize throughput
without ever triggering a 429, and expose deep observability at every layer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. PROJECT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/
├── gateway/
│   ├── RiotGateway.ts           # Main gateway class (singleton)
│   ├── RateLimitTracker.ts      # Parses & tracks all rate limit headers
│   ├── TokenBucket.ts           # Sliding window bucket per limit window
│   ├── RequestQueue.ts          # Priority queue with concurrency control
│   ├── RetryHandler.ts          # 429 / 5xx retry logic with backoff
│   ├── ObservabilityBus.ts      # Central event emitter for all gateway events
│   ├── MetricsCollector.ts      # In-memory rolling metrics (rps, latency, 429s, queue depth)
│   └── types.ts                 # All shared types/interfaces
├── http/
│   └── undiciClient.ts          # HTTP client based on undici (Pool + raw headers)
├── routes/
│   ├── matchV5.ts               # Match-V5 endpoints
│   └── leagueV4.ts              # League-V4 endpoints
├── config/
│   └── riotConfig.ts            # Centralized config from .env
├── tests/
│   ├── unit/
│   │   ├── TokenBucket.test.ts
│   │   ├── RateLimitTracker.test.ts
│   │   └── RiotGateway.test.ts  # mocked HTTP
│   └── integration/
│       ├── liveRateLimit.test.ts   # Real API — burst + 429 reaction
│       ├── liveThroughput.test.ts  # Real API — 9 req/s sustained check
│       └── liveSoak.test.ts        # Real API — 10-30 min sustained soak test
└── index.ts                     # Entry point / usage example

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. ENVIRONMENT CONFIG (.env + .env.example)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# .env.example — copy to .env and fill in

RIOT_API_KEY=RGAPI-xxxx-xxxx-xxxx-xxxx

# "personal" | "production"
# Controls fallback hard caps BEFORE first server response headers arrive.
# personal    → 99 req/120s,    19 req/1s
# production  → 29999 req/120s, 499 req/1s
API_KEY_TYPE=personal

# Regional cluster for Match-V5 (europe | americas | asia | sea)
RIOT_REGION_URL=https://europe.api.riotgames.com

# Platform for League-V4 (euw1 | na1 | kr | etc.)
RIOT_PLATFORM_URL=https://euw1.api.riotgames.com

# A valid PUUID to use in integration tests (must belong to an account on your platform)
TEST_PUUID=xxxx

# Max concurrent in-flight requests
MAX_CONCURRENCY=10

# Log level: trace | debug | info | warn | error | fatal
LOG_LEVEL=debug

# Safety margin: keep this % of tokens as buffer (0.01 = 1%, 0.05 = 5%)
SAFETY_MARGIN=0.05

# Soak test duration in minutes
SOAK_DURATION_MINUTES=10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. HTTP CLIENT — undici (NOT axios, NOT node-fetch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use `undici` (v6.x) as the HTTP client. It is the fastest Node.js HTTP/1.1 client,
powers Node's built-in fetch, and provides raw header access.

### http/undiciClient.ts

Create ONE undici.Pool instance per base URL (regional + platform).
Pool config:
  connections: 10          // matches MAX_CONCURRENCY
  pipelining: 1            // safe for HTTP/1.1 APIs
  connect.timeout: 10_000  // 10s connect timeout
  bodyTimeout: 15_000      // 15s full response timeout
  headersTimeout: 10_000

Expose a single function:

```typescript
export async function riotFetch(
  baseUrl: string,
  path: string,
  queryParams?: Record<string, string | number>,
  signal?: AbortSignal
): Promise<{
  statusCode: number;
  headers: Record<string, string>;   // lowercase header names
  body: unknown;                     // parsed JSON
  latencyMs: number;
}> {}
```

The function MUST:
  - Inject headers: X-Riot-Token, Accept: application/json
  - Serialize queryParams into the URL (skip undefined/null values)
  - Parse body as JSON (only on 2xx — on error, parse if possible, return raw string otherwise)
  - Return ALL response headers as lowercase keys (undici gives them lowercase by default)
  - Throw RiotHttpError (extend RiotApiError) with statusCode + body on non-2xx, non-429, non-5xx
  - On network error (ECONNRESET, ETIMEDOUT): wrap in RiotNetworkError and rethrow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. RATE LIMIT MODEL — EXACT BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 4.1 Header parsing
Every Riot response carries:
  x-app-rate-limit:          "100:120,20:1"
  x-app-rate-limit-count:    "57:120,3:1"
  x-method-rate-limit:       "2000:10"
  x-method-rate-limit-count: "134:10"

Parse ALL comma-separated "count:windowSeconds" pairs. N pairs per header is valid.
Headers are lowercase from undici. Parse both limit and count headers together per pair index.

For each pair → one SlidingWindowBucket:
  limit     : from x-*-rate-limit
  windowMs  : seconds * 1000
  used      : from x-*-rate-limit-count (same pair index)
  resetAt   : epoch ms — on FIRST population: Date.now() + windowMs
               on UPDATE: sliding — do NOT reset the clock unless the new used < previous used
               (which signals Riot's window rolled over — then set resetAt = Date.now() + windowMs)

Scoping:
  APP level    → global, applies to ALL requests
  METHOD level → per methodKey = "GET /lol/match/v5/matches/{matchId}" (URL template, NOT real URL)

### 4.2 Token availability check
Before dispatch, for EACH window (app + method):

  safe_limit = Math.max(1, Math.floor(limit * (1 - SAFETY_MARGIN)))
  available  = safe_limit - used - in_flight

Dispatch allowed only if available >= 1 for ALL windows simultaneously.

### 4.3 Throughput maximization
After EVERY response (2xx, 429, 5xx, error):
  → Immediately attempt queue flush (dispatch as many requests as tokens allow)

When ALL windows are saturated:
  → waitMs = MIN(msUntilReset) across all blocked windows
  → Schedule ONE setTimeout(flushQueue, waitMs + 1) — the +1ms avoids off-by-one
  → Cancel and reschedule if a newer earlier reset is detected
  → NEVER busy-poll

In-flight tracking (atomic counter pattern):
  → Increment BEFORE dispatching (when dequeued from RequestQueue)
  → Decrement AFTER headers are processed (success or any error)
  → Track BOTH global in-flight count AND per-methodKey in-flight count

### 4.4 On 429
  1. Parse Retry-After header (integer seconds). Default: 2s.
  2. saturate(methodKey, Date.now() + retryAfterMs) → blocks that bucket
  3. Also saturate app-level bucket if the 429 has no Method header
     (means app-level was hit, not method-level)
  4. Re-enqueue failed request at HEAD with priority='high'
  5. Schedule flush after retryAfterMs + 50ms buffer
  6. If retries >= MAX_RETRIES(3): reject with RiotRateLimitError, do NOT re-enqueue

### 4.5 On 5xx
  Exponential backoff: attempt 1→500ms, 2→1000ms, 3→2000ms.
  Re-enqueue at HEAD with priority='high'.
  Max 3 retries. Do NOT update rate limit buckets.

### 4.6 On network error (ECONNRESET, ETIMEDOUT, etc.)
  Same as 5xx. Max 3 retries with same backoff.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. OBSERVABILITY — MAXIMUM VERBOSITY (remove later)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This section is NON-NEGOTIABLE. Every listed event MUST be logged AND emitted on ObservabilityBus.

### 5.1 Logger
Use `pino` (v9.x) with `pino-pretty` for dev.
Logger name: "riot-gateway"
Always include: { timestamp, pid, component, requestId? }

### 5.2 ObservabilityBus (EventEmitter)
```typescript
export type GatewayEvent =
  | 'request:enqueued'
  | 'request:dispatched'
  | 'request:success'
  | 'request:retrying'
  | 'request:failed'
  | 'ratelimit:updated'
  | 'ratelimit:saturated'
  | 'ratelimit:429'
  | 'ratelimit:window_reset'
  | 'queue:flush_attempt'
  | 'queue:backpressure'
  | 'queue:empty'
  | 'bucket:near_limit'        // when used > 80% of safe_limit
  | 'metrics:snapshot'         // emitted every 5s by MetricsCollector
  | 'gateway:shutdown_start'
  | 'gateway:shutdown_complete';
```
Each event carries a typed payload (define all payload types in types.ts).

### 5.3 Log events — exact log per situation

#### TRACE level (hottest path — every request)
```
[TRACE] {component:"RateLimitTracker", event:"canDispatch_check"}
  methodKey, appWindows:[{limit,used,inFlight,available,resetInMs},...],
  methodWindows:[...], decision:"allowed"|"blocked", waitMs?
```
```
[TRACE] {component:"RequestQueue", event:"enqueue"|"dequeue"}
  requestId, priority, queueSize, highPriorityCount
```
```
[TRACE] {component:"TokenBucket", event:"update"}
  bucketId, previousUsed, newUsed, limit, windowMs, resetInMs, slidOver:bool
```

#### DEBUG level
```
[DEBUG] {component:"RiotGateway", event:"request_dispatched"}
  requestId, methodKey, url, queueWaitMs, inFlight(global), inFlight(method),
  appBuckets:[{window,used,limit,available,resetInMs}],
  methodBuckets:[{window,used,limit,available,resetInMs}]
```
```
[DEBUG] {component:"RiotGateway", event:"flush_triggered"}
  reason: "post_response"|"timer_expired"|"retry_ready"
  queueSize, dispatched_this_flush, remaining_in_queue
```
```
[DEBUG] {component:"RateLimitTracker", event:"headers_received"}
  methodKey, rawHeaders:{appLimit,appCount,methodLimit,methodCount},
  parsedAppWindows:[...], parsedMethodWindows:[...]
```
```
[DEBUG] {component:"MetricsCollector", event:"snapshot"}
  every 5 seconds:
  {
    window_5s: { requests, success, errors, retries, rateLimit429s },
    rps_current: number,                    // requests/sec over last 5s
    rps_avg_60s: number,
    latency_p50_ms: number,
    latency_p95_ms: number,
    latency_p99_ms: number,
    queue_depth: number,
    in_flight: number,
    token_utilization_per_window: [
      { bucket:"app:120s", used:57, limit:99, pct:57.6, safe_limit:94 },
      ...
    ],
    total_since_start: { requests, success, errors, retries, rateLimit429s }
  }
```

#### INFO level
```
[INFO] {component:"RiotGateway", event:"request_success"}
  requestId, methodKey, url, statusCode, latencyMs,
  remaining_tokens_app:[{window,available}],
  remaining_tokens_method:[{window,available}]
```
```
[INFO] {component:"RateLimitTracker", event:"window_reset_detected"}
  bucketId, previousResetAt, newResetAt, slidOver:true
```
```
[INFO] {component:"RiotGateway", event:"gateway_ready"}
  apiKeyType, fallbackLimits, maxConcurrency, safetyMargin
```

#### WARN level
```
[WARN] {component:"RiotGateway", event:"rate_limit_429"}
  requestId, methodKey, url, attempt, retryAfterMs,
  appBucketState:[...], methodBucketState:[...]
```
```
[WARN] {component:"RiotGateway", event:"request_retrying"}
  requestId, methodKey, url, reason:"429"|"5xx"|"network", attempt, backoffMs
```
```
[WARN] {component:"MetricsCollector", event:"queue_backpressure"}
  queueSize > 50: queueSize, inFlight, rps_current, token_utilization
```
```
[WARN] {component:"RateLimitTracker", event:"bucket_near_limit"}
  bucketId, used, safe_limit, pct_used, windowMs, resetInMs
  Trigger: used >= safe_limit * 0.80
```
```
[WARN] {component:"RiotGateway", event:"throughput_anomaly"}
  Trigger: rps_current drops > 20% vs rps_avg_60s unexpectedly
  rps_current, rps_avg_60s, queue_depth, in_flight, token_utilization
```
```
[WARN] {component:"RiotGateway", event:"latency_spike"}
  Trigger: single request latency > 3000ms
  requestId, methodKey, latencyMs
```

#### ERROR level
```
[ERROR] {component:"RiotGateway", event:"request_failed_max_retries"}
  requestId, methodKey, url, attempts, finalError:{type,message,statusCode?}
```
```
[ERROR] {component:"undiciClient", event:"network_error"}
  url, errorCode, errorMessage, attempt
```
```
[ERROR] {component:"RiotGateway", event:"uncaught_queue_error"}
  Full stack, queue state snapshot
```

#### FATAL level
```
[FATAL] {component:"RiotGateway", event:"invalid_config"}
  reason: "missing RIOT_API_KEY" | "invalid API_KEY_TYPE" | etc.
  Process must exit(1) after this log.
```

### 5.4 MetricsCollector — in-memory rolling stats
```typescript
export class MetricsCollector {
  // Called on every event
  record(event: 'success' | 'error' | 'retry' | '429', latencyMs?: number): void {}

  // Rolling 5s and 60s windows
  getRPS(): { current: number; avg60s: number } {}
  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {}
  getTokenUtilization(tracker: RateLimitTracker): TokenUtilizationSnapshot[] {}
  getTotals(): { requests: number; success: number; errors: number; retries: number; r429: number } {}

  // Emit snapshot every 5s via ObservabilityBus
  startPeriodicSnapshot(intervalMs?: number): void {}
  stop(): void {}
}
```
Use a circular buffer (ring buffer) for latency samples. Keep last 1000 samples.
Compute percentiles with a simple sort on the ring buffer contents.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. CLASSES — CONTRACTS & SIGNATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### types.ts — define ALL of the following

```typescript
export type ApiKeyType = 'personal' | 'production';
export type HttpMethod = 'GET';    // only GET for now
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type RequestPriority = 'high' | 'normal';
export type RetryReason = '429' | '5xx' | 'network';
export type FlushReason = 'post_response' | 'timer_expired' | 'retry_ready';
export type ShutdownReason = 'graceful' | 'timeout';

export interface RateLimitWindow {
  limit: number;
  windowMs: number;
  used: number;
  resetAt: number;
  saturatedUntil?: number;
}

export interface BucketState {
  bucketId: string;          // e.g. "app:120000" or "method:GET /lol/match/v5/matches/{matchId}:10000"
  limit: number;
  used: number;
  inFlight: number;
  available: number;
  safeLimit: number;
  windowMs: number;
  resetInMs: number;
  saturatedUntil?: number;
  pctUsed: number;
}

export interface QueuedRequest<T = unknown> {
  id: string;
  priority: RequestPriority;
  methodKey: string;
  baseUrl: string;
  path: string;
  queryParams?: Record<string, string | number>;
  retries: number;
  maxRetries: number;
  resolve: (value: GatewayResponse<T>) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
  lastAttemptAt?: number;
  abortController: AbortController;
}

export interface GatewayResponse<T> {
  data: T;
  statusCode: number;
  requestId: string;
  latencyMs: number;
  rateLimitSnapshot: BucketState[];
}

export interface TokenUtilizationSnapshot {
  bucketId: string;
  used: number;
  limit: number;
  safeLimit: number;
  pct: number;
  resetInMs: number;
}

// Error hierarchy
export class RiotApiError extends Error {
  constructor(public statusCode: number, public endpoint: string, message: string) {
    super(message); this.name = 'RiotApiError';
  }
}
export class RiotRateLimitError extends RiotApiError { retryAfterMs: number }
export class RiotHttpError extends RiotApiError { body: unknown }
export class RiotNetworkError extends Error { originalError: unknown }
export class RiotShutdownError extends Error {}
export class RiotMaxRetriesError extends RiotApiError { attempts: number; reason: RetryReason }
```

### RiotGateway.ts — complete public interface

```typescript
export class RiotGateway {
  private static instance: RiotGateway;
  static getInstance(): RiotGateway {}
  static resetInstance(): void {}  // test-only: destroy singleton for re-init

  async request<T>(
    baseUrl: string,
    path: string,               // URL template with {param} placeholders
    pathParams: Record<string, string>,
    queryParams?: Record<string, string | number>,
    priority?: RequestPriority
  ): Promise<GatewayResponse<T>> {}

  getStatus(): GatewayStatus {}  // full observability snapshot
  getObservabilityBus(): ObservabilityBus {}

  async shutdown(timeoutMs?: number): Promise<{ reason: ShutdownReason; flushed: number; rejected: number }> {}
}

export interface GatewayStatus {
  uptime_ms: number;
  queue: { size: number; highPriority: number };
  inFlight: { global: number; byMethod: Record<string, number> };
  buckets: BucketState[];
  metrics: {
    rps: { current: number; avg60s: number };
    latency: { p50: number; p95: number; p99: number };
    totals: { requests: number; success: number; errors: number; retries: number; r429: number };
    tokenUtilization: TokenUtilizationSnapshot[];
  };
  config: { apiKeyType: ApiKeyType; maxConcurrency: number; safetyMargin: number };
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. ROUTE MODULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each route function calls RiotGateway.getInstance().request(...) with the URL template
as methodKey (literal template string, NOT interpolated URL).

### routes/matchV5.ts

```typescript
// GET /lol/match/v5/matches/by-puuid/{puuid}/ids
export async function getMatchIdsByPUUID(
  puuid: string,
  options?: {
    queue?: number;
    type?: 'ranked' | 'normal' | 'tourney' | 'tutorial';
    start?: number;      // default 0
    count?: number;      // default 20, max 100
    startTime?: number;  // epoch seconds
    endTime?: number;    // epoch seconds
  }
): Promise<string[]>

// GET /lol/match/v5/matches/{matchId}
export async function getMatch(matchId: string): Promise<MatchDto>

// GET /lol/match/v5/matches/{matchId}/timeline
export async function getMatchTimeline(matchId: string): Promise<TimelineDto>
```

### routes/leagueV4.ts

```typescript
// GET /lol/league/v4/entries/by-puuid/{encryptedPUUID}
export async function getLeagueEntriesByPUUID(
  puuid: string,
  options?: {
    queue?: string;
    tier?: string;
    division?: string;
    page?: number;
  }
): Promise<LeagueEntryDto[]>
```

Define minimal but correct TypeScript interfaces for MatchDto, TimelineDto, LeagueEntryDto.
Use `[key: string]: unknown` for unmapped fields. Explicitly map only: metadata, info.participants
(summoner, champion, stats), timeline.frames, leagueEntry (tier, rank, lp, wins, losses).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 8. CONFIG (riotConfig.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
export const riotConfig = {
  apiKey: process.env.RIOT_API_KEY!,
  apiKeyType: (process.env.API_KEY_TYPE ?? 'personal') as ApiKeyType,
  regionalUrl: process.env.RIOT_REGION_URL ?? 'https://europe.api.riotgames.com',
  platformUrl: process.env.RIOT_PLATFORM_URL ?? 'https://euw1.api.riotgames.com',
  logLevel: (process.env.LOG_LEVEL ?? 'debug') as LogLevel,
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY ?? '10'),
  safetyMargin: parseFloat(process.env.SAFETY_MARGIN ?? '0.05'),
  maxRetries: 3,

  fallbackLimits: {
    personal:   {
      app:    [{ limit: 99,    windowMs: 120_000 }, { limit: 19,  windowMs: 1_000 }]
    },
    production: {
      app:    [{ limit: 29999, windowMs: 120_000 }, { limit: 499, windowMs: 1_000 }]
    },
  },
} as const;

export function validateConfig(): void {
  // Throws RiotApiError (FATAL) if:
  // - RIOT_API_KEY is missing or doesn't start with "RGAPI-"
  // - API_KEY_TYPE is not "personal" or "production"
  // - TEST_PUUID is missing (for integration tests only, warn not throw)
  // Logs every validated field at INFO level on success
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 9. INTEGRATION TESTS — REAL API CALLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: These tests hit the REAL Riot API. They require a valid .env file.
Run with: `npx vitest run --project integration`

Use TEST_PUUID from .env for all calls. All tests use getMatchIdsByPUUID as the probe endpoint
(it is cheap, idempotent, and always available).

Separate vitest config: vitest.integration.config.ts
  testTimeout: 1_800_000   // 30 min max for soak
  hookTimeout: 30_000

---
### tests/integration/liveRateLimit.test.ts
  Title: "Real API — 429 reaction test"
  Goal: Verify the gateway correctly handles a real 429 from Riot.

  Setup:
    - Initialize gateway with API_KEY_TYPE=personal
    - TEMPORARILY override safety margin to 0 (use 100% of tokens to force a 429)
    - Do NOT set safetyMargin in the gateway — set it via a test-only escape hatch
      (expose a setSafetyMargin(n: number) method on RiotGateway for tests only)

  Test: "should receive a 429, back off, and successfully recover"
    1. Fire 25 concurrent requests (more than the 20/1s personal limit)
    2. Expect: at least 1 RiotRateLimitError is caught internally (logged as WARN)
    3. Expect: gateway recovers — all requests eventually resolve or reject with RiotMaxRetriesError
    4. Expect: after recovery, a fresh request succeeds (statusCode 200)
    5. Expect: zero unhandled promise rejections
    6. Assert: metrics.totals.r429 >= 1
    7. Assert: no request hangs forever (all resolve/reject within 30s)
    8. Print gateway.getStatus() snapshot at the end

  Test: "should not emit a 429 under normal personal key usage"
    1. Send exactly (limit - safetyTokens) requests over 5 seconds
    2. Assert: metrics.totals.r429 === 0
    3. Assert: all requests resolve with statusCode 200

---
### tests/integration/liveThroughput.test.ts
  Title: "Real API — 9 req/s sustained throughput check"
  Goal: Confirm the gateway sustains ~9 req/s on a personal key without 429s.

  Why 9/sec: personal key allows 19/1s but we target 95% → 18/1s ≈ 9 req/s
  averaged over the 120s window (99/120s ≈ 0.825 req/s avg, but burst to 18/s then pause).
  The test validates BURST behavior within the 1s window, not the 120s average.

  Test: "should sustain 9 req/s burst for 30 seconds without 429"
    Strategy:
      - Run a loop for 30 seconds
      - Each second: enqueue 9 requests simultaneously
      - Await all 9 before next second tick (or use a rolling window)
    Assertions after 30s:
      - totalRequests: between 250 and 280 (some variance ok)
      - r429: 0
      - successRate: >= 99%
      - rps_avg: between 8.0 and 10.0
      - latency p95 < 3000ms
    Print: per-second RPS, latency p50/p95, token utilization snapshot every 5s

---
### tests/integration/liveSoak.test.ts
  Title: "Real API — Sustained soak test (SOAK_DURATION_MINUTES)"
  Goal: Verify sustained operation at maximum safe throughput over 10–30 minutes.
  Duration: controlled by SOAK_DURATION_MINUTES env var (default 10).

  Strategy:
    - Continuously keep the queue fed with getMatchIdsByPUUID requests
    - Use an async producer that enqueues new requests as old ones complete (keep queue at ~20)
    - Let the gateway self-regulate via rate limiting
    - Never manually throttle in the test — let the gateway do all pacing

  Snapshot: every 60s, log and store a checkpoint:
    { elapsed_s, total_requests, rps_current, rps_avg, p50, p95, p99,
      r429, errors, token_utilization, queue_depth, in_flight }

  Final assertions (after SOAK_DURATION_MINUTES):
    a) r429 === 0
       If r429 > 0: FAIL with full checkpoint history and bucket state at time of 429
    b) successRate >= 99.5%
       If not: FAIL with error breakdown
    c) rps never drops to 0 for more than 3 consecutive seconds
       (would indicate a deadlock or stall in the queue flush)
    d) rps_avg_overall >= expected_rps * 0.80
       where expected_rps = (fallbackLimit_120s * (1-safetyMargin)) / 120
       For personal key: (99 * 0.95) / 120 ≈ 0.784 req/s minimum avg
    e) No memory leak: process.memoryUsage().heapUsed stable (< 2x initial after warmup)

  Output at end:
    - Full checkpoint table (pretty-printed)
    - Gateway final status snapshot
    - Pass/Fail with reason

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 10. UNIT TESTS (mocked HTTP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use vitest. Mock undiciClient entirely.

### TokenBucket.test.ts
  - available() correct with in-flight subtraction
  - saturate() → isBlocked() true, unblocks after ms
  - update() with sliding window detection (used went down → window rolled)
  - safetyMargin applied correctly
  - msUntilReset() returns 0 when not blocked

### RateLimitTracker.test.ts
  - parseHeader("100:120,20:1") → 2 windows
  - parseHeader("2000:10") → 1 window
  - canDispatch: false when ANY window saturated
  - waitMs = minimum across saturated windows
  - Fallback limits used before first header arrives
  - updateFromHeaders triggers window reset detection
  - Per-methodKey isolation: saturating one method doesn't block another
  - App-level saturation blocks ALL methods

### RiotGateway.test.ts
  Mock scenarios:
  1. Single 200 response → success, headers parsed, metrics updated
  2. 429 on attempt 1 → re-queued at HEAD → 200 on attempt 2 → success
  3. 3x 429 → RiotMaxRetriesError
  4. 5xx → exponential backoff → success
  5. Burst of 50 requests with personal key mock limits → 0 simulated 429s
  6. Concurrency never exceeds MAX_CONCURRENCY
  7. Shutdown: pending requests rejected with RiotShutdownError, in-flight allowed to finish
  8. In-flight counter: always returns to 0 after all responses (no leaks)
  9. Throughput anomaly warning fires when rps drops 20%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 11. PACKAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "dependencies": {
    "undici": "^6.19.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:soak": "SOAK_DURATION_MINUTES=30 vitest run --project integration --testNamePattern soak",
    "test:throughput": "vitest run --project integration --testNamePattern throughput",
    "dev": "node --env-file=.env --watch src/index.ts"
  }
}

vitest.config.ts: two projects — "unit" (src/tests/unit) and "integration" (src/tests/integration)
Integration project: isolate: false (share singleton state across tests in the same file)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 12. CRITICAL INVARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER dispatch if ANY window has available_tokens < 1
2. NEVER busy-poll. All waiting via setTimeout only.
3. NEVER leak promises. Every enqueued request resolves or rejects.
4. NEVER share method-level buckets between different methodKeys.
5. NEVER hardcode rate limit numbers outside riotConfig.ts fallbackLimits.
6. Singleton only. Enforce with static instance + private constructor.
7. On shutdown timeout: reject remaining queue with RiotShutdownError, log count.
8. In-flight counter MUST be symmetrical: every increment has exactly one decrement.
9. AbortController per request: abort on shutdown or max retries exceeded.
10. All bucket state updates MUST happen synchronously within the event loop tick
    (Node.js is single-threaded — no mutex needed, but NEVER use async in bucket update path).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 13. DELIVERABLES CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] TypeScript strict mode — zero type errors
[ ] tsconfig.json: strict:true, target:ES2022, module:NodeNext, moduleResolution:NodeNext
[ ] .env.example with all variables and inline comments
[ ] All unit tests pass: npx vitest run --project unit
[ ] Integration test files exist and are runnable (skip if no .env)
[ ] README.md with:
    - ASCII architecture diagram
    - How rate limiting works (sliding window explanation)
    - How to switch personal → production (1-line .env change)
    - How to run each test suite
    - How to read the observability logs
    - Expected throughput table for both key types
[ ] No console.log anywhere — only pino logger
[ ] No any types without explicit // eslint-disable-next-line comment with reason

Generate ALL files now. Order: types.ts → riotConfig.ts → undiciClient.ts →
TokenBucket.ts → RateLimitTracker.ts → ObservabilityBus.ts → MetricsCollector.ts →
RequestQueue.ts → RetryHandler.ts → RiotGateway.ts → routes/ → unit tests →
integration tests → config files → README.md
```

---

## Ce qui change vs V1

| Sujet | V1 | V2 |
|---|---|---|
| Limite prod | ~~999/120s~~ | **29 999/120s + 499/1s** |
| HTTP client | ~~axios~~ | **undici Pool** — plus rapide, zero-dep, headers bruts natifs |
| Observabilité | basique | **TRACE/DEBUG/INFO/WARN/ERROR/FATAL** exhaustifs + MetricsCollector + ObservabilityBus |
| Tests réels | absents | **3 suites** : 429-reaction, 9req/s burst, soak 10-30min |
| AbortController | absent | **par request**, abort sur shutdown + max retries |
| Anomaly detection | absent | throughput drop 20% → WARN, latency spike 3s → WARN |


Voilà le prompt #2 — Poller Engine complet :

---

```
You are a senior backend engineer. The Riot API Gateway (RiotGateway singleton, routes matchV5.ts
and leagueV4.ts) is already implemented and working. Do NOT modify it.

Build the Polling Engine on top of it. This engine orchestrates the full data-collection
workflow for one or more players. It has NO knowledge of any database — it emits typed events
that a downstream service will consume. All state is in-memory, scoped to a PollSession.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. PROJECT STRUCTURE (add to existing src/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/
├── poller/
│   ├── PollerEngine.ts          # Orchestrator: manages sessions, player queues
│   ├── PollSession.ts           # Single poll session: state, dedup, emit
│   ├── PlayerPoller.ts          # Per-player workflow (rank + matchIds + matches)
│   ├── MatchProcessor.ts        # match + timeline fetch + participant rank resolution
│   ├── ParticipantRankCache.ts  # In-memory PUUID→rank cache, shared within session
│   ├── MatchIdPaginator.ts      # Handles paginated getMatchIdsByPUUID calls
│   ├── RegionRouter.ts          # Maps platform → regional cluster URL
│   ├── PollerEventBus.ts        # Typed EventEmitter for all poller output events
│   └── types.ts                 # All poller-specific types (Player, PollConfig, events…)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. TYPES (poller/types.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// ─── Player identity ───────────────────────────────────────────────────────

export type Platform =
  | 'euw1' | 'eun1' | 'tr1' | 'ru'          // Europe cluster
  | 'na1' | 'br1' | 'la1' | 'la2'            // Americas cluster
  | 'kr' | 'jp1'                              // Asia cluster
  | 'oc1' | 'ph2' | 'sg2' | 'th2' | 'tw2' | 'vn2'; // SEA cluster

export type RegionalCluster = 'europe' | 'americas' | 'asia' | 'sea';

export interface Player {
  puuid: string;
  platform: Platform;
  // Optional display info — not used by poller logic
  summonerName?: string;
  tagLine?: string;
}

// ─── Poll configuration ────────────────────────────────────────────────────

export interface PollConfig {
  // Only RANKED_SOLO_DUO (queue 420) — hardcoded, NOT configurable
  sinceTimestamp: number;    // epoch seconds — fetch matches AFTER this point
                             // Caller passes Date.now()/1000 at poll start

  // Pagination
  matchIdsPerPage: number;   // default 100 (Riot max)

  // Concurrency within a session
  maxConcurrentPlayers: number;    // how many PlayerPollers run in parallel (default 3)
  maxConcurrentMatchFetches: number; // match+timeline pairs per player (default 5)

  // Participant rank resolution
  resolveParticipantRanks: boolean; // default true
  participantRankConcurrency: number; // default 5
}

export const DEFAULT_POLL_CONFIG: PollConfig = {
  sinceTimestamp: Math.floor(Date.now() / 1000),
  matchIdsPerPage: 100,
  maxConcurrentPlayers: 3,
  maxConcurrentMatchFetches: 5,
  resolveParticipantRanks: true,
  participantRankConcurrency: 5,
};

// ─── Session state ─────────────────────────────────────────────────────────

export type SessionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SessionStats {
  playersTotal: number;
  playersCompleted: number;
  playersFailed: number;
  matchIdsDiscovered: number;
  matchIdsSkipped: number;       // already processed (dedup)
  matchesFetched: number;
  timelinesFetched: number;
  participantRanksFetched: number;
  participantRanksFromCache: number;
  errors: SessionError[];
  startedAt: number;             // epoch ms
  completedAt?: number;
  elapsedMs?: number;
}

export interface SessionError {
  ts: number;
  playerPuuid?: string;
  matchId?: string;
  participantPuuid?: string;
  stage: PollStage;
  error: string;
  retried: boolean;
  fatal: boolean;
}

export type PollStage =
  | 'player_rank'
  | 'match_ids'
  | 'match_data'
  | 'match_timeline'
  | 'participant_rank';

// ─── Poller output events (emitted — no DB) ────────────────────────────────

export interface PlayerRankEvent {
  sessionId: string;
  player: Player;
  entries: LeagueEntryDto[];    // from leagueV4 route
  fetchedAt: number;            // epoch ms
}

export interface MatchIdsEvent {
  sessionId: string;
  player: Player;
  matchIds: string[];           // full paginated list for this player
  page: number;                 // which page (for observability)
  total: number;                // cumulative discovered so far
}

export interface MatchDataEvent {
  sessionId: string;
  player: Player;               // the player who triggered this match fetch
  matchId: string;
  match: MatchDto;              // from matchV5 route
  timeline: TimelineDto;        // from matchV5 route
  fetchedAt: number;
}

export interface ParticipantRankEvent {
  sessionId: string;
  triggerMatchId: string;       // match that triggered this fetch
  participant: { puuid: string; platform: Platform };
  entries: LeagueEntryDto[];
  fromCache: boolean;
  fetchedAt: number;
}

export interface PlayerCompleteEvent {
  sessionId: string;
  player: Player;
  stats: {
    matchIdsDiscovered: number;
    matchIdsSkipped: number;
    matchesFetched: number;
    participantRanksFetched: number;
    elapsedMs: number;
    errors: SessionError[];
  };
}

export interface SessionCompleteEvent {
  sessionId: string;
  status: SessionStatus;
  stats: SessionStats;
}

export interface PollerErrorEvent {
  sessionId: string;
  error: SessionError;
}

// Map event names → payload types (for typed EventEmitter)
export interface PollerEvents {
  'player:rank':       PlayerRankEvent;
  'match:ids':         MatchIdsEvent;
  'match:data':        MatchDataEvent;
  'participant:rank':  ParticipantRankEvent;
  'player:complete':   PlayerCompleteEvent;
  'session:complete':  SessionCompleteEvent;
  'poller:error':      PollerErrorEvent;
  'session:cancelled': { sessionId: string };
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. REGION ROUTER (RegionRouter.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Deterministic, zero-async, pure mapping.
// All URLs are constructed here — never hardcoded elsewhere in the poller.

export class RegionRouter {
  static getCluster(platform: Platform): RegionalCluster {}
  static getRegionalUrl(platform: Platform): string {}   // e.g. "https://europe.api.riotgames.com"
  static getPlatformUrl(platform: Platform): string {}   // e.g. "https://euw1.api.riotgames.com"
}

// Mapping (implement as a frozen const record):
// euw1, eun1, tr1, ru         → europe  → https://europe.api.riotgames.com
// na1, br1, la1, la2          → americas → https://americas.api.riotgames.com
// kr, jp1                     → asia    → https://asia.api.riotgames.com
// oc1, ph2, sg2, th2, tw2, vn2 → sea   → https://sea.api.riotgames.com

// Platform base URLs (for League-V4):
// euw1 → https://euw1.api.riotgames.com
// eun1 → https://eun1.api.riotgames.com
// [etc., one per Platform value]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. MATCH ID PAGINATOR (MatchIdPaginator.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Handles paginated calls to getMatchIdsByPUUID.
// Stops when: empty page OR page size < matchIdsPerPage (last page reached).
// Emits 'match:ids' event per page for observability.

export class MatchIdPaginator {
  constructor(
    private player: Player,
    private config: PollConfig,
    private eventBus: PollerEventBus,
    private sessionId: string
  ) {}

  // Returns the FULL list of matchIds across all pages.
  // Each page fetches: queue=420, type='ranked', startTime=sinceTimestamp,
  //                    start=offset, count=matchIdsPerPage
  // Calls getMatchIdsByPUUID from matchV5 route.
  // Uses player's regional cluster URL.
  // Emits 'match:ids' after each page.
  async fetchAll(): Promise<string[]> {}
}

// IMPORTANT: queue=420 (RANKED_SOLO_DUO) is HARDCODED. Not a config option.
// IMPORTANT: type='ranked' is HARDCODED.
// IMPORTANT: sinceTimestamp is passed as startTime (epoch seconds).
// IMPORTANT: max 100 per page (Riot API hard limit).
// Pagination stops when page.length < matchIdsPerPage — do NOT check for zero only.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. PARTICIPANT RANK CACHE (ParticipantRankCache.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Shared across ALL PlayerPollers within ONE session.
// Prevents fetching the same participant rank multiple times.
// Simple in-memory Map — no TTL, no persistence.

export class ParticipantRankCache {
  // Returns true if puuid is already known (fetched or queued)
  has(puuid: string): boolean {}

  // Mark as in-progress (prevents concurrent duplicate fetches)
  reserve(puuid: string): void {}

  // Store result after fetch
  set(puuid: string, entries: LeagueEntryDto[]): void {}

  // Get cached result (null if not fetched yet)
  get(puuid: string): LeagueEntryDto[] | null {}

  // Stats for observability
  get size(): number {}
  get hitCount(): number {}    // incremented each time has() returns true
  get missCount(): number {}   // incremented each time reserve() is called
}

// Pattern for concurrent safety (Node is single-threaded, but async gaps exist):
// Before fetching: check has() → if false: reserve() immediately → then fetch → set()
// This prevents two concurrent MatchProcessors from fetching the same PUUID.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. MATCH PROCESSOR (MatchProcessor.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Handles ONE match: fetch match + timeline concurrently, then resolve participant ranks.

export class MatchProcessor {
  constructor(
    private player: Player,
    private config: PollConfig,
    private eventBus: PollerEventBus,
    private rankCache: ParticipantRankCache,
    private sessionId: string
  ) {}

  // Main entry point for a single matchId.
  async process(matchId: string): Promise<void> {}
}
```

### Internal process() workflow (EXACT):

```
Step 1: Fetch match + timeline CONCURRENTLY
  ┌──────────────────────────────────────────────────────────┐
  │  [getMatch(matchId)]    [getMatchTimeline(matchId)]      │
  │         ↓                         ↓                      │
  │      MatchDto                 TimelineDto                │
  └──────────────────────────────────────────────────────────┘
  Both via regional URL (player's cluster).
  Use Promise.all() — they are INDEPENDENT.

  On success:
    → emit 'match:data' with { match, timeline, player, matchId }

  On error (any):
    → log ERROR with stage, matchId, error
    → add to session errors (fatal=false)
    → return early (skip participant ranks for this match)
    → do NOT throw (let other matches continue)

Step 2: Extract participant PUUIDs from match
  participants = match.info.participants.map(p => p.puuid)
  // This gives 10 PUUIDs (5v5). The triggering player's PUUID is included.

Step 3: Filter participants needing rank fetch
  toFetch = participants.filter(puuid => {
    if (rankCache.has(puuid)) {
      // Cache hit: just count it, do NOT emit (already emitted or in-flight)
      rankCache increment hitCount  ← (internal, already handled by has())
      return false;
    }
    rankCache.reserve(puuid);  // claim it immediately to prevent duplicate fetches
    return true;
  });

Step 4: Fetch participant ranks concurrently (up to participantRankConcurrency)
  Process toFetch in batches of config.participantRankConcurrency using a
  simple semaphore / chunk pattern (NOT Promise.all on all 10 at once).

  For each participant puuid in toFetch:
    platform = infer from matchId prefix:
      matchId format: "{PLATFORM}_{gameId}", e.g. "EUW1_1234567890"
      Extract platform prefix (lowercase) → Platform type
      Use RegionRouter.getPlatformUrl(platform) for the League-V4 call.

    call: getLeagueEntriesByPUUID(puuid, { queue: 'RANKED_SOLO_5x5' })
    on success:
      rankCache.set(puuid, entries)
      emit 'participant:rank' with { puuid, platform, entries, fromCache:false, triggerMatchId }
    on error:
      log WARN with puuid, matchId, error
      rankCache.set(puuid, [])    // cache empty result to avoid retrying
      add to session errors (fatal=false)
      continue (non-fatal)

Step 5: For cache-hit participants (fromCache=true):
  emit 'participant:rank' with { puuid, platform, entries, fromCache:true, triggerMatchId }
  NOTE: platform for cached participants — infer from matchId prefix same as above.
  Emit fromCache=true events AFTER the fetch batch completes, so the consumer
  gets all 10 participant rank events per match in a consistent order.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. PLAYER POLLER (PlayerPoller.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Orchestrates the full workflow for ONE player.

export class PlayerPoller {
  constructor(
    private player: Player,
    private config: PollConfig,
    private eventBus: PollerEventBus,
    private rankCache: ParticipantRankCache,
    private processedMatchIds: Set<string>,  // shared across all PlayerPollers in session
    private sessionId: string
  ) {}

  async run(): Promise<PlayerCompleteEvent['stats']> {}
}
```

### Internal run() workflow (EXACT ORDER):

```
Step 1: Fetch player rank (high priority)
  → getLeagueEntriesByPUUID(player.puuid, { queue: 'RANKED_SOLO_5x5' })
     using player's platform URL
  → emit 'player:rank'
  → on error: log WARN, add to errors, continue (rank failure is non-fatal)
  → Also reserve player's puuid in rankCache + set(entries) to avoid re-fetching
    as a participant

Step 2: Paginate match IDs (MatchIdPaginator)
  → MatchIdPaginator.fetchAll()
  → Returns complete list of matchIds

Step 3: Deduplicate against processedMatchIds (shared Set)
  newMatchIds = matchIds.filter(id => !processedMatchIds.has(id))
  skipped = matchIds.length - newMatchIds.length
  // Add ALL to processedMatchIds NOW (before processing) to prevent
  // duplicate processing if two PlayerPollers share a match
  newMatchIds.forEach(id => processedMatchIds.add(id))
  // Log: INFO — how many new vs skipped

Step 4: Process matches in batches
  Process newMatchIds in concurrent batches of config.maxConcurrentMatchFetches.
  Use a semaphore/pool pattern (NOT all at once, NOT one at a time).

  For each matchId in the batch:
    → new MatchProcessor(...).process(matchId)
    → errors are caught internally by MatchProcessor (non-fatal)

  Implementation pattern:
    Use a simple async pool: maintain N concurrent MatchProcessor.process() promises,
    start next as soon as one finishes. Vanilla async/await + counter.
    Do NOT use external concurrency libraries.

Step 5: Emit 'player:complete'
  → Emit with full stats for this player
  → Return stats
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 8. POLL SESSION (PollSession.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
export class PollSession {
  readonly sessionId: string;    // crypto.randomUUID()
  readonly config: PollConfig;
  readonly players: Player[];
  readonly startedAt: number;    // Date.now()

  // Shared state across all PlayerPollers in this session
  private rankCache: ParticipantRankCache;
  private processedMatchIds: Set<string>;
  private stats: SessionStats;
  private status: SessionStatus;
  private abortController: AbortController;

  constructor(players: Player[], config: Partial<PollConfig>, eventBus: PollerEventBus) {}

  // Start the session. Returns when all players are processed.
  async run(): Promise<SessionStats> {}

  // Cancel the session gracefully (in-flight requests complete, no new dispatches)
  cancel(): void {}

  getStatus(): SessionStatus {}
  getStats(): SessionStats {}
}
```

### run() workflow:

```
1. Set status = 'running'
2. Log INFO: session started, { sessionId, players count, config }
3. Run PlayerPollers in batches of config.maxConcurrentPlayers
   (same async pool pattern as MatchProcessor batching)
4. Each PlayerPoller.run() result → merge stats into SessionStats
5. On abortController signal: stop launching new PlayerPollers,
   let in-flight ones complete naturally
6. When all done: set status = 'completed' (or 'cancelled')
7. Emit 'session:complete'
8. Log INFO: session complete with full stats summary
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 9. POLLER ENGINE (PollerEngine.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// Top-level singleton. Creates and tracks PollSessions.
// One PollerEngine, multiple sessions possible (though typically 1 at a time).

export class PollerEngine {
  private static instance: PollerEngine;
  static getInstance(): PollerEngine {}

  // Main entry point used by external callers.
  // sinceTimestamp defaults to Date.now()/1000 (now) if not provided.
  async poll(
    players: Player[],
    options?: Partial<PollConfig>
  ): Promise<{ sessionId: string; stats: SessionStats }> {}

  // Cancel a running session
  cancelSession(sessionId: string): void {}

  // Get status of any session
  getSessionStatus(sessionId: string): SessionStatus | null {}

  // Access the event bus to subscribe to poller events
  getEventBus(): PollerEventBus {}

  // Graceful shutdown — cancel all sessions, await completion
  async shutdown(): Promise<void> {}
}
```

### PollerEventBus (PollerEventBus.ts)

```typescript
import { EventEmitter } from 'node:events';

// Typed wrapper around EventEmitter.
// Provides type-safe on() / emit() / off().
export class PollerEventBus extends EventEmitter {
  emit<K extends keyof PollerEvents>(event: K, payload: PollerEvents[K]): boolean {}
  on<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {}
  once<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {}
  off<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {}
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 10. OBSERVABILITY — LOGS (add to existing pino logger)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All logs use component field: "poller" (sub-components: "MatchProcessor", "PlayerPoller", etc.)

#### DEBUG
```
[DEBUG] {component:"MatchIdPaginator"} fetching page
  { sessionId, puuid, page, offset, count, sinceTimestamp }
[DEBUG] {component:"MatchIdPaginator"} page result
  { sessionId, puuid, page, returned, cumulative, hasMore }
[DEBUG] {component:"MatchProcessor"} starting match
  { sessionId, matchId, playerPuuid }
[DEBUG] {component:"MatchProcessor"} participant rank batch
  { sessionId, matchId, toFetch:[puuids], fromCache:[puuids], batchSize }
[DEBUG] {component:"PlayerPoller"} dedup result
  { sessionId, puuid, total, new:N, skipped:N }
[DEBUG] {component:"PollSession"} player slot freed
  { sessionId, completedPuuid, remaining, nextPuuid? }
```

#### INFO
```
[INFO] {component:"PollerEngine"} poll started
  { sessionId, players:[{puuid,platform}], config }
[INFO] {component:"PlayerPoller"} player rank fetched
  { sessionId, puuid, platform, tier, rank, lp, queueType }
[INFO] {component:"PlayerPoller"} match ids complete
  { sessionId, puuid, total, new, skipped, pages }
[INFO] {component:"MatchProcessor"} match processed
  { sessionId, matchId, latencyMs, participantsFetched, participantsFromCache }
[INFO] {component:"PlayerPoller"} player complete
  { sessionId, puuid, matchesFetched, participantRanksFetched, errors, elapsedMs }
[INFO] {component:"PollSession"} session complete
  { sessionId, status, players:{total,completed,failed},
    matches:{discovered,fetched,skipped},
    ranks:{fetched,fromCache},
    errors:N, elapsedMs }
```

#### WARN
```
[WARN] {component:"PlayerPoller"} player rank failed
  { sessionId, puuid, error, continuing:true }
[WARN] {component:"MatchProcessor"} match fetch failed
  { sessionId, matchId, error, stage:"match_data"|"match_timeline", skippingParticipants:true }
[WARN] {component:"MatchProcessor"} participant rank failed
  { sessionId, matchId, participantPuuid, error, cachedEmpty:true }
[WARN] {component:"MatchIdPaginator"} pagination error
  { sessionId, puuid, page, error, partialResults:N }
[WARN] {component:"PollSession"} session cancelled mid-run
  { sessionId, playersRemaining, status }
```

#### ERROR
```
[ERROR] {component:"PlayerPoller"} player poller failed completely
  { sessionId, puuid, error, fatalStage }
[ERROR] {component:"PollSession"} unrecoverable session error
  { sessionId, error, stats }
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 11. ASYNC POOL PATTERN — implement ONCE, use everywhere
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create src/poller/utils/asyncPool.ts:

```typescript
// Generic async pool: run tasks with max N concurrent.
// Yields results in COMPLETION ORDER (not input order).
// Does NOT throw on individual task failures — catches and returns errors.

export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  task: (item: T) => Promise<R>
): Promise<{ item: T; result?: R; error?: unknown }[]> {}

// Usage:
// const results = await asyncPool(5, matchIds, id => processor.process(id));
// results.forEach(r => { if (r.error) handleError(r.error); });
```

Use THIS everywhere — PlayerPoller batch, MatchProcessor participant batch, PollSession player batch.
NO other concurrency primitive (no pLimit, no p-queue, no external packages).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 12. MATCHID → PLATFORM PARSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement in src/poller/utils/parseMatchId.ts:

```typescript
// Riot matchId format: "{PLATFORM_UPPER}_{gameId}"
// Examples: "EUW1_1234567890", "NA1_9876543210", "KR_1122334455"

export function parsePlatformFromMatchId(matchId: string): Platform {
  // Split on "_", take first part, lowercase
  // Map: "EUW1"→"euw1", "EUN1"→"eun1", "NA1"→"na1", "KR"→"kr", etc.
  // Throw ParseError if format unrecognized
}

// Also export:
export function isValidMatchId(matchId: string): boolean {}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 13. UNIT TESTS (vitest, mocked gateway)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/unit/poller/

### ParticipantRankCache.test.ts
  - has() returns false for unknown puuid
  - reserve() then has() returns true, get() returns null (in-flight)
  - set() then get() returns entries
  - hitCount / missCount increments correctly
  - Concurrent reserve calls: only first sets in-flight (no double-reserve)

### MatchIdPaginator.test.ts
  Mock getMatchIdsByPUUID:
  - Single page (< 100 results) → stops after 1 call
  - Exactly 100 results → fetches page 2 → page 2 has 0 → stops
  - Exactly 100 + 50 results → 2 pages, 150 total
  - Empty first page → returns []
  - Emits 'match:ids' for each page
  - Passes startTime=sinceTimestamp, queue=420, type='ranked' to every call

### RegionRouter.test.ts
  - All Platform values map to correct cluster
  - All Platform values map to correct URLs
  - No platform maps to wrong cluster

### parseMatchId.test.ts
  - "EUW1_123" → "euw1"
  - "NA1_456"  → "na1"
  - "KR_789"   → "kr"
  - "INVALID"  → throws ParseError
  - isValidMatchId() → true/false

### asyncPool.test.ts
  - Concurrency never exceeds N (track max concurrent via counter)
  - All items processed even if some throw
  - Results include error field for thrown tasks
  - Empty input → returns []
  - concurrency=1 → serial execution

### PlayerPoller.test.ts (integration of mocked steps)
  Mock: getMatchIdsByPUUID, getLeagueEntriesByPUUID, MatchProcessor.process
  - Player rank fetched first (before matchIds)
  - Player PUUID reserved in rankCache before matchIds
  - Dedup: 5 matchIds, 2 already in processedMatchIds → only 3 processed
  - processedMatchIds populated BEFORE processing (prevents concurrent duplicate)
  - maxConcurrentMatchFetches respected (mock concurrency tracking)
  - Player rank failure is non-fatal: matchIds still fetched
  - 'player:complete' emitted at end with correct stats

### MatchProcessor.test.ts
  Mock: getMatch, getMatchTimeline, getLeagueEntriesByPUUID
  - match + timeline fetched concurrently (both called, not sequentially)
  - 'match:data' emitted with both match and timeline
  - Participant dedup: 10 participants, 3 in cache → 7 fetched
  - fromCache=true events emitted for cached participants
  - Match fetch failure → no participant fetches → error logged, non-fatal
  - participantRankConcurrency respected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 14. INTEGRATION TEST — REAL API (live, uses gateway)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/integration/livePoller.test.ts

Requires TEST_PUUID + valid RIOT_API_KEY in .env.
Run with: npm run test:poller:integration

Test: "should complete a full poll for one player"
  1. player = { puuid: TEST_PUUID, platform: 'euw1' }
  2. sinceTimestamp = Date.now()/1000 - 30*24*3600  // last 30 days
  3. resolveParticipantRanks = true

  Assertions:
  - 'player:rank' emitted exactly once for TEST_PUUID
  - 'match:ids' emitted at least once
  - All emitted matchIds start with correct platform prefix
  - For each matchId: 'match:data' emitted (match + timeline present)
  - 'participant:rank' emitted 10 times per match (fromCache mix ok)
  - 'player:complete' emitted with stats
  - 'session:complete' emitted with status='completed'
  - stats.matchesFetched === 'match:data' event count
  - No unhandled promise rejections
  - All participant PUUIDs across all matches are in rankCache at the end
  - rankCache has zero duplicate fetches (hitCount + missCount = total participants seen)
  - Gateway.getStatus().metrics.r429 === 0

Test: "should deduplicate matches across two players in same session"
  1. players = [{ puuid: TEST_PUUID, platform: 'euw1' }, same player again]
     (same puuid twice simulates worst case: shared match history)
  2. Run poll
  Assertions:
  - Each matchId appears in 'match:data' events EXACTLY once
  - processedMatchIds Set contains no duplicates

Test: "should handle resolveParticipantRanks=false"
  1. resolveParticipantRanks = false
  Assertions:
  - 'participant:rank' events: 0
  - 'match:data' events: still emitted normally

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 15. SCRIPTS IN package.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"test:poller":             "vitest run --project unit --testPathPattern poller",
"test:poller:integration": "vitest run --project integration --testPathPattern livePoller",

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 16. CRITICAL INVARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. queue=420 (RANKED_SOLO_DUO) and type='ranked' are HARDCODED. Never in config.
2. sinceTimestamp is ALWAYS passed to getMatchIdsByPUUID. Never fetch all-time history.
3. processedMatchIds.add() BEFORE processing starts (not after) — prevents duplicates.
4. rankCache.reserve() BEFORE async fetch — prevents duplicate concurrent fetches.
5. match + timeline ALWAYS fetched with Promise.all — never sequentially.
6. Non-fatal errors (rank, single match, single participant) MUST NOT abort the session.
7. PollerEngine.poll() MUST NOT throw — always returns { sessionId, stats }.
8. PollerEventBus is the ONLY output. No console.log, no return values carrying match data.
9. The poller has ZERO knowledge of any database or storage layer.
10. asyncPool is the ONLY concurrency primitive — no external packages for this.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 17. DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] All files compile, strict mode, zero type errors
[ ] Unit tests: npm run test:poller → all pass
[ ] Integration test file exists and is runnable
[ ] No external concurrency packages (only asyncPool)
[ ] No database imports anywhere in src/poller/
[ ] RegionRouter covers ALL 16 Platform values
[ ] README updated with poller section:
    - Workflow diagram (ASCII)
    - How to subscribe to events
    - How sinceTimestamp works
    - Example usage: PollerEngine.getInstance().poll([player])

Generate files in this order:
types.ts → asyncPool.ts → parseMatchId.ts → RegionRouter.ts →
ParticipantRankCache.ts → PollerEventBus.ts → MatchIdPaginator.ts →
MatchProcessor.ts → PlayerPoller.ts → PollSession.ts → PollerEngine.ts →
unit tests → integration test
```

---

## Vue d'ensemble du flux de données

```
PollerEngine.poll([players])
    └── PollSession.run()                 (shared: rankCache, processedMatchIds)
            └── asyncPool(maxConcurrentPlayers)
                    └── PlayerPoller.run()
                            ├── 1. getLeagueEntriesByPUUID()   → emit 'player:rank'
                            ├── 2. MatchIdPaginator.fetchAll()  → emit 'match:ids' ×pages
                            ├──    dedup vs processedMatchIds
                            └── 3. asyncPool(maxConcurrentMatchFetches)
                                        └── MatchProcessor.process(matchId)
                                                ├── Promise.all([getMatch, getMatchTimeline])
                                                │       → emit 'match:data'
                                                └── asyncPool(participantRankConcurrency)
                                                        └── getLeagueEntriesByPUUID(participant)
                                                                → emit 'participant:rank'
                                    → emit 'player:complete'
        → emit 'session:complete'
```

## Points clés du design

| Décision | Raison |
|---|---|
| `sinceTimestamp = now` par défaut | Évite de repoll l'historique à chaque run |
| `processedMatchIds.add()` avant processing | Si 2 joueurs ont joué ensemble, le match n'est fetch qu'une fois |
| `rankCache.reserve()` avant await | Node.js single-thread mais les gaps async permettent des doublons sans ça |
| `Promise.all([match, timeline])` | Deux endpoints indépendants — toujours parallèle |
| Erreurs non-fatales partout | Un match 404 ne doit pas casser tout le poll |
| Zéro DB dans le poller | Le consumer écoute le bus et écrit ce qu'il veut |

Honnêtement non, c'est insuffisant. J'ai les tests unitaires par composant et un test live basique, mais il manque :

- le test de la **boucle entière end-to-end** (gateway mocké, tout le pipeline)
- les tests de **comportements limites** (annulation, 0 match, erreurs en cascade)
- les tests de **stabilité longue durée** (memory leak, deadlock, stall asyncPool)
- la **vérification des invariants de concurrence** en conditions réelles

Voilà le prompt corrigé pour la section tests, qui remplace les sections 13 et 14 :

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 13. UNIT TESTS — composants isolés (gateway mocké)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/unit/poller/

Framework: vitest. Mock complet de toutes les routes gateway via vi.mock().
Chaque fichier de test est INDÉPENDANT — aucun ordre d'exécution supposé.

─────────────────────────────────────────────────
### asyncPool.test.ts
─────────────────────────────────────────────────

Cas "mécanique pure" — aucun mock externe.

  T1 — concurrence max respectée
    Injecter un compteur atomique : incrément au début de chaque tâche, décrément à la fin.
    Vérifier que le compteur ne dépasse JAMAIS N pendant toute l'exécution.
    Tester avec N=1, N=3, N=10.

  T2 — toutes les tâches complétées même si certaines throw
    10 tâches, 3 throw une Error aléatoire.
    results.length === 10
    Les 3 erroneuses ont error !== undefined
    Les 7 restantes ont result !== undefined

  T3 — ordre de completion vs ordre d'entrée
    5 tâches avec des délais décroissants (tâche 5 = la plus rapide).
    Vérifier que les résultats arrivent en ordre de complétion, PAS d'entrée.

  T4 — input vide → retourne [] immédiatement sans attendre

  T5 — concurrency=1 → exécution strictement séquentielle
    Les tâches ne se chevauchent jamais (timestamps début/fin vérifiés).

  T6 — une tâche qui ne se résout jamais (timeout)
    Simuler avec une Promise qui ne resolve pas dans 200ms.
    asyncPool ne doit pas deadlock — les autres tâches continuent.
    La tâche pendu doit finir en timeout/reject, pas bloquer le pool.

─────────────────────────────────────────────────
### ParticipantRankCache.test.ts
─────────────────────────────────────────────────

  T1 — has() false pour PUUID inconnu
  T2 — reserve() puis has() → true, get() → null (in-flight, pas encore set)
  T3 — set() puis get() → retourne les entries
  T4 — hitCount / missCount : semantique exacte
       has()=true → hitCount++, get() appelé
       reserve() → missCount++
  T5 — double reserve() du même PUUID dans le même tick
       Simuler deux MatchProcessors qui appellent reserve() quasi-simultanément.
       Le deuxième has() doit retourner true (déjà réservé).
       Vérifier que missCount === 1, pas 2.
  T6 — set(puuid, []) pour erreur → get() retourne [] (pas null)
       Garantit que has() reste true et on ne re-fetch pas.

─────────────────────────────────────────────────
### MatchIdPaginator.test.ts
─────────────────────────────────────────────────

Mock: vi.mock('../../../routes/matchV5', () => ({ getMatchIdsByPUUID: vi.fn() }))

  T1 — page unique < 100 résultats → 1 appel API, stop
  T2 — exactement 100 résultats → fetch page 2 → page 2 vide → stop (2 appels)
  T3 — 100 + 100 + 47 → 3 pages, 247 matchIds au total
  T4 — première page vide → retourne [], 1 appel API
  T5 — page de 99 (< matchIdsPerPage) → stop immédiatement, pas de page suivante
  T6 — paramètres corrects vérifiés sur CHAQUE appel :
       queue=420, type='ranked', startTime=sinceTimestamp
       start=0 (page 1), start=100 (page 2), start=200 (page 3)
  T7 — 'match:ids' émis à chaque page avec { page, matchIds, total }
  T8 — erreur API sur page 2 → retourne les résultats de page 1 (partiel)
       log WARN émis, pas de throw

─────────────────────────────────────────────────
### RegionRouter.test.ts
─────────────────────────────────────────────────

  T1 — exhaustif : les 16 Platform values mappent toutes vers un cluster
  T2 — exhaustif : les 16 Platform values retournent une URL régionale valide
  T3 — exhaustif : les 16 Platform values retournent une URL plateforme valide
  T4 — valeur inconnue → throw avec message clair
  T5 — URLs commencent par "https://", pas de trailing slash

─────────────────────────────────────────────────
### parseMatchId.test.ts
─────────────────────────────────────────────────

  T1 — "EUW1_1234567890" → "euw1"
  T2 — "NA1_9876543210"  → "na1"
  T3 — "KR_1122334455"   → "kr"
  T4 — "TW2_5566778899"  → "tw2"
  T5 — "INVALID"         → throw ParseError
  T6 — ""                → throw ParseError
  T7 — "EUW1_"           → throw (gameId manquant)
  T8 — isValidMatchId() true/false pour les cas ci-dessus

─────────────────────────────────────────────────
### MatchProcessor.test.ts
─────────────────────────────────────────────────

Mock: getMatch, getMatchTimeline, getLeagueEntriesByPUUID
Fixture: buildMockMatch(matchId, participantPuuids[10]) → MatchDto factice

  T1 — match + timeline fetched CONCURRENTLY
       Injecter un espion sur Promise.all.
       OU : mesurer que le temps total ≈ max(latMatch, latTimeline), pas la somme.
       Les deux appels doivent démarrer AVANT que l'un ne se termine.

  T2 — 'match:data' émis avec { match, timeline } après succès

  T3 — déduplication participants :
       10 participants, 3 déjà en cache → getLeagueEntriesByPUUID appelé 7 fois
       3 events 'participant:rank' avec fromCache=true
       7 events 'participant:rank' avec fromCache=false

  T4 — participantRankConcurrency respecté (même technique que asyncPool T1)
       Concurrency=3 → compteur actif jamais > 3

  T5 — échec getMatch → aucun appel participant, error enregistrée, process() resolve (non-fatal)

  T6 — échec getMatchTimeline → même : 'match:data' NON émis, participants non fetch, non-fatal

  T7 — échec participant rank pour 2 participants sur 7 :
       rankCache.set(puuid, []) pour les 2 en erreur
       Les 5 autres fetchés correctement
       process() resolve quand même

  T8 — platform inférée du matchId pour chaque participant
       matchId="EUW1_123" → getPlatformUrl("euw1") utilisé pour League-V4

  T9 — tous les 10 events 'participant:rank' émis (7 fresh + 3 cache)
       Compter via eventBus.on('participant:rank', ...) dans le test

─────────────────────────────────────────────────
### PlayerPoller.test.ts
─────────────────────────────────────────────────

Mock: MatchIdPaginator, MatchProcessor, getLeagueEntriesByPUUID
Fixture: 20 matchIds fictifs

  T1 — ordre d'exécution strict :
       1. getLeagueEntriesByPUUID (rank)
       2. MatchIdPaginator.fetchAll()
       3. MatchProcessor.process() pour chaque matchId
       Vérifier via timestamps ou call order tracking.

  T2 — player PUUID réservé dans rankCache AVANT MatchIdPaginator
       (pour que MatchProcessor ne re-fetch pas le joueur principal)

  T3 — déduplication :
       processedMatchIds contient déjà 8 des 20 IDs.
       MatchProcessor.process() appelé exactement 12 fois.
       processedMatchIds.size === 20 à la fin.

  T4 — processedMatchIds.add() appelé AVANT le premier MatchProcessor.process()
       Simuler un deuxième PlayerPoller concurrent sur les mêmes matchIds.
       Vérifier que chaque matchId est traité UNE SEULE fois au total.

  T5 — maxConcurrentMatchFetches=3 :
       Compteur actif pendant process() ne dépasse jamais 3.

  T6 — rank failure non-fatale :
       getLeagueEntriesByPUUID throw → log WARN, matchIds toujours fetchés.
       'player:complete' émis quand même.

  T7 — 0 matchIds retournés → 'player:complete' émis avec matchesFetched=0, pas d'erreur.

  T8 — stats dans 'player:complete' cohérentes :
       matchIdsDiscovered = total paginator
       matchIdsSkipped = déjà dans processedMatchIds
       matchesFetched = MatchProcessor appelé N fois

─────────────────────────────────────────────────
### PollSession.test.ts
─────────────────────────────────────────────────

Mock: PlayerPoller complet (remplacé par un mock qui track les appels)

  T1 — maxConcurrentPlayers=2, 5 joueurs :
       Maximum 2 PlayerPollers actifs simultanément (vérifier via compteur).
       Tous les 5 complétés au final.

  T2 — 'session:complete' émis EXACTEMENT une fois, après tous les joueurs.

  T3 — stats agrégées correctement :
       Chaque PlayerPoller.run() retourne des stats fictives.
       SessionStats.matchesFetched = somme de tous les retours.

  T4 — cancel() en cours de session :
       cancel() appelé après le démarrage du 2ème joueur.
       Les joueurs en cours finissent (non interrompus).
       Les joueurs non démarrés ne démarrent pas.
       'session:complete' émis avec status='cancelled'.

  T5 — un PlayerPoller throw completement →
       Session continue avec les autres joueurs.
       stats.playersFailed === 1.
       'session:complete' émis avec status='completed' (pas 'failed').

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 14. END-TO-END TEST — boucle entière (gateway mocké)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/e2e/pollerFullLoop.test.ts

Pas d'appel réseau. Mock complet de undiciClient (et donc du gateway).
Teste la chaîne complète : PollerEngine → PollSession → PlayerPoller →
MatchProcessor → EventBus.

### Fixtures
```typescript
// Générateur de données mock réalistes
function buildMockMatchId(platform: Platform, n: number): string  // "EUW1_10000N"
function buildMockMatch(matchId: string, puuids: string[]): MatchDto  // 10 participants
function buildMockTimeline(matchId: string): TimelineDto
function buildMockLeagueEntries(puuid: string): LeagueEntryDto[]

// Scénario configurable
interface E2EScenario {
  players: Player[];
  matchesPerPlayer: number;
  sharedMatchRatio: number;    // 0.0–1.0 : fraction de matchs partagés entre joueurs
  participantCacheHitRatio: number;
  simulateMatchFetchErrorRate: number;   // 0.0–1.0
  simulateParticipantErrorRate: number;
}
```

─────────────────────────────────────────────────
### T1 — Scénario nominal : 1 joueur, 5 matchs
─────────────────────────────────────────────────
  Vérifications sur les events reçus (collecter via eventBus.on) :

  player:rank      → 1 event, puuid = player.puuid
  match:ids        → au moins 1 event, matchIds.length = 5 total
  match:data       → 5 events, chaque matchId représenté exactement 1 fois
  participant:rank → 5 × 10 = 50 events au total (10 par match)
  player:complete  → 1 event, stats.matchesFetched = 5
  session:complete → 1 event, status = 'completed'

  Vérifier l'ordre relatif des events :
  - 'player:rank' AVANT tout 'match:data'
  - 'match:data' (matchId X) AVANT 'participant:rank' (triggerMatchId X)
  - 'player:complete' APRÈS tous les 'match:data' et 'participant:rank'
  - 'session:complete' APRÈS 'player:complete'

─────────────────────────────────────────────────
### T2 — Déduplication : 2 joueurs partagent 3 matchs sur 5
─────────────────────────────────────────────────
  Joueur A : matchIds [M1, M2, M3, M4, M5]
  Joueur B : matchIds [M3, M4, M5, M6, M7]
  Matchs partagés : M3, M4, M5

  Assertions :
  - 'match:data' émis exactement 1 fois pour chaque matchId (M1..M7) → 7 events total
  - M3, M4, M5 ne sont PAS traités deux fois
  - processedMatchIds.size === 7 en fin de session

─────────────────────────────────────────────────
### T3 — Erreurs partielles non-fatales (chaos scenario)
─────────────────────────────────────────────────
  1 joueur, 10 matchs.
  Configurer le mock pour simuler :
    - 2 matchs : getMatch() throw 404
    - 3 matchs : getMatchTimeline() throw 500
    - 10 participants : getLeagueEntriesByPUUID() throw pour 20% d'entre eux

  Assertions :
  - 'session:complete' émis avec status='completed' (pas 'failed')
  - stats.matchesFetched = 5 (les 5 qui ont réussi complètement)
  - stats.errors.length > 0, tous avec fatal=false
  - 'participant:rank' émis pour les participants qui ont réussi
  - rankCache contient les PUUIDs en erreur avec entries=[] (pas de re-fetch)
  - Aucun unhandled rejection

─────────────────────────────────────────────────
### T4 — Vérification des invariants de concurrence
─────────────────────────────────────────────────
  3 joueurs, 15 matchs chacun, matchesPerPlayer=15.
  Config: maxConcurrentPlayers=2, maxConcurrentMatchFetches=4, participantRankConcurrency=3

  Instrumentation : injecter des compteurs dans chaque mock
    playerConcurrencyPeak  : max players actifs simultanément
    matchConcurrencyPeak   : max match+timeline pairs actifs
    participantConcurrencyPeak : max participant rank fetches actifs

  Assertions (strict) :
  - playerConcurrencyPeak <= 2
  - matchConcurrencyPeak <= 4   (par player, pas global)
  - participantConcurrencyPeak <= 3  (par match)
  - Tous les events session:complete avec status='completed'

─────────────────────────────────────────────────
### T5 — Annulation propre
─────────────────────────────────────────────────
  3 joueurs, 20 matchs chacun. Délais artificiels dans les mocks (50ms/match).
  cancel() appelé 200ms après démarrage.

  Assertions :
  - 'session:complete' émis avec status='cancelled'
  - Les PlayerPollers démarrés terminent leurs matchs en cours (pas coupés brutalement)
  - Les PlayerPollers non-démarrés n'émettent aucun event
  - Aucun event émis après 'session:complete'
  - Aucun timer/promise orpheline (vérifier avec --detectOpenHandles)

─────────────────────────────────────────────────
### T6 — 0 matchs depuis sinceTimestamp (joueur inactif)
─────────────────────────────────────────────────
  getMatchIdsByPUUID retourne [] à la première page.

  Assertions :
  - 'player:rank' émis (le rank est toujours fetch)
  - 'match:ids' émis avec matchIds=[], total=0
  - Aucun 'match:data', aucun 'participant:rank'
  - 'player:complete' émis avec matchesFetched=0, matchIdsDiscovered=0
  - 'session:complete' émis avec status='completed'

─────────────────────────────────────────────────
### T7 — resolveParticipantRanks=false
─────────────────────────────────────────────────
  1 joueur, 5 matchs.
  Assertions :
  - getLeagueEntriesByPUUID appelé exactement 1 fois (pour le joueur lui-même, Step 1)
  - 'participant:rank' → 0 events
  - 'match:data' → 5 events (non impacté)
  - rankCache.size === 1 (seulement le joueur principal)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 15. INTEGRATION TESTS — API réelle (live)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/integration/livePoller.test.ts

Requiert TEST_PUUID + RIOT_API_KEY valides dans .env.
testTimeout: 300_000 (5 min)

─────────────────────────────────────────────────
### T1 — Poll complet, 1 joueur, 30 derniers jours
─────────────────────────────────────────────────
  Collecter tous les events. Après session:complete :
  - 'player:rank' : 1 event, entries non vides (joueur ranké)
  - 'match:data' : N events, chaque matchId unique
  - 'participant:rank' : N×10 events, distribution fromCache cohérente
  - stats.matchesFetched === count('match:data')
  - stats.participantRanksFromCache + stats.participantRanksFetched === stats.matchesFetched × 10
  - Gateway stats : r429 === 0
  - Aucun unhandled rejection

─────────────────────────────────────────────────
### T2 — Déduplication sur vrais matchIds (même joueur, 2x)
─────────────────────────────────────────────────
  players = [TEST_PLAYER, TEST_PLAYER]  // même PUUID deux fois
  Assertions :
  - 'match:data' : chaque matchId exactement 1 fois
  - 'player:rank' : 2 events (un par joueur, même PUUID)
  - rankCache pour le PUUID du joueur : miss=1, hit=1 (réservé au 1er, cache au 2ème)

─────────────────────────────────────────────────
### T3 — resolveParticipantRanks=false (live)
─────────────────────────────────────────────────
  - getLeagueEntriesByPUUID appelé uniquement pour TEST_PUUID
  - 0 events 'participant:rank'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 16. STABILITY TEST — stabilité longue durée
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/tests/stability/pollerStability.test.ts

testTimeout: 3_600_000 (1h max)
Contrôlé par STABILITY_DURATION_MINUTES (défaut: 20) et STABILITY_SESSIONS (défaut: 30).
Peut tourner avec mocks OU live selon STABILITY_USE_LIVE_API=true.

### Setup commun
  - Si mode mock : 5 joueurs fictifs, 10 matchs chacun, 50ms de délai par appel simulé
  - Si mode live : TEST_PUUID réel, sinceTimestamp = 90 jours
  - Snapshot mémoire initial : heapUsed0 = process.memoryUsage().heapUsed

─────────────────────────────────────────────────
### T1 — Sessions répétées sans fuite mémoire
─────────────────────────────────────────────────
  Lancer STABILITY_SESSIONS sessions successives.
  Après chaque session :
    heapUsed = process.memoryUsage().heapUsed
    relativeGrowth = (heapUsed - heapUsed0) / heapUsed0

  Checkpoint toutes les 5 sessions :
  ```
  [STABILITY] session N/30 | heap: Xmb | growth: Y% | rps: Z | r429: W
  ```

  Assertions finales :
  - heapUsed final < heapUsed0 × 2.0  (pas plus que 2× la baseline)
  - La croissance est STABLE ou DÉCROISSANTE sur les 10 dernières sessions
    (pas de tendance linéaire croissante = pas de leak)
  - Toutes les sessions retournent status='completed'
  - PollerEngine.getInstance() renvoie toujours le même singleton

─────────────────────────────────────────────────
### T2 — Détection de stall (deadlock asyncPool)
─────────────────────────────────────────────────
  Mock : 5% des tâches ne se résolvent jamais (Promise pending).
  Timeout par tâche : 2000ms (configuré dans asyncPool T6 pattern).
  Lancer 10 sessions avec ces mocks.

  Assertions :
  - 'session:complete' émis pour TOUTES les 10 sessions (pas de hang)
  - Temps max par session < 30s (2s timeout × quelques tâches en parallèle)
  - Aucun timer orphelin à la fin (vitest --detectOpenHandles)

─────────────────────────────────────────────────
### T3 — Stabilité des événements (pas de doublons sur la durée)
─────────────────────────────────────────────────
  Lancer 20 sessions avec le même set de joueurs.
  Collecter TOUS les 'match:data' events dans un Map<matchId, count>.

  Assertions :
  - Chaque matchId apparaît exactement 1 fois dans chaque session
    (déduplication inter-session via processedMatchIds est NEUF à chaque session — attendu)
  - Pas de matchId avec count > 1 DANS LA MÊME SESSION

─────────────────────────────────────────────────
### T4 — (mode live uniquement) Stabilité gateway + poller sur durée
─────────────────────────────────────────────────
  Durée : STABILITY_DURATION_MINUTES minutes en continu.
  Stratégie : lancer une session, dès qu'elle complete → relancer immédiatement.

  Snapshots toutes les 60s :
  ```typescript
  interface StabilityCheckpoint {
    elapsed_s: number;
    sessions_completed: number;
    total_matches_fetched: number;
    total_participant_ranks: number;
    gateway_r429: number;
    gateway_rps_current: number;
    gateway_rps_avg: number;
    gateway_latency_p95: number;
    heap_mb: number;
    queue_depth: number;
    errors: number;
  }
  ```

  Assertions finales :
  - gateway.r429 === 0 (aucun 429 pendant tout le run)
  - sessions_completed >= 2 (au moins 2 cycles complets)
  - heap_mb stable (< 2× baseline après warmup)
  - Aucun stall > 30s sans 'session:complete' (détecté par timer de watchdog)
  - Erreurs de type 404/503 acceptées, mais pas > 5% du total des requêtes
  - Afficher la table complète des checkpoints à la fin

  Watchdog implémentation :
  ```typescript
  // Démarre un timer reset à chaque 'session:complete'
  // Si le timer expire (30s sans session:complete) → FAIL avec snapshot de l'état courant
  let watchdog = setTimeout(() => fail('STALL DETECTED'), 30_000);
  eventBus.on('session:complete', () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => fail('STALL DETECTED'), 30_000);
  });
  ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 17. SCRIPTS package.json (mise à jour)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"test:poller:unit":        "vitest run --project unit --testPathPattern poller",
"test:poller:e2e":         "vitest run --project e2e --testPathPattern pollerFullLoop",
"test:poller:integration": "vitest run --project integration --testPathPattern livePoller",
"test:poller:stability":   "vitest run --project stability --testPathPattern pollerStability",
"test:poller:stability:live": "STABILITY_USE_LIVE_API=true STABILITY_DURATION_MINUTES=20 vitest run --project stability",
"test:poller:all":         "npm run test:poller:unit && npm run test:poller:e2e",

vitest.config.ts — ajouter deux projets supplémentaires :
  "e2e":       src/tests/e2e,       isolate:true,   testTimeout:60_000
  "stability": src/tests/stability, isolate:false,  testTimeout:3_600_000
```

---

## Ce que couvre maintenant chaque couche

```
┌─────────────────────────────────────────────────────────────────┐
│  UNIT (gateway mocké, composant isolé)                          │
│  asyncPool · Cache · Paginator · Router · parseMatchId          │
│  MatchProcessor · PlayerPoller · PollSession                    │
│  → Tous les comportements internes, edge cases, erreurs         │
├─────────────────────────────────────────────────────────────────┤
│  E2E (gateway mocké, pipeline complet)                          │
│  PollerEngine → EventBus (7 scénarios)                         │
│  → Ordre des events, déduplication, concurrence, annulation     │
│  → Chaos (erreurs partielles), inactif, config flags            │
├─────────────────────────────────────────────────────────────────┤
│  INTEGRATION (API réelle, run unique)                           │
│  → Vrais matchIds, vraies réponses Riot, 0 × 429               │
├─────────────────────────────────────────────────────────────────┤
│  STABILITY (mocks ou live, longue durée)                        │
│  → Fuite mémoire (30 sessions), deadlock asyncPool (stall),     │
│     doublons d'events, watchdog anti-stall,                     │
│     gateway + poller sur 20 min continus                        │
└─────────────────────────────────────────────────────────────────┘
```