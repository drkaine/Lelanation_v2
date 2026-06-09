import Redis from "ioredis";
import { config } from "../config/index.js";

const REDIS_RETRY_MAX_DELAY_MS = 5_000;
const REDIS_ERROR_LOG_INTERVAL_MS = 10_000;

let lastErrorLogAt = 0;

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10_000,
  retryStrategy(times) {
    return Math.min(times * 200, REDIS_RETRY_MAX_DELAY_MS);
  },
});

redis.on("error", (err) => {
  const now = Date.now();
  if (now - lastErrorLogAt < REDIS_ERROR_LOG_INTERVAL_MS) {
    return;
  }
  lastErrorLogAt = now;
  console.warn(`[redis] connection error (retrying): ${err.message}`);
});

export function waitForRedis(timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redis.status === "ready") {
      void redis
        .ping()
        .then(() => resolve())
        .catch(reject);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Redis unavailable at ${config.REDIS_URL} after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      redis.off("ready", onReady);
    };

    redis.once("ready", onReady);
  });
}
