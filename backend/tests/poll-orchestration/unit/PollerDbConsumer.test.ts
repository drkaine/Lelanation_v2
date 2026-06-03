import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import {
  buildMatchDataEvent,
  buildPlayerRankEvent,
} from '../helpers/pipelineFixtures.js';

const { rankHistoryByPuuid, sqlMock } = vi.hoisted(() => {
  process.env.ENV = 'dev';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.DATABASE_URL = 'postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques';
  process.env.RIOT_API_KEY = 'RGAPI-test-key';

  const rankHistoryByPuuid = new Map<string, string>();
  const sqlMock = Object.assign(
    vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = String(strings.join('?')).toLowerCase();
      if (q.includes('player_rank_history') && q.includes('distinct on')) {
        for (const v of values) {
          if (Array.isArray(v)) {
            return (v as string[])
              .filter((puuid) => rankHistoryByPuuid.has(puuid))
              .map((puuid) => ({ puuid, rank_tier: rankHistoryByPuuid.get(puuid) }));
          }
        }
      }
      return [];
    }),
    { array: (arr: string[]) => arr },
  );
  return { rankHistoryByPuuid, sqlMock };
});

vi.mock('../../../src/db/client.js', () => ({ sql: sqlMock }));

const insertRankHistory = vi.fn();
const insertPendingProcessedMatch = vi.fn();
const updateProcessedMatchRank = vi.fn();
const markProcessedMatchError = vi.fn();
const ingestionAdd = vi.fn();
const buildPayload = vi.fn();
const updateLastSeen = vi.fn();
const upsertParticipants = vi.fn();
const extractFromMatch = vi.fn();

vi.mock('../../../src/db/queries/ranks.js', () => ({ insertRankHistory }));
vi.mock('../../../src/poll-orchestration/processedMatchWrite.js', () => ({
  insertPendingProcessedMatch,
  updateProcessedMatchRank,
  markProcessedMatchError,
  extractPatchFromMatch: () => '16.11',
}));
vi.mock('../../../src/queues/index.js', () => ({
  ingestionQueue: { add: ingestionAdd },
}));
vi.mock('../../../src/services/matchIngestionPayload.js', () => ({
  buildIngestionPayloadFromMatchData: buildPayload,
}));
vi.mock('../../../src/poll-orchestration/ParticipantDiscovery.js', () => ({
  ParticipantDiscovery: class {
    extractFromMatch = extractFromMatch;
    upsertParticipants = upsertParticipants;
  },
}));
vi.mock('../../../src/poll-orchestration/PlayerDiscovery.js', () => ({
  PlayerDiscovery: class {
    updateLastSeen = updateLastSeen;
  },
}));

async function createConsumer(resolveRanks: boolean) {
  const { PollerDbConsumer } = await import('../../../src/poll-orchestration/PollerDbConsumer.js');
  const { ParticipantDiscovery } = await import('../../../src/poll-orchestration/ParticipantDiscovery.js');
  const { PlayerDiscovery } = await import('../../../src/poll-orchestration/PlayerDiscovery.js');
  const bus = new PollerEventBus();
  const consumer = new PollerDbConsumer(
    new ParticipantDiscovery(),
    new PlayerDiscovery(),
    { currentPatch: '16.11', rankTierForUnranked: 'UNRANKED', resolveParticipantRanks: resolveRanks },
    bus,
  );
  consumer.subscribe();
  return { consumer, bus };
}

describe('PollerDbConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rankHistoryByPuuid.clear();
    sqlMock.mockClear();
    insertRankHistory.mockResolvedValue(undefined);
    insertPendingProcessedMatch.mockResolvedValue(true);
    updateProcessedMatchRank.mockResolvedValue(undefined);
    markProcessedMatchError.mockResolvedValue(undefined);
    ingestionAdd.mockResolvedValue({});
    buildPayload.mockResolvedValue({
      participants: [{ puuid: 'p1' }],
      teamStats: { matchId: 'EUW1_1', rankTier: 'GOLD' },
    });
    updateLastSeen.mockResolvedValue(undefined);
    upsertParticipants.mockResolvedValue(0);
    extractFromMatch.mockReturnValue([]);
  });

  test('T1 onPlayerRank inserts rank history', async () => {
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a'));
    await vi.waitFor(() => expect(insertRankHistory).toHaveBeenCalled());
  });

  test('T2 onPlayerRank without solo queue stores UNRANKED tier', async () => {
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', {
      ...buildPlayerRankEvent('player-a'),
      entries: [{ queueType: 'RANKED_FLEX_SR', tier: 'SILVER' }],
    });
    await vi.waitFor(() => expect(insertRankHistory).toHaveBeenCalled());
    const row = vi.mocked(insertRankHistory).mock.calls[0]?.[0];
    expect(row?.rankTier).toBe('UNRANKED');
  });

  test('T3 participant fromCache empty skips rank insert', async () => {
    const { bus } = await createConsumer(true);
    bus.emit('participant:rank', {
      sessionId: 's',
      triggerMatchId: 'EUW1_1',
      participant: { puuid: 'p-cache', platform: 'euw1' },
      entries: [],
      fromCache: true,
      fetchedAt: Date.now(),
    });
    await Promise.resolve();
    expect(insertRankHistory).not.toHaveBeenCalled();
  });

  test('T4 participant rank stores history when not from cache', async () => {
    const { bus } = await createConsumer(true);
    bus.emit('participant:rank', {
      sessionId: 's',
      triggerMatchId: 'EUW1_1',
      participant: { puuid: 'p-new', platform: 'euw1' },
      entries: [{ queueType: 'RANKED_SOLO_5x5', tier: 'PLATINUM' }],
      fromCache: false,
      fetchedAt: Date.now(),
    });
    await vi.waitFor(() => expect(insertRankHistory).toHaveBeenCalled());
  });

  test('T5 onMatchData happy path enqueues ingestion', async () => {
    const participants = Array.from({ length: 10 }, (_, i) => `part-${i}`);
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a', 'GOLD'));
    bus.emit('match:data', buildMatchDataEvent('EUW1_1', 'player-a', participants));
    await vi.waitFor(() => expect(ingestionAdd).toHaveBeenCalled());
    expect(insertPendingProcessedMatch).toHaveBeenCalled();
    expect(updateProcessedMatchRank).toHaveBeenCalled();
    expect(upsertParticipants).toHaveBeenCalled();
    expect(ingestionAdd).toHaveBeenCalledWith(
      'ingest-match',
      expect.any(Object),
      expect.objectContaining({ jobId: 'EUW1_1' }),
    );
  });

  test('T6 onMatchData conflict skips queue', async () => {
    insertPendingProcessedMatch.mockResolvedValueOnce(false);
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_9', 'player-a', ['p1']));
    await Promise.resolve();
    expect(ingestionAdd).not.toHaveBeenCalled();
  });

  test('T7 uses participant rank when player rank missing', async () => {
    const { bus } = await createConsumer(true);
    bus.emit('participant:rank', {
      sessionId: 's',
      triggerMatchId: 'EUW1_2',
      participant: { puuid: 'part-0', platform: 'euw1' },
      entries: [{ queueType: 'RANKED_SOLO_5x5', tier: 'DIAMOND' }],
      fromCache: false,
      fetchedAt: Date.now(),
    });
    bus.emit('match:data', buildMatchDataEvent('EUW1_2', 'player-b', ['part-0']));
    await vi.waitFor(() => expect(ingestionAdd).toHaveBeenCalled());
    expect(updateProcessedMatchRank).toHaveBeenCalledWith(expect.any(String), 'EUW1_2', 'DIAMOND');
  });

  test('T8 fallback UNRANKED when no ranks in cache', async () => {
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_3', 'player-x', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    const call = vi.mocked(insertPendingProcessedMatch).mock.calls[0]?.[0];
    expect(call?.rank).toBe('UNRANKED');
  });

  test('does not insert pending processed_match when rank gate skips ingestion', async () => {
    buildPayload.mockResolvedValueOnce(null);
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_SKIP', 'player-z', ['part-0']));
    await Promise.resolve();
    expect(insertPendingProcessedMatch).not.toHaveBeenCalled();
    expect(ingestionAdd).not.toHaveBeenCalled();
  });

  test('T9 ingestion failure marks error without throwing', async () => {
    ingestionAdd.mockRejectedValueOnce(new Error('queue down'));
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a'));
    bus.emit('match:data', buildMatchDataEvent('EUW1_4', 'player-a', ['part-0']));
    await vi.waitFor(() => expect(markProcessedMatchError).toHaveBeenCalled());
  });

  test('does not mark error when participant discovery fails after queueing', async () => {
    upsertParticipants.mockRejectedValueOnce(new Error('deadlock detected'));
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a'));
    bus.emit('match:data', buildMatchDataEvent('EUW1_Q_OK', 'player-a', ['part-0']));
    await vi.waitFor(() => expect(ingestionAdd).toHaveBeenCalled());
    expect(markProcessedMatchError).not.toHaveBeenCalled();
  });

  test('T10 onPlayerComplete updates last_seen', async () => {
    const { bus } = await createConsumer(false);
    bus.emit('player:complete', {
      sessionId: 's',
      player: { puuid: 'player-a', platform: 'euw1' },
      stats: {
        matchIdsDiscovered: 1,
        matchIdsSkipped: 0,
        matchesFetched: 1,
        participantRanksFetched: 0,
        elapsedMs: 1,
        errors: [],
      },
    });
    await vi.waitFor(() => expect(updateLastSeen).toHaveBeenCalledWith('player-a'));
  });

  test('T11 onSessionComplete clears pending state', async () => {
    const { consumer, bus } = await createConsumer(true);
    bus.emit('match:data', buildMatchDataEvent('EUW1_5', 'player-a', ['part-0']));
    bus.emit('session:complete', {
      sessionId: 's',
      status: 'completed',
      stats: {
        playersTotal: 1,
        playersCompleted: 1,
        playersFailed: 0,
        matchIdsDiscovered: 1,
        matchIdsSkipped: 0,
        matchesFetched: 0,
        timelinesFetched: 0,
        participantRanksFetched: 0,
        participantRanksFromCache: 0,
        errors: [],
        startedAt: Date.now(),
        elapsedMs: 1,
      },
    });
    await vi.waitFor(() => expect(ingestionAdd).toHaveBeenCalled());
    consumer.resetSessionState();
    ingestionAdd.mockClear();
    bus.emit('match:data', buildMatchDataEvent('EUW1_6', 'player-a', ['part-0']));
    await Promise.resolve();
    expect(ingestionAdd).not.toHaveBeenCalled();
  });

  test('DB fallback used when rank cache empty', async () => {
    rankHistoryByPuuid.set('player-a', 'GOLD');
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB1', 'player-a', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    expect(insertPendingProcessedMatch.mock.calls[0]?.[0]?.rank).toBe('GOLD');
    expect(sqlMock).toHaveBeenCalled();
  });

  test('rank cache wins over DB fallback', async () => {
    rankHistoryByPuuid.set('player-a', 'GOLD');
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a', 'PLATINUM'));
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB2', 'player-a', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    expect(insertPendingProcessedMatch.mock.calls[0]?.[0]?.rank).toBe('PLATINUM');
    expect(sqlMock).not.toHaveBeenCalled();
  });

  test('UNRANKED only when DB has no rank today', async () => {
    const { orchestrationLogger } = await import('../../../src/poll-orchestration/logger.js');
    const warnSpy = vi.spyOn(orchestrationLogger, 'warn');
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB3', 'player-x', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    expect(insertPendingProcessedMatch.mock.calls[0]?.[0]?.rank).toBe('UNRANKED');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'rank_fallback_unranked' }),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  test('single DB query for many unknown participants', async () => {
    const participants = Array.from({ length: 10 }, (_, i) => `part-${i}`);
    rankHistoryByPuuid.set('part-0', 'SILVER');
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB4', 'player-z', participants));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    const rankQueries = sqlMock.mock.calls.filter((call) =>
      String(call[0]?.join?.('') ?? call[0]).toLowerCase().includes('player_rank_history'),
    );
    expect(rankQueries).toHaveLength(1);
  });

  test('DB fallback populates cache for next match', async () => {
    rankHistoryByPuuid.set('player-b', 'SILVER');
    const { bus } = await createConsumer(false);
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB5A', 'player-b', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    const callsAfterFirst = sqlMock.mock.calls.length;

    insertPendingProcessedMatch.mockClear();
    bus.emit('match:data', buildMatchDataEvent('EUW1_DB5B', 'player-b', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    expect(sqlMock.mock.calls.length).toBe(callsAfterFirst);
  });

  test('fetchRankTiersFromDb keeps one tier per puuid', async () => {
    rankHistoryByPuuid.set('puuid_x', 'GOLD');
    const { PollerDbConsumer } = await import('../../../src/poll-orchestration/PollerDbConsumer.js');
    const { ParticipantDiscovery } = await import('../../../src/poll-orchestration/ParticipantDiscovery.js');
    const { PlayerDiscovery } = await import('../../../src/poll-orchestration/PlayerDiscovery.js');
    const bus = new PollerEventBus();
    const consumer = new PollerDbConsumer(
      new ParticipantDiscovery(),
      new PlayerDiscovery(),
      { currentPatch: '16.11', rankTierForUnranked: 'UNRANKED', resolveParticipantRanks: false },
      bus,
    );
    await (consumer as unknown as { fetchRankTiersFromDb: (p: string[]) => Promise<Set<string>> }).fetchRankTiersFromDb(
      ['puuid_x'],
    );
    const cache = (consumer as unknown as { rankTierCache: Map<string, string> }).rankTierCache;
    expect(cache.get('puuid_x')).toBe('GOLD');
    expect(cache.size).toBe(1);
  });

  test('T12 rank in cache before match uses player rank not fallback', async () => {
    insertPendingProcessedMatch.mockClear();
    const { bus } = await createConsumer(false);
    bus.emit('player:rank', buildPlayerRankEvent('player-a', 'MASTER'));
    bus.emit('match:data', buildMatchDataEvent('EUW1_7', 'player-a', ['part-0']));
    await vi.waitFor(() => expect(insertPendingProcessedMatch).toHaveBeenCalled());
    expect(insertPendingProcessedMatch.mock.calls[0]?.[0]?.rank).toBe('MASTER');
  });
});
