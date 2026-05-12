import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

process.env.ENV ||= "dev";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/riot_db";
process.env.RIOT_API_KEY ||= "RGAPI-test";

const { createLuaRateLimiterForTests } = await import("../src/redis/rate-limiter.js");

const preferredRedisUrl = process.env.REDIS_TEST_URL || "redis://localhost:6380";
const fallbackRedisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let activeRedisUrl = preferredRedisUrl;
let redis = new Redis(preferredRedisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  retryStrategy: () => null,
});

const keys = {
  oneSec: "rl:test:1s",
  oneTwentySec: "rl:test:120s",
};

let limiterDefault = createLuaRateLimiterForTests({
  redisClient: redis,
  bucket1sKey: keys.oneSec,
  bucket120sKey: keys.oneTwentySec,
  limit1s: 10,
  limit120s: 500,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeAll(async () => {
  try {
    await redis.connect();
    await redis.ping();
  } catch {
    if (preferredRedisUrl !== fallbackRedisUrl) {
      await redis.quit().catch(() => undefined);
      activeRedisUrl = fallbackRedisUrl;
      redis = new Redis(activeRedisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        retryStrategy: () => null,
      });
      await redis.connect();
      await redis.ping();
    } else {
      throw new Error(`Redis test instance unavailable at ${preferredRedisUrl}`);
    }
  }
  console.log(`[rate-limiter.test] using redis at ${activeRedisUrl}`);
  limiterDefault = createLuaRateLimiterForTests({
    redisClient: redis,
    bucket1sKey: keys.oneSec,
    bucket120sKey: keys.oneTwentySec,
    limit1s: 10,
    limit120s: 500,
  });
  await limiterDefault.loadScript();
});

beforeEach(async () => {
  await redis.del(keys.oneSec, keys.oneTwentySec);
});

afterAll(async () => {
  if (redis.status === "ready") {
    await redis.del(keys.oneSec, keys.oneTwentySec);
  }
  if (redis.status !== "end") {
    await redis.quit();
  }
});

describe("rate limiter integration", () => {
  test("ne depasse pas la limite 1s", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () => limiterDefault.tryAcquire(1)),
    );
    const passed = attempts.filter((a) => a.granted).length;
    const refused = attempts.filter((a) => !a.granted).length;

    expect(passed).toBe(10);
    expect(refused).toBe(1);
  });

  test("retourne le bon PTTL en cas de refus", async () => {
    for (let i = 0; i < 10; i += 1) {
      const result = await limiterDefault.tryAcquire(1);
      expect(result.granted).toBe(true);
    }

    const denied = await limiterDefault.tryAcquire(1);
    expect(denied.granted).toBe(false);
    expect(denied.waitMs).toBeGreaterThanOrEqual(0);
    expect(denied.waitMs).toBeLessThanOrEqual(1000);
  });

  test("cout=2 consomme 2 tokens", async () => {
    for (let i = 0; i < 5; i += 1) {
      const result = await limiterDefault.tryAcquire(2);
      expect(result.granted).toBe(true);
    }

    const denied = await limiterDefault.tryAcquire(2);
    expect(denied.granted).toBe(false);
  });

  test("fenetre 120s independante", async () => {
    const limiter120 = createLuaRateLimiterForTests({
      redisClient: redis,
      bucket1sKey: keys.oneSec,
      bucket120sKey: keys.oneTwentySec,
      limit1s: 100,
      limit120s: 3,
    });
    await limiter120.loadScript();

    const first = await limiter120.tryAcquire(1);
    expect(first.granted).toBe(true);
    await sleep(200);
    const second = await limiter120.tryAcquire(1);
    expect(second.granted).toBe(true);
    await sleep(200);
    const third = await limiter120.tryAcquire(1);
    expect(third.granted).toBe(true);
    await sleep(200);
    const fourth = await limiter120.tryAcquire(1);
    expect(fourth.granted).toBe(false);
  });

  test("idempotence : ne compte pas les requetes refusees", async () => {
    for (let i = 0; i < 10; i += 1) {
      await limiterDefault.tryAcquire(1);
    }

    for (let i = 0; i < 3; i += 1) {
      const denied = await limiterDefault.tryAcquire(1);
      expect(denied.granted).toBe(false);
    }

    await sleep(1100);

    let passedAfterReset = 0;
    for (let i = 0; i < 10; i += 1) {
      const result = await limiterDefault.tryAcquire(1);
      if (result.granted) passedAfterReset += 1;
    }
    expect(passedAfterReset).toBe(10);
  });
});
