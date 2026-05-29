import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { Player, PollerEvents } from '../../../src/poller/types.js';
import {
  initLivePoller,
  livePollOptions,
  resetLivePoller,
  resolveTestPuuid,
  sleep,
  waitForGatewayHeadroom,
} from './helpers/liveEnv.js';

const hasLiveApiKey = (): boolean => Boolean(process.env.RIOT_API_KEY?.startsWith('RGAPI-'));

function collect<T extends keyof PollerEvents>(
  engine: Awaited<ReturnType<typeof initLivePoller>>['engine'],
  event: T,
) {
  const items: PollerEvents[T][] = [];
  engine.getEventBus().on(event, (payload) => items.push(payload));
  return items;
}

describe.skipIf(!hasLiveApiKey())('livePoller', () => {
  let testPuuid = '';

  beforeAll(async () => {
    testPuuid = await resolveTestPuuid();
  }, 30_000);

  afterEach(async () => {
    await resetLivePoller();
    await sleep(2_000);
  });

  afterAll(async () => {
    await resetLivePoller();
  });

  test('deduplicates when same player is polled twice in one session', async () => {
    const { engine } = await initLivePoller();
    const player: Player = { puuid: testPuuid, platform: 'euw1' };
    const matchData = collect(engine, 'match:data');
    const playerRank = collect(engine, 'player:rank');

    await waitForGatewayHeadroom(8);

    await engine.poll([player, player], {
      ...livePollOptions(),
      maxMatchesToProcess: 2,
      resolveParticipantRanks: false,
      maxConcurrentPlayers: 1,
    });

    const ids = matchData.map((e) => e.matchId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(2);
    expect(playerRank).toHaveLength(2);
  }, 300_000);

  test('resolveParticipantRanks=false live', async () => {
    const { engine } = await initLivePoller();
    const participantRank = collect(engine, 'participant:rank');
    const matchData = collect(engine, 'match:data');

    await waitForGatewayHeadroom(8);

    await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], {
      ...livePollOptions(),
      maxMatchesToProcess: 3,
      resolveParticipantRanks: false,
    });

    expect(participantRank).toHaveLength(0);
    expect(matchData.length).toBeLessThanOrEqual(3);
  }, 300_000);

  test('should complete a full poll for one player', async () => {
    const { engine, gateway } = await initLivePoller();
    const player: Player = { puuid: testPuuid, platform: 'euw1' };

    const playerRank = collect(engine, 'player:rank');
    const matchIds = collect(engine, 'match:ids');
    const matchData = collect(engine, 'match:data');
    const participantRank = collect(engine, 'participant:rank');
    const sessionComplete = collect(engine, 'session:complete');

    await waitForGatewayHeadroom(8);

    const maxMatches = Number.parseInt(process.env.POLLER_LIVE_MAX_MATCHES ?? '2', 10);

    const { stats } = await engine.poll([player], {
      ...livePollOptions(),
      maxMatchesToProcess: maxMatches,
      resolveParticipantRanks: true,
      maxConcurrentMatchFetches: 2,
      participantRankConcurrency: 2,
    });

    expect(playerRank).toHaveLength(1);
    expect(matchIds.length).toBeGreaterThanOrEqual(1);
    expect(sessionComplete).toHaveLength(1);
    expect(sessionComplete[0]?.status).toBe('completed');
    expect(stats.matchesFetched).toBe(matchData.length);
    expect(stats.matchesFetched).toBeLessThanOrEqual(maxMatches);
    expect(gateway.getStatus().metrics.totals.r429).toBe(0);

    for (const event of matchData) {
      expect(event.matchId.toUpperCase().startsWith('EUW1_')).toBe(true);
    }

    if (matchData.length > 0) {
      expect(participantRank.length).toBeGreaterThan(0);
    }
  }, 600_000);
});
