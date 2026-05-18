import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

process.env.ENV ||= "dev";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/riot_db";
process.env.RIOT_API_KEY ||= "RGAPI-test";

const {
  advanceDripAccumulator,
  createLuaRateLimiterForTests,
  discoveryTargetRatePerSec,
  hydrationTargetRatePerSec,
  rankTargetRatePerSec,
  RANK_SLOT_KEY,
  HYDRATION_SLOT_KEY,
  DISCOVERY_SLOT_KEY,
  totalTargetRatePerSec,
} = await import("../src/redis/rate-scheduler.js");

const preferredRedisUrl = process.env.REDIS_TEST_URL || "redis://localhost:6380";
const fallbackRedisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let activeRedisUrl = preferredRedisUrl;
let redis = new Redis(preferredRedisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  retryStrategy: () => null,
});

const discoverySlotKey = "rl:test:slots:discovery";
const hydrationSlotKey = "rl:test:slots:hydration";
const rankSlotKey = "rl:test:slots:rank";

let discoveryLimiter = createLuaRateLimiterForTests({
  redisClient: redis,
  slotKey: discoverySlotKey,
  targetRatePerSec: discoveryTargetRatePerSec(500),
});

let hydrationLimiter = createLuaRateLimiterForTests({
  redisClient: redis,
  slotKey: hydrationSlotKey,
  targetRatePerSec: hydrationTargetRatePerSec(500),
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
  discoveryLimiter = createLuaRateLimiterForTests({
    redisClient: redis,
    slotKey: discoverySlotKey,
    targetRatePerSec: discoveryTargetRatePerSec(500),
  });
  hydrationLimiter = createLuaRateLimiterForTests({
    redisClient: redis,
    slotKey: hydrationSlotKey,
    targetRatePerSec: hydrationTargetRatePerSec(500),
  });
  rankLimiter = createLuaRateLimiterForTests({
    redisClient: redis,
    slotKey: rankSlotKey,
    targetRatePerSec: rankTargetRatePerSec(500),
  });
  await discoveryLimiter.loadScript();
  await hydrationLimiter.loadScript();
  await rankLimiter.loadScript();
});

beforeEach(async () => {
  discoveryLimiter.stopDrip();
  hydrationLimiter.stopDrip();
  rankLimiter.stopDrip();
  await redis.del(discoverySlotKey, hydrationSlotKey, rankSlotKey);
});

afterAll(async () => {
  discoveryLimiter.stopDrip();
  hydrationLimiter.stopDrip();
  rankLimiter.stopDrip();
  if (redis.status === "ready") {
    await redis.del(discoverySlotKey, hydrationSlotKey, rankSlotKey);
  }
  if (redis.status !== "end") {
    await redis.quit();
  }
});

describe("budget allocation", () => {
  test("les trois budgets somment à totalTargetRate", () => {
    const total = totalTargetRatePerSec(95);
    const sum =
      discoveryTargetRatePerSec(95) +
      hydrationTargetRatePerSec(95) +
      rankTargetRatePerSec(95);
    expect(sum).toBeCloseTo(total, 5);
  });

  test("clés Redis de production", () => {
    expect(DISCOVERY_SLOT_KEY).toBe("rl:slots:discovery");
    expect(HYDRATION_SLOT_KEY).toBe("rl:slots:hydration");
    expect(RANK_SLOT_KEY).toBe("rl:slots:rank");
  });
});

describe("drip accumulator", () => {
  test("~1 slot après 7 ticks à 200ms (dev total rate)", () => {
    const targetRate = totalTargetRatePerSec(95);
    let acc = 0;
    let totalSlots = 0;
    for (let i = 0; i < 7; i += 1) {
      const step = advanceDripAccumulator(acc, targetRate, 200);
      acc = step.accumulator;
      totalSlots += step.slotsToAdd;
    }
    expect(totalSlots).toBe(1);
    expect(acc).toBeGreaterThan(0);
    expect(acc).toBeLessThan(1);
  });

  test("~87 slots sur 120s de ticks (pas ~600 avec Math.ceil)", () => {
    const targetRate = totalTargetRatePerSec(95);
    const ticksIn120s = 120_000 / 200;
    let acc = 0;
    let totalSlots = 0;
    for (let i = 0; i < ticksIn120s; i += 1) {
      const step = advanceDripAccumulator(acc, targetRate, 200);
      acc = step.accumulator;
      totalSlots += step.slotsToAdd;
    }
    expect(totalSlots).toBeGreaterThanOrEqual(85);
    expect(totalSlots).toBeLessThanOrEqual(90);
  });

  test("la plupart des ticks n’ajoutent aucun slot", () => {
    const targetRate = totalTargetRatePerSec(95);
    let acc = 0;
    let zeroTicks = 0;
    for (let i = 0; i < 20; i += 1) {
      const step = advanceDripAccumulator(acc, targetRate, 200);
      acc = step.accumulator;
      if (step.slotsToAdd === 0) zeroTicks += 1;
    }
    expect(zeroTicks).toBeGreaterThanOrEqual(15);
  });
});

describe("hydration scheduled slot rate limiter", () => {
  test("refuse quand pas assez de creneaux (cost 1)", async () => {
    await hydrationLimiter.seedSlots(10);

    const attempts = await Promise.all(
      Array.from({ length: 11 }, () => hydrationLimiter.tryAcquire(1)),
    );
    expect(attempts.filter((a) => a.granted).length).toBe(10);
    expect(attempts.filter((a) => !a.granted).length).toBe(1);
  });

  test("cout=2 consomme 2 creneaux", async () => {
    await hydrationLimiter.seedSlots(10);

    for (let i = 0; i < 5; i += 1) {
      expect((await hydrationLimiter.tryAcquire(2)).granted).toBe(true);
    }

    expect((await hydrationLimiter.tryAcquire(2)).granted).toBe(false);
  });
});

describe("rank scheduled slot rate limiter", () => {
  test("retourne budget_exhausted sans creneau", async () => {
    expect(await rankLimiter.tryAcquireRankOnce()).toBe("budget_exhausted");
  });

  test("consomme un creneau rank quand disponible", async () => {
    await rankLimiter.seedSlots(1);
    expect(await rankLimiter.tryAcquireRankOnce()).toBe("ok");
    expect(await redis.zcard(rankSlotKey)).toBe(0);
  });

  test(
    "drip rank alimente une file separee",
    async () => {
      rankLimiter.startDrip();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const count = await redis.zcard(rankSlotKey);
      rankLimiter.stopDrip();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(20);
    },
    10_000,
  );
});
