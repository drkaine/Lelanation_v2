import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import type { Player, PollerEvents } from '../../../src/poller/types.js';
import { MatchFilter } from '../../../src/poll-orchestration/MatchFilter.js';
import { RankFilter } from '../../../src/poll-orchestration/RankFilter.js';
import { createSqlMock, resetSqlMockState, seedProcessedMatch } from '../helpers/sqlMockState.js';
import { buildMatch } from '../helpers/pipelineFixtures.js';

vi.mock('../../../src/db/client.js', async () => {
  const { createSqlMock } = await import('../helpers/sqlMockState.js');
  return { sql: createSqlMock() };
});

vi.mock('../../../src/poller/gatewayRoutes.js', () => ({
  fetchMatchIdsByPUUID: vi.fn(),
  fetchMatch: vi.fn(),
  fetchMatchTimeline: vi.fn(),
  fetchLeagueEntriesByPUUID: vi.fn(),
}));

vi.mock('../../../src/queues/index.js', () => ({
  ingestionQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
}));

vi.mock('../../../src/services/matchIngestionPayload.js', () => ({
  buildIngestionPayloadFromMatchData: vi.fn(async ({ match }: { match: { metadata?: { matchId?: string } } }) => ({
    riotMatchId: match.metadata?.matchId ?? 'unknown',
    patch: '16.11',
    queueRegion: 'euw1',
    participants: [],
    teamStats: [],
  })),
}));

vi.mock('../../../src/poll-orchestration/processedMatchWrite.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/poll-orchestration/processedMatchWrite.js')>();
  return actual;
});

import { sql } from '../../../src/db/client.js';
import {
  fetchLeagueEntriesByPUUID,
  fetchMatch,
  fetchMatchIdsByPUUID,
  fetchMatchTimeline,
} from '../../../src/poller/gatewayRoutes.js';
import { ingestionQueue } from '../../../src/queues/index.js';

const M1 = 'EUW1_M1';
const M2 = 'EUW1_M2';
const M3 = 'EUW1_M3_SHARED';
const M4 = 'EUW1_M4';
const M5 = 'EUW1_M5_ALREADY_DONE';

function collect<T extends keyof PollerEvents>(bus: ReturnType<PollerEngine['getEventBus']>, event: T) {
  const items: PollerEvents[T][] = [];
  bus.on(event, (payload) => items.push(payload));
  return items;
}

describe('fullPipeline e2e', () => {
  const matchFilter = new MatchFilter();
  const rankFilter = new RankFilter();

  beforeEach(async () => {
    resetSqlMockState();
    seedProcessedMatch(M5, 'done');
    await PollerEngine.resetInstance();
    vi.clearAllMocks();

    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 50 },
    ]);
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: { frames: [] } });
    vi.mocked(fetchMatch).mockImplementation(async (id: string) =>
      buildMatch(
        id,
        Array.from({ length: 10 }, (_, i) => `shared-part-${id}-${i}`),
      ),
    );

    vi.mocked(fetchMatchIdsByPUUID).mockImplementation(async (puuid: string) => {
      if (puuid === 'player-a') return [M1, M2, M3];
      if (puuid === 'player-b') return [M3, M4, M5];
      return [];
    });
  });

  afterEach(async () => {
    await PollerEngine.resetInstance();
  });

  test('two players with shared match and DB pre-filter', async () => {
    const { PollerDbConsumer } = await import('../../../src/poll-orchestration/PollerDbConsumer.js');
    const { ParticipantDiscovery } = await import('../../../src/poll-orchestration/ParticipantDiscovery.js');
    const { PlayerDiscovery } = await import('../../../src/poll-orchestration/PlayerDiscovery.js');

    const engine = PollerEngine.getInstance();
    const bus = engine.getEventBus();
    const consumer = new PollerDbConsumer(
      new ParticipantDiscovery(),
      new PlayerDiscovery(),
      { currentPatch: '16.11', rankTierForUnranked: 'UNRANKED', resolveParticipantRanks: true },
      bus,
    );
    consumer.subscribe();

    const playerRank = collect(bus, 'player:rank');
    const matchData = collect(bus, 'match:data');
    const sessionComplete = collect(bus, 'session:complete');

    const players: Player[] = [
      { puuid: 'player-a', platform: 'euw1' },
      { puuid: 'player-b', platform: 'euw1' },
    ];

    const { stats } = await engine.poll(players, {
      sinceTimestamp: 1_700_000_000,
      maxConcurrentPlayers: 2,
      maxConcurrentMatchFetches: 2,
      participantRankConcurrency: 5,
      matchFilter: (ids) => matchFilter.filterNew(ids),
      rankFilter: (puuid, region) => rankFilter.isKnownToday(puuid, region),
    });

    expect(playerRank).toHaveLength(2);
    expect(new Set(matchData.map((e) => e.matchId))).toEqual(new Set([M1, M2, M3, M4]));
    expect(matchData.map((e) => e.matchId)).not.toContain(M5);
    expect(sessionComplete).toHaveLength(1);
    expect(stats.matchesFetched).toBeGreaterThanOrEqual(4);

    const uniqueJobIds = new Set(
      vi.mocked(ingestionQueue.add).mock.calls.map((call) => call[2]?.jobId as string),
    );
    expect(uniqueJobIds.size).toBeGreaterThanOrEqual(4);
    for (const id of [M1, M2, M3, M4]) {
      expect(uniqueJobIds.has(id)).toBe(true);
    }

    expect(sql).toHaveBeenCalled();
  }, 60_000);
});
