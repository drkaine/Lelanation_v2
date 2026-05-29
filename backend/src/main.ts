import 'dotenv/config';
import type { Worker } from 'bullmq';
import { config } from './config/index.js';
import { healthCheck, sql } from './db/client.js';
import { appendUnifiedLog } from './logging/unifiedAppLog.js';
import { pollerV2Observability } from './observability/poller-v2-observability.js';
import { fetchNextPlayerBatch } from './db/queries/players.js';
import { PollerDbConsumer, PollerEngine } from './poller/index.js';
import type { Platform, Player } from './poller/types.js';
import { getQueueMetrics } from './queues/index.js';
import { trimCompletedQueueJobs } from './queues/queue-cleanup.js';
import { purgeStaleProcessedMatchesAndRankHistory } from './services/patch-retention-cleanup.js';
import { initRiotGateway, logRiotRoutingVerified, shutdownRiotGateway } from './riot/client.js';
import { RiotGateway } from './riot-gateway/index.js';
import { normalizePlatformRegion } from './riot/platform-region.js';
import { redis } from './redis/client.js';

const POLLER_LEADER_LOCK_KEY = 'poller-v2:leader';
const POLLER_LEADER_LOCK_TTL_SEC = 120;

let ingestionWorker: Worker | null = null;
let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
let patchRetentionInterval: NodeJS.Timeout | null = null;
let leaderLockRenewInterval: NodeJS.Timeout | null = null;
let discoveryInterval: NodeJS.Timeout | null = null;
let dbConsumer: PollerDbConsumer | null = null;
let discoveryRunning = false;
let shuttingDown = false;

function resolvePollSinceTimestamp(): number {
  const days = Number.parseInt(process.env.POLLER_SINCE_DAYS ?? '14', 10);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 14;
  return Math.floor(Date.now() / 1000) - safeDays * 24 * 3600;
}

function toPlatform(region: string): Platform {
  return normalizePlatformRegion(region).toLowerCase() as Platform;
}

function buildPollConfig() {
  return {
    sinceTimestamp: resolvePollSinceTimestamp(),
    matchIdsPerPage: Number.parseInt(process.env.POLLER_MATCH_IDS_PER_PAGE ?? '100', 10),
    maxConcurrentPlayers: Number.parseInt(process.env.POLLER_MAX_CONCURRENT_PLAYERS ?? '3', 10),
    maxConcurrentMatchFetches: Number.parseInt(process.env.POLLER_MAX_CONCURRENT_MATCH_FETCHES ?? '5', 10),
    resolveParticipantRanks: process.env.POLLER_RESOLVE_PARTICIPANT_RANKS !== 'false',
    participantRankConcurrency: Number.parseInt(process.env.POLLER_PARTICIPANT_RANK_CONCURRENCY ?? '5', 10),
  };
}

async function acquirePollerLeaderLock(): Promise<void> {
  const acquired = await redis.set(
    POLLER_LEADER_LOCK_KEY,
    String(process.pid),
    'EX',
    POLLER_LEADER_LOCK_TTL_SEC,
    'NX',
  );
  if (acquired !== 'OK') {
    const owner = await redis.get(POLLER_LEADER_LOCK_KEY);
    console.warn(
      `[poller-main] leader lock held by pid=${owner ?? 'unknown'} (this pid=${process.pid}) — exiting; use a single poller instance only`,
    );
    await redis.quit().catch(() => undefined);
    process.exit(0);
  }

  leaderLockRenewInterval = setInterval(() => {
    void redis
      .set(POLLER_LEADER_LOCK_KEY, String(process.pid), 'EX', POLLER_LEADER_LOCK_TTL_SEC)
      .catch((error) => {
        console.error('[poller-main] leader lock renew failed', error);
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

async function startIngestionWorker(): Promise<Worker> {
  const mod = await import('./workers/ingestion.worker.js');
  return mod.ingestionWorker;
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
  const gateway = RiotGateway.getInstance().getStatus();
  const lagSeconds = await getDataLagSeconds();

  pollerV2Observability.recordQueueSnapshot({
    discovery: metrics.discovery,
    hydration: metrics.hydration,
    ingestion: metrics.ingestion,
    rank: metrics.rank,
    dataLagSeconds: lagSeconds,
    tickDurationMs: Date.now() - startedAt,
    rankWorkerConfiguredConcurrency: 0,
    rankBacklog: (metrics.rank.waiting ?? 0) + (metrics.rank.active ?? 0),
  });
  await pollerV2Observability.flushSnapshotToDisk();

  const bucket120 = gateway.buckets.find((b) => b.windowMs === 120_000);
  console.log(
    `[poller-main] ingestion(w:${metrics.ingestion.waiting},a:${metrics.ingestion.active},f:${metrics.ingestion.failed}) ` +
      `gateway_r429=${gateway.metrics.totals.r429} bucket120=${bucket120?.available ?? 'n/a'}/${bucket120?.limit ?? 'n/a'} ` +
      `data_lag_seconds=${lagSeconds ?? 'n/a'}`,
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

async function runPatchRetentionPurge(): Promise<void> {
  try {
    const result = await purgeStaleProcessedMatchesAndRankHistory();
    if (result.skipped) {
      console.warn(
        `[poller-main] patch_retention_purge_skipped reason=${result.skipReason ?? 'unknown'} retention_days=${result.retentionDays}`,
      );
      return;
    }
    console.log(
      `[poller-main] patch_retention_purge cutoff=${result.cutoffDate} retention_days=${result.retentionDays} ` +
        `deleted_processed_matches=${result.deletedProcessedMatches} deleted_rank_history=${result.deletedRankHistory}`,
    );
  } catch (error) {
    console.error('[poller-main] patch_retention_purge_failed', error);
  }
}

async function emitWindowSummary(window: '30m' | '1h'): Promise<void> {
  const now = Date.now();
  const windowMs = window === '30m' ? 30 * 60_000 : 60 * 60_000;
  const dbWindow = await queryDbWindowStats(now - windowMs, now);
  const payload = await pollerV2Observability.buildWindowSummary(window, dbWindow);
  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: window === '30m' ? 'poller_v2_30m' : 'poller_v2_hourly',
    message: `poller-v3 summary ${window}`,
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
    void emitWindowSummary('30m');
  }, 30 * 60_000);
  summary1hInterval = setInterval(() => {
    void emitWindowSummary('1h');
  }, 60 * 60_000);
}

async function runDiscoveryCycle(): Promise<void> {
  if (discoveryRunning || shuttingDown) return;
  discoveryRunning = true;
  try {
    const batch = await fetchNextPlayerBatch(config.DISCOVERY_PLAYERS_PER_TICK);
    if (batch.length === 0) {
      pollerV2Observability.incDiscoveryNoPlayerCycle();
      console.log('[poller-main] discovery tick: no players in queue');
      return;
    }

    const players: Player[] = batch.map((row) => ({
      puuid: row.puuid,
      platform: toPlatform(row.region),
    }));

    pollerV2Observability.incDiscoveryCycle();
    const engine = PollerEngine.getInstance();
    dbConsumer?.resetSessionState();
    const { stats } = await engine.poll(players, buildPollConfig());
    pollerV2Observability.recordDiscoveryMatches(stats.matchIdsDiscovered, stats.matchesFetched);
    console.log(
      `[poller-main] poll complete players=${stats.playersCompleted}/${stats.playersTotal} ` +
        `matches=${stats.matchesFetched} match_ids=${stats.matchIdsDiscovered} errors=${stats.errors.length}`,
    );
  } catch (error) {
    console.error('[poller-main] discovery cycle failed', error);
  } finally {
    discoveryRunning = false;
  }
}

function startDiscoveryLoop(): void {
  void runDiscoveryCycle();
  discoveryInterval = setInterval(() => {
    void runDiscoveryCycle();
  }, config.DISCOVERY_INTERVAL_MS);
}

async function bootstrap(): Promise<void> {
  void config.ENV;
  void config.REDIS_URL;
  void config.DATABASE_URL;
  void config.RIOT_API_KEY;

  console.log(`[poller-main] config validated env=${config.ENV}`);
  logRiotRoutingVerified();
  initRiotGateway();

  await acquirePollerLeaderLock();
  console.log(`[poller-main] leader lock acquired pid=${process.pid}`);

  ingestionWorker = await startIngestionWorker();
  console.log('[poller-main] ingestion worker started');

  const engine = PollerEngine.getInstance();
  dbConsumer = new PollerDbConsumer({
    resolveParticipantRanks: buildPollConfig().resolveParticipantRanks,
  });
  dbConsumer.attach(engine.getEventBus());
  console.log('[poller-main] PollerDbConsumer attached to event bus');

  await trimCompletedQueueJobs();
  console.log('[poller-main] stale BullMQ jobs trimmed (completed/failed >5m)');

  const dbOk = await healthCheck();
  if (!dbOk) {
    throw new Error('database_healthcheck_failed');
  }
  console.log('[poller-main] database health check OK');

  await runPatchRetentionPurge();
  patchRetentionInterval = setInterval(() => {
    void runPatchRetentionPurge();
  }, 6 * 60 * 60_000);

  startDiscoveryLoop();
  console.log(
    `[poller-main] discovery loop started (${config.DISCOVERY_INTERVAL_MS}ms, ${config.DISCOVERY_PLAYERS_PER_TICK} players/tick)`,
  );

  await startMonitoring();
  process.send?.('ready');
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[poller-main] ${signal} received, starting graceful shutdown`);

  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }
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
  if (patchRetentionInterval) {
    clearInterval(patchRetentionInterval);
    patchRetentionInterval = null;
  }

  try {
    await releasePollerLeaderLock();
    await PollerEngine.resetInstance();
    dbConsumer = null;

    if (ingestionWorker) {
      await ingestionWorker.pause(true);
      await ingestionWorker.close();
      ingestionWorker = null;
    }

    await shutdownRiotGateway();
    await sql.end();
    await redis.quit();
    console.log('[poller-main] graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('[poller-main] graceful shutdown failed', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

void bootstrap().catch(async (error) => {
  console.error('[poller-main] bootstrap failed', error);
  try {
    if (ingestionWorker) {
      await ingestionWorker.pause(true);
      await ingestionWorker.close();
      ingestionWorker = null;
    }
    await releasePollerLeaderLock();
  } catch {
    // ignore
  }
  try {
    await shutdownRiotGateway();
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
