export interface MatchMetadataDto {
  matchId: string;
  [key: string]: unknown;
}

export interface MatchParticipantDto {
  puuid?: string;
  summonerName?: string;
  championName?: string;
  [key: string]: unknown;
}

export interface MatchInfoDto {
  gameCreation?: number;
  gameStartTimestamp?: number;
  gameDuration?: number;
  participants?: MatchParticipantDto[];
  [key: string]: unknown;
}

export interface MatchDto {
  metadata?: MatchMetadataDto;
  info?: MatchInfoDto;
  [key: string]: unknown;
}

export interface TimelineFrameDto {
  timestamp?: number;
  [key: string]: unknown;
}

export interface TimelineInfoDto {
  frames?: TimelineFrameDto[];
  [key: string]: unknown;
}

export interface TimelineDto {
  info?: TimelineInfoDto;
  [key: string]: unknown;
}

export interface LeagueEntryDto {
  queueType?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  [key: string]: unknown;
}
