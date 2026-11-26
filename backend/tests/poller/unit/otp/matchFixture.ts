import type { IngestionJobData, ParsedParticipantDto, TeamStatsDto } from '../../../../src/dto/match.dto.js';

/** Match complet 10 joueurs (copie du fixture d'intégration runAggregationTransaction). */
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;

function participant(over: {
  matchId: string;
  puuid: string;
  teamId: 100 | 200;
  championId: number;
  role: string;
  win: boolean;
  opponentChampionId: number;
  goldEarned?: number;
  bannedChampionId?: number;
}): ParsedParticipantDto {
  return {
    matchId: over.matchId,
    puuid: over.puuid,
    patch: '15.13',
    gameDate: new Date('2026-07-01T12:00:00Z').toISOString(),
    gameEndTimestamp: 1_800_000,
    gameDurationSec: 1800,
    region: 'euw1',
    rankTier: 'GOLD',
    needsRankFetch: false,
    role: over.role,
    championId: over.championId,
    championTransform: 0,
    transformTimestampMs: 0,
    teamId: over.teamId,
    win: over.win,
    firstBloodKill: false,
    firstBloodAssist: false,
    firstTowerKill: false,
    firstTowerAssist: false,
    gameEndedInEarlySurrender: false,
    gameEndedInSurrender: false,
    teamEarlySurrendered: false,
    kills: 1,
    deaths: 1,
    assists: 1,
    goldEarned: over.goldEarned ?? 10_000,
    goldSpent: 9_000,
    opponentChampionId: over.opponentChampionId,
    opponentParticipantId: 0,
    opponentRole: over.role,
    spellOrder: '',
    spell1Casts: 0,
    spell2Casts: 0,
    spell3Casts: 0,
    spell4Casts: 0,
    spellLevelUpTimestampSumMs: 0,
    starterKey: '1055',
    coreKey: '3006_3031',
    materialKey: '',
    bootsKey: '3006',
    finalKey: '3006_3031_3072',
    items: [
      { itemId: 1055, phase: 'starter', timestampMs: 1000, win: over.win },
      { itemId: 3006, phase: 'core', timestampMs: 500_000, win: over.win },
      { itemId: 3031, phase: 'final', timestampMs: 900_000, win: over.win },
    ],
    runeList: '8005_9101',
    shardList: '5008_5008_5003',
    perks: [8005, 9101, 5008],
    spellD: 4,
    spellF: 7,
    spellDCasts: 0,
    spellFCasts: 0,
    rankTierValue: 'GOLD',
    rankDivision: 'II',
    lp: 50,
    bannedChampionId: over.bannedChampionId ?? 0,
    pickOrder: 1,
    u15: {
      goldEarned: 0,
      cs: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      visionScore: 0,
      physDmgToChampion: 0,
      magicDmgToChampion: 0,
      trueDmgToChampion: 0,
      shieldAndHeal: 0,
    },
  } as unknown as ParsedParticipantDto;
}

/** Match complet 10 joueurs : team 100 (champions 1-5) bat team 200 (champions 6-10). */
export function buildMatch(matchId: string, championOffset = 0): IngestionJobData {
  const participants: ParsedParticipantDto[] = [];
  for (let i = 0; i < 5; i++) {
    const champ100 = 1 + i + championOffset;
    const champ200 = 6 + i + championOffset;
    participants.push(
      participant({
        matchId,
        puuid: `${matchId}-b${i}`,
        teamId: 100,
        championId: champ100,
        role: ROLES[i]!,
        win: true,
        opponentChampionId: champ200,
        bannedChampionId: 100 + i,
      }),
    );
    participants.push(
      participant({
        matchId,
        puuid: `${matchId}-r${i}`,
        teamId: 200,
        championId: champ200,
        role: ROLES[i]!,
        win: false,
        opponentChampionId: champ100,
      }),
    );
  }
  const teamStats: TeamStatsDto = {
    matchId,
    patch: '15.13',
    rankTier: 'GOLD',
    region: 'euw1',
    team100Win: true,
    objectives: [],
    surrendered: false,
    earlySurrendered: false,
    surrenderedTeam100: false,
    surrenderedTeam200: false,
    earlySurrenderedTeam100: false,
    earlySurrenderedTeam200: false,
    team100ChampionKills: 0,
    team200ChampionKills: 0,
    team100ElderDrakeFirst: false,
    team200ElderDrakeFirst: false,
  };
  return { participants, teamStats };
}
