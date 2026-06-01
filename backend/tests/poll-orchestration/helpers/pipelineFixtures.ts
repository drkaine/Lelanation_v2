import type { MatchDataEvent, PlayerRankEvent } from '../../../src/poller/types.js';

export function buildMatch(matchId: string, puuids: string[]) {
  return {
    metadata: { matchId },
    info: {
      gameVersion: '16.11.1.123',
      gameStartTimestamp: Date.now() - 3_600_000,
      participants: puuids.map((puuid, index) => ({
        puuid,
        riotIdGameName: `Player${index}`,
        riotIdTagline: 'EUW',
      })),
    },
  };
}

export function buildPlayerRankEvent(puuid: string, tier = 'GOLD'): PlayerRankEvent {
  return {
    sessionId: 'test-session',
    player: { puuid, platform: 'euw1' },
    entries: [{ queueType: 'RANKED_SOLO_5x5', tier, rank: 'II', leaguePoints: 50 }],
    fetchedAt: Date.now(),
  };
}

export function buildMatchDataEvent(
  matchId: string,
  playerPuuid: string,
  participantPuuids: string[],
): MatchDataEvent {
  return {
    sessionId: 'test-session',
    player: { puuid: playerPuuid, platform: 'euw1' },
    matchId,
    match: buildMatch(matchId, participantPuuids),
    timeline: { info: { frames: [] } },
    fetchedAt: Date.now(),
  };
}
