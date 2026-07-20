import 'dotenv/config';
import './redis/ensure-ready.js';
import type { Worker } from 'bullmq';
import { config } from './config/index.js';
import { healthCheck, sql } from './db/client.js';
import { appendUnifiedLog } from './logging/unifiedAppLog.js';
import {
  BackpressureMonitor,
  MatchFilter,
  ParticipantDiscovery,
  PatchResolver,
  PlayerDiscovery,
  PlayerQueue,
  PollerDbConsumer,
  RankFilter,
  SessionPool,
  SinceTimestampResolver,
  assertPollConfigFiltersWired,
  clearSessionPoolStatusGetter,
  loadPollOrchestrationEnv,
} from './poll-orchestration/index.js';
import { PollerEngine } from './poller/PollerEngine.js';
import type { PollConfig } from './poller/types.js';
import { ingestionQueue, getQueueMetrics } from './queues/index.js';
import { trimCompletedQueueJobs } from './queues/queue-cleanup.js';
import { getMatchAggregationIntervalMs,
  runMatchBatchAggregationOnce,
} from './services/matchBatchAggregation.js';
import { initRiotGateway, logRiotRoutingVerified, shutdownRiotGateway } from './riot/client.js';
import { riotConfig } from './riot-gateway/config/riotConfig.js';
import { RiotGateway } from './riot-gateway/index.js';
import { redis } from './redis/client.js';
import { orchestrationLogger } from './poll-orchestration/logger.js';
import { ObservabilityOrchestrator } from './observability/poller-metrics/index.js';
import { PollerTuner, TUNER_MAX_DISCOVERY_FETCH } from './tuner/index.js';

const POLLER_LEADER_LOCK_KEY = 'poller:leader';
const POLLER_LEADER_LOCK_TTL_SEC = 120;

const orchEnv = loadPollOrchestrationEnv();

let ingestionWorker: Worker | null = null;
let rankWorker: Worker | null = null;
let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
let matchAggregationInterval: NodeJS.Timeout | null = null;
let leaderLockRenewInterval: NodeJS.Timeout | null = null;
let dbConsumer: PollerDbConsumer | null = null;
let observability: ObservabilityOrchestrator | null = null;
let sessionPool: SessionPool | null = null;
let shuttingDown = false;

const playerDiscovery = new PlayerDiscovery();
const sinceResolver = new SinceTimestampResolver(playerDiscovery);
const matchFilter = new MatchFilter();
const rankFilter = new RankFilter();
const participantDiscovery = new ParticipantDiscovery();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquirePollerLeaderLock(maxWaitMs = 60_000): Promise<void> {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < maxWaitMs) {
    // Try to acquire lock
    const acquired = await redis.set(
      POLLER_LEADER_LOCK_KEY,
      String(process.pid),
      'EX',
      POLLER_LEADER_LOCK_TTL_SEC,
      'NX',
    );

    if (acquired === 'OK') {
      console.log(`[poller-main] leader lock acquired pid=${process.pid}`);
      leaderLockRenewInterval = setInterval(() => {
        void redis
          .set(POLLER_LEADER_LOCK_KEY, String(process.pid), 'EX', POLLER_LEADER_LOCK_TTL_SEC)
          .catch((error) => {
            console.error('[poller-main] leader lock renew failed', error);
          });
      }, 30_000);
      return;
    }

    // Lock held - check TTL
    const ttl = await redis.ttl(POLLER_LEADER_LOCK_KEY);
    const owner = await redis.get(POLLER_LEADER_LOCK_KEY);

    // If lock has no TTL or is stale (> 2x TTL old), steal it
    if (ttl < 0 || ttl > POLLER_LEADER_LOCK_TTL_SEC * 2) {
      console.warn(
        `[poller-main] stealing stale leader lock (ttl=${ttl}, owner=${owner ?? 'unknown'})`,
      );
      await redis.del(POLLER_LEADER_LOCK_KEY);
      continue; // Retry immediately
    }

    // If TTL is short (< 5s), wait for it to expire
    if (ttl < 5) {
      console.warn(
        `[poller-main] leader lock expires in ${ttl}s, waiting... (owner=${owner ?? 'unknown'})`,
      );
      await sleep((ttl + 1) * 1000);
      continue;
    }

    // Exponential backoff with jitter
    attempt++;
    const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 10_000);
    console.warn(
      `[poller-main] leader lock held by pid=${owner ?? 'unknown'}, waiting ${Math.round(delay)}ms (attempt ${attempt})`,
    );
    await sleep(delay);
  }

  // Max wait exceeded - exit
  const owner = await redis.get(POLLER_LEADER_LOCK_KEY);
  console.error(
    `[poller-main] failed to acquire leader lock after ${maxWaitMs}ms (owner=${owner ?? 'unknown'}) — exiting`,
  );
  await redis.quit().catch(() => undefined);
  process.exit(0);
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
  const mod = await import('./workers/ingestion.worker.bootstrap.js');
  return mod.ingestionWorker;
}

async function startRankWorkerIfProduction(): Promise<Worker | null> {
  if (riotConfig.apiKeyType === 'personal') {
    console.log('[poller-main] rank worker skipped (personal API key — materialize rank gate)');
    return null;
  }
  const mod = await import('./workers/rank.worker.js');
  const worker = await mod.createRankWorker();
  console.log(`[poller-main] rank worker started concurrency=${worker.concurrency}`);
  return worker;
}

async function getDataLagSeconds(): Promise<number | null> {
  try {
    const rows = await sql<{ lag_seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::bigint AS lag_seconds
      FROM matchs
    `;
    return rows[0]?.lag_seconds ?? null;
  } catch {
    return null;
  }
}

async function logMetricsTick(): Promise<void> {
  const metrics = await getQueueMetrics();
  const gateway = RiotGateway.getInstance().getStatus();
  const lagSeconds = await getDataLagSeconds();
  const bucket120 = gateway.buckets.find((b) => b.windowMs === 120_000);
  console.log(
    `[poller-main] ingestion(w:${metrics.ingestion.waiting},a:${metrics.ingestion.active}) ` +
      `hydration(w:${metrics.hydration.waiting},a:${metrics.hydration.active}) ` +
      `lag_s=${lagSeconds ?? 'n/a'} gateway_r429=${gateway.metrics.totals.r429} ` +
      `bucket120=${bucket120?.available ?? 'n/a'}/${bucket120?.limit ?? 'n/a'}`,
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
      (SELECT COUNT(*)::int FROM matchs WHERE created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS matches_added
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

async function runMatchBatchAggregation(): Promise<void> {
  try {
    await runMatchBatchAggregationOnce();
  } catch (error) {
    console.error('[poller-main] match_batch_aggregation_failed', error);
  }
}

async function emitDbWindowSummary(window: '30m' | '1h'): Promise<void> {
  const now = Date.now();
  const windowMs = window === '30m' ? 30 * 60_000 : 60 * 60_000;
  const dbWindow = await queryDbWindowStats(now - windowMs, now);
  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: `poller_db_${window}`,
    message: `poller db window ${window}`,
    json: { window, atIso: new Date().toISOString(), dbWindow },
  });
}

async function startMonitoring(): Promise<void> {
  await logMetricsTick();
  metricsInterval = setInterval(() => void logMetricsTick(), 30_000);
  summary30mInterval = setInterval(() => void emitDbWindowSummary('30m'), 30 * 60_000);
  summary1hInterval = setInterval(() => void emitDbWindowSummary('1h'), 60 * 60_000);
}

async function startSessionPool(): Promise<void> {
  const backpressure = new BackpressureMonitor(
    ingestionQueue,
    orchEnv.backpressureThreshold,
    orchEnv.backpressurePollIntervalMs,
  );
  const tuner = PollerTuner.getInstance();
  const gateway = RiotGateway.getInstance();
  const engine = PollerEngine.getInstance();

  const initialParams = tuner.compute({
    gatewayStatus: gateway.getStatus(),
    queueDepth: 0,
    availablePlayers: 1000,
  });

  const playerQueue = new PlayerQueue(playerDiscovery, {
    highWaterMark: initialParams.batchSize * initialParams.maxConcurrentSessions * 4,
    lowWaterMark: initialParams.batchSize * initialParams.maxConcurrentSessions,
    fetchBatchSize: initialParams.batchSize * initialParams.maxConcurrentSessions * 2,
  });
  await playerQueue.prime();

  const resolveParticipantRanks =
    riotConfig.apiKeyType === 'personal'
      ? false
      : process.env.RESOLVE_PARTICIPANT_RANKS !== 'false';

  const basePollConfig: Partial<PollConfig> = {
    matchIdsPerPage: Number.parseInt(process.env.POLLER_MATCH_IDS_PER_PAGE ?? '100', 10),
    resolveParticipantRanks,
    matchFilter: (matchIds) => matchFilter.filterNew(matchIds),
    rankFilter: (puuid, region) => rankFilter.isKnownToday(puuid, region),
  };
  assertPollConfigFiltersWired(basePollConfig, orchestrationLogger);

  if (!observability) {
    throw new Error('observability_not_started');
  }

  sessionPool = new SessionPool(
    playerQueue,
    engine,
    tuner,
    backpressure,
    sinceResolver,
    gateway,
    observability,
    dbConsumer,
    rankFilter,
    {
      maxConcurrentSessions: initialParams.maxConcurrentSessions,
      batchSize: initialParams.batchSize,
      pollConfig: basePollConfig,
    },
  );

  orchestrationLogger.info(
    {
      component: 'main',
      maxConcurrentSessions: initialParams.maxConcurrentSessions,
      batchSize: initialParams.batchSize,
      queueHighWater: initialParams.batchSize * initialParams.maxConcurrentSessions * 4,
    },
    'session pool starting',
  );

  await sessionPool.start();
}

async function bootstrap(): Promise<void> {
  void config.ENV;
  void config.REDIS_URL;
  void config.DATABASE_URL;
  void config.RIOT_API_KEY;

  const patchInfo = await PatchResolver.resolveCurrentPatchInfo();
  console.log(`[poller-main] config validated env=${config.ENV}`);
  logRiotRoutingVerified();
  initRiotGateway();

  const resolveParticipantRanks =
    riotConfig.apiKeyType === 'personal'
      ? false
      : process.env.RESOLVE_PARTICIPANT_RANKS !== 'false';
  orchestrationLogger.info(
    {
      component: 'main',
      apiKeyType: riotConfig.apiKeyType,
      resolveParticipantRanks,
      note: resolveParticipantRanks
        ? 'player rank (path A) + participant ranks (path B) both active'
        : 'player rank (path A) active - participant ranks (path B) disabled (personal key)',
    },
    'rank resolution config',
  );

  await acquirePollerLeaderLock();

  ingestionWorker = await startIngestionWorker();
  console.log('[poller-main] ingestion worker started');

  rankWorker = await startRankWorkerIfProduction();

  const engine = PollerEngine.getInstance();
  dbConsumer = new PollerDbConsumer(participantDiscovery, playerDiscovery, {
    currentPatch: patchInfo.patch,
    rankTierForUnranked: 'UNRANKED',
    resolveParticipantRanks,
  }, engine.getEventBus());
  dbConsumer.subscribe();

  const gateway = RiotGateway.getInstance();
  const tuner = PollerTuner.getInstance();
  gateway.getObservabilityBus().on('ratelimit:429', () => {
    tuner.onRateLimitHit();
  });

  observability = ObservabilityOrchestrator.getInstance(gateway, ingestionQueue);
  await observability.start();

  orchestrationLogger.info(
    {
      currentPatch: patchInfo.patch,
      patchStart: new Date(patchInfo.startTimestamp * 1000).toISOString(),
      tunerMaxDiscoveryFetch: TUNER_MAX_DISCOVERY_FETCH,
      backpressureThreshold: orchEnv.backpressureThreshold,
    },
    'poll orchestration initialized',
  );

  await trimCompletedQueueJobs();

  const dbOk = await healthCheck();
  if (!dbOk) {
    throw new Error('database_healthcheck_failed');
  }

  const aggregationIntervalMs = getMatchAggregationIntervalMs();
  void runMatchBatchAggregation();
  matchAggregationInterval = setInterval(() => void runMatchBatchAggregation(), aggregationIntervalMs);
  console.log(`[poller-main] match_batch_aggregation scheduled every ${aggregationIntervalMs}ms`);

  void startSessionPool();

  await startMonitoring();
  process.send?.('ready');
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[poller-main] ${signal} received, starting graceful shutdown`);

  if (metricsInterval) clearInterval(metricsInterval);
  if (summary30mInterval) clearInterval(summary30mInterval);
  if (summary1hInterval) clearInterval(summary1hInterval);
  if (matchAggregationInterval) clearInterval(matchAggregationInterval);

  // Release the leader lock FIRST, before the (up to 60s) session-pool drain.
  // The incoming instance can then acquire it within seconds instead of timing
  // out and exiting, which previously caused a ~2 min ingestion stall on every
  // PM2 restart. This instance no longer starts new poll sessions once
  // `shuttingDown` is set, and all DB writes are idempotent, so a brief overlap
  // with the new leader is safe.
  await releasePollerLeaderLock();

  try {
    await sessionPool?.shutdown(60_000);
    sessionPool = null;
    clearSessionPoolStatusGetter();
    dbConsumer?.unsubscribe();
    dbConsumer = null;
    observability?.stop();
    ObservabilityOrchestrator.resetInstance();
    observability = null;
    await PollerEngine.resetInstance();

    if (ingestionWorker) {
      await ingestionWorker.pause(true);
      await ingestionWorker.close();
      ingestionWorker = null;
    }
    if (rankWorker) {
      await rankWorker.pause(true);
      await rankWorker.close();
      rankWorker = null;
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

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

void bootstrap().catch(async (error) => {
  console.error('[poller-main] bootstrap failed', error);
  try {
    if (ingestionWorker) {
      await ingestionWorker.pause(true);
      await ingestionWorker.close();
    }
    if (rankWorker) {
      await rankWorker.pause(true);
      await rankWorker.close();
    }
    await releasePollerLeaderLock();
    await shutdownRiotGateway();
    await sql.end();
    await redis.quit();
  } catch {
    // ignore
  }
  process.exit(1);
});
