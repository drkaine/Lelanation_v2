import { gatewayLogger } from '../logger.js';

export class TokenBucket {
  limit: number;
  used: number;
  resetAt: number;
  saturatedUntil?: number;

  constructor(
    public readonly bucketId: string,
    limit: number,
    public readonly windowMs: number,
    used = 0,
    resetAt?: number,
  ) {
    this.limit = limit;
    this.used = used;
    this.resetAt = resetAt ?? Date.now() + windowMs;
  }

  safeLimit(safetyMargin: number): number {
    return Math.max(1, Math.floor(this.limit * (1 - safetyMargin)));
  }

  isBlocked(now = Date.now()): boolean {
    if (this.saturatedUntil !== undefined && now < this.saturatedUntil) return true;
    return false;
  }

  available(inFlight: number, safetyMargin: number, now = Date.now()): number {
    if (this.isBlocked(now)) return 0;
    return this.safeLimit(safetyMargin) - this.used - inFlight;
  }

  pctUsed(safetyMargin: number): number {
    const safe = this.safeLimit(safetyMargin);
    if (safe <= 0) return 100;
    return (this.used / safe) * 100;
  }

  msUntilReset(now = Date.now()): number {
    if (this.saturatedUntil !== undefined && now < this.saturatedUntil) {
      return Math.max(0, this.saturatedUntil - now);
    }
    return Math.max(0, this.resetAt - now);
  }

  saturate(untilMs: number): void {
    this.saturatedUntil = untilMs;
  }

  clearSaturation(): void {
    this.saturatedUntil = undefined;
  }

  update(newUsed: number, newLimit?: number): { slidOver: boolean; previousUsed: number } {
    const previousUsed = this.used;
    if (newLimit !== undefined) this.limit = newLimit;
    const slidOver = newUsed < previousUsed;
    this.used = newUsed;
    if (slidOver) {
      this.resetAt = Date.now() + this.windowMs;
    }
    gatewayLogger.trace(
      {
        component: 'TokenBucket',
        event: 'update',
        bucketId: this.bucketId,
        previousUsed,
        newUsed,
        limit: this.limit,
        windowMs: this.windowMs,
        resetInMs: this.msUntilReset(),
        slidOver,
      },
      'Token bucket updated',
    );
    return { slidOver, previousUsed };
  }

  toState(inFlight: number, safetyMargin: number): {
    bucketId: string;
    limit: number;
    used: number;
    inFlight: number;
    available: number;
    safeLimit: number;
    windowMs: number;
    resetInMs: number;
    saturatedUntil?: number;
    pctUsed: number;
  } {
    const safe = this.safeLimit(safetyMargin);
    return {
      bucketId: this.bucketId,
      limit: this.limit,
      used: this.used,
      inFlight,
      available: this.available(inFlight, safetyMargin),
      safeLimit: safe,
      windowMs: this.windowMs,
      resetInMs: this.msUntilReset(),
      saturatedUntil: this.saturatedUntil,
      pctUsed: this.pctUsed(safetyMargin),
    };
  }
}

export function parseRateLimitHeader(header: string | undefined): Array<{ limit: number; windowMs: number }> {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [limitRaw, windowSecRaw] = part.split(':');
      const limit = Number.parseInt(limitRaw ?? '', 10);
      const windowSec = Number.parseInt(windowSecRaw ?? '', 10);
      return { limit, windowMs: windowSec * 1000 };
    })
    .filter((entry) => Number.isFinite(entry.limit) && Number.isFinite(entry.windowMs) && entry.windowMs > 0);
}

export function parseRateLimitCounts(header: string | undefined): number[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part.split(':')[0] ?? '', 10))
    .filter((value) => Number.isFinite(value));
}
