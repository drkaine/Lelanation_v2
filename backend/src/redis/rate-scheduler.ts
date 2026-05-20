/**
 * Trois drips Redis (discovery / hydration / rank) sur un budget unique :
 *
 *   TOTAL_RATE = RATE_LIMIT_PER_120S * TARGET_PCT / 120
 *   // dev : 95 * 0.95 / 120 ≈ 0.7521 tokens/s
 *
 *   discovery 15% · hydration 85% (rank = BullMQ limiter, pas de drip Redis)
 *   // dev : ~0.11/s discovery · ~0.64/s hydration (coût 2)
 *
 * Rank : Worker BullMQ `limiter` (17 / 120s, concurrency 2) — pas de spin Redis.
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

/** Part de TOTAL_RATE pour matchlists discovery (coût 1). */
export const DISCOVERY_BUDGET_PCT = 0.15;
/** Part de TOTAL_RATE pour match + timeline (coût 2 par job hydration). */
export const HYDRATION_BUDGET_PCT = 0.85;
/** Référence doc / limiter BullMQ rank (~17 appels / 120s en dev). */
export const RANK_BUDGET_PCT = 0.1;

/** Limiter BullMQ rank.worker — voir rank-backlog-policy (drain vs normal). */
export const RANK_BULLMQ_LIMITER_DURATION_MS = 120_000;

export const DISCOVERY_SLOT_KEY = "rl:slots:discovery";
export const HYDRATION_SLOT_KEY = "rl:slots:hydration";
export const RANK_SLOT_KEY = "rl:slots:rank";

/** @deprecated use HYDRATION_SLOT_KEY */
export const MATCH_SLOT_KEY = HYDRATION_SLOT_KEY;
/** @deprecated use DISCOVERY_SLOT_KEY or HYDRATION_SLOT_KEY */
export const SLOT_KEY = HYDRATION_SLOT_KEY;

const GLOBAL_COOLDOWN_KEY = "rl:app:global-cooldown";
const MAX_LOOKAHEAD_MS = 8000;
const DRIP_INTERVAL_MS = 200;

let acquireSlotSha: string | null = null;
const dripIntervals: NodeJS.Timeout[] = [];
const dripAccumulators = new Map<string, number>();

export type RankSlotResult = "ok" | "budget_exhausted";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function totalTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return (rateLimitPer120s * TARGET_PCT) / 120;
}

export function discoveryTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return totalTargetRatePerSec(rateLimitPer120s) * DISCOVERY_BUDGET_PCT;
}

export function hydrationTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return totalTargetRatePerSec(rateLimitPer120s) * HYDRATION_BUDGET_PCT;
}

export function rankTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return totalTargetRatePerSec(rateLimitPer120s) * RANK_BUDGET_PCT;
}

function slotIntervalMs(targetRatePerSec: number): number {
  return 1000 / targetRatePerSec;
}

export function advanceDripAccumulator(
  accumulator: number,
  targetRatePerSec: number,
  dripIntervalMs = DRIP_INTERVAL_MS,
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

async function runDripTick(slotKey: string, targetRatePerSec: number): Promise<void> {
  const now = Date.now();
  const maxFutureTs = now + MAX_LOOKAHEAD_MS;
  const intervalMs = slotIntervalMs(targetRatePerSec);

  const last = await redis.zrange(slotKey, -1, -1, "WITHSCORES");
  // File vide : ancrer un créneau à `now`. Sinon le 1er slot serait à now+intervalMs,
  // souvent > MAX_LOOKAHEAD_MS pour discovery/rank → zéro slot ajouté (workers bloqués).
  let scheduleFromTs = last.length >= 2 ? Number.parseFloat(last[1]!) : now - intervalMs;
  if (scheduleFromTs + intervalMs > maxFutureTs) {
    scheduleFromTs = maxFutureTs - intervalMs;
  }

  const { accumulator, slotsToAdd } = advanceDripAccumulator(
    dripAccumulators.get(slotKey) ?? 0,
    targetRatePerSec,
  );
  dripAccumulators.set(slotKey, accumulator);

  const queueDepth = await redis.zcard(slotKey);

  if (process.env.RATE_SCHEDULER_DEBUG === "1") {
    console.debug(
      JSON.stringify({
        msg: "drip_tick",
        slotKey,
        scheduleFromTs,
        slotIntervalMs: Math.round(intervalMs * 100) / 100,
        slotsToAdd,
        queueDepth,
        targetTokensPerSec: targetRatePerSec,
        dripAccumulator: accumulator,
      }),
    );
  }

  if (slotsToAdd <= 0) {
    await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
    return;
  }

  const prefix = slotMemberPrefix(slotKey);
  const zaddArgs: Array<string | number> = [];
  for (let i = 1; i <= slotsToAdd; i += 1) {
    const ts = scheduleFromTs + intervalMs * i;
    if (ts > maxFutureTs) {
      break;
    }
    zaddArgs.push(ts, `${prefix}:${ts.toFixed(0)}:${i}`);
  }

  if (process.env.RATE_SCHEDULER_DEBUG === "1" && zaddArgs.length > 0) {
    console.debug(
      JSON.stringify({
        msg: "drip_tick_added",
        slotKey,
        slotsAdded: zaddArgs.length / 2,
      }),
    );
  }

  if (zaddArgs.length > 0) {
    await redis.zadd(slotKey, ...zaddArgs);
  }

  await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
}

function startDripForKey(slotKey: string, targetRatePerSec: number): void {
  void runDripTick(slotKey, targetRatePerSec).catch((error) => {
    console.error(`[rate-scheduler] drip tick failed key=${slotKey}`, error);
  });

  const interval = setInterval(() => {
    void runDripTick(slotKey, targetRatePerSec).catch((error) => {
      console.error(`[rate-scheduler] drip tick failed key=${slotKey}`, error);
    });
  }, DRIP_INTERVAL_MS);

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

  startDripForKey(DISCOVERY_SLOT_KEY, discoveryRate);
  startDripForKey(HYDRATION_SLOT_KEY, hydrationRate);

  console.log(
    `[rate-scheduler] drip started ` +
      `discovery=${discoveryRate.toFixed(4)}/s hydration=${hydrationRate.toFixed(4)}/s ` +
      `(budgets ${DISCOVERY_BUDGET_PCT * 100}%/${HYDRATION_BUDGET_PCT * 100}% of ${TARGET_PCT * 100}% cap; ` +
      `rank via BullMQ limiter (drain max ~88% cap / ${RANK_BULLMQ_LIMITER_DURATION_MS}ms)`,
  );
}

export function stopDrip(): void {
  while (dripIntervals.length > 0) {
    const interval = dripIntervals.pop();
    if (interval) {
      clearInterval(interval);
    }
  }
  dripAccumulators.clear();
}

async function waitForScheduledSlot(slotKey: string, cost: 1 | 2): Promise<void> {
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
      pollerV2Observability.recordRateLimitAttempt(cost, true, Math.max(0, delay));
      if (delay > 5) {
        await sleep(delay);
      }
      return;
    }

    const waitMs = Math.max(value, 0);
    pollerV2Observability.recordRateLimitAttempt(cost, false, waitMs);
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
    pollerV2Observability.recordRateLimitAttempt(1, true, delay);
    if (delay > 5) {
      await sleep(delay);
    }
    return { granted: true, waitMs: 0 };
  }

  const waitMs = Math.max(value, 0);
  pollerV2Observability.recordRateLimitAttempt(1, false, waitMs);
  return { granted: false, waitMs };
}

/**
 * rank.worker uniquement (concurrency 2).
 * Un seul essai : pas de spin Redis — file d’attente = BullMQ.
 * @deprecated Préférer acquireRankSlot + waitForRankSlotOrSkip dans rank.worker.
 */
export async function waitForRankSlot(): Promise<RankSlotResult> {
  const globalCooldownMs = await getGlobalCooldownMs();
  if (globalCooldownMs > 0) {
    return "budget_exhausted";
  }

  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(RANK_SLOT_KEY, 1, now);

  if (allowed !== 1) {
    const waitMs = Math.max(value, 0);
    pollerV2Observability.recordRateLimitAttempt(1, false, waitMs);
    return "budget_exhausted";
  }

  const delay = value - Date.now();
  pollerV2Observability.recordRateLimitAttempt(1, true, Math.max(0, delay));

  if (delay > 5) {
    await sleep(delay);
  }
  return "ok";
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
  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(slotKey, cost, now);
  const granted = allowed === 1;
  const waitMs = granted ? Math.max(0, value - now) : Math.max(value, 0);
  pollerV2Observability.recordRateLimitAttempt(cost, granted, waitMs);
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
      }, DRIP_INTERVAL_MS);
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
