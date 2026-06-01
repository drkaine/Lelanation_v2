/**
 * Trois drips Redis (discovery / hydration / rank) planifiés sur WINDOW_MS.
 *
 * Budget + intervals : computeDripBudgetConfig() in rate-budget.ts (single source).
 * Drip token ticks use discoveryIntervalMs / hydrationTokenIntervalMs / rankIntervalMs.
 * Cooldown 429 global bloque les 3 pipelines.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";
import type { BudgetAllocation } from "../lib/adaptiveBudget.js";
import {
  applyCurrentBudgetAllocation,
  currentBudgetAllocationRef,
} from "./budget-allocation-ref.js";
import {
  apiTokenBudgetForPipeline,
  computeDripBudgetConfig,
  dripIntervalMsForPipeline,
  getEffectiveBudgetBreakdown,
  hydrationJobIntervalMs,
  SLOT_COSTS,
  WINDOW_MS,
  type SlotPipeline,
} from "./rate-budget.js";
import { redis } from "./client.js";

export {
  DISCOVERY_BUDGET_RATIO,
  HYDRATION_BUDGET_RATIO,
  RANK_BUDGET_RATIO,
  computeDripBudgetConfig,
  getEffectiveBudgetBreakdown,
  SLOT_COSTS,
  WINDOW_MS,
  type DripBudgetConfig,
  type EffectiveBudgetBreakdown,
  type SlotPipeline,
} from "./rate-budget.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACQUIRE_SLOT_LUA = readFileSync(join(__dirname, "lua", "acquire-slot.lua"), "utf8");

export const TARGET_PCT = 0.98;

/** API tokens / 120s at dev budget 95 (derived from ratio split). */
export const SLOT_BUDGETS_REF = (() => {
  const b = getEffectiveBudgetBreakdown(95);
  return {
    discovery: b.discoverySlots,
    hydration: b.hydrationSlots * SLOT_COSTS.hydration,
    rank: b.rankSlots,
  };
})();

/** Alias explicite Phase 4. */
export const SLOT_TOKENS = SLOT_BUDGETS_REF;

const SLOT_BUDGET_WINDOW_SEC = WINDOW_MS / 1000;

export const DISCOVERY_SLOT_KEY = "rl:slots:discovery";
export const HYDRATION_SLOT_KEY = "rl:slots:hydration";
export const RANK_SLOT_KEY = "rl:slots:rank";

/** @deprecated use HYDRATION_SLOT_KEY */
export const MATCH_SLOT_KEY = HYDRATION_SLOT_KEY;
/** @deprecated use DISCOVERY_SLOT_KEY or HYDRATION_SLOT_KEY */
export const SLOT_KEY = HYDRATION_SLOT_KEY;

const GLOBAL_COOLDOWN_KEY = "rl:app:global-cooldown";
const MAX_LOOKAHEAD_MS = 8000;
/** Tick simulateur tests (accumulateur fractionnaire). */
const TEST_DRIP_TICK_MS = 200;

let acquireSlotSha: string | null = null;
const dripIntervals: NodeJS.Timeout[] = [];

type ActiveDrip = {
  slotKey: string;
  interval: NodeJS.Timeout;
  tokenIntervalMs: number;
};

const activeDrips = new Map<SlotPipeline, ActiveDrip>();

export type RankSlotResult = "ok" | "budget_exhausted";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slotBudgetForPipeline(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  return apiTokenBudgetForPipeline(pipeline, rateLimitPer120s);
}

export function totalSlotBudgetPer120s(
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  return computeDripBudgetConfig(rateLimitPer120s).totalReqPer120s;
}

export function totalTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return totalSlotBudgetPer120s(rateLimitPer120s) / SLOT_BUDGET_WINDOW_SEC;
}

export function discoveryTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return slotBudgetForPipeline("discovery", rateLimitPer120s) / SLOT_BUDGET_WINDOW_SEC;
}

export function hydrationTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return slotBudgetForPipeline("hydration", rateLimitPer120s) / SLOT_BUDGET_WINDOW_SEC;
}

export function rankTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return slotBudgetForPipeline("rank", rateLimitPer120s) / SLOT_BUDGET_WINDOW_SEC;
}

/** Intervalle entre deux tokens individuels dans le zset Redis. */
export function tokenReleaseIntervalMs(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  const active = activeDrips.get(pipeline);
  if (active) {
    return active.tokenIntervalMs;
  }
  return dripIntervalMsForPipeline(pipeline, rateLimitPer120s);
}

/** Intervalle entre deux jobs worker hydration (coût 2 tokens). */
export function jobReleaseIntervalMs(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  if (pipeline === "hydration") {
    const active = activeDrips.get("hydration");
    if (active) {
      return active.tokenIntervalMs * SLOT_COSTS.hydration;
    }
    return hydrationJobIntervalMs(rateLimitPer120s);
  }
  return tokenReleaseIntervalMs(pipeline, rateLimitPer120s);
}

function slotIntervalMs(targetRatePerSec: number): number {
  return 1000 / targetRatePerSec;
}

export function advanceDripAccumulator(
  accumulator: number,
  targetRatePerSec: number,
  dripIntervalMs = TEST_DRIP_TICK_MS,
): { accumulator: number; slotsToAdd: number } {
  const tokensPerInterval = (targetRatePerSec * dripIntervalMs) / 1000;
  const next = accumulator + tokensPerInterval;
  const slotsToAdd = Math.floor(next);
  return { accumulator: next - slotsToAdd, slotsToAdd };
}

function slotMemberPrefix(slotKey: string): string {
  if (slotKey === DISCOVERY_SLOT_KEY) return "d";
  if (slotKey === HYDRATION_SLOT_KEY) return "h";
  if (slotKey === RANK_SLOT_KEY) return "r";
  return "s";
}

function pipelineForSlotKey(slotKey: string): SlotPipeline {
  if (slotKey === DISCOVERY_SLOT_KEY) return "discovery";
  if (slotKey === HYDRATION_SLOT_KEY) return "hydration";
  return "rank";
}

async function evalAcquireSlot(
  slotKey: string,
  cost: 1 | 2,
  nowMs: number,
): Promise<[number, number]> {
  if (!acquireSlotSha) {
    await loadLuaScript();
  }

  const args = [slotKey, cost.toString(), nowMs.toString()] as const;

  try {
    return (await redis.evalsha(acquireSlotSha as string, 1, ...args)) as [number, number];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("NOSCRIPT")) {
      throw error;
    }

    acquireSlotSha = (await redis.script("LOAD", ACQUIRE_SLOT_LUA)) as string;
    return (await redis.eval(ACQUIRE_SLOT_LUA, 1, ...args)) as [number, number];
  }
}

async function getGlobalCooldownMs(): Promise<number> {
  const ttl = await redis.pttl(GLOBAL_COOLDOWN_KEY);
  return ttl > 0 ? ttl : 0;
}

async function runUniformDripTick(slotKey: string, tokenIntervalMs: number): Promise<void> {
  const now = Date.now();
  const maxFutureTs = now + MAX_LOOKAHEAD_MS;

  const last = await redis.zrange(slotKey, -1, -1, "WITHSCORES");
  let scheduleFromTs = last.length >= 2 ? Number.parseFloat(last[1]!) : now - tokenIntervalMs;
  if (scheduleFromTs + tokenIntervalMs > maxFutureTs) {
    scheduleFromTs = maxFutureTs - tokenIntervalMs;
  }

  const ts = scheduleFromTs + tokenIntervalMs;
  const queueDepth = await redis.zcard(slotKey);

  if (process.env.RATE_SCHEDULER_DEBUG === "1") {
    console.debug(
      JSON.stringify({
        msg: "drip_tick",
        slotKey,
        scheduleFromTs,
        tokenIntervalMs: Math.round(tokenIntervalMs * 100) / 100,
        nextTokenTs: ts,
        queueDepth,
      }),
    );
  }

  if (ts > maxFutureTs) {
    await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
    return;
  }

  const prefix = slotMemberPrefix(slotKey);
  await redis.zadd(slotKey, ts, `${prefix}:${ts.toFixed(0)}:0`);

  if (process.env.RATE_SCHEDULER_DEBUG === "1") {
    console.debug(
      JSON.stringify({
        msg: "drip_tick_added",
        slotKey,
        slotsAdded: 1,
      }),
    );
  }

  await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
}

function slotKeyForPipeline(pipeline: SlotPipeline): string {
  if (pipeline === "discovery") return DISCOVERY_SLOT_KEY;
  if (pipeline === "hydration") return HYDRATION_SLOT_KEY;
  return RANK_SLOT_KEY;
}

function stopPipelineDrip(pipeline: SlotPipeline): void {
  const active = activeDrips.get(pipeline);
  if (!active) return;
  clearInterval(active.interval);
  activeDrips.delete(pipeline);
  const idx = dripIntervals.indexOf(active.interval);
  if (idx >= 0) {
    dripIntervals.splice(idx, 1);
  }
}

function startDripForKey(slotKey: string, tokenIntervalMs: number): void {
  void runUniformDripTick(slotKey, tokenIntervalMs).catch((error) => {
    console.error(`[rate-scheduler] drip tick failed key=${slotKey}`, error);
  });

  const interval = setInterval(() => {
    void runUniformDripTick(slotKey, tokenIntervalMs).catch((error) => {
      console.error(`[rate-scheduler] drip tick failed key=${slotKey}`, error);
    });
  }, tokenIntervalMs);

  dripIntervals.push(interval);
}

function startDripForPipeline(pipeline: SlotPipeline, tokenIntervalMs: number): void {
  stopPipelineDrip(pipeline);
  const slotKey = slotKeyForPipeline(pipeline);
  startDripForKey(slotKey, tokenIntervalMs);
  const interval = dripIntervals[dripIntervals.length - 1];
  if (interval) {
    activeDrips.set(pipeline, { slotKey, interval, tokenIntervalMs });
  }
}

/** Met à jour le drip d'un pipeline (units/120s ; hydration = matchs, pas req). */
export function setDripRate(
  pipeline: SlotPipeline,
  unitsPer120s: number,
  costPerJob: 1 | 2 = SLOT_COSTS[pipeline],
): void {
  const safeUnits = Math.max(1, Math.trunc(unitsPer120s));
  const tokensPer120s = pipeline === "hydration" ? safeUnits * costPerJob : safeUnits;
  const tokenIntervalMs = Math.ceil(WINDOW_MS / tokensPer120s);
  startDripForPipeline(pipeline, tokenIntervalMs);
}

export type RuntimeBudgetAllocation = BudgetAllocation;

export async function applyBudgetAllocation(alloc: RuntimeBudgetAllocation): Promise<void> {
  applyCurrentBudgetAllocation(alloc);
  setDripRate("discovery", alloc.discovery, 1);
  setDripRate("hydration", alloc.hydration, 2);
  setDripRate("rank", alloc.rank, 1);
}

export function getCurrentBudgetAllocation(): BudgetAllocation {
  return currentBudgetAllocationRef;
}

export { currentBudgetAllocationRef } from "./budget-allocation-ref.js";

export async function loadLuaScript(): Promise<void> {
  acquireSlotSha = (await redis.script("LOAD", ACQUIRE_SLOT_LUA)) as string;
}

export function startDrip(): void {
  if (dripIntervals.length > 0) {
    return;
  }

  const cfg = computeDripBudgetConfig();
  setDripRate("discovery", cfg.discoverySlots, 1);
  setDripRate("hydration", cfg.hydrationSlots, 2);
  setDripRate("rank", cfg.rankSlots, 1);
  applyCurrentBudgetAllocation({
    discovery: cfg.discoverySlots,
    hydration: cfg.hydrationSlots,
    rank: cfg.rankSlots,
    totalReq: cfg.totalReqPer120s,
  });

  console.log(
    `[rate-scheduler] drip started:\n` +
      `  discovery=${cfg.discoverySlots} slots → 1 token/${cfg.discoveryIntervalMs}ms\n` +
      `  hydration=${cfg.hydrationSlots} matches → 1 job/${cfg.hydrationIntervalMs}ms\n` +
      `  rank=${cfg.rankSlots} tokens → 1 token/${cfg.rankIntervalMs}ms\n` +
      `  total req/120s budget=${cfg.budget} (allocated ${cfg.totalReqPer120s})`,
  );
}

export function stopDrip(): void {
  for (const pipeline of ["discovery", "hydration", "rank"] as SlotPipeline[]) {
    stopPipelineDrip(pipeline);
  }
  while (dripIntervals.length > 0) {
    const interval = dripIntervals.pop();
    if (interval) {
      clearInterval(interval);
    }
  }
  activeDrips.clear();
}

/** Sleep entre tentatives acquireSlot — lit l'allocation courante à chaque appel. */
export function getDripSleepMs(
  pipeline: SlotPipeline,
  allocation: BudgetAllocation = currentBudgetAllocationRef,
): number {
  const tokensPer120s =
    pipeline === "hydration"
      ? Math.max(1, allocation.hydration * SLOT_COSTS.hydration)
      : Math.max(1, allocation[pipeline]);
  const msPerToken = WINDOW_MS / tokensPer120s;
  return Math.max(250, Math.min(15_000, Math.floor(msPerToken * 0.85)));
}

function deniedSlotWaitMs(pipeline: SlotPipeline, luaWaitMs: number): number {
  const safeLuaWait = Math.max(0, Math.trunc(luaWaitMs));
  const dripWait = getDripSleepMs(pipeline);
  const base = Math.max(safeLuaWait, dripWait);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

async function waitForScheduledSlot(slotKey: string, cost: 1 | 2): Promise<void> {
  const pipeline = pipelineForSlotKey(slotKey);
  let attempts = 0;

  while (true) {
    const globalCooldownMs = await getGlobalCooldownMs();
    if (globalCooldownMs > 0) {
      await sleep(globalCooldownMs + 10);
      continue;
    }

    const now = Date.now();
    const [allowed, value] = await evalAcquireSlot(slotKey, cost, now);

    if (allowed === 1) {
      const delay = value - Date.now();
      if (attempts > 0 && process.env.RATE_SCHEDULER_DEBUG === "1") {
        console.debug(
          JSON.stringify({
            msg: "slot_acquired",
            pipeline,
            attempts,
          }),
        );
      }
      if (delay > 5) {
        await sleep(delay);
      }
      return;
    }

    attempts += 1;
    const waitMs = deniedSlotWaitMs(pipeline, value);
    await sleep(waitMs);
  }
}

/** discovery.worker — coût 1, attend le créneau (boucle courte Redis). */
export async function waitForDiscoverySlot(): Promise<void> {
  await waitForScheduledSlot(DISCOVERY_SLOT_KEY, 1);
}

/** hydration.worker — coût 2, attend le créneau (boucle courte Redis). */
export async function waitForHydrationSlot(): Promise<void> {
  await waitForScheduledSlot(HYDRATION_SLOT_KEY, 2);
}

/**
 * Un essai d’acquisition rank (sans attente). `waitMs` = délai jusqu’au prochain créneau si refusé,
 * ou délai de planification si accordé (appliqué avant l’appel API par le worker).
 */
export async function acquireRankSlot(): Promise<{ granted: boolean; waitMs: number }> {
  const globalCooldownMs = await getGlobalCooldownMs();
  if (globalCooldownMs > 0) {
    return { granted: false, waitMs: globalCooldownMs };
  }

  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(RANK_SLOT_KEY, 1, now);

  if (allowed === 1) {
    const delay = Math.max(0, value - now);
    if (delay > 5) {
      await sleep(delay);
    }
    return { granted: true, waitMs: 0 };
  }

  const waitMs = deniedSlotWaitMs("rank", value);
  await sleep(waitMs);
  return { granted: false, waitMs: 0 };
}

/** rank.worker — coût 1, attend le créneau (boucle courte Redis + cooldown 429 global). */
export async function waitForRankSlot(): Promise<void> {
  await waitForScheduledSlot(RANK_SLOT_KEY, 1);
}

/** @deprecated use waitForDiscoverySlot or waitForHydrationSlot */
export async function waitForMatchSlot(cost: 1 | 2): Promise<void> {
  if (cost === 1) {
    await waitForDiscoverySlot();
    return;
  }
  await waitForHydrationSlot();
}

/** @deprecated use waitForHydrationSlot */
export const waitForSlot = waitForMatchSlot;

export async function tryAcquireSlot(cost: 1 | 2): Promise<{ granted: boolean; waitMs: number }> {
  const slotKey = cost === 1 ? DISCOVERY_SLOT_KEY : HYDRATION_SLOT_KEY;
  const pipeline = pipelineForSlotKey(slotKey);
  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(slotKey, cost, now);
  const granted = allowed === 1;
  const waitMs = granted
    ? Math.max(0, value - now)
    : deniedSlotWaitMs(pipeline, value);
  return { granted, waitMs };
}

export async function setGlobalRateLimitCooldown(waitMs: number): Promise<void> {
  const safeWaitMs = Math.max(0, Math.trunc(waitMs));
  if (safeWaitMs <= 0) return;
  await redis.set(GLOBAL_COOLDOWN_KEY, "1", "PX", safeWaitMs);
}

export function createLuaRateLimiterForTests(params: {
  redisClient: {
    script: (command: string, script: string) => Promise<string>;
    evalsha: (...args: unknown[]) => Promise<unknown>;
    eval: (...args: unknown[]) => Promise<unknown>;
    zrange: (...args: unknown[]) => Promise<string[]>;
    zadd: (...args: unknown[]) => Promise<unknown>;
    zremrangebyscore: (...args: unknown[]) => Promise<unknown>;
    del: (...args: unknown[]) => Promise<unknown>;
  };
  slotKey: string;
  targetRatePerSec: number;
}) {
  let sha: string | null = null;
  let testDripInterval: NodeJS.Timeout | null = null;
  let testDripAccumulator = 0;

  async function loadScript(): Promise<void> {
    sha = (await params.redisClient.script("LOAD", ACQUIRE_SLOT_LUA)) as string;
  }

  async function evalSlot(cost: 1 | 2, nowMs: number): Promise<[number, number]> {
    if (!sha) {
      await loadScript();
    }

    const args = [params.slotKey, cost.toString(), nowMs.toString()] as const;

    try {
      return (await params.redisClient.evalsha(sha as string, 1, ...args)) as [number, number];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("NOSCRIPT")) {
        throw error;
      }
      sha = (await params.redisClient.script("LOAD", ACQUIRE_SLOT_LUA)) as string;
      return (await params.redisClient.eval(ACQUIRE_SLOT_LUA, 1, ...args)) as [number, number];
    }
  }

  async function runTestDripTick(): Promise<void> {
    const now = Date.now();
    const maxFutureTs = now + MAX_LOOKAHEAD_MS;
    const intervalMs = slotIntervalMs(params.targetRatePerSec);

    const last = await params.redisClient.zrange(params.slotKey, -1, -1, "WITHSCORES");
    let scheduleFromTs = last.length >= 2 ? Number.parseFloat(last[1]!) : now - intervalMs;
    if (scheduleFromTs + intervalMs > maxFutureTs) {
      scheduleFromTs = maxFutureTs - intervalMs;
    }

    const advanced = advanceDripAccumulator(testDripAccumulator, params.targetRatePerSec);
    testDripAccumulator = advanced.accumulator;
    const slotsToAdd = advanced.slotsToAdd;

    if (slotsToAdd <= 0) {
      await params.redisClient.zremrangebyscore(params.slotKey, "-inf", now - 5000);
      return;
    }

    const zaddArgs: Array<string | number> = [];
    for (let i = 1; i <= slotsToAdd; i += 1) {
      const ts = scheduleFromTs + intervalMs * i;
      if (ts > maxFutureTs) {
        break;
      }
      zaddArgs.push(ts, `s:${ts.toFixed(0)}:${i}`);
    }

    if (zaddArgs.length > 0) {
      await params.redisClient.zadd(params.slotKey, ...zaddArgs);
    }

    await params.redisClient.zremrangebyscore(params.slotKey, "-inf", now - 5000);
  }

  return {
    loadScript,
    async tryAcquire(cost: 1 | 2): Promise<{ granted: boolean; waitMs: number }> {
      const now = Date.now();
      const [allowed, value] = await evalSlot(cost, now);
      const granted = allowed === 1;
      return {
        granted,
        waitMs: granted ? Math.max(0, value - now) : Math.max(value, 0),
      };
    },
    async tryAcquireRankOnce(): Promise<RankSlotResult> {
      const now = Date.now();
      const [allowed, value] = await evalSlot(1, now);
      if (allowed !== 1) {
        return "budget_exhausted";
      }
      const delay = value - now;
      if (delay > 5) {
        await sleep(delay);
      }
      return "ok";
    },
    async seedSlots(count: number, startTs = Date.now(), spacingMs = 1): Promise<void> {
      const zaddArgs: Array<string | number> = [];
      for (let i = 0; i < count; i += 1) {
        const ts = startTs + spacingMs * i;
        zaddArgs.push(ts, `s:seed:${ts}:${i}`);
      }
      if (zaddArgs.length > 0) {
        await params.redisClient.zadd(params.slotKey, ...zaddArgs);
      }
    },
    startDrip(): void {
      if (testDripInterval) {
        return;
      }
      void runTestDripTick();
      testDripInterval = setInterval(() => {
        void runTestDripTick();
      }, TEST_DRIP_TICK_MS);
    },
    stopDrip(): void {
      if (!testDripInterval) {
        return;
      }
      clearInterval(testDripInterval);
      testDripInterval = null;
      testDripAccumulator = 0;
    },
    slotIntervalMs: () => slotIntervalMs(params.targetRatePerSec),
  };
}
