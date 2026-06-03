import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { ingestionQueue } from '../../../src/queues/index.js';
import { AlertDetector } from '../../../src/observability/poller-metrics/AlertDetector.js';
import { AggregateComputer } from '../../../src/observability/poller-metrics/AggregateComputer.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import { ObservabilityOrchestrator } from '../../../src/observability/poller-metrics/ObservabilityOrchestrator.js';
import { setLatestResolvedSince } from '../../../src/poll-orchestration/sinceContext.js';
import {
  initLiveOrchestration,
  resolveTestPuuid,
  sleep,
  waitForGatewayHeadroom,
} from '../../poll-orchestration/integration/helpers/liveOrchestrationEnv.js';
import { gatewayLogger } from '../../../src/riot-gateway/logger.js';

const useLiveApi = process.env.STABILITY_USE_LIVE_API === 'true';
const hasLiveApiKey = (): boolean => Boolean(process.env.RIOT_API_KEY?.startsWith('RGAPI-'));
const durationMinutes = Number.parseInt(process.env.STABILITY_DURATION_MINUTES ?? '20', 10);
const durationMs = Math.max(1, durationMinutes) * 60_000;

type StabilityCheckpoint = {
  elapsed_s: number;
  sessions_completed: number;
  total_matches_fetched: number;
  gateway_r429: number;
  heap_mb: number;
  rank_resolved_from_db: number;
  rank_unranked_fallback: number;
  ingested_processed: number;
  ingested_already_done: number;
  token_underutilized_alert: boolean;
  watchdog_warn_count: number;
};

type CollectedLog = { event?: string; level?: string };

describe.skipIf(!useLiveApi || !hasLiveApiKey())('pollerLiveStability', () => {
  let testPuuid = '';
  const collectedLogs: CollectedLog[] = [];

  beforeAll(() => {
    const origWarn = gatewayLogger.warn.bind(gatewayLogger);
    vi.spyOn(gatewayLogger, 'warn').mockImplementation((obj, ...args) => {
      if (obj && typeof obj === 'object' && 'event' in obj) {
        collectedLogs.push({ event: String((obj as { event?: string }).event), level: 'warn' });
      }
      return origWarn(obj, ...args);
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    ObservabilityOrchestrator.resetInstance();
    const { PollerEngine } = await import('../../../src/poller/PollerEngine.js');
    const { RiotGateway } = await import('../../../src/riot-gateway/gateway/RiotGateway.js');
    await PollerEngine.resetInstance();
    await RiotGateway.resetInstance();
  });

  test(
    `soak: gateway + poller hold for ${durationMinutes} minutes`,
    async () => {
      testPuuid = await resolveTestPuuid();
      MetricsStore.resetInstance();
      ObservabilityOrchestrator.resetInstance();

      const sinceMode = (process.env.STABILITY_SINCE_MODE ?? 'personal_24h') as
        | 'personal_24h'
        | 'prod_patch'
        | 'prod_full_history'
        | 'unknown';
      setLatestResolvedSince({
        mode: sinceMode,
        sinceTimestamp: Math.floor(Date.now() / 1000) - 86_400,
        reason: 'stability-test',
      });

      const { engine, gateway, pollConfig } = await initLiveOrchestration();
      await ObservabilityOrchestrator.getInstance(gateway, ingestionQueue).start();

      const checkpoints: StabilityCheckpoint[] = [];
      let sessionsCompleted = 0;
      let totalMatchesFetched = 0;
      let watchdogWarnCount = 0;
      const baselineHeap = process.memoryUsage().heapUsed;
      let warmupHeap = baselineHeap;
      const startedAt = Date.now();
      let lastSessionCompleteAt = Date.now();

      const store = MetricsStore.getInstance();
      const computer = new AggregateComputer(store);
      const alertDetector = new AlertDetector(store);

      const failStall = (): never => {
        throw new Error(
          `STALL DETECTED after 30s without session:complete (sessions=${sessionsCompleted}, checkpoints=${checkpoints.length})`,
        );
      };

      let watchdog = setTimeout(failStall, 30_000);

      engine.getEventBus().on('session:complete', (event) => {
        clearTimeout(watchdog);
        sessionsCompleted += 1;
        totalMatchesFetched += event.stats.matchesFetched;
        lastSessionCompleteAt = Date.now();
        watchdog = setTimeout(failStall, 30_000);
      });

      const snapshotInterval = setInterval(() => {
        const status = gateway.getStatus();
        const elapsed_s = Math.floor((Date.now() - startedAt) / 1000);
        const heap_mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (elapsed_s >= 60 && warmupHeap === baselineHeap) {
          warmupHeap = process.memoryUsage().heapUsed;
        }

        const app120 = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
        const app1 = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);
        const snap = computer.computeFull('10m', app120?.limit ?? 100, app1?.limit ?? 20, []);
        snap.since = { mode: sinceMode, sinceTimestamp: snap.ts, reason: 'stability-test' };
        alertDetector.check(snap);

        watchdogWarnCount = collectedLogs.filter(
          (l) => l.event === 'watchdog_flush' && l.level === 'warn',
        ).length;

        checkpoints.push({
          elapsed_s,
          sessions_completed: sessionsCompleted,
          total_matches_fetched: totalMatchesFetched,
          gateway_r429: status.metrics.totals.r429,
          heap_mb,
          rank_resolved_from_db: snap.ingestion.rank_resolved_from_db,
          rank_unranked_fallback: snap.ingestion.rank_unranked_fallback,
          ingested_processed: snap.ingestion.ingested_processed,
          ingested_already_done: snap.ingestion.ingested_already_done,
          token_underutilized_alert: snap.active_alerts.some((a) => a.type === 'token_underutilized'),
          watchdog_warn_count: watchdogWarnCount,
        });
      }, 60_000);

      while (Date.now() - startedAt < durationMs) {
        await waitForGatewayHeadroom(8);
        await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], pollConfig);
        await sleep(1_000);
      }

      clearTimeout(watchdog);
      clearInterval(snapshotInterval);
      ObservabilityOrchestrator.getInstance(gateway, ingestionQueue).stop();

      const finalStatus = gateway.getStatus();
      const finalHeap = process.memoryUsage().heapUsed;
      const heapLimit = Math.max(warmupHeap, baselineHeap) * 2;
      const app120 = finalStatus.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
      const app1 = finalStatus.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);
      const finalSnapshot = computer.computeFull('10m', app120?.limit ?? 100, app1?.limit ?? 20, []);
      finalSnapshot.since = { mode: sinceMode, sinceTimestamp: finalSnapshot.ts, reason: 'stability-test' };
      alertDetector.check(finalSnapshot);
      finalSnapshot.active_alerts = alertDetector.getActive();

      console.table(checkpoints);
      console.log(
        `[stability] sessions=${sessionsCompleted} matches=${totalMatchesFetched} r429=${finalStatus.metrics.totals.r429} rank_db=${finalSnapshot.ingestion.rank_resolved_from_db} rank_unranked=${finalSnapshot.ingestion.rank_unranked_fallback}`,
      );

      expect(finalStatus.metrics.totals.r429).toBe(0);

      const totalIngested = finalSnapshot.ingestion.matches_ingested;
      const processed = finalSnapshot.ingestion.ingested_processed;
      const alreadyDone = finalSnapshot.ingestion.ingested_already_done;
      expect(processed + alreadyDone).toBe(totalIngested);

      const criticalAlerts = finalSnapshot.active_alerts.filter((a) => a.severity === 'error');
      expect(criticalAlerts).toHaveLength(0);

      expect(finalSnapshot.active_alerts.map((a) => a.type)).not.toContain('token_underutilized');

      const watchdogEvents = collectedLogs.filter(
        (l) => l.event === 'watchdog_flush' && l.level === 'warn',
      );
      expect(watchdogEvents).toHaveLength(0);

      if (totalIngested > 0) {
        const unrankedPct =
          (finalSnapshot.ingestion.rank_unranked_fallback / totalIngested) * 100;
        expect(unrankedPct).toBeLessThan(5);
      }

      expect(finalHeap).toBeLessThan(heapLimit);
      expect(Date.now() - lastSessionCompleteAt).toBeLessThan(30_000);

      if (sessionsCompleted > 0) {
        const avgSessionIntervalMs = durationMs / sessionsCompleted;
        expect(avgSessionIntervalMs).toBeLessThan(60_000);
      }
    },
    durationMs + 120_000,
  );
});
