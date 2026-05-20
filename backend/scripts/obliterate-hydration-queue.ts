import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { HYDRATION_QUEUE } from "../src/queues/definitions.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const hydrationQueue = new Queue(HYDRATION_QUEUE, { connection: redis });

const before = await hydrationQueue.getJobCounts("waiting", "active", "failed", "delayed", "completed");
console.log("before", before);

await hydrationQueue.obliterate({ force: true });

const after = await hydrationQueue.getJobCounts("waiting", "active", "failed", "delayed", "completed");
console.log("after", after);

await hydrationQueue.close();
await redis.quit();
