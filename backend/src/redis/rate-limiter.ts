import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { redis } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACQUIRE_SLOT_LUA = readFileSync(join(__dirname, "lua", "acquire-slot.lua"), "utf8");

export const TARGET_PCT = 0.92;
export const MATCH_SLOT_KEY = "rl:token_schedule";
export const RANK_SLOT_KEY = "rl:token_schedule_rank";
/** @deprecated use MATCH_SLOT_KEY */
export const SLOT_KEY = MATCH_SLOT_KEY;

const GLOBAL_COOLDOWN_KEY = "rl:app:global-cooldown";
const MAX_LOOKAHEAD_MS = 8000;
const DRIP_INTERVAL_MS = 200;

let acquireSlotSha: string | null = null;
const dripIntervals: NodeJS.Timeout[] = [];

export type RankSlotResult = "ok" | "budget_exhausted";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function totalTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return (rateLimitPer120s * TARGET_PCT) / 120;
}

export function matchTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return totalTargetRatePerSec(rateLimitPer120s) * 0.8;
}

export function rankTargetRatePerSec(rateLimitPer120s = config.RATE_LIMIT_PER_120S): number {
  return Math.min((rateLimitPer120s * TARGET_PCT * 0.2) / 120, 2.0);
}

function slotIntervalMs(targetRatePerSec: number): number {
  return 1000 / targetRatePerSec;
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
  const lastTs = last.length >= 2 ? Number.parseFloat(last[1]!) : now;

  if (lastTs >= maxFutureTs) {
    return;
  }

  const slotsToAdd = Math.ceil(
    (Math.min(maxFutureTs, lastTs + DRIP_INTERVAL_MS * 2) - lastTs) / intervalMs,
  );

  if (slotsToAdd <= 0) {
    await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
    return;
  }

  const zaddArgs: Array<string | number> = [];
  for (let i = 1; i <= slotsToAdd; i += 1) {
    const ts = lastTs + intervalMs * i;
    if (ts > maxFutureTs) {
      break;
    }
    const prefix = slotKey === RANK_SLOT_KEY ? "r" : "m";
    zaddArgs.push(ts, `${prefix}:${ts.toFixed(0)}`);
  }

  if (zaddArgs.length > 0) {
    await redis.zadd(slotKey, ...zaddArgs);
  }

  await redis.zremrangebyscore(slotKey, "-inf", now - 5000);
}

function startDripForKey(slotKey: string, targetRatePerSec: number): void {
  void runDripTick(slotKey, targetRatePerSec).catch((error) => {
    console.error(`[rate-limiter] drip tick failed key=${slotKey}`, error);
  });

  const interval = setInterval(() => {
    void runDripTick(slotKey, targetRatePerSec).catch((error) => {
      console.error(`[rate-limiter] drip tick failed key=${slotKey}`, error);
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

  const matchRate = matchTargetRatePerSec();
  const rankRate = rankTargetRatePerSec();

  startDripForKey(MATCH_SLOT_KEY, matchRate);
  startDripForKey(RANK_SLOT_KEY, rankRate);

  console.log(
    `[rate-limiter] drip started match_rate=${matchRate.toFixed(4)}/s rank_rate=${rankRate.toFixed(4)}/s`,
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

export async function waitForMatchSlot(cost: 1 | 2): Promise<void> {
  await waitForScheduledSlot(MATCH_SLOT_KEY, cost);
}

/** @deprecated use waitForMatchSlot */
export const waitForSlot = waitForMatchSlot;

export async function waitForRankSlot(): Promise<RankSlotResult> {
  const globalCooldownMs = await getGlobalCooldownMs();
  if (globalCooldownMs > 0) {
    return "budget_exhausted";
  }

  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(RANK_SLOT_KEY, 1, now);

  if (allowed !== 1) {
    pollerV2Observability.recordRateLimitAttempt(1, false, Math.max(value, 0));
    return "budget_exhausted";
  }

  const delay = value - Date.now();
  pollerV2Observability.recordRateLimitAttempt(1, true, Math.max(0, delay));
  if (delay > 5) {
    await sleep(delay);
  }
  return "ok";
}

export async function tryAcquireSlot(cost: 1 | 2): Promise<{ granted: boolean; waitMs: number }> {
  const now = Date.now();
  const [allowed, value] = await evalAcquireSlot(MATCH_SLOT_KEY, cost, now);
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
    const lastTs = last.length >= 2 ? Number.parseFloat(last[1]!) : now;

    if (lastTs >= maxFutureTs) {
      return;
    }

    const slotsToAdd = Math.ceil(
      (Math.min(maxFutureTs, lastTs + DRIP_INTERVAL_MS * 2) - lastTs) / intervalMs,
    );

    const zaddArgs: Array<string | number> = [];
    for (let i = 1; i <= slotsToAdd; i += 1) {
      const ts = lastTs + intervalMs * i;
      if (ts > maxFutureTs) {
        break;
      }
      zaddArgs.push(ts, `s:${ts.toFixed(0)}`);
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
    },
    slotIntervalMs: () => slotIntervalMs(params.targetRatePerSec),
  };
}
