/**
 * Métriques admin « collecte » depuis `lelanation_statistiques` (`players`, `processed_matches`).
 */
import { getStatistiquesPool, isStatistiquesDatabaseConfigured } from '../drizzle/statistiquesDb.js'

function playerKeyVersionForAdminStats(): string {
  const explicit = process.env.PLAYER_KEY_VERSION?.trim()
  if (explicit) return explicit
  const env = process.env.ENV?.trim()
  if (env === 'dev' || env === 'prod') return env
  return 'dev'
}

export type AdminDataCollectStats = {
  adminDataSource: 'statistiques_db'
  totalPlayers: number
  playersWrongKeyVersion: number
  lastNewPlayerAt: string | null
  lastPlayerLastSeenAt: string | null
  lastPlayerUpdatedAt: string | null
  totalTrackedMatches: number
  trackedMatchesCreatedLast1h: number
  trackedMatchesPendingNow: number
  trackedMatchesPendingOver1h: number
  trackedOldestPendingCreatedAt: string | null
  trackedAggregateStatus: Record<string, number>
  trackedLastAggregatedAt: string | null
  playersCreatedLast1h: number
  playersLastSeenLast1h: number
  playersUpdatedLast1h: number
  matchIngestRaw: null
  trackedMatchesDeferredRankPending: number
}

function emptyStats(): AdminDataCollectStats {
  return {
    adminDataSource: 'statistiques_db',
    totalPlayers: 0,
    playersWrongKeyVersion: 0,
    lastNewPlayerAt: null,
    lastPlayerLastSeenAt: null,
    lastPlayerUpdatedAt: null,
    totalTrackedMatches: 0,
    trackedMatchesCreatedLast1h: 0,
    trackedMatchesPendingNow: 0,
    trackedMatchesPendingOver1h: 0,
    trackedOldestPendingCreatedAt: null,
    trackedAggregateStatus: {},
    trackedLastAggregatedAt: null,
    playersCreatedLast1h: 0,
    playersLastSeenLast1h: 0,
    playersUpdatedLast1h: 0,
    matchIngestRaw: null,
    trackedMatchesDeferredRankPending: 0,
  }
}

export async function getAdminDataCollectStats(): Promise<AdminDataCollectStats> {
  if (!isStatistiquesDatabaseConfigured()) return emptyStats()

  const empty = emptyStats()
  const since1h = new Date(Date.now() - 60 * 60 * 1000)
  const pool = getStatistiquesPool()
  try {
    const [
      lastPlayer,
      maxLastSeen,
      maxUpdated,
      totalPlayers,
      pmTotal,
      pm1h,
      pmPendingNow,
      pmPendingOver1h,
      pmOldestPending,
      pmAggByStatus,
      pmLastAggregated,
      playersWrongKeyVersion,
      playersCreated1h,
      playersLastSeen1h,
      playersUpdated1h,
      pmDeferredRank,
    ] = await Promise.all([
      pool.query<{ created_at: Date }>(
        `SELECT created_at FROM players ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      ),
      pool.query<{ d: Date | null }>(`SELECT MAX(last_seen) AS d FROM players`),
      pool.query<{ d: Date | null }>(`SELECT MAX(updated_at) AS d FROM players`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM players`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM processed_matches`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM processed_matches WHERE created_at >= $1`,
        [since1h],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM processed_matches WHERE aggregate_status = 'PENDING'`,
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM processed_matches
         WHERE aggregate_status = 'PENDING' AND created_at < $1`,
        [since1h],
      ),
      pool.query<{ d: Date | null }>(
        `SELECT MIN(created_at) AS d FROM processed_matches WHERE aggregate_status = 'PENDING'`,
      ),
      pool.query<{ aggregate_status: string; c: string }>(
        `SELECT aggregate_status, COUNT(*)::text AS c FROM processed_matches GROUP BY aggregate_status`,
      ),
      pool.query<{ d: Date | null }>(
        `SELECT MAX(aggregated_at) AS d FROM processed_matches`,
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM players WHERE puuid_key_version IS DISTINCT FROM $1`,
        [playerKeyVersionForAdminStats()],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM players WHERE created_at >= $1`,
        [since1h],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM players WHERE last_seen >= $1`,
        [since1h],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM players WHERE updated_at >= $1`,
        [since1h],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM processed_matches
         WHERE COALESCE(status, '') = 'DEFERRED_RANK_PENDING' AND aggregate_status = 'PENDING'`,
      ),
    ])
    const lp = lastPlayer.rows[0]
    return {
      adminDataSource: 'statistiques_db',
      totalPlayers: parseInt(totalPlayers.rows[0]?.c ?? '0', 10),
      playersWrongKeyVersion: parseInt(playersWrongKeyVersion.rows[0]?.c ?? '0', 10),
      lastNewPlayerAt: lp?.created_at?.toISOString() ?? null,
      lastPlayerLastSeenAt: maxLastSeen.rows[0]?.d?.toISOString() ?? null,
      lastPlayerUpdatedAt: maxUpdated.rows[0]?.d?.toISOString() ?? null,
      totalTrackedMatches: parseInt(pmTotal.rows[0]?.c ?? '0', 10),
      trackedMatchesCreatedLast1h: parseInt(pm1h.rows[0]?.c ?? '0', 10),
      trackedMatchesPendingNow: parseInt(pmPendingNow.rows[0]?.c ?? '0', 10),
      trackedMatchesPendingOver1h: parseInt(pmPendingOver1h.rows[0]?.c ?? '0', 10),
      trackedOldestPendingCreatedAt: pmOldestPending.rows[0]?.d?.toISOString() ?? null,
      trackedAggregateStatus: Object.fromEntries(
        pmAggByStatus.rows.map((r: { aggregate_status: string; c: string }) => [
          r.aggregate_status,
          parseInt(r.c ?? '0', 10),
        ]),
      ),
      trackedLastAggregatedAt: pmLastAggregated.rows[0]?.d?.toISOString() ?? null,
      playersCreatedLast1h: parseInt(playersCreated1h.rows[0]?.c ?? '0', 10),
      playersLastSeenLast1h: parseInt(playersLastSeen1h.rows[0]?.c ?? '0', 10),
      playersUpdatedLast1h: parseInt(playersUpdated1h.rows[0]?.c ?? '0', 10),
      matchIngestRaw: null,
      trackedMatchesDeferredRankPending: parseInt(pmDeferredRank.rows[0]?.c ?? '0', 10),
    }
  } catch {
    return empty
  }
}
