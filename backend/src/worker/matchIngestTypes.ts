/** Shared across a batch of match ingests: one DB round-trip for max(game_date) + player rows. */
export type MatchIngestDbPreload = {
  maxGameByPuuid: Map<string, Date>
  playerRankSnapshotByPuuid: Map<string, { rankSnapshotGameDate: Date | null }>
}

export type MatchIngestRankCache = Map<
  string,
  { rankTier?: string; rankDivision?: string | null; rankLp?: number | null }
>

export type MatchIngestOptions = {
  ingestPreload?: MatchIngestDbPreload
  sharedAccountRankCache?: MatchIngestRankCache
  /** League-v4 rank fetch: abort when true (e.g. poller stopping). */
  shouldAbort?: () => boolean
  /** Allow league-v4 rank API lookups during ingest (can be disabled for max DB throughput). */
  allowLeagueRankApiFetch?: boolean
  /** Force one league-v4 API call per participant for every ingested match (bypass rank caches). */
  forceLeagueRankApiForEachParticipant?: boolean
}
