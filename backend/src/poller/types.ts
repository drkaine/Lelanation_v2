import type { LeagueEntryDto, MatchDto, TimelineDto } from '../riot-gateway/routes/dto.js';

export type Platform =
  | 'euw1'
  | 'eun1'
  | 'tr1'
  | 'ru'
  | 'na1'
  | 'br1'
  | 'la1'
  | 'la2'
  | 'kr'
  | 'jp1'
  | 'oc1'
  | 'ph2'
  | 'sg2'
  | 'th2'
  | 'tw2'
  | 'vn2';

export type RegionalCluster = 'europe' | 'americas' | 'asia' | 'sea';

export interface Player {
  puuid: string;
  platform: Platform;
  summonerName?: string;
  tagLine?: string;
}

export interface PollConfig {
  sinceTimestamp: number;
  matchIdsPerPage: number;
  maxConcurrentPlayers: number;
  maxConcurrentMatchFetches: number;
  resolveParticipantRanks: boolean;
  participantRankConcurrency: number;
  /** Optional cap — process at most N new matchIds per player (integration / smoke). */
  maxMatchesToProcess?: number;
  /** DB pre-filter: return matchIds not yet in processed_matches (done/pending). */
  matchFilter?: (matchIds: string[]) => Promise<string[]>;
  /** DB pre-filter: true if rank already exists for (puuid, today). */
  rankFilter?: (puuid: string, region: string) => Promise<boolean>;
  /**
   * Shared across concurrent SessionPool sessions — dedupes matchIds in place.
   * When omitted, PollSession uses a session-local Set.
   */
  sharedProcessedMatchIds?: Set<string>;
}

export const DEFAULT_POLL_CONFIG: PollConfig = {
  sinceTimestamp: Math.floor(Date.now() / 1000),
  matchIdsPerPage: 100,
  maxConcurrentPlayers: 3,
  maxConcurrentMatchFetches: 5,
  resolveParticipantRanks: true,
  participantRankConcurrency: 5,
};

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type PollStage =
  | 'player_rank'
  | 'match_ids'
  | 'match_data'
  | 'match_timeline'
  | 'participant_rank';

export interface SessionError {
  ts: number;
  playerPuuid?: string;
  matchId?: string;
  participantPuuid?: string;
  stage: PollStage;
  error: string;
  retried: boolean;
  fatal: boolean;
}

export interface SessionStats {
  playersTotal: number;
  playersCompleted: number;
  playersFailed: number;
  matchIdsDiscovered: number;
  matchIdsSkipped: number;
  matchesFetched: number;
  timelinesFetched: number;
  participantRanksFetched: number;
  participantRanksFromCache: number;
  errors: SessionError[];
  startedAt: number;
  completedAt?: number;
  elapsedMs?: number;
}

export interface PlayerRankEvent {
  sessionId: string;
  player: Player;
  entries: LeagueEntryDto[];
  fetchedAt: number;
}

export interface MatchIdsEvent {
  sessionId: string;
  player: Player;
  matchIds: string[];
  page: number;
  total: number;
}

export interface MatchDataEvent {
  sessionId: string;
  player: Player;
  matchId: string;
  match: MatchDto;
  timeline: TimelineDto;
  fetchedAt: number;
}

export interface ParticipantRankEvent {
  sessionId: string;
  triggerMatchId: string;
  participant: { puuid: string; platform: Platform };
  entries: LeagueEntryDto[];
  fromCache: boolean;
  fetchedAt: number;
}

export interface PlayerCompleteEvent {
  sessionId: string;
  player: Player;
  stats: {
    matchIdsDiscovered: number;
    matchIdsSkipped: number;
    matchesFetched: number;
    participantRanksFetched: number;
    elapsedMs: number;
    errors: SessionError[];
  };
}

export interface SessionCompleteEvent {
  sessionId: string;
  status: SessionStatus;
  stats: SessionStats;
}

export interface PollerErrorEvent {
  sessionId: string;
  error: SessionError;
}

export interface PollerEvents {
  'player:rank': PlayerRankEvent;
  'match:ids': MatchIdsEvent;
  'match:data': MatchDataEvent;
  'participant:rank': ParticipantRankEvent;
  'player:complete': PlayerCompleteEvent;
  'session:complete': SessionCompleteEvent;
  'poller:error': PollerErrorEvent;
  'session:cancelled': { sessionId: string };
}

export interface PlayerPollStats {
  matchIdsDiscovered: number;
  matchIdsSkipped: number;
  matchesFetched: number;
  participantRanksFetched: number;
  elapsedMs: number;
  errors: SessionError[];
}

export function mergePollConfig(partial?: Partial<PollConfig>): PollConfig {
  return {
    ...DEFAULT_POLL_CONFIG,
    ...partial,
    sinceTimestamp: partial?.sinceTimestamp ?? Math.floor(Date.now() / 1000),
  };
}

export function createEmptySessionStats(playersTotal: number, startedAt: number): SessionStats {
  return {
    playersTotal,
    playersCompleted: 0,
    playersFailed: 0,
    matchIdsDiscovered: 0,
    matchIdsSkipped: 0,
    matchesFetched: 0,
    timelinesFetched: 0,
    participantRanksFetched: 0,
    participantRanksFromCache: 0,
    errors: [],
    startedAt,
  };
}
