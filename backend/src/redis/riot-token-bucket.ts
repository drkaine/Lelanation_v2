/**
 * Token bucket applicatif calqué sur les limites Riot personnelles :
 * - 20 req/s (burst)
 * - 100 req/120s (fenêtre glissante)
 */
const BUCKET_1S_CAPACITY = 20;
const BUCKET_120S_CAPACITY = 100;
const WINDOW_120_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  private refill(nowMs: number): void {
    const elapsed = Math.max(0, nowMs - this.lastRefillMs);
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = nowMs;
  }

  tryConsume(count = 1, nowMs = Date.now()): boolean {
    this.refill(nowMs);
    if (this.tokens < count) return false;
    this.tokens -= count;
    return true;
  }

  msUntilAvailable(count = 1, nowMs = Date.now()): number {
    this.refill(nowMs);
    if (this.tokens >= count) return 0;
    const deficit = count - this.tokens;
    return Math.ceil(deficit / this.refillPerMs);
  }

  getRemaining(nowMs = Date.now()): number {
    this.refill(nowMs);
    return Math.floor(this.tokens);
  }
}

const bucket1s = new TokenBucket(BUCKET_1S_CAPACITY, BUCKET_1S_CAPACITY / 1000);
const bucket120s = new TokenBucket(BUCKET_120S_CAPACITY, BUCKET_120S_CAPACITY / WINDOW_120_MS);

export type RiotTokenBucketSnapshot = {
  bucket_1s_remaining: number;
  bucket_120s_remaining: number;
};

export function getRiotTokenBucketSnapshot(): RiotTokenBucketSnapshot {
  return {
    bucket_1s_remaining: bucket1s.getRemaining(),
    bucket_120s_remaining: bucket120s.getRemaining(),
  };
}

/** Consomme un token des deux buckets avant un appel Riot. */
export async function acquireRiotAppToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    const wait1s = bucket1s.msUntilAvailable(1, now);
    const wait120s = bucket120s.msUntilAvailable(1, now);
    const waitMs = Math.max(wait1s, wait120s);
    if (waitMs <= 0) {
      const ok1 = bucket1s.tryConsume(1, now);
      const ok120 = bucket120s.tryConsume(1, now);
      if (ok1 && ok120) return;
      continue;
    }
    await sleep(Math.min(waitMs, 250));
  }
}

export function resetRiotTokenBucketsForTests(): void {
  Object.assign(bucket1s, new TokenBucket(BUCKET_1S_CAPACITY, BUCKET_1S_CAPACITY / 1000));
  Object.assign(bucket120s, new TokenBucket(BUCKET_120S_CAPACITY, BUCKET_120S_CAPACITY / WINDOW_120_MS));
}
