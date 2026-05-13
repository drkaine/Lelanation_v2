import { config } from "../config/index.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { redis } from "./client.js";

const BUCKET_1S_KEY = "rl:app:1s";
const BUCKET_120S_KEY = "rl:app:120s";
const GLOBAL_COOLDOWN_KEY = "rl:app:global-cooldown";

const LUA_DUAL_WINDOW_SCRIPT = `
local key1 = KEYS[1]
local key120 = KEYS[2]
local limit1 = tonumber(ARGV[1])
local limit120 = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

local count1 = tonumber(redis.call("GET", key1) or "0")
local count120 = tonumber(redis.call("GET", key120) or "0")

local over1 = (count1 + cost) > limit1
local over120 = (count120 + cost) > limit120

if over1 or over120 then
  local ttl1 = redis.call("PTTL", key1)
  local ttl120 = redis.call("PTTL", key120)

  if over1 and not over120 then
    return {0, ttl1}
  end

  if over120 and not over1 then
    return {0, ttl120}
  end

  if ttl1 > ttl120 then
    return {0, ttl1}
  end

  return {0, ttl120}
end

redis.call("INCRBY", key1, cost)
if count1 == 0 then
  redis.call("PEXPIRE", key1, 1000)
end

redis.call("INCRBY", key120, cost)
if count120 == 0 then
  redis.call("PEXPIRE", key120, 120000)
end

return {1, 0}
`;

let luaScriptSha: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalWithFallback(cost: 1 | 2): Promise<[number, number]> {
  const args = [
    BUCKET_1S_KEY,
    BUCKET_120S_KEY,
    String(config.RATE_LIMIT_PER_1S),
    String(config.RATE_LIMIT_PER_120S),
    String(cost),
  ] as const;

  if (!luaScriptSha) {
    await loadLuaScript();
  }

  try {
    const result = (await redis.evalsha(
      luaScriptSha as string,
      2,
      ...args,
    )) as [number, number];
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("NOSCRIPT")) {
      throw error;
    }

    luaScriptSha = (await redis.script("LOAD", LUA_DUAL_WINDOW_SCRIPT)) as string;
    const fallbackResult = (await redis.eval(
      LUA_DUAL_WINDOW_SCRIPT,
      2,
      ...args,
    )) as [number, number];
    return fallbackResult;
  }
}

async function getGlobalCooldownMs(): Promise<number> {
  const ttl = await redis.pttl(GLOBAL_COOLDOWN_KEY);
  return ttl > 0 ? ttl : 0;
}

export async function loadLuaScript(): Promise<void> {
  luaScriptSha = (await redis.script("LOAD", LUA_DUAL_WINDOW_SCRIPT)) as string;
}

export async function tryAcquireSlot(cost: 1 | 2): Promise<{ granted: boolean; waitMs: number }> {
  const [granted, pttl] = await evalWithFallback(cost);
  pollerV2Observability.recordRateLimitAttempt(cost, granted === 1, Math.max(pttl, 0));
  return {
    granted: granted === 1,
    waitMs: Math.max(pttl, 0),
  };
}

export async function waitForSlot(cost: 1 | 2): Promise<void> {
  while (true) {
    const globalCooldownMs = await getGlobalCooldownMs();
    if (globalCooldownMs > 0) {
      await sleep(globalCooldownMs + 10);
      continue;
    }

    const attempt = await tryAcquireSlot(cost);
    if (attempt.granted) {
      return;
    }

    const waitMs = attempt.waitMs + 10;
    await sleep(waitMs);
  }
}

export async function setGlobalRateLimitCooldown(waitMs: number): Promise<void> {
  const safeWaitMs = Math.max(0, Math.trunc(waitMs));
  if (safeWaitMs <= 0) return;
  await redis.set(GLOBAL_COOLDOWN_KEY, "1", "PX", safeWaitMs);
}

export function createLuaRateLimiterForTests(params: {
  redisClient: any;
  bucket1sKey: string;
  bucket120sKey: string;
  limit1s: number;
  limit120s: number;
}) {
  let sha: string | null = null;

  async function loadScript(): Promise<void> {
    sha = (await params.redisClient.script("LOAD", LUA_DUAL_WINDOW_SCRIPT)) as string;
  }

  async function tryAcquire(cost: 1 | 2): Promise<{ granted: boolean; waitMs: number }> {
    if (!sha) {
      await loadScript();
    }
    const args = [
      params.bucket1sKey,
      params.bucket120sKey,
      String(params.limit1s),
      String(params.limit120s),
      String(cost),
    ] as const;

    try {
      const [granted, pttl] = (await params.redisClient.evalsha(sha as string, 2, ...args)) as [number, number];
      return { granted: granted === 1, waitMs: Math.max(pttl, 0) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("NOSCRIPT")) throw error;
      sha = (await params.redisClient.script("LOAD", LUA_DUAL_WINDOW_SCRIPT)) as string;
      const [granted, pttl] = (await params.redisClient.eval(LUA_DUAL_WINDOW_SCRIPT, 2, ...args)) as [number, number];
      return { granted: granted === 1, waitMs: Math.max(pttl, 0) };
    }
  }

  return {
    loadScript,
    tryAcquire,
  };
}
