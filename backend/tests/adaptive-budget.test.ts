import { describe, expect, test } from "vitest";
import {
  computeAllocation,
  computeIdleBudgetReq120s,
  computeRankFillCount,
  DEFAULT_INITIAL_ALLOCATION,
  isSignificantAllocationChange,
  scorePipelines,
  shouldTriggerRankFill,
  totalBudgetReq120s,
  type PipelineSnapshot,
} from "../src/lib/adaptiveBudget.js";

function snapshots(
  overrides: Partial<Record<"discovery" | "hydration" | "rank", Partial<PipelineSnapshot>>> = {},
): Record<"discovery" | "hydration" | "rank", PipelineSnapshot> {
  const base: PipelineSnapshot = {
    queueWaiting: 0,
    queueActive: 0,
    tokensUsed120s: 0,
    currentAlloc: 0,
  };
  return {
    discovery: { ...base, ...overrides.discovery },
    hydration: { ...base, ...overrides.hydration },
    rank: { ...base, ...overrides.rank },
  };
}

describe("computeAllocation", () => {
  test("respects total budget ceiling", () => {
    const alloc = computeAllocation(
      snapshots({
        hydration: { queueWaiting: 500, queueActive: 8 },
        rank: { queueWaiting: 150 },
      }),
      90,
    );
    expect(alloc.totalReq).toBeLessThanOrEqual(90);
  });

  test("boosts discovery when hydration queue is starved", () => {
    const starved = computeAllocation(
      snapshots({ hydration: { queueWaiting: 5 } }),
      90,
    );
    const overloaded = computeAllocation(
      snapshots({ hydration: { queueWaiting: 500 } }),
      90,
    );
    expect(starved.discovery).toBeGreaterThan(overloaded.discovery);
  });

  test("boosts rank when backlog is critical", () => {
    const idle = computeAllocation(snapshots(), 90);
    const critical = computeAllocation(
      snapshots({ rank: { queueWaiting: 150 } }),
      90,
    );
    expect(critical.rank).toBeGreaterThan(idle.rank);
  });

  test("boosts rank when hydration waitingChildren is high", () => {
    const idle = computeAllocation(snapshots(), 90);
    const blocked = computeAllocation(
      snapshots({
        hydration: { hydrationWaitingChildren: 35, queueWaiting: 40 },
        rank: { queueWaiting: 0 },
      }),
      90,
    );
    expect(blocked.rank).toBeGreaterThan(idle.rank);
  });

  test("does not reclaim rank budget when hydration is blocked on rank children", () => {
    const blocked = computeAllocation(
      snapshots({
        hydration: { hydrationWaitingChildren: 35, queueWaiting: 40, tokensUsed120s: 1 },
        rank: { queueWaiting: 0, queueActive: 0, tokensUsed120s: 0 },
      }),
      90,
    );
    expect(blocked.rank).toBeGreaterThanOrEqual(20);
  });

  test("guarantees pipeline minimums", () => {
    const alloc = computeAllocation(
      snapshots({ hydration: { queueWaiting: 500 }, rank: { queueWaiting: 200 } }),
      90,
    );
    expect(alloc.discovery).toBeGreaterThanOrEqual(4);
    expect(alloc.hydration).toBeGreaterThanOrEqual(10);
    expect(alloc.rank).toBeGreaterThanOrEqual(6);
  });
});

describe("scorePipelines", () => {
  test("hydration overload throttles discovery score", () => {
    const scores = scorePipelines(
      snapshots({ hydration: { queueWaiting: 500 } }),
    );
    expect(scores.discovery).toBeLessThan(0.2);
    expect(scores.hydration).toBeGreaterThan(0.8);
  });

  test("waitingChildren boosts rank score when rank queue is empty", () => {
    const scores = scorePipelines(
      snapshots({
        hydration: { hydrationWaitingChildren: 35, queueWaiting: 40 },
        rank: { queueWaiting: 0, queueActive: 0 },
      }),
    );
    expect(scores.rank).toBe(1.0);
  });
});

describe("isSignificantAllocationChange", () => {
  test("ignores small deltas", () => {
    expect(
      isSignificantAllocationChange(
        DEFAULT_INITIAL_ALLOCATION,
        { ...DEFAULT_INITIAL_ALLOCATION, discovery: DEFAULT_INITIAL_ALLOCATION.discovery + 1 },
      ),
    ).toBe(false);
  });

  test("detects large deltas", () => {
    expect(
      isSignificantAllocationChange(
        DEFAULT_INITIAL_ALLOCATION,
        { ...DEFAULT_INITIAL_ALLOCATION, rank: DEFAULT_INITIAL_ALLOCATION.rank + 3 },
      ),
    ).toBe(true);
  });
});

describe("totalBudgetReq120s", () => {
  test("applies 98% margin on dev budget", () => {
    expect(totalBudgetReq120s(95)).toBe(93);
  });
});

describe("rank fill phase", () => {
  test("detects idle budget and calm queues", () => {
    const snap = snapshots({
      hydration: { queueWaiting: 0, queueActive: 2, tokensUsed120s: 10 },
      rank: { queueWaiting: 0, queueActive: 0, tokensUsed120s: 5 },
      discovery: { tokensUsed120s: 10 },
    });
    const idle = computeIdleBudgetReq120s(snap, 90);
    expect(idle).toBe(65);
    expect(shouldTriggerRankFill(snap, idle)).toBe(true);
  });

  test("does not fill when hydration has any waiting backlog", () => {
    const snap = snapshots({
      hydration: { queueWaiting: 5, queueActive: 8 },
      rank: { queueWaiting: 0, queueActive: 0 },
    });
    expect(shouldTriggerRankFill(snap, 40)).toBe(false);
  });

  test("does not fill when hydration is heavily backlogged", () => {
    const snap = snapshots({
      hydration: { queueWaiting: 100, queueActive: 8 },
      rank: { queueWaiting: 0, queueActive: 0 },
    });
    expect(shouldTriggerRankFill(snap, 40)).toBe(false);
  });

  test("does not fill when hydration pipeline is fully idle (no match supply)", () => {
    const snap = snapshots({
      hydration: { queueWaiting: 0, queueActive: 0, tokensUsed120s: 0 },
      rank: { queueWaiting: 0, queueActive: 6, tokensUsed120s: 12 },
      discovery: { tokensUsed120s: 18 },
    });
    expect(shouldTriggerRankFill(snap, 50)).toBe(false);
  });

  test("fills when rank workers are active but queue not saturated (steady-state)", () => {
    // Cas typique en runtime : 6 rank workers tournent en continu mais la queue
    // se vide à mesure. On doit quand même fill pour viser 94-98 req/120s constant.
    const snap = snapshots({
      hydration: { queueWaiting: 0, queueActive: 2, tokensUsed120s: 10 },
      rank: { queueWaiting: 0, queueActive: 6, tokensUsed120s: 12 },
      discovery: { tokensUsed120s: 18 },
    });
    expect(shouldTriggerRankFill(snap, 50)).toBe(true);
  });

  test("does not fill when rank queue is critically backlogged", () => {
    const snap = snapshots({
      hydration: { queueWaiting: 0 },
      rank: { queueWaiting: 150 },
    });
    expect(shouldTriggerRankFill(snap, 50)).toBe(false);
  });

  test("caps fill count to half idle budget and rank alloc", () => {
    expect(computeRankFillCount(30, { discovery: 8, hydration: 20, rank: 14, totalReq: 62 })).toBe(
      14,
    );
    expect(computeRankFillCount(8, { discovery: 8, hydration: 20, rank: 14, totalReq: 62 })).toBe(4);
  });
});

describe("rank existing jobs delay", () => {
  test("scales with pending count and rank allocation", async () => {
    const { computeRankExistingJobsDelayMs, computeRankGateWaitMs } = await import(
      "../src/queues/rank-jobs-shared.js"
    );
    const small = computeRankExistingJobsDelayMs(2, 30);
    const large = computeRankExistingJobsDelayMs(20, 30);
    expect(small).toBeGreaterThanOrEqual(5_000);
    expect(large).toBeGreaterThan(small);
    expect(computeRankGateWaitMs(8, 30)).toBeGreaterThanOrEqual(45_000);
  });
});
