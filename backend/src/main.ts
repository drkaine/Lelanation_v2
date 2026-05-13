import "dotenv/config";
import { config } from "./config/index.js";
import { healthCheck, sql } from "./db/client.js";
import { appendUnifiedLog } from "./logging/unifiedAppLog.js";
import { pollerV2Observability } from "./observability/poller-v2-observability.js";
import { scheduleDiscoveryRepeatJob, discoveryWorker } from "./workers/discovery.worker.js";
import { hydrationWorker } from "./workers/hydration.worker.js";
import { ingestionWorker } from "./workers/ingestion.worker.js";
import { getQueueMetrics } from "./queues/index.js";
import { loadLuaScript } from "./redis/rate-limiter.js";
import { redis } from "./redis/client.js";

let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
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
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::bigint AS lag_seconds
      FROM processed_matches
    `;
    return rows[0]?.lag_seconds ?? null;
  } catch {
    return null;
  }
}

async function logMetricsTick(): Promise<void> {
  const startedAt = Date.now();
  const metrics = await getQueueMetrics();
  const lagSeconds = await getDataLagSeconds();
  const tickDurationMs = Date.now() - startedAt;

  pollerV2Observability.recordQueueSnapshot({
    discovery: metrics.discovery,
    hydration: metrics.hydration,
    ingestion: metrics.ingestion,
    dataLagSeconds: lagSeconds,
    tickDurationMs,
  });
  await pollerV2Observability.flushSnapshotToDisk();

  console.log(
    `[poller-main] queues discovery(w:${metrics.discovery.waiting},a:${metrics.discovery.active},f:${metrics.discovery.failed}) ` +
      `hydration(w:${metrics.hydration.waiting},a:${metrics.hydration.active},f:${metrics.hydration.failed}) ` +
      `ingestion(w:${metrics.ingestion.waiting},a:${metrics.ingestion.active},f:${metrics.ingestion.failed}) ` +
      `data_lag_seconds=${lagSeconds ?? "n/a"} tick_ms=${tickDurationMs}`,
  );
}

async function queryDbWindowStats(windowStartMs: number, windowEndMs: number): Promise<Record<string, unknown>> {
  const startIso = new Date(windowStartMs).toISOString();
  const endIso = new Date(windowEndMs).toISOString();
  const rows = await sql<{
    players_polled: number;
    players_updated: number;
    players_added: number;
    matches_added: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM players WHERE last_seen >= ${startIso}::timestamptz AND last_seen < ${endIso}::timestamptz) AS players_polled,
      (SELECT COUNT(*)::int FROM players WHERE updated_at >= ${startIso}::timestamptz AND updated_at < ${endIso}::timestamptz) AS players_updated,
      (SELECT COUNT(*)::int FROM players WHERE created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS players_added,
      (SELECT COUNT(*)::int FROM processed_matches WHERE created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS matches_added
  `;
  const first = rows[0];
  return {
    windowStartIso: startIso,
    windowEndIso: endIso,
    playersPolled: first?.players_polled ?? 0,
    playersUpdated: first?.players_updated ?? 0,
    playersAdded: first?.players_added ?? 0,
    matchesAdded: first?.matches_added ?? 0,
  };
}

async function emitWindowSummary(window: "30m" | "1h"): Promise<void> {
  const now = Date.now();
  const windowMs = window === "30m" ? 30 * 60_000 : 60 * 60_000;
  const dbWindow = await queryDbWindowStats(now - windowMs, now);
  const payload = pollerV2Observability.buildWindowSummary(window, dbWindow);
  await appendUnifiedLog({
    section: "back",
    type: "info",
    script: window === "30m" ? "poller_v2_30m" : "poller_v2_hourly",
    message: `poller-v2 summary ${window}`,
    json: payload,
  });
  await pollerV2Observability.flushSnapshotToDisk();
}

async function startMonitoring(): Promise<void> {
  await logMetricsTick();
  metricsInterval = setInterval(() => {
    void logMetricsTick();
  }, 30_000);
  summary30mInterval = setInterval(() => {
    void emitWindowSummary("30m");
  }, 30 * 60_000);
  summary1hInterval = setInterval(() => {
    void emitWindowSummary("1h");
  }, 60 * 60_000);
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
  if (summary30mInterval) {
    clearInterval(summary30mInterval);
    summary30mInterval = null;
  }
  if (summary1hInterval) {
    clearInterval(summary1hInterval);
    summary1hInterval = null;
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
