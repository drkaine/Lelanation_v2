export type ApiKeyType = 'personal' | 'production';
export type HttpMethod = 'GET';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type RequestPriority = 'high' | 'normal';
export type RetryReason = '429' | '5xx' | 'network';
export type FlushReason = 'post_response' | 'timer_expired' | 'retry_ready' | 'watchdog';
export type ShutdownReason = 'graceful' | 'timeout';

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
  | 'bucket:near_limit'
  | 'metrics:snapshot'
  | 'gateway:shutdown_start'
  | 'gateway:shutdown_complete'
  | 'gateway:watchdog_triggered';

export interface RateLimitWindow {
  limit: number;
  windowMs: number;
  used: number;
  resetAt: number;
  saturatedUntil?: number;
}

export interface BucketState {
  bucketId: string;
  limit: number;
  used: number;
  inFlight: number;
  available: number;
  safeLimit: number;
  windowMs: number;
  resetInMs: number;
  saturatedUntil?: number;
  isBlocked?: boolean;
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
  headers: Record<string, string>;
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

export class RiotApiError extends Error {
  constructor(
    public statusCode: number,
    public endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = 'RiotApiError';
  }
}

export class RiotRateLimitError extends RiotApiError {
  retryAfterMs: number;

  constructor(statusCode: number, endpoint: string, message: string, retryAfterMs: number) {
    super(statusCode, endpoint, message);
    this.name = 'RiotRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class RiotHttpError extends RiotApiError {
  body: unknown;

  constructor(statusCode: number, endpoint: string, message: string, body: unknown) {
    super(statusCode, endpoint, message);
    this.name = 'RiotHttpError';
    this.body = body;
  }
}

export class RiotNetworkError extends Error {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = 'RiotNetworkError';
    this.originalError = originalError;
  }
}

export class RiotShutdownError extends Error {
  constructor(message = 'Gateway is shutting down') {
    super(message);
    this.name = 'RiotShutdownError';
  }
}

export class RiotMaxRetriesError extends RiotApiError {
  attempts: number;
  reason: RetryReason;

  constructor(
    statusCode: number,
    endpoint: string,
    message: string,
    attempts: number,
    reason: RetryReason,
  ) {
    super(statusCode, endpoint, message);
    this.name = 'RiotMaxRetriesError';
    this.attempts = attempts;
    this.reason = reason;
  }
}
