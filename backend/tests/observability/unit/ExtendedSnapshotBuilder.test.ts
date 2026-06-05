import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AggregateComputer } from '../../../src/observability/poller-metrics/AggregateComputer.js';
import { AlertDetector } from '../../../src/observability/poller-metrics/AlertDetector.js';
import { ExtendedSnapshotBuilder } from '../../../src/observability/poller-metrics/ExtendedSnapshotBuilder.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';
import type { SessionFeedback } from '../../../src/tuner/types.js';
import { buildGatewayStatus } from '../../tuner/helpers/gatewayFixtures.js';

vi.mock('../../../src/db/client.js', () => ({
  sql: vi.fn(async () => []),
}));

function sessionFeedback(): SessionFeedback {
  return {
    playersCompleted: 10,
    totalGatewayRequests: 48,
    sessionDurationMs: 62_000,
    matchesFetched: 5,
    matchesSkipped: 2,
    participantRanksFetched: 5,
    participantRanksFromCache: 5,
    avgMatchLatencyMs: 2600,
    wasGatewayQueueCongested: false,
  };
}

describe('ExtendedSnapshotBuilder', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
    PollerTuner.resetInstance();
  });

  test('enriches tuner, sessionPool, dataQuality and alertHistory without DB sections on 30m', async () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    const tuner = PollerTuner.getInstance();
    tuner.compute({
      gatewayStatus: buildGatewayStatus(50, 20),
      queueDepth: 0,
      availablePlayers: 200,
    });
    for (let i = 0; i < 6; i += 1) {
      tuner.recordSession(sessionFeedback());
    }

    store.pushSessionPool({
      ts: now,
      type: 'session_completed',
      activeSessions: 0,
      maxSessions: 2,
      queueSize: 50,
      durationMs: 62_000,
      gatewayRequests: 48,
      playersCompleted: 10,
      gatewayQueuePeak: 8,
    });

    store.pushMatchFetch({
      ts: now,
      matchId: 'm1',
      patch: '15.10',
      success: true,
      latencyMs: 10_340,
    });
    store.pushMatchDiscovery({
      ts: now,
      puuid: 'p1',
      matchId: 'm1',
      type: 'skipped_db',
    });
    store.pushMatchDiscovery({
      ts: now,
      puuid: 'p2',
      matchId: 'm2',
      type: 'new',
    });
    store.pushIngestionQueue({
      ts: now,
      matchId: 'm1',
      patch: '15.10',
      rank: 'UNRANKED',
      type: 'queued',
      rankSource: 'unranked_fallback',
    });
    store.pushIngestionQueue({
      ts: now,
      matchId: 'm2',
      patch: '15.10',
      rank: 'GOLD',
      type: 'queued',
      rankSource: 'db_fallback',
    });
    store.pushIngestionWorker({
      ts: now,
      matchId: 'm2',
      patch: '15.10',
      rank: 'GOLD',
      type: 'failed',
      errorMessage: 'column count_baron_kill does not exist',
    });

    const detector = new AlertDetector(store);
    const base = new AggregateComputer(store).computeFull('30m', 99, 19, []);
    const enriched = await new ExtendedSnapshotBuilder(store, detector).enrich(base);

    expect(enriched.tuner?.batchSize).toBeGreaterThan(0);
    expect(enriched.tuner?.ema_matchLatencyMs).toBeGreaterThan(0);
    expect(enriched.sessionPool?.sessionAvgDurationMs).toBe(62_000);
    expect(enriched.sessionPool?.gatewayQueuePeakDuringSession).toBe(8);
    expect(enriched.dataQuality?.matchReuseRatePct).toBe(50);
    expect(enriched.dataQuality?.matchQueueWaitEstimateMs).toBeGreaterThan(7000);
    expect(enriched.dataQuality?.topErrorsLast24h[0]?.message).toContain('count_baron_kill');
    expect(enriched.playerPool).toBeUndefined();
    expect(enriched.byPatch).toBeUndefined();
    expect(enriched.alertHistory?.last24h).toEqual([]);
  });

  test('alertHistory summarizes raise/clear lifecycle', async () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const builder = new ExtendedSnapshotBuilder(store, detector);
    const base = new AggregateComputer(store).computeFull('10m', 99, 19, []);

    const t0 = Date.now() - 60_000;
    store.pushAlertLifecycle({ ts: t0, type: 'ingestion_failure_rate', event: 'raised' });
    store.pushAlertLifecycle({ ts: t0 + 30_000, type: 'ingestion_failure_rate', event: 'cleared' });
    store.pushAlertLifecycle({ ts: t0 + 45_000, type: 'too_many_429s', event: 'raised' });
    store.pushAlertLifecycle({ ts: t0 + 50_000, type: 'too_many_429s', event: 'cleared' });
    store.pushAlertLifecycle({ ts: t0 + 55_000, type: 'ingestion_failure_rate', event: 'raised' });

    const enriched = await builder.enrich(base);
    expect(enriched.alertHistory?.last24h).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ingestion_failure_rate', count: 2 }),
        expect.objectContaining({ type: 'too_many_429s', count: 1 }),
      ]),
    );
    expect(enriched.alertHistory?.mostFrequent).toBe('ingestion_failure_rate');
  });
});
