import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { INGESTION_QUEUE, RANK_QUEUE } from "../src/queues/definitions.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

async function cleanFailed(queueName: string): Promise<number> {
  const queue = new Queue(queueName, { connection: redis });
  const failed = await queue.getFailed(0, -1);
  await Promise.all(failed.map((job) => job.remove()));
  await queue.close();
  return failed.length;
}

for (const name of [INGESTION_QUEUE, RANK_QUEUE] as const) {
  const count = await cleanFailed(name);
  console.log(`[clean-failed-queue-jobs] ${name} cleaned:`, count);
}

await redis.quit();
process.exit(0);
