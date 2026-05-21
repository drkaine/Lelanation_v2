import "dotenv/config";
import type { Worker } from "bullmq";
import { config } from "./config/index.js";
import { healthCheck, sql } from "./db/client.js";
import { appendUnifiedLog } from "./logging/unifiedAppLog.js";
import { pollerV2Observability } from "./observability/poller-v2-observability.js";
import { getQueueMetrics } from "./queues/index.js";
import { trimCompletedQueueJobs } from "./queues/queue-cleanup.js";
import { syncMatchPipelinePause } from "./queues/pipeline-pause-sync.js";
import { loadLuaScript, startDrip, stopDrip } from "./redis/rate-scheduler.js";
import { redis } from "./redis/client.js";

type PollerWorkers = {
  discoveryWorker: Worker;
  hydrationWorker: Worker;
  ingestionWorker: Worker;
  rankWorker: Worker;
  scheduleDiscoveryRepeatJob: () => Promise<void>;
};

let workers: PollerWorkers | null = null;
let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
let leaderLockRenewInterval: NodeJS.Timeout | null = null;
let shuttingDown = false;

const POLLER_LEADER_LOCK_KEY = "poller-v2:leader";
const POLLER_LEADER_LOCK_TTL_SEC = 120;

async function acquirePollerLeaderLock(): Promise<void> {
  const acquired = await redis.set(
    POLLER_LEADER_LOCK_KEY,
    String(process.pid),
    "EX",
    POLLER_LEADER_LOCK_TTL_SEC,
    "NX",
  );
  if (acquired !== "OK") {
    const owner = await redis.get(POLLER_LEADER_LOCK_KEY);
    console.warn(
      `[poller-main] leader lock held by pid=${owner ?? "unknown"} (this pid=${process.pid}) — exiting; use a single poller instance only`,
    );
    await redis.quit().catch(() => undefined);
    process.exit(0);
  }

  leaderLockRenewInterval = setInterval(() => {
    void redis
      .set(POLLER_LEADER_LOCK_KEY, String(process.pid), "EX", POLLER_LEADER_LOCK_TTL_SEC)
      .catch((error) => {
        console.error("[poller-main] leader lock renew failed", error);
      });
  }, 30_000);
}

async function releasePollerLeaderLock(): Promise<void> {
  if (leaderLockRenewInterval) {
    clearInterval(leaderLockRenewInterval);
    leaderLockRenewInterval = null;
  }
  const owner = await redis.get(POLLER_LEADER_LOCK_KEY);
  if (owner === String(process.pid)) {
    await redis.del(POLLER_LEADER_LOCK_KEY);
  }
}

async function startWorkers(): Promise<PollerWorkers> {
  const [discoveryMod, hydrationMod, ingestionMod, rankMod] = await Promise.all([
    import("./workers/discovery.worker.js"),
    import("./workers/hydration.worker.js"),
    import("./workers/ingestion.worker.js"),
    import("./workers/rank.worker.js"),
  ]);

  return {
    discoveryWorker: discoveryMod.discoveryWorker,
    hydrationWorker: hydrationMod.hydrationWorker,
    ingestionWorker: ingestionMod.ingestionWorker,
    rankWorker: rankMod.rankWorker,
    scheduleDiscoveryRepeatJob: discoveryMod.scheduleDiscoveryRepeatJob,
  };
}

async function closeWorkers(activeWorkers: PollerWorkers): Promise<void> {
  await Promise.all([
    activeWorkers.discoveryWorker.pause(true),
    activeWorkers.hydrationWorker.pause(true),
    activeWorkers.ingestionWorker.pause(true),
    activeWorkers.rankWorker.pause(true),
  ]);

  await Promise.all([
    activeWorkers.discoveryWorker.close(),
    activeWorkers.hydrationWorker.close(),
    activeWorkers.ingestionWorker.close(),
    activeWorkers.rankWorker.close(),
  ]);
}

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
  if (!workers) return;

  const startedAt = Date.now();
  const pipelinesPaused = await syncMatchPipelinePause(workers.hydrationWorker, workers.ingestionWorker);
  const metrics = await getQueueMetrics();
  const lagSeconds = await getDataLagSeconds();
  const tickDurationMs = Date.now() - startedAt;

  pollerV2Observability.recordQueueSnapshot({
    discovery: metrics.discovery,
    hydration: metrics.hydration,
    ingestion: metrics.ingestion,
    rank: metrics.rank,
    dataLagSeconds: lagSeconds,
    tickDurationMs,
  });
  await pollerV2Observability.flushSnapshotToDisk();

  console.log(
    `[poller-main] queues discovery(w:${metrics.discovery.waiting},a:${metrics.discovery.active},f:${metrics.discovery.failed}) ` +
      `hydration(w:${metrics.hydration.waiting},a:${metrics.hydration.active},f:${metrics.hydration.failed}) ` +
      `ingestion(w:${metrics.ingestion.waiting},a:${metrics.ingestion.active},f:${metrics.ingestion.failed}) ` +
      `rank(w:${metrics.rank.waiting},a:${metrics.rank.active},f:${metrics.rank.failed}) ` +
      `pipelines_paused=${pipelinesPaused} ` +
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

  await acquirePollerLeaderLock();
  console.log(`[poller-main] leader lock acquired pid=${process.pid}`);

  workers = await startWorkers();
  console.log("[poller-main] workers started: discovery, hydration, ingestion, rank");

  await trimCompletedQueueJobs();
  console.log("[poller-main] stale BullMQ jobs trimmed (completed/failed >5m)");

  await loadLuaScript();
  startDrip();
  console.log("[poller-main] scheduled slot rate limiter loaded (drip started)");

  const dbOk = await healthCheck();
  if (!dbOk) {
    throw new Error("database_healthcheck_failed");
  }
  console.log("[poller-main] database health check OK");

  await workers.scheduleDiscoveryRepeatJob();
  console.log(
    `[poller-main] discovery repeat job scheduled (${config.DISCOVERY_INTERVAL_MS}ms, ${config.DISCOVERY_PLAYERS_PER_TICK} players/tick)`,
  );

  const pipelinesPaused = await syncMatchPipelinePause(workers.hydrationWorker, workers.ingestionWorker);
  console.log(`[poller-main] match pipelines paused=${pipelinesPaused} (rank backlog policy)`);

  await startMonitoring();
  process.send?.("ready");
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
  stopDrip();

  try {
    await releasePollerLeaderLock();

    if (workers) {
      await closeWorkers(workers);
      workers = null;
    }

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
    if (workers) {
      await closeWorkers(workers);
      workers = null;
    }
    await releasePollerLeaderLock();
  } catch {
    // ignore
  }
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
