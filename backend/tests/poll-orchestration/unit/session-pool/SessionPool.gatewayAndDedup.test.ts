import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/poll-orchestration/PatchResolver.js', () => ({
  PatchResolver: {
    resolveCurrentPatchInfo: vi.fn(async () => ({
      patch: '16.11',
      startTimestamp: Math.floor(Date.now() / 1000),
    })),
  },
}));

import {
  maxGatewayQueueBeforeSession,
  SessionPool,
} from '../../../../src/poll-orchestration/SessionPool.js';
import type { PlayerQueue } from '../../../../src/poll-orchestration/PlayerQueue.js';
import type { BackpressureMonitor } from '../../../../src/poll-orchestration/BackpressureMonitor.js';
import type { SinceTimestampResolver } from '../../../../src/poll-orchestration/SinceTimestampResolver.js';
import type { RankFilter } from '../../../../src/poll-orchestration/RankFilter.js';
import type { PollerDbConsumer } from '../../../../src/poll-orchestration/PollerDbConsumer.js';
import type { ObservabilityOrchestrator } from '../../../../src/observability/poller-metrics/ObservabilityOrchestrator.js';
import { PollSession } from '../../../../src/poller/PollSession.js';
import { PollerEventBus } from '../../../../src/poller/PollerEventBus.js';
import { PollerTuner } from '../../../../src/tuner/PollerTuner.js';
import { buildGatewayStatus } from '../../../tuner/helpers/gatewayFixtures.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SessionPool gateway guard and shared dedup', () => {
  beforeEach(() => {
    PollerTuner.resetInstance();
    process.env.MAX_GATEWAY_QUEUE = '10';
  });

  afterEach(() => {
    delete process.env.MAX_GATEWAY_QUEUE;
    PollerTuner.resetInstance();
  });

  test('T1 waitForGatewayQueue blocks until queue drops below threshold', async () => {
    let gatewayQueueSize = 15;
    const gateway = {
      getStatus: vi.fn(() => ({
        ...buildGatewayStatus(100, 20),
        queue: { size: gatewayQueueSize, highPriority: 0 },
      })),
    };

    const pool = new SessionPool(
      { size: 0, dequeue: vi.fn(() => []), isExhausted: vi.fn(() => true), waitForPlayers: vi.fn() } as never,
      { poll: vi.fn() } as never,
      PollerTuner.getInstance(),
      {} as never,
      {} as never,
      gateway as never,
      { getStore: () => ({ matchFetch: { inWindow: () => [] } }) } as never,
      null,
      { clearCache: vi.fn() } as never,
      { maxConcurrentSessions: 1, batchSize: 1, pollConfig: {} },
    );

    const waitPromise = (
      pool as unknown as { waitForGatewayQueue: (n: number) => Promise<void> }
    ).waitForGatewayQueue(maxGatewayQueueBeforeSession());

    await sleep(250);
    expect(gateway.getStatus).toHaveBeenCalled();
    gatewayQueueSize = 5;
    await waitPromise;
  });

  test('T2 shared processedMatchIds: concurrent sessions share the same Set', () => {
    const shared = new Set<string>();
    const bus = new PollerEventBus();
    const baseConfig = {
      sinceTimestamp: 1,
      maxConcurrentPlayers: 1,
      maxConcurrentMatchFetches: 1,
      resolveParticipantRanks: false,
      participantRankConcurrency: 1,
      sharedProcessedMatchIds: shared,
    };

    const sessionA = new PollSession([{ puuid: 'a', platform: 'euw1' }], baseConfig, bus);
    const sessionB = new PollSession([{ puuid: 'b', platform: 'euw1' }], baseConfig, bus);

    expect(sessionA.getProcessedMatchIds()).toBe(shared);
    expect(sessionB.getProcessedMatchIds()).toBe(shared);

    shared.add('EUW1_shared_match');
    expect(sessionA.getProcessedMatchIds().has('EUW1_shared_match')).toBe(true);
    expect(sessionB.getProcessedMatchIds().has('EUW1_shared_match')).toBe(true);
  });

  test('T3 sharedProcessedMatchIds reset after 24h', () => {
    const pool = new SessionPool(
      { size: 0, dequeue: vi.fn(() => []), isExhausted: vi.fn(() => true), waitForPlayers: vi.fn() } as never,
      { poll: vi.fn() } as never,
      PollerTuner.getInstance(),
      {} as never,
      {} as never,
      { getStatus: vi.fn(() => buildGatewayStatus(100, 20)) } as never,
      { getStore: () => ({ matchFetch: { inWindow: () => [] } }) } as never,
      null,
      { clearCache: vi.fn() } as never,
      { maxConcurrentSessions: 1, batchSize: 1, pollConfig: {} },
    );

    const internal = pool as unknown as {
      sharedProcessedMatchIds: Set<string>;
      sharedMatchIdsLastReset: number;
      resetSharedMatchIdsIfNeeded: () => void;
    };
    internal.sharedProcessedMatchIds.add('EUW1_1');
    internal.sharedMatchIdsLastReset = Date.now() - 25 * 60 * 60 * 1000;
    internal.resetSharedMatchIdsIfNeeded();
    expect(internal.sharedProcessedMatchIds.size).toBe(0);
  });
});

describe('maxGatewayQueueBeforeSession', () => {
  test('defaults to 10 when env unset', () => {
    delete process.env.MAX_GATEWAY_QUEUE;
    expect(maxGatewayQueueBeforeSession()).toBe(10);
  });
});
