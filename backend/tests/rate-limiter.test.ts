import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

process.env.ENV ||= "dev";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/riot_db";
process.env.RIOT_API_KEY ||= "RGAPI-test";

const {
  createLuaRateLimiterForTests,
  matchTargetRatePerSec,
  rankTargetRatePerSec,
  RANK_SLOT_KEY,
} = await import("../src/redis/rate-limiter.js");

const preferredRedisUrl = process.env.REDIS_TEST_URL || "redis://localhost:6380";
const fallbackRedisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let activeRedisUrl = preferredRedisUrl;
let redis = new Redis(preferredRedisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  retryStrategy: () => null,
});

const matchSlotKey = "rl:test:token_schedule";
const rankSlotKey = "rl:test:token_schedule_rank";

let matchLimiter = createLuaRateLimiterForTests({
  redisClient: redis,
  slotKey: matchSlotKey,
  targetRatePerSec: matchTargetRatePerSec(500),
});

let rankLimiter = createLuaRateLimiterForTests({
  redisClient: redis,
  slotKey: rankSlotKey,
  targetRatePerSec: rankTargetRatePerSec(500),
});

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
  matchLimiter = createLuaRateLimiterForTests({
    redisClient: redis,
    slotKey: matchSlotKey,
    targetRatePerSec: matchTargetRatePerSec(500),
  });
  rankLimiter = createLuaRateLimiterForTests({
    redisClient: redis,
    slotKey: rankSlotKey,
    targetRatePerSec: rankTargetRatePerSec(500),
  });
  await matchLimiter.loadScript();
  await rankLimiter.loadScript();
});

beforeEach(async () => {
  matchLimiter.stopDrip();
  rankLimiter.stopDrip();
  await redis.del(matchSlotKey, rankSlotKey);
});

afterAll(async () => {
  matchLimiter.stopDrip();
  rankLimiter.stopDrip();
  if (redis.status === "ready") {
    await redis.del(matchSlotKey, rankSlotKey);
  }
  if (redis.status !== "end") {
    await redis.quit();
  }
});

describe("match scheduled slot rate limiter", () => {
  test("refuse quand pas assez de creneaux", async () => {
    await matchLimiter.seedSlots(10);

    const attempts = await Promise.all(
      Array.from({ length: 11 }, () => matchLimiter.tryAcquire(1)),
    );
    const passed = attempts.filter((a) => a.granted).length;
    const refused = attempts.filter((a) => !a.granted).length;

    expect(passed).toBe(10);
    expect(refused).toBe(1);
  });

  test("cout=2 consomme 2 creneaux", async () => {
    await matchLimiter.seedSlots(10);

    for (let i = 0; i < 5; i += 1) {
      const result = await matchLimiter.tryAcquire(2);
      expect(result.granted).toBe(true);
    }

    const denied = await matchLimiter.tryAcquire(2);
    expect(denied.granted).toBe(false);
  });

  test("idempotence : les refus ne consomment pas de creneaux", async () => {
    await matchLimiter.seedSlots(10);
    for (let i = 0; i < 10; i += 1) {
      await matchLimiter.tryAcquire(1);
    }

    for (let i = 0; i < 3; i += 1) {
      const denied = await matchLimiter.tryAcquire(1);
      expect(denied.granted).toBe(false);
    }

    expect(await redis.zcard(matchSlotKey)).toBe(0);

    await matchLimiter.seedSlots(10);
    let passedAfterReseed = 0;
    for (let i = 0; i < 10; i += 1) {
      const result = await matchLimiter.tryAcquire(1);
      if (result.granted) passedAfterReseed += 1;
    }
    expect(passedAfterReseed).toBe(10);
  });
});

describe("rank scheduled slot rate limiter", () => {
  test("retourne budget_exhausted sans creneau", async () => {
    const result = await rankLimiter.tryAcquireRankOnce();
    expect(result).toBe("budget_exhausted");
  });

  test("consomme un creneau rank quand disponible", async () => {
    await rankLimiter.seedSlots(1);
    const result = await rankLimiter.tryAcquireRankOnce();
    expect(result).toBe("ok");
    expect(await redis.zcard(rankSlotKey)).toBe(0);
  });

  test("drip rank alimente une file separee", async () => {
    rankLimiter.startDrip();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const count = await redis.zcard(rankSlotKey);
    rankLimiter.stopDrip();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(20);
  });

  test("cle rank production distincte", () => {
    expect(RANK_SLOT_KEY).toBe("rl:token_schedule_rank");
  });
});
