import { riotConfig } from '../config/riotConfig.js';
import { RiotGateway } from '../gateway/RiotGateway.js';
import type { LeagueEntryDto, MatchDto, TimelineDto } from './dto.js';

const MATCH_IDS_TEMPLATE = '/lol/match/v5/matches/by-puuid/{puuid}/ids';
const MATCH_TEMPLATE = '/lol/match/v5/matches/{matchId}';
const TIMELINE_TEMPLATE = '/lol/match/v5/matches/{matchId}/timeline';

export async function getMatchIdsByPUUID(
  puuid: string,
  options?: {
    queue?: number;
    type?: 'ranked' | 'normal' | 'tourney' | 'tutorial';
    start?: number;
    count?: number;
    startTime?: number;
    endTime?: number;
  },
): Promise<string[]> {
  const response = await RiotGateway.getInstance().request<string[]>(
    riotConfig.regionalUrl,
    MATCH_IDS_TEMPLATE,
    { puuid },
    {
      queue: options?.queue ?? 420,
      type: options?.type ?? 'ranked',
      start: options?.start ?? 0,
      count: options?.count ?? 20,
      ...(options?.startTime != null ? { startTime: options.startTime } : {}),
      ...(options?.endTime != null ? { endTime: options.endTime } : {}),
    },
  );
  return response.data;
}

export async function getMatch(matchId: string): Promise<MatchDto> {
  const response = await RiotGateway.getInstance().request<MatchDto>(
    riotConfig.regionalUrl,
    MATCH_TEMPLATE,
    { matchId },
  );
  return response.data;
}

export async function getMatchTimeline(matchId: string): Promise<TimelineDto> {
  const response = await RiotGateway.getInstance().request<TimelineDto>(
    riotConfig.regionalUrl,
    TIMELINE_TEMPLATE,
    { matchId },
  );
  return response.data;
}

export async function getLeagueEntriesByPUUID(
  puuid: string,
  options?: {
    queue?: string;
    tier?: string;
    division?: string;
    page?: number;
  },
): Promise<LeagueEntryDto[]> {
  const response = await RiotGateway.getInstance().request<LeagueEntryDto[]>(
    riotConfig.platformUrl,
    '/lol/league/v4/entries/by-puuid/{encryptedPUUID}',
    { encryptedPUUID: puuid },
    {
      ...(options?.queue ? { queue: options.queue } : {}),
      ...(options?.tier ? { tier: options.tier } : {}),
      ...(options?.division ? { division: options.division } : {}),
      ...(options?.page != null ? { page: options.page } : {}),
    },
  );
  return response.data;
}

export const ROUTE_METHOD_KEYS = {
  matchIds: MATCH_IDS_TEMPLATE,
  match: MATCH_TEMPLATE,
  timeline: TIMELINE_TEMPLATE,
  leagueEntries: '/lol/league/v4/entries/by-puuid/{encryptedPUUID}',
} as const;
