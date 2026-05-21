import "dotenv/config";
import { discoveryQueue, hydrationQueue, ingestionQueue, rankQueue } from "../src/queues/index.js";
import { redis } from "../src/redis/client.js";

async function scanDelete(pattern: string): Promise<number> {
  let deleted = 0;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = next;
    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== "0");
  return deleted;
}

async function main(): Promise<void> {
  const queues = [
    ["discovery", discoveryQueue],
    ["hydration", hydrationQueue],
    ["ingestion", ingestionQueue],
    ["rank", rankQueue],
  ] as const;

  for (const [name, queue] of queues) {
    const before = await queue.getJobCounts("waiting", "active", "failed", "delayed", "waiting-children");
    await queue.obliterate({ force: true });
    console.log(JSON.stringify({ queue: name, before, status: "obliterated" }));
  }

  const leaderLockDeleted = await redis.del("poller-v2:leader");
  const rlQueuedDeleted = await scanDelete("rl:queued:*");
  const deferDeleted = await scanDelete("hydration:defer:*");
  await redis.del("rl:slots:discovery", "rl:slots:hydration", "rl:slots:rank", "rl:app:global-cooldown");

  const mem = await redis.info("memory");
  const usedMemoryHuman = mem.match(/used_memory_human:(.+)/)?.[1]?.trim();
  const redisKeys = await redis.dbsize();

  console.log(
    JSON.stringify({
      leaderLockDeleted,
      rlQueuedDeleted,
      deferDeleted,
      redisKeys,
      usedMemoryHuman,
    }),
  );

  await discoveryQueue.close();
  await hydrationQueue.close();
  await ingestionQueue.close();
  await rankQueue.close();
  await redis.quit();
}

void main().catch(async (error) => {
  console.error("[reset-poller-queues] failed", error);
  try {
    await redis.quit();
  } catch {
    // ignore
  }
  process.exit(1);
});
