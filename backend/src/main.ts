import 'dotenv/config';
import './redis/ensure-ready.js';
import type { Worker } from 'bullmq';
import { config } from './config/index.js';
import { healthCheck, sql } from './db/client.js';
import { appendUnifiedLog } from './logging/unifiedAppLog.js';
import { installProcessErrorCapture } from './logging/errorCapture.js';
import { recordProcessStart } from './monitoring/processFreshness.js';
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
import { POLLER_PLATFORMS, POLLER_SETTINGS } from './poller/utils/pollerScope.js';
import { tierWeightsFor } from './poller/pollerSettings.js';
import { createLeagueSweeper } from './poll-orchestration/LeagueSweeper.js';
import { sweepTickDelayMs } from './poll-orchestration/leagueSweep.js';
import { SweepGate } from './poll-orchestration/sweepGate.js';
import { MetricsStore } from './observability/poller-metrics/MetricsStore.js';
import { createRankHistoryPurge } from './poll-orchestration/rankHistoryRetention.js';
import { getAdminLimits } from './services/AdminLimitsService.js';
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
import {
  isLeaderProcessAlive,
  POLLER_LEADER_LOCK_KEY,
  POLLER_LEADER_LOCK_TTL_SEC,
} from './poll-orchestration/pollerLeaderLock.js';

installProcessErrorCapture('poller');
void recordProcessStart('poller').catch((e) => console.warn('[poller-main] recordProcessStart failed:', e));

const orchEnv = loadPollOrchestrationEnv();

let ingestionWorker: Worker | null = null;
let rankWorker: Worker | null = null;
let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
let matchAggregationInterval: NodeJS.Timeout | null = null;
const leagueSweepTimers = new Set<NodeJS.Timeout>();
/** Poller en pause tant que le balayage des rangs du jour tourne. */
const sweepGate = new SweepGate(process.env.LEAGUE_SWEEP_ENABLED === 'false' ? [] : POLLER_PLATFORMS);
let leaderLockRenewInterval: NodeJS.Timeout | null = null;
let dbConsumer: PollerDbConsumer | null = null;
let observability: ObservabilityOrchestrator | null = null;
let sessionPool: SessionPool | null = null;
let shuttingDown = false;

const playerDiscovery = new PlayerDiscovery(
  () => sweepGate.activePlatforms(POLLER_PLATFORMS),
  undefined,
  (platform) => tierWeightsFor(POLLER_SETTINGS, platform),
);
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

    const owner = await redis.get(POLLER_LEADER_LOCK_KEY);

    if (owner && !isLeaderProcessAlive(owner)) {
      console.warn(`[poller-main] stealing leader lock from dead pid=${owner}`);
      await redis.del(POLLER_LEADER_LOCK_KEY);
      continue;
    }

    const ttl = await redis.ttl(POLLER_LEADER_LOCK_KEY);

    // Key exists but has no expiry — should not happen with EX; reclaim defensively.
    if (ttl < 0) {
      console.warn(
        `[poller-main] stealing leader lock without TTL (owner=${owner ?? 'unknown'})`,
      );
      await redis.del(POLLER_LEADER_LOCK_KEY);
      continue;
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
      holdNewSessions: () => sweepGate.allHeld(POLLER_PLATFORMS),
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
  gateway.getObservabilityBus().on('ratelimit:429', (event: { limitType?: string }) => {
    if (event.limitType === 'service') return;
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

  startLeagueSweep();

  void startSessionPool();

  await startMonitoring();
  process.send?.('ready');
}

const RANK_PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Rangs via league-v4 (205 joueurs / requête) chaque jour dès 00:01 : N pages par division (curseur
 * tournant d'un jour à l'autre), même quota pour les tiers apex. Ces joueurs = cibles de poll du jour
 * (poll_targets), rallongé si elles sont toutes pollées. Une boucle par plateforme. Purge horaire de l'historique de rangs et des cibles.
 */
function startLeagueSweep(): void {
  if (process.env.LEAGUE_SWEEP_ENABLED === 'false') {
    console.log('[poller-main] league_sweep disabled');
    return;
  }
  const minIntervalRaw = Number.parseInt(process.env.LEAGUE_SWEEP_MIN_INTERVAL_MS ?? '1250', 10);
  const minIntervalMs = Number.isFinite(minIntervalRaw) && minIntervalRaw > 0 ? minIntervalRaw : 1250;
  const pagesRaw = Number.parseInt(process.env.LEAGUE_SWEEP_PAGES_PER_DIVISION ?? '2', 10);
  const pagesPerDivision = Number.isFinite(pagesRaw) && pagesRaw > 0 ? pagesRaw : 2;
  // Tours de balayage max par jour (1 = pas de rallonge quand toutes les cibles sont pollées).
  const roundsRaw = Number.parseInt(process.env.LEAGUE_SWEEP_MAX_ROUNDS ?? '4', 10);
  const maxRounds = Number.isFinite(roundsRaw) && roundsRaw > 0 ? roundsRaw : 4;

  const schedule = (fn: () => Promise<void>, delayMs: number): void => {
    if (shuttingDown) return;
    const timer = setTimeout(() => {
      leagueSweepTimers.delete(timer);
      void fn();
    }, delayMs);
    leagueSweepTimers.add(timer);
  };

  for (const platform of POLLER_PLATFORMS) {
    const sweeper = createLeagueSweeper(platform, pagesPerDivision);
    const loop = async (): Promise<void> => {
      let delayMs = sweepTickDelayMs('idle', minIntervalMs);
      try {
        const result = await sweeper.tick();
        delayMs = sweepTickDelayMs(result.kind, minIntervalMs);
        // Toutes les cibles du jour pollées : un tour de pages de plus (le repli de PlayerDiscovery poll en attendant).
        if (result.kind === 'idle' && playerDiscovery.exhaustedPlatforms().includes(platform)) {
          if (await sweeper.extend(maxRounds)) {
            playerDiscovery.clearExhausted(platform);
            delayMs = minIntervalMs;
            orchestrationLogger.info({ component: 'LeagueSweeper', platform }, 'poll targets exhausted — sweep extended');
          }
        }
        sweepGate.record(platform, result.kind);
        MetricsStore.getInstance().setSweepHold(sweepGate.allHeld(POLLER_PLATFORMS));
        if (result.kind !== 'idle') {
          orchestrationLogger.debug({ component: 'LeagueSweeper', platform, ...result }, 'league sweep tick');
        }
      } catch (error) {
        orchestrationLogger.warn(
          { component: 'LeagueSweeper', platform, err: error instanceof Error ? error.message : String(error) },
          'league sweep tick failed',
        );
      }
      schedule(loop, delayMs);
    };
    schedule(loop, 0);
  }

  const keepDaysOf = () => getAdminLimits().rankHistoryRetentionDays;
  const purge = createRankHistoryPurge(keepDaysOf);
  const purgeLoop = async (): Promise<void> => {
    try {
      const deleted = await purge();
      if (deleted > 0) {
        orchestrationLogger.info({ component: 'RankHistoryRetention', deleted, keepDays: keepDaysOf() }, 'rank history and matches purged');
      }
    } catch (error) {
      orchestrationLogger.warn(
        { component: 'RankHistoryRetention', err: error instanceof Error ? error.message : String(error) },
        'rank history purge failed',
      );
    }
    schedule(purgeLoop, RANK_PURGE_INTERVAL_MS);
  };
  schedule(purgeLoop, 0);

  console.log(
    `[poller-main] league_sweep ${POLLER_PLATFORMS.join(',')} daily from 00:01, min ${minIntervalMs}ms; raw data (ranks, matches) ${keepDaysOf()}d (admin)`,
  );
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[poller-main] ${signal} received, starting graceful shutdown`);

  if (metricsInterval) clearInterval(metricsInterval);
  if (summary30mInterval) clearInterval(summary30mInterval);
  if (summary1hInterval) clearInterval(summary1hInterval);
  if (matchAggregationInterval) clearInterval(matchAggregationInterval);
  for (const timer of leagueSweepTimers) clearTimeout(timer);
  leagueSweepTimers.clear();

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
    // Écritures en vol finies avant sql.end(), sinon « write CONNECTION_ENDED ».
    if (dbConsumer && !(await dbConsumer.drain(5_000))) {
      orchestrationLogger.warn({ component: 'main' }, 'Poller shutdown: DB writes still in flight after 5s, closing anyway');
    }
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

process.on('unhandledRejection', (reason) => {
  console.error('[poller-main] unhandledRejection', reason);
  void releasePollerLeaderLock()
    .catch(() => undefined)
    .finally(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  console.error('[poller-main] uncaughtException', error);
  void releasePollerLeaderLock()
    .catch(() => undefined)
    .finally(() => process.exit(1));
});

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
