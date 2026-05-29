import { riotConfig } from '../config/riotConfig.js';
import { gatewayLogger } from '../logger.js';
import type { BucketState } from '../types.js';
import { observabilityBus } from './ObservabilityBus.js';
import { isNearLimit, NEAR_LIMIT_RATIO } from './MetricsCollector.js';
import { TokenBucket, parseRateLimitCounts, parseRateLimitHeader } from './TokenBucket.js';

export class RateLimitTracker {
  private appBuckets: TokenBucket[] = [];
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

  incrementInFlight(methodKey: string): void {
    this.globalInFlight += 1;
    this.methodInFlight.set(methodKey, (this.methodInFlight.get(methodKey) ?? 0) + 1);
  }

  decrementInFlight(methodKey: string): void {
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

  getMethodInFlight(methodKey: string): number {
    return this.methodInFlight.get(methodKey) ?? 0;
  }

  canDispatch(methodKey: string): { allowed: boolean; waitMs?: number; appWindows: BucketState[]; methodWindows: BucketState[] } {
    const appWindows = this.getAppBucketStates();
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

  getWaitMs(methodKey: string): number {
    const check = this.canDispatch(methodKey);
    return check.waitMs ?? 0;
  }

  updateFromHeaders(methodKey: string, headers: Record<string, string>): void {
    const appLimit = headers['x-app-rate-limit'];
    const appCount = headers['x-app-rate-limit-count'];
    const methodLimit = headers['x-method-rate-limit'];
    const methodCount = headers['x-method-rate-limit-count'];

    const parsedApp = parseRateLimitHeader(appLimit);
    const parsedAppCounts = parseRateLimitCounts(appCount);
    const parsedMethod = parseRateLimitHeader(methodLimit);
    const parsedMethodCounts = parseRateLimitCounts(methodCount);

    this.appBuckets = this.syncBuckets('app', this.appBuckets, parsedApp, parsedAppCounts);
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
        parsedAppWindows: this.getAppBucketStates(),
        parsedMethodWindows: this.getMethodBucketStates(methodKey),
      },
      'Rate limit headers received',
    );

    observabilityBus.emitEvent('ratelimit:updated', {
      methodKey,
      appWindows: this.getAppBucketStates(),
      methodWindows: this.getMethodBucketStates(methodKey),
    });

    this.checkNearLimitWarnings([...this.appBuckets, ...(this.methodBuckets.get(methodKey) ?? [])]);
  }

  saturate(methodKey: string, untilMs: number, includeApp: boolean): void {
    if (includeApp) {
      for (const bucket of this.appBuckets) {
        bucket.saturate(untilMs);
      }
      observabilityBus.emitEvent('ratelimit:saturated', { scope: 'app', untilMs });
    }
    const method = this.methodBuckets.get(methodKey) ?? [];
    for (const bucket of method) {
      bucket.saturate(untilMs);
    }
    observabilityBus.emitEvent('ratelimit:saturated', { scope: 'method', methodKey, untilMs });
  }

  getAllBucketStates(): BucketState[] {
    const app = this.getAppBucketStates();
    const methodStates: BucketState[] = [];
    for (const [methodKey, buckets] of this.methodBuckets.entries()) {
      methodStates.push(...this.getMethodBucketStates(methodKey, buckets));
    }
    return [...app, ...methodStates];
  }

  getAppBucketStates(): BucketState[] {
    return this.appBuckets.map((bucket) => bucket.toState(this.globalInFlight, this.safetyMargin));
  }

  getMethodBucketStates(methodKey: string, buckets = this.methodBuckets.get(methodKey) ?? []): BucketState[] {
    const inFlight = this.getMethodInFlight(methodKey);
    return buckets.map((bucket) => bucket.toState(inFlight, this.safetyMargin));
  }

  private resetFallbackBuckets(): void {
    const fallback = riotConfig.fallbackLimits[riotConfig.apiKeyType].app;
    this.appBuckets = fallback.map(
      (entry) => new TokenBucket(`app:${entry.windowMs}`, entry.limit, entry.windowMs, 0),
    );
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
        gatewayLogger.info(
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
