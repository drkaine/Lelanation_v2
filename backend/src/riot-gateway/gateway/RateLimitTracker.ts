import { riotConfig } from '../config/riotConfig.js';
import { gatewayLogger } from '../logger.js';
import type { BucketState } from '../types.js';
import { observabilityBus } from './ObservabilityBus.js';
import { isNearLimit, NEAR_LIMIT_RATIO } from './MetricsCollector.js';
import { TokenBucket, parseRateLimitCounts, parseRateLimitHeader } from './TokenBucket.js';

/** Default routing host key, used by callers that do not pass a host. */
export const DEFAULT_HOST = 'default';

/**
 * Riot app limits are counted per routing host (europe, euw1, …): verified live with a personal key,
 * the europe and euw1 counters advance independently. App buckets are therefore keyed by host.
 */
export function hostKey(baseUrl: string | undefined): string {
  if (!baseUrl) return DEFAULT_HOST;
  try {
    return new URL(baseUrl).host || DEFAULT_HOST;
  } catch {
    return baseUrl.replace(/\/+$/, '');
  }
}

export class RateLimitTracker {
  private readonly appBucketsByHost = new Map<string, TokenBucket[]>();
  private readonly hostInFlight = new Map<string, number>();
  private readonly methodBuckets = new Map<string, TokenBucket[]>();
  private globalInFlight = 0;
  private readonly methodInFlight = new Map<string, number>();
  private safetyMargin: number;

  constructor(safetyMargin = riotConfig.safetyMargin) {
    this.safetyMargin = safetyMargin;
    this.resetFallbackBuckets();
  }

  setSafetyMargin(margin: number): void {
    this.safetyMargin = margin;
  }

  getSafetyMargin(): number {
    return this.safetyMargin;
  }

  incrementInFlight(methodKey: string, baseUrl?: string): void {
    const host = hostKey(baseUrl);
    this.hostInFlight.set(host, (this.hostInFlight.get(host) ?? 0) + 1);
    this.globalInFlight += 1;
    this.methodInFlight.set(methodKey, (this.methodInFlight.get(methodKey) ?? 0) + 1);
  }

  decrementInFlight(methodKey: string, baseUrl?: string): void {
    const host = hostKey(baseUrl);
    this.hostInFlight.set(host, Math.max(0, (this.hostInFlight.get(host) ?? 0) - 1));
    this.globalInFlight = Math.max(0, this.globalInFlight - 1);
    const current = this.methodInFlight.get(methodKey) ?? 0;
    if (current <= 1) {
      this.methodInFlight.delete(methodKey);
    } else {
      this.methodInFlight.set(methodKey, current - 1);
    }
  }

  getGlobalInFlight(): number {
    return this.globalInFlight;
  }

  /** Sum of all in-flight requests (alias for watchdog / diagnostics). */
  getTotalInFlight(): number {
    return this.globalInFlight;
  }

  getInFlightByMethod(): Record<string, number> {
    return Object.fromEntries(this.methodInFlight.entries());
  }

  getMethodInFlight(methodKey: string): number {
    return this.methodInFlight.get(methodKey) ?? 0;
  }

  getHostInFlight(baseUrl?: string): number {
    return this.hostInFlight.get(hostKey(baseUrl)) ?? 0;
  }

  canDispatch(
    methodKey: string,
    baseUrl?: string,
  ): { allowed: boolean; waitMs?: number; appWindows: BucketState[]; methodWindows: BucketState[] } {
    const appWindows = this.getAppBucketStates(baseUrl);
    const methodWindows = this.getMethodBucketStates(methodKey);
    const allWindows = [...appWindows, ...methodWindows];

    const blocked = allWindows.filter((window) => window.available < 1);
    const allowed = blocked.length === 0;
    const waitMs = allowed ? undefined : Math.min(...blocked.map((window) => window.resetInMs)) + 1;

    gatewayLogger.trace(
      {
        component: 'RateLimitTracker',
        event: 'canDispatch_check',
        methodKey,
        appWindows,
        methodWindows,
        decision: allowed ? 'allowed' : 'blocked',
        waitMs,
      },
      'Rate limit dispatch check',
    );

    return { allowed, waitMs, appWindows, methodWindows };
  }

  getWaitMs(methodKey: string, baseUrl?: string): number {
    const check = this.canDispatch(methodKey, baseUrl);
    return check.waitMs ?? 0;
  }

  updateFromHeaders(methodKey: string, headers: Record<string, string>, baseUrl?: string): void {
    const host = hostKey(baseUrl);
    const appLimit = headers['x-app-rate-limit'];
    const appCount = headers['x-app-rate-limit-count'];
    const methodLimit = headers['x-method-rate-limit'];
    const methodCount = headers['x-method-rate-limit-count'];

    const parsedApp = parseRateLimitHeader(appLimit);
    const parsedAppCounts = parseRateLimitCounts(appCount);
    const parsedMethod = parseRateLimitHeader(methodLimit);
    const parsedMethodCounts = parseRateLimitCounts(methodCount);

    const appBuckets = this.syncBuckets(`app:${host}`, this.appBucketsFor(host), parsedApp, parsedAppCounts);
    this.appBucketsByHost.set(host, appBuckets);
    const existingMethod = this.methodBuckets.get(methodKey) ?? [];
    this.methodBuckets.set(
      methodKey,
      this.syncBuckets(`method:${methodKey}`, existingMethod, parsedMethod, parsedMethodCounts),
    );
    gatewayLogger.debug(
      {
        component: 'RateLimitTracker',
        event: 'headers_received',
        methodKey,
        rawHeaders: { appLimit, appCount, methodLimit, methodCount },
        host,
        parsedAppWindows: this.getAppBucketStates(baseUrl),
        parsedMethodWindows: this.getMethodBucketStates(methodKey),
      },
      'Rate limit headers received',
    );

    observabilityBus.emitEvent('ratelimit:updated', {
      methodKey,
      appWindows: this.getAppBucketStates(baseUrl),
      methodWindows: this.getMethodBucketStates(methodKey),
    });

    this.checkNearLimitWarnings([...appBuckets, ...(this.methodBuckets.get(methodKey) ?? [])]);
  }

  saturate(methodKey: string, untilMs: number, includeApp: boolean, baseUrl?: string): void {
    if (includeApp) {
      const host = hostKey(baseUrl);
      for (const bucket of this.appBucketsFor(host)) {
        bucket.saturate(untilMs);
      }
      observabilityBus.emitEvent('ratelimit:saturated', { scope: 'app', host, untilMs });
    }
    const method = this.methodBuckets.get(methodKey) ?? [];
    for (const bucket of method) {
      bucket.saturate(untilMs);
    }
    observabilityBus.emitEvent('ratelimit:saturated', { scope: 'method', methodKey, untilMs });
  }

  getAllBucketStates(): BucketState[] {
    const app: BucketState[] = [];
    for (const host of this.appBucketsByHost.keys()) {
      app.push(...this.getAppBucketStates(host));
    }
    const methodStates: BucketState[] = [];
    for (const [methodKey, buckets] of this.methodBuckets.entries()) {
      methodStates.push(...this.getMethodBucketStates(methodKey, buckets));
    }
    return [...app, ...methodStates];
  }

  /** App buckets of one routing host (DEFAULT_HOST when omitted). */
  getAppBucketStates(baseUrl?: string): BucketState[] {
    const host = hostKey(baseUrl);
    const inFlight = this.hostInFlight.get(host) ?? 0;
    return this.appBucketsFor(host).map((bucket) => bucket.toState(inFlight, this.safetyMargin));
  }

  getAppHosts(): string[] {
    return [...this.appBucketsByHost.keys()];
  }

  getMethodBucketStates(methodKey: string, buckets = this.methodBuckets.get(methodKey) ?? []): BucketState[] {
    const inFlight = this.getMethodInFlight(methodKey);
    return buckets.map((bucket) => bucket.toState(inFlight, this.safetyMargin));
  }

  private appBucketsFor(host: string): TokenBucket[] {
    const existing = this.appBucketsByHost.get(host);
    if (existing) return existing;
    const fallback = riotConfig.fallbackLimits[riotConfig.apiKeyType].app.map(
      (entry) => new TokenBucket(`app:${host}:${entry.windowMs}`, entry.limit, entry.windowMs, 0),
    );
    this.appBucketsByHost.set(host, fallback);
    return fallback;
  }

  private resetFallbackBuckets(): void {
    this.appBucketsByHost.clear();
    this.appBucketsFor(DEFAULT_HOST);
  }

  private syncBuckets(
    prefix: string,
    existing: TokenBucket[],
    parsedLimits: Array<{ limit: number; windowMs: number }>,
    parsedCounts: number[],
  ): TokenBucket[] {
    if (parsedLimits.length === 0) {
      return existing;
    }

    const buckets: TokenBucket[] = [];
    for (let i = 0; i < parsedLimits.length; i += 1) {
      const { limit, windowMs } = parsedLimits[i];
      const used = parsedCounts[i] ?? 0;
      const bucketId = `${prefix}:${windowMs}`;
      const previous = existing.find((item) => item.windowMs === windowMs) ?? existing[i];
      const bucket = previous ?? new TokenBucket(bucketId, limit, windowMs, used);
      const { slidOver, previousUsed } = bucket.update(used, limit);
      if (slidOver) {
        // debug : émis à chaque glissement de fenêtre, trop verbeux en info.
        gatewayLogger.debug(
          {
            component: 'RateLimitTracker',
            event: 'window_reset_detected',
            bucketId,
            previousResetAt: bucket.resetAt - windowMs,
            newResetAt: bucket.resetAt,
            slidOver: true,
          },
          'Rate limit window reset detected',
        );
        observabilityBus.emitEvent('ratelimit:window_reset', { bucketId, previousUsed, newUsed: used });
      }
      buckets.push(bucket);
    }
    return buckets;
  }

  private checkNearLimitWarnings(buckets: TokenBucket[]): void {
    for (const bucket of buckets) {
      const safe = bucket.safeLimit(this.safetyMargin);
      if (isNearLimit(bucket.used, safe)) {
        gatewayLogger.warn(
          {
            component: 'RateLimitTracker',
            event: 'bucket_near_limit',
            bucketId: bucket.bucketId,
            used: bucket.used,
            safe_limit: safe,
            pct_used: bucket.pctUsed(this.safetyMargin),
            windowMs: bucket.windowMs,
            resetInMs: bucket.msUntilReset(),
          },
          'Rate limit bucket near limit',
        );
        observabilityBus.emitEvent('bucket:near_limit', {
          bucketId: bucket.bucketId,
          used: bucket.used,
          safeLimit: safe,
          ratio: NEAR_LIMIT_RATIO,
        });
      }
    }
  }
}
