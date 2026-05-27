import type { MatchDto, MatchTimelineDto } from '../riot/types.js'

export interface PlayerJob {
  puuid: string
  region: string
  lastSeen: Date | null
}

export interface RankedPlayerJob extends PlayerJob {
  rankTier: string
  rankDivision: string
  rankLp: number
  rankedAt: Date
}

export interface MatchListJob extends RankedPlayerJob {
  matchIds: string[]
}

export interface NewMatchJob {
  matchId: string
  region: string
  patch: string
  rankTier: string
}

export interface MatchDataJob {
  matchId: string
  region: string
  patch: string
  rankTier: string
  matchData: MatchDto
  timeline: MatchTimelineDto
}
