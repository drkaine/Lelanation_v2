import 'dotenv/config';
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
  PollerDbConsumer,
  RankFilter,
  SinceTimestampResolver,
  applySinceModeTransition,
  assertPollConfigFiltersWired,
  loadPollOrchestrationEnv,
  setLatestResolvedSince,
} from './poll-orchestration/index.js';
import type { SinceMode } from './poll-orchestration/SinceTimestampResolver.js';
import { PollerEngine } from './poller/PollerEngine.js';
import type { Platform, Player, PollConfig } from './poller/types.js';
import { ingestionQueue, getQueueMetrics } from './queues/index.js';
import { trimCompletedQueueJobs } from './queues/queue-cleanup.js';
import { purgeStaleProcessedMatchesAndRankHistory } from './services/patch-retention-cleanup.js';
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
let metricsInterval: NodeJS.Timeout | null = null;
let summary30mInterval: NodeJS.Timeout | null = null;
let summary1hInterval: NodeJS.Timeout | null = null;
let patchRetentionInterval: NodeJS.Timeout | null = null;
let leaderLockRenewInterval: NodeJS.Timeout | null = null;
let dbConsumer: PollerDbConsumer | null = null;
let observability: ObservabilityOrchestrator | null = null;
let shuttingDown = false;

const playerDiscovery = new PlayerDiscovery();
const sinceResolver = new SinceTimestampResolver(playerDiscovery);
const matchFilter = new MatchFilter();
const rankFilter = new RankFilter();
const participantDiscovery = new ParticipantDiscovery();

function toPlatform(region: string): Platform {
  return region.trim().toLowerCase() as Platform;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      `[poller-main] leader lock held by pid=${owner ?? 'unknown'} (this pid=${process.pid}) — exiting`,
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
      console.warn(`[poller-main] patch_retention_purge_skipped reason=${result.skipReason ?? 'unknown'}`);
      return;
    }
    console.log(
      `[poller-main] patch_retention_purge deleted_processed=${result.deletedProcessedMatches} deleted_rank=${result.deletedRankHistory}`,
    );
  } catch (error) {
    console.error('[poller-main] patch_retention_purge_failed', error);
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

async function discoveryLoop(): Promise<void> {
  orchestrationLogger.info('discovery loop started');
  const backpressure = new BackpressureMonitor(
    ingestionQueue,
    orchEnv.backpressureThreshold,
    orchEnv.backpressurePollIntervalMs,
  );
  const tuner = PollerTuner.getInstance();
  const gateway = RiotGateway.getInstance();
  let requestsAtSessionStart = 0;
  let previousSinceMode: SinceMode | null = null;

  while (!shuttingDown) {
    try {
      await backpressure.waitForHeadroom();
      const { total: queueDepth } = await backpressure.getDepth();

      const discovered = await playerDiscovery.fetchNextBatch(TUNER_MAX_DISCOVERY_FETCH);
      if (discovered.length === 0) {
        orchestrationLogger.warn({ sleepMs: orchEnv.discoveryIdleSleepMs }, 'no players in discovery batch, sleeping');
        await sleep(orchEnv.discoveryIdleSleepMs);
        continue;
      }

      const tuned = tuner.compute({
        gatewayStatus: gateway.getStatus(),
        queueDepth,
        availablePlayers: discovered.length,
      });

      const players = discovered.slice(0, tuned.batchSize);

      orchestrationLogger.info(
        {
          count: players.length,
          discovered: discovered.length,
          firstPlayer: players[0]?.puuid,
          lastPlayer: players[players.length - 1]?.puuid,
        },
        'discovery batch ready',
      );

      const patchInfo = await PatchResolver.resolveCurrentPatchInfo();
      const resolved = await sinceResolver.resolve();
      setLatestResolvedSince(resolved);
      previousSinceMode = applySinceModeTransition(previousSinceMode, resolved);

      orchestrationLogger.info(
        {
          patch: patchInfo.patch,
          since: new Date(resolved.sinceTimestamp * 1000).toISOString(),
          sinceMode: resolved.mode,
          sinceReason: resolved.reason,
        },
        'polling patch',
      );

      const pollConfig: Partial<PollConfig> = {
        sinceTimestamp: resolved.sinceTimestamp,
        matchIdsPerPage: Number.parseInt(process.env.POLLER_MATCH_IDS_PER_PAGE ?? '100', 10),
        resolveParticipantRanks:
          riotConfig.apiKeyType === 'personal'
            ? false
            : process.env.RESOLVE_PARTICIPANT_RANKS !== 'false',
        maxConcurrentPlayers: tuned.maxConcurrentPlayers,
        maxConcurrentMatchFetches: tuned.maxConcurrentMatchFetches,
        participantRankConcurrency: tuned.participantRankConcurrency,
        matchFilter: (matchIds) => matchFilter.filterNew(matchIds),
        rankFilter: (puuid, region) => rankFilter.isKnownToday(puuid, region),
      };
      assertPollConfigFiltersWired(pollConfig, orchestrationLogger);

      const pollerPlayers: Player[] = players.map((p) => ({
        puuid: p.puuid,
        platform: toPlatform(p.region),
      }));

      const engine = PollerEngine.getInstance();
      dbConsumer?.resetSessionState();
      rankFilter.clearCache();

      requestsAtSessionStart = gateway.getStatus().metrics.totals.requests;

      const { sessionId, stats } = await engine.poll(pollerPlayers, pollConfig);

      const requestsUsed =
        gateway.getStatus().metrics.totals.requests - requestsAtSessionStart;

      tuner.recordSession({
        playersCompleted: stats.playersCompleted,
        totalGatewayRequests: requestsUsed,
        sessionDurationMs: stats.elapsedMs ?? 0,
        matchesFetched: stats.matchesFetched,
        matchesSkipped: stats.matchIdsSkipped,
        participantRanksFetched: stats.participantRanksFetched,
        participantRanksFromCache: stats.participantRanksFromCache,
      });

      orchestrationLogger.info(
        {
          sessionId,
          players: stats.playersTotal,
          matchesFetched: stats.matchesFetched,
          errors: stats.errors.length,
          elapsedMs: stats.elapsedMs,
          tunerSnapshot: tuner.getSnapshot(),
        },
        'poll session complete',
      );

      let sleepMs = 0;
      if (stats.matchesFetched === 0) {
        sleepMs = orchEnv.discoveryIdleSleepMs;
      } else if (tuned.discoveryIntervalMs > 0) {
        sleepMs = tuned.discoveryIntervalMs;
      }
      if (sleepMs > 0) {
        orchestrationLogger.debug({ sleepMs }, 'sleeping before next discovery');
        await sleep(sleepMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      orchestrationLogger.error({ error: message }, 'discovery loop iteration failed');
      await sleep(10_000);
    }
  }

  orchestrationLogger.info('discovery loop exited (shutdown signal)');
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
  console.log(`[poller-main] leader lock acquired pid=${process.pid}`);

  ingestionWorker = await startIngestionWorker();
  console.log('[poller-main] ingestion worker started');

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

  await runPatchRetentionPurge();
  patchRetentionInterval = setInterval(() => void runPatchRetentionPurge(), 6 * 60 * 60_000);

  void discoveryLoop();

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
  if (patchRetentionInterval) clearInterval(patchRetentionInterval);

  try {
    dbConsumer?.unsubscribe();
    dbConsumer = null;
    observability?.stop();
    ObservabilityOrchestrator.resetInstance();
    observability = null;
    await releasePollerLeaderLock();
    await PollerEngine.resetInstance();

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

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

void bootstrap().catch(async (error) => {
  console.error('[poller-main] bootstrap failed', error);
  try {
    if (ingestionWorker) {
      await ingestionWorker.pause(true);
      await ingestionWorker.close();
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
