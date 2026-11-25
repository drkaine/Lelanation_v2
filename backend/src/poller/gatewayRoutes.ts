import { RiotGateway } from '../riot-gateway/gateway/RiotGateway.js';
import type { LeagueEntryDto, MatchDto, TimelineDto } from '../riot-gateway/routes/dto.js';
import { RegionRouter } from './RegionRouter.js';
import type { Platform } from './types.js';

const MATCH_IDS_TEMPLATE = '/lol/match/v5/matches/by-puuid/{puuid}/ids';
const MATCH_TEMPLATE = '/lol/match/v5/matches/{matchId}';
const TIMELINE_TEMPLATE = '/lol/match/v5/matches/{matchId}/timeline';
const LEAGUE_TEMPLATE = '/lol/league/v4/entries/by-puuid/{encryptedPUUID}';
const LEAGUE_PAGE_TEMPLATE = '/lol/league/v4/entries/{queue}/{tier}/{division}';
const APEX_LEAGUE_TEMPLATE = '/lol/league/v4/{league}/by-queue/{queue}';

const RANKED_SOLO_QUEUE = 420;
const RANKED_SOLO_QUEUE_NAME = 'RANKED_SOLO_5x5';

export async function fetchMatchIdsByPUUID(
  puuid: string,
  platform: Platform,
  options: {
    start: number;
    count: number;
    startTime: number;
  },
): Promise<string[]> {
  const response = await RiotGateway.getInstance().request<string[]>(
    RegionRouter.getRegionalUrl(platform),
    MATCH_IDS_TEMPLATE,
    { puuid },
    {
      queue: RANKED_SOLO_QUEUE,
      type: 'ranked',
      start: options.start,
      count: options.count,
      startTime: options.startTime,
    },
  );
  return response.data;
}

export async function fetchMatch(matchId: string, platform: Platform): Promise<MatchDto> {
  const response = await RiotGateway.getInstance().request<MatchDto>(
    RegionRouter.getRegionalUrl(platform),
    MATCH_TEMPLATE,
    { matchId },
  );
  return response.data;
}

export async function fetchMatchTimeline(matchId: string, platform: Platform): Promise<TimelineDto> {
  const response = await RiotGateway.getInstance().request<TimelineDto>(
    RegionRouter.getRegionalUrl(platform),
    TIMELINE_TEMPLATE,
    { matchId },
  );
  return response.data;
}

export async function fetchLeagueEntriesByPUUID(
  puuid: string,
  platform: Platform,
  priority: 'high' | 'normal' = 'normal',
): Promise<LeagueEntryDto[]> {
  const response = await RiotGateway.getInstance().request<LeagueEntryDto[]>(
    RegionRouter.getPlatformUrl(platform),
    LEAGUE_TEMPLATE,
    { encryptedPUUID: puuid },
    { queue: RANKED_SOLO_QUEUE_NAME },
    priority,
  );
  return response.data;
}

/** Une page (205 joueurs) d'une division classée solo. */
export async function fetchLeagueEntriesPage(
  tier: string,
  division: string,
  page: number,
  platform: Platform,
): Promise<LeagueEntryDto[]> {
  const response = await RiotGateway.getInstance().request<LeagueEntryDto[]>(
    RegionRouter.getPlatformUrl(platform),
    LEAGUE_PAGE_TEMPLATE,
    { queue: RANKED_SOLO_QUEUE_NAME, tier, division },
    { page },
  );
  return response.data;
}

/** Ligue apex entière (challengerleagues, grandmasterleagues, masterleagues) en solo. */
export async function fetchApexLeague(
  league: string,
  platform: Platform,
): Promise<{ tier?: string; entries?: LeagueEntryDto[] }> {
  const response = await RiotGateway.getInstance().request<{ tier?: string; entries?: LeagueEntryDto[] }>(
    RegionRouter.getPlatformUrl(platform),
    APEX_LEAGUE_TEMPLATE,
    { league, queue: RANKED_SOLO_QUEUE_NAME },
  );
  return response.data;
}

export { RANKED_SOLO_QUEUE, RANKED_SOLO_QUEUE_NAME };
