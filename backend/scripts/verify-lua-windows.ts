import Redis from "ioredis";

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

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  try {
    const sha = (await redis.script("LOAD", LUA_DUAL_WINDOW_SCRIPT)) as string;
    const run = async (
      key1: string,
      key120: string,
      limit1: number,
      limit120: number,
      cost: number,
    ): Promise<[number, number]> =>
      (await redis.evalsha(
        sha,
        2,
        key1,
        key120,
        String(limit1),
        String(limit120),
        String(cost),
      )) as [number, number];

    await redis.del("rl:test:1s:a", "rl:test:120s:a", "rl:test:1s:b", "rl:test:120s:b");

    await run("rl:test:1s:a", "rl:test:120s:a", 3, 100, 1);
    await run("rl:test:1s:a", "rl:test:120s:a", 3, 100, 1);
    await run("rl:test:1s:a", "rl:test:120s:a", 3, 100, 1);
    const denied1s = await run("rl:test:1s:a", "rl:test:120s:a", 3, 100, 1);

    await run("rl:test:1s:b", "rl:test:120s:b", 100, 3, 1);
    await run("rl:test:1s:b", "rl:test:120s:b", 100, 3, 1);
    await run("rl:test:1s:b", "rl:test:120s:b", 100, 3, 1);
    const denied120s = await run("rl:test:1s:b", "rl:test:120s:b", 100, 3, 1);

    console.log(`1s-window deny=${denied1s[0] === 0} pttl_ms=${denied1s[1]}`);
    console.log(`120s-window deny=${denied120s[0] === 0} pttl_ms=${denied120s[1]}`);
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exitCode = 1;
});
