import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { RANK_QUEUE } from "../src/queues/definitions.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const rankQueue = new Queue(RANK_QUEUE, { connection: redis });

const before = await rankQueue.getJobCounts("waiting", "active", "failed", "delayed", "completed");
console.log("[obliterate-rank-queue] before", before);

await rankQueue.obliterate({ force: true });

const after = await rankQueue.getJobCounts("waiting", "active", "failed", "delayed", "completed");
console.log("[obliterate-rank-queue] after", after);

await rankQueue.close();
await redis.quit();
process.exit(0);
