import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/poll-orchestration/PatchResolver.js', () => ({
  PatchResolver: {
    resolveCurrentPatchInfo: vi.fn(async () => ({
      patch: '16.11',
      startTimestamp: Math.floor(Date.now() / 1000),
    })),
  },
}));
import { SessionPool } from '../../../../src/poll-orchestration/SessionPool.js';
import type { PlayerQueue } from '../../../../src/poll-orchestration/PlayerQueue.js';
import type { BackpressureMonitor } from '../../../../src/poll-orchestration/BackpressureMonitor.js';
import type { SinceTimestampResolver } from '../../../../src/poll-orchestration/SinceTimestampResolver.js';
import type { RankFilter } from '../../../../src/poll-orchestration/RankFilter.js';
import type { PollerDbConsumer } from '../../../../src/poll-orchestration/PollerDbConsumer.js';
import type { ObservabilityOrchestrator } from '../../../../src/observability/poller-metrics/ObservabilityOrchestrator.js';
import { PollerTuner } from '../../../../src/tuner/PollerTuner.js';
import { buildGatewayStatus } from '../../../tuner/helpers/gatewayFixtures.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SessionPool', () => {
  beforeEach(() => {
    PollerTuner.resetInstance();
  });

  function buildPool(opts: {
    maxSessions?: number;
    batchSize?: number;
    players?: Array<{ puuid: string; region: string }>;
    pollDelayMs?: number;
    exhausted?: boolean;
  }) {
    const players = opts.players ?? [{ puuid: 'p1', region: 'euw1' }];
    const pollDelayMs = opts.pollDelayMs ?? 5;
    let computeCalls = 0;
    let pollCalls = 0;

    const playerQueue = {
      size: players.length,
      dequeue: vi.fn((n: number) => players.splice(0, n)),
      isExhausted: vi.fn(() => opts.exhausted ?? players.length === 0),
      waitForPlayers: vi.fn(async () => {
        await sleep(50);
        return players.splice(0, 1);
      }),
    } as unknown as PlayerQueue;

    const pollerEngine = {
      poll: vi.fn(async () => {
        pollCalls += 1;
        await sleep(pollDelayMs);
        return {
          sessionId: `s-${pollCalls}`,
          stats: {
            playersTotal: 1,
            playersCompleted: 1,
            playersFailed: 0,
            matchIdsDiscovered: 0,
            matchIdsSkipped: 0,
            matchesFetched: 1,
            timelinesFetched: 0,
            participantRanksFetched: 0,
            participantRanksFromCache: 0,
            errors: [],
            startedAt: Date.now(),
            elapsedMs: pollDelayMs,
          },
        };
      }),
    };

    const tuner = PollerTuner.getInstance();
    const computeSpy = vi.spyOn(tuner, 'compute').mockImplementation(() => {
      computeCalls += 1;
      return {
        batchSize: opts.batchSize ?? 1,
        discoveryIntervalMs: 0,
        maxConcurrentPlayers: 1,
        maxConcurrentMatchFetches: 1,
        participantRankConcurrency: 1,
        maxConcurrentSessions: opts.maxSessions ?? 2,
        rawMaxConcurrentSessions: opts.maxSessions ?? 2,
        maxConcurrentSessionsCap: opts.maxSessions ?? 2,
        sessionDispatchS: 1,
        sessionWallClockS: 2,
        targetRps: 1,
        detectedLimit120s: 99,
        detectedLimit1s: 19,
        estimatedReqPerPlayer: 2,
        warmupActive: false,
        sessionsSinceStart: 0,
      };
    });

    const backpressure = {
      getDepth: vi.fn(async () => ({ waiting: 0, active: 0, total: 0 })),
      isOverloaded: vi.fn(async () => false),
      waitForHeadroom: vi.fn(async () => undefined),
    } as unknown as BackpressureMonitor;

    const sinceResolver = {
      resolve: vi.fn(async () => ({
        mode: 'personal_24h' as const,
        sinceTimestamp: 1,
        reason: 'test',
      })),
    } as unknown as SinceTimestampResolver;

    const gateway = {
      getStatus: vi.fn(() => buildGatewayStatus(99, 19)),
    };

    const observability = {
      getStore: () => ({
        matchFetch: { inWindow: () => [] },
      }),
    } as unknown as ObservabilityOrchestrator;

    const rankFilter = { clearCache: vi.fn() } as unknown as RankFilter;
    const dbConsumer = { resetSessionState: vi.fn() } as unknown as PollerDbConsumer;

    const pool = new SessionPool(
      playerQueue,
      pollerEngine as never,
      tuner,
      backpressure,
      sinceResolver,
      gateway as never,
      observability,
      dbConsumer,
      rankFilter,
      {
        maxConcurrentSessions: opts.maxSessions ?? 2,
        batchSize: opts.batchSize ?? 1,
        pollConfig: {
          matchFilter: async () => [],
          rankFilter: async () => false,
        },
      },
    );

    return { pool, pollerEngine, computeSpy, playerQueue, pollCalls: () => pollCalls };
  }

  test('T1 starts up to maxConcurrentSessions sessions', async () => {
    const { pool, pollerEngine } = buildPool({
      maxSessions: 2,
      players: [
        { puuid: 'a', region: 'euw1' },
        { puuid: 'b', region: 'euw1' },
        { puuid: 'c', region: 'euw1' },
      ],
    });

    const run = pool.start();
    await sleep(80);
    await pool.shutdown(5000);
    await run.catch(() => undefined);

    expect(pollerEngine.poll).toHaveBeenCalled();
    expect(pool.getStatus().totalSessionsLaunched).toBeGreaterThanOrEqual(1);
  });

  test('T3 never exceeds maxConcurrentSessions', async () => {
    const { pool } = buildPool({
      maxSessions: 2,
      pollDelayMs: 200,
      players: Array.from({ length: 10 }, (_, i) => ({
        puuid: `p${i}`,
        region: 'euw1',
      })),
    });

    const run = pool.start();
    await sleep(50);
    expect(pool.getStatus().activeSessions).toBeLessThanOrEqual(2);
    await pool.shutdown(5000);
    await run.catch(() => undefined);
  });

  test('T6 shutdown stops launching new sessions', async () => {
    const { pool, pollerEngine } = buildPool({ maxSessions: 1, pollDelayMs: 100 });
    const run = pool.start();
    await sleep(30);
    const launched = pool.getStatus().totalSessionsLaunched;
    await pool.shutdown(5000);
    await run.catch(() => undefined);
    expect(pool.getStatus().isShuttingDown).toBe(true);
    expect(pollerEngine.poll.mock.calls.length).toBeLessThanOrEqual(launched + 1);
  });

  test('T9 tuning params recomputed before slot fill', async () => {
    const { pool, computeSpy } = buildPool({ maxSessions: 1 });
    const run = pool.start();
    await sleep(60);
    await pool.shutdown(5000);
    await run.catch(() => undefined);
    expect(computeSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
