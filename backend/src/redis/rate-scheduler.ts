/**
 * Trois drips Redis (discovery / hydration / rank) sur 98 req/120s (dev ref) :
 *
 *   tokenReleaseIntervalMs = WINDOW_MS / tokens
 *   // discovery 1/20s · hydration 1 token/1.6s (job cost 2 ≈ /3.2s) · rank 1/6.7s
 *
 * Production : 1 token par tick de timer (pas de rafale accumulateur).
 * Cooldown 429 global bloque les 3 pipelines.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { redis } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACQUIRE_SLOT_LUA = readFileSync(join(__dirname, "lua", "acquire-slot.lua"), "utf8");

export const TARGET_PCT = 0.95;

/** Fenêtre glissante Riot (ms). */
export const WINDOW_MS = 120_000;

/** Tokens API par pipeline sur WINDOW_MS (clé dev ref 95 req/120s). */
export const SLOT_BUDGETS_REF = {
  discovery: 6,
  hydration: 74,
  rank: 18,
} as const;

/** Alias explicite Phase 4. */
export const SLOT_TOKENS = SLOT_BUDGETS_REF;

/** Coût Riot par job worker. */
export const SLOT_COSTS = {
  discovery: 1,
  hydration: 2,
  rank: 1,
} as const;

const SLOT_BUDGETS_REF_RATE_LIMIT_120S = 95;
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

export type RankSlotResult = "ok" | "budget_exhausted";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SlotPipeline = keyof typeof SLOT_BUDGETS_REF;

export function slotBudgetForPipeline(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  const refBudget = SLOT_BUDGETS_REF[pipeline];
  const scaled =
    (refBudget * rateLimitPer120s) / SLOT_BUDGETS_REF_RATE_LIMIT_120S;
  return Math.max(1, Math.round(scaled));
}

export function totalSlotBudgetPer120s(
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  return (
    slotBudgetForPipeline("discovery", rateLimitPer120s) +
    slotBudgetForPipeline("hydration", rateLimitPer120s) +
    slotBudgetForPipeline("rank", rateLimitPer120s)
  );
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
  const tokens = slotBudgetForPipeline(pipeline, rateLimitPer120s);
  return WINDOW_MS / tokens;
}

/** Intervalle entre deux jobs worker (coût SLOT_COSTS). */
export function jobReleaseIntervalMs(
  pipeline: SlotPipeline,
  rateLimitPer120s = config.RATE_LIMIT_PER_120S,
): number {
  const tokens = slotBudgetForPipeline(pipeline, rateLimitPer120s);
  const cost = SLOT_COSTS[pipeline];
  return WINDOW_MS / (tokens / cost);
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

function startDripForKey(slotKey: string, pipeline: SlotPipeline): void {
  const tokenIntervalMs = tokenReleaseIntervalMs(pipeline);

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

export async function loadLuaScript(): Promise<void> {
  acquireSlotSha = (await redis.script("LOAD", ACQUIRE_SLOT_LUA)) as string;
}

export function startDrip(): void {
  if (dripIntervals.length > 0) {
    return;
  }

  const discoveryRate = discoveryTargetRatePerSec();
  const hydrationRate = hydrationTargetRatePerSec();
  const rankRate = rankTargetRatePerSec();

  startDripForKey(DISCOVERY_SLOT_KEY, "discovery");
  startDripForKey(HYDRATION_SLOT_KEY, "hydration");
  startDripForKey(RANK_SLOT_KEY, "rank");

  const budgets = {
    discovery: slotBudgetForPipeline("discovery"),
    hydration: slotBudgetForPipeline("hydration"),
    rank: slotBudgetForPipeline("rank"),
  };
  const intervals = {
    discovery: tokenReleaseIntervalMs("discovery"),
    hydration: jobReleaseIntervalMs("hydration"),
    rank: tokenReleaseIntervalMs("rank"),
  };

  console.log(
    `[rate-scheduler] drip started uniform ` +
      `discovery=${discoveryRate.toFixed(4)}/s token/${(intervals.discovery / 1000).toFixed(1)}s ` +
      `hydration=${hydrationRate.toFixed(4)}/s job/${(intervals.hydration / 1000).toFixed(1)}s ` +
      `rank=${rankRate.toFixed(4)}/s token/${(intervals.rank / 1000).toFixed(1)}s ` +
      `(budgets ${budgets.discovery}/${budgets.hydration}/${budgets.rank} req/120s)`,
  );
}

export function stopDrip(): void {
  while (dripIntervals.length > 0) {
    const interval = dripIntervals.pop();
    if (interval) {
      clearInterval(interval);
    }
  }
}

const DISCOVERY_POLL_RETRY_CONCURRENCY = 2;

function minPollSleepMs(pipeline: SlotPipeline): number {
  if (pipeline === "hydration") {
    return Math.max(250, Math.floor(jobReleaseIntervalMs("hydration") / config.HYDRATION_CONCURRENCY));
  }
  if (pipeline === "rank") {
    return Math.max(
      250,
      Math.floor(tokenReleaseIntervalMs("rank") / config.RANK_WORKER_CONCURRENCY_DRAIN),
    );
  }
  return Math.max(
    250,
    Math.floor(tokenReleaseIntervalMs("discovery") / DISCOVERY_POLL_RETRY_CONCURRENCY),
  );
}

async function waitForScheduledSlot(slotKey: string, cost: 1 | 2): Promise<void> {
  const pipeline = pipelineForSlotKey(slotKey);
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
      pollerV2Observability.recordRateLimitAttempt(cost, true, Math.max(0, delay), pipeline);
      if (delay > 5) {
        await sleep(delay);
      }
      return;
    }

    const waitMs = Math.max(value, minPollSleepMs(pipeline));
    pollerV2Observability.recordRateLimitAttempt(cost, false, waitMs, pipeline);
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
    pollerV2Observability.recordRateLimitAttempt(1, true, delay, "rank");
    if (delay > 5) {
      await sleep(delay);
    }
    return { granted: true, waitMs: 0 };
  }

  const waitMs = Math.max(value, minPollSleepMs("rank"));
  pollerV2Observability.recordRateLimitAttempt(1, false, waitMs, "rank");
  return { granted: false, waitMs };
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
  const waitMs = granted ? Math.max(0, value - now) : Math.max(value, 0);
  pollerV2Observability.recordRateLimitAttempt(cost, granted, waitMs, pipeline);
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
