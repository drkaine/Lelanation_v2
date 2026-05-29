/** Riot match DTO shapes used by match ingest workers (loosely typed for partial API payloads). */

export interface RiotParticipantDto {
  puuid?: string
  championId?: number
  teamId?: number
  win?: boolean
  individualPosition?: string
  teamPosition?: string
  kills?: number
  deaths?: number
  assists?: number
  champLevel?: number
  goldEarned?: number
  totalDamageDealtToChampions?: number
  totalMinionsKilled?: number
  visionScore?: number
  teamEarlySurrendered?: boolean
  [key: string]: unknown
}

export interface RiotMatchDto {
  metadata?: { matchId: string }
  info?: {
    gameId?: number
    gameCreation?: number
    gameDuration?: number
    gameVersion?: string
    queueId?: number
    endOfGameResult?: string
    participants?: RiotParticipantDto[]
    teams?: Array<{
      teamId?: number
      win?: boolean
      bans?: Array<{ championId?: number }>
      objectives?: Record<string, { first?: boolean; kills?: number }>
    }>
  }
}

export interface RiotMatchTimelineDto {
  info?: {
    frameInterval?: number
    frames?: Array<{
      timestamp?: number
      events?: Array<{ type?: string; [key: string]: unknown }>
      [key: string]: unknown
    }>
  }
}

export interface RiotLeagueEntryDto {
  leagueId?: string
  queueType?: string
  tier?: string
  rank?: string
  summonerId?: string
  puuid?: string
  leaguePoints?: number
  wins?: number
  losses?: number
}

export interface RiotAccountDto {
  puuid: string
  gameName?: string
  tagLine?: string
  [key: string]: unknown
}
