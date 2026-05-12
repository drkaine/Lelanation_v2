import "dotenv/config";
import { config } from "./config/index.js";
import { healthCheck, sql } from "./db/client.js";
import { scheduleDiscoveryRepeatJob, discoveryWorker } from "./workers/discovery.worker.js";
import { hydrationWorker } from "./workers/hydration.worker.js";
import { ingestionWorker } from "./workers/ingestion.worker.js";
import { getQueueMetrics } from "./queues/index.js";
import { loadLuaScript } from "./redis/rate-limiter.js";
import { redis } from "./redis/client.js";

let metricsInterval: NodeJS.Timeout | null = null;
let shuttingDown = false;

function validateConfig(): void {
  void config.ENV;
  void config.REDIS_URL;
  void config.DATABASE_URL;
  void config.RIOT_API_KEY;
}

async function getDataLagSeconds(): Promise<number | null> {
  try {
    const rows = await sql<{ lag_seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(aggregated_at)))::bigint AS lag_seconds
      FROM processed_matches
    `;
    return rows[0]?.lag_seconds ?? null;
  } catch {
    return null;
  }
}

async function logMetricsTick(): Promise<void> {
  const metrics = await getQueueMetrics();
  const lagSeconds = await getDataLagSeconds();

  console.log(
    `[poller-main] queues discovery(w:${metrics.discovery.waiting},a:${metrics.discovery.active},f:${metrics.discovery.failed}) ` +
      `hydration(w:${metrics.hydration.waiting},a:${metrics.hydration.active},f:${metrics.hydration.failed}) ` +
      `ingestion(w:${metrics.ingestion.waiting},a:${metrics.ingestion.active},f:${metrics.ingestion.failed}) ` +
      `data_lag_seconds=${lagSeconds ?? "n/a"}`,
  );
}

async function startMonitoring(): Promise<void> {
  await logMetricsTick();
  metricsInterval = setInterval(() => {
    void logMetricsTick();
  }, 30_000);
}

async function bootstrap(): Promise<void> {
  validateConfig();
  console.log(`[poller-main] config validated env=${config.ENV}`);

  await loadLuaScript();
  console.log("[poller-main] Lua rate limiter loaded");

  const dbOk = await healthCheck();
  if (!dbOk) {
    throw new Error("database_healthcheck_failed");
  }
  console.log("[poller-main] database health check OK");

  await scheduleDiscoveryRepeatJob();
  console.log("[poller-main] discovery repeat job scheduled (30s)");

  // Workers are started on import; we only confirm readiness here.
  console.log("[poller-main] workers started: discovery, hydration, ingestion");

  await startMonitoring();
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[poller-main] ${signal} received, starting graceful shutdown`);

  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }

  try {
    await Promise.all([
      discoveryWorker.pause(true),
      hydrationWorker.pause(true),
      ingestionWorker.pause(true),
    ]);

    await Promise.all([
      discoveryWorker.close(),
      hydrationWorker.close(),
      ingestionWorker.close(),
    ]);

    await sql.end();
    await redis.quit();
    console.log("[poller-main] graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("[poller-main] graceful shutdown failed", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

void bootstrap().catch(async (error) => {
  console.error("[poller-main] bootstrap failed", error);
  try {
    await sql.end();
  } catch {
    // ignore
  }
  try {
    await redis.quit();
  } catch {
    // ignore
  }
  process.exit(1);
});
