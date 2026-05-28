import { describe, expect, test } from "vitest";
import { isSignificantAllocationChange, smoothPipelineSnapshots } from "../src/lib/adaptiveBudget.js";
import { computeRankExistingJobsDelayMs } from "../src/queues/rank-jobs-shared.js";
import {
  cachedRankValidForMatchDate,
  clearRankCacheL1ForTests,
  readRankCacheL1,
  writeRankCacheL1,
} from "../src/redis/rank-cache.js";
import {
  getRiotTokenBucketSnapshot,
  resetRiotTokenBucketsForTests,
} from "../src/redis/riot-token-bucket.js";
import { rankInflightKey } from "../src/services/rank-inflight.js";

describe("rank inflight key", () => {
  test("is stable per puuid/region/date", () => {
    expect(rankInflightKey("abc", "euw1", "2026-05-22")).toBe("euw1:abc:2026-05-22");
  });
});

describe("computeRankExistingJobsDelayMs", () => {
  test("scales with pending count and rank allocation", () => {
    const small = computeRankExistingJobsDelayMs(2, 30);
    const large = computeRankExistingJobsDelayMs(20, 30);
    expect(small).toBeGreaterThanOrEqual(5_000);
    expect(large).toBeGreaterThan(small);
  });
});

describe("adaptive budget stability", () => {
  test("requires 20% change for rebalance significance", () => {
    const prev = { discovery: 10, hydration: 20, rank: 30, totalReq: 90 };
    const minor = { discovery: 11, hydration: 20, rank: 30, totalReq: 91 };
    const major = { discovery: 6, hydration: 20, rank: 33, totalReq: 86 };
    expect(isSignificantAllocationChange(prev, minor)).toBe(false);
    expect(isSignificantAllocationChange(prev, major)).toBe(true);
  });

  test("smooths queue signals with EMA", () => {
    const ema = { discovery: {}, hydration: {}, rank: {} };
    const raw = {
      discovery: { queueWaiting: 100, queueActive: 1, tokensUsed120s: 5, currentAlloc: 6 },
      hydration: {
        queueWaiting: 200,
        queueActive: 8,
        tokensUsed120s: 40,
        currentAlloc: 22,
        hydrationWaitingChildren: 500,
      },
      rank: { queueWaiting: 0, queueActive: 6, tokensUsed120s: 33, currentAlloc: 33 },
    };
    const first = smoothPipelineSnapshots(raw, ema, 0.5);
    expect(first.hydration.queueWaiting).toBe(200);
    const second = smoothPipelineSnapshots(
      {
        ...raw,
        hydration: { ...raw.hydration, queueWaiting: 0, hydrationWaitingChildren: 0 },
      },
      ema,
      0.5,
    );
    expect(second.hydration.queueWaiting).toBe(100);
  });
});

describe("riot token bucket", () => {
  test("exposes remaining tokens snapshot", () => {
    resetRiotTokenBucketsForTests();
    const snap = getRiotTokenBucketSnapshot();
    expect(snap.bucket_1s_remaining).toBeGreaterThan(0);
    expect(snap.bucket_120s_remaining).toBeGreaterThan(0);
  });
});

describe("rank cache", () => {
  test("L1 cache read/write and match date validation", () => {
    clearRankCacheL1ForTests();
    writeRankCacheL1("p1", "EUW1", {
      rankTier: "GOLD",
      rankDivision: "II",
      rankLp: 50,
      snapshotDate: "2026-05-22",
      cachedAtMs: Date.now(),
    });
    expect(readRankCacheL1("p1", "EUW1", "2026-05-22")?.rankTier).toBe("GOLD");
    expect(
      cachedRankValidForMatchDate(
        {
          rankTier: "GOLD",
          rankDivision: "II",
          rankLp: 50,
          snapshotDate: "2026-05-22",
          cachedAtMs: 0,
        },
        "2026-05-20",
      ),
    ).toBe(true);
  });

  test("accepts snapshot up to RANK_CACHE_GRACE_DAYS days before matchDate", () => {
    const snapshot = {
      rankTier: "PLATINUM",
      rankDivision: "I",
      rankLp: 75,
      snapshotDate: "2026-05-22",
      cachedAtMs: 0,
    };
    expect(cachedRankValidForMatchDate(snapshot, "2026-05-25")).toBe(true);
    expect(cachedRankValidForMatchDate(snapshot, "2026-05-29")).toBe(true);
    expect(cachedRankValidForMatchDate(snapshot, "2026-05-30")).toBe(false);
  });

  test("custom graceDays override", () => {
    const snapshot = {
      rankTier: "DIAMOND",
      rankDivision: "II",
      rankLp: 10,
      snapshotDate: "2026-05-20",
      cachedAtMs: 0,
    };
    expect(cachedRankValidForMatchDate(snapshot, "2026-05-23", 2)).toBe(false);
    expect(cachedRankValidForMatchDate(snapshot, "2026-05-22", 2)).toBe(true);
  });
});
