import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Job } from 'bullmq';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import type { IngestionJobData } from '../../../src/dto/match.dto.js';
import {
  AlreadyProcessedMatchError,
  processIngestionJob,
  type IngestionJobDeps,
} from '../../../src/workers/ingestion.worker.js';

vi.mock('../../../src/observability/poller-v2-observability.js', () => ({
  pollerV2Observability: {
    recordIngestionStart: vi.fn(),
    recordIngestionSuccess: vi.fn(),
    recordIngestionDuplicate: vi.fn(),
    recordIngestionFailure: vi.fn(),
    recordMatchIngestedForPipeline: vi.fn(),
    recordPlayersAdded: vi.fn(),
    recordDuration: vi.fn(),
  },
}));

vi.mock('../../../src/queues/index.js', () => ({
  getRankBacklogCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../src/queues/rank-backlog-policy.js', () => ({
  shouldPauseMatchPipelines: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/queues/rank-jobs.js', () => ({
  enqueueRankFetchJobsForParticipants: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/redis/ingestion-metrics.js', () => ({
  recordAggregatedMatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('bullmq', () => {
  class Worker {
    constructor(..._args: unknown[]) {}
    on() {
      return this;
    }
    close() {
      return Promise.resolve();
    }
  }
  return { Worker };
});

vi.mock('../../../src/redis/client.js', () => ({
  redis: {},
}));

vi.mock('../../../src/config/index.js', () => ({
  config: { ENV: 'test' },
}));

vi.mock('../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { begin: vi.fn() }),
}));

function terminalEvents() {
  return MetricsStore.getInstance()
    .ingestionWorker.inWindow(60_000)
    .filter((e) => e.type === 'completed' || e.type === 'failed');
}

function job(overrides: Partial<IngestionJobData> = {}): Job<IngestionJobData> {
  return {
    data: {
      participants: [
        {
          matchId: 'EUW1_123',
          patch: '16.11',
          rankTier: 'GOLD',
          puuid: 'p1',
          platform: 'euw1',
          gameDate: new Date(),
        } as IngestionJobData['participants'][number],
      ],
      teamStats: { matchId: 'EUW1_123', patch: '16.11' },
      ...overrides,
    } as IngestionJobData,
  } as Job<IngestionJobData>;
}

describe('ingestion worker metrics', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
    vi.clearAllMocks();
  });

  test('T_worker_1 emits completed/already_done when match already processed', async () => {
    const deps: IngestionJobDeps = {
      runTransaction: vi.fn().mockRejectedValue(new AlreadyProcessedMatchError('EUW1_123')),
    };
    await processIngestionJob(job(), deps);

    const terminal = terminalEvents();
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.type).toBe('completed');
    expect(terminal[0]?.completedReason).toBe('already_done');
  });

  test('T_worker_2 emits completed/processed when transaction runs successfully', async () => {
    const deps: IngestionJobDeps = {
      runTransaction: vi.fn().mockResolvedValue({ insertedPlayers: 10, aggregated: true }),
    };
    await processIngestionJob(job(), deps);

    const terminal = terminalEvents();
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.completedReason).toBe('processed');
  });

  test('T_worker_3 emits failed when transaction throws', async () => {
    const deps: IngestionJobDeps = {
      runTransaction: vi.fn().mockRejectedValue(new Error('constraint violation')),
    };
    await expect(processIngestionJob(job(), deps)).rejects.toThrow('constraint violation');

    const terminal = terminalEvents();
    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.type).toBe('failed');
    expect(terminal[0]?.errorMessage).toBe('constraint violation');
  });

  test('T_worker_4 always emits exactly one terminal event per job', async () => {
    const scenarios: Array<IngestionJobDeps> = [
      {
        runTransaction: vi.fn().mockRejectedValue(new AlreadyProcessedMatchError('EUW1_123')),
      },
      {
        runTransaction: vi.fn().mockResolvedValue({ insertedPlayers: 1, aggregated: false }),
      },
      {
        runTransaction: vi.fn().mockRejectedValue(new Error('fail')),
      },
    ];

    for (const deps of scenarios) {
      MetricsStore.resetInstance();
      await processIngestionJob(job(), deps).catch(() => undefined);
      expect(terminalEvents()).toHaveLength(1);
    }
  });
});
