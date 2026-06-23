/**
 * Métriques admin « collecte » depuis `lelanation_statistiques` (`players`, `matchs`, `match_aggregated`).
 */
import { getStatistiquesPool, isStatistiquesDatabaseConfigured } from '../drizzle/statistiquesDb.js'

function playerKeyVersionForAdminStats(): string {
  const explicit = process.env.PLAYER_KEY_VERSION?.trim()
  if (explicit) return explicit
  const env = process.env.ENV?.trim()
  if (env === 'dev' || env === 'prod') return env
  return 'dev'
}

const MATCH_PENDING_AGG_SQL = `NOT EXISTS (
  SELECT 1 FROM match_aggregated ma WHERE ma.riot_match_id = m.riot_match_id
)`

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
  /** Répartition agrégation : `aggregated` / `pending`. */
  trackedAggregateStatus: Record<string, number>
  /** Dernière agrégation réussie (`match_aggregated.aggregated_at`). */
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

  const since1h = new Date(Date.now() - 60 * 60 * 1000)
  const pool = getStatistiquesPool()
  try {
    const [
      lastPlayer,
      maxLastSeen,
      maxUpdated,
      totalPlayers,
      matchTotal,
      match1h,
      matchPendingNow,
      matchPendingOver1h,
      matchOldestPending,
      matchAggStatus,
      matchLastAggregated,
      playersWrongKeyVersion,
      playersCreated1h,
      playersLastSeen1h,
      playersUpdated1h,
    ] = await Promise.all([
      pool.query<{ created_at: Date }>(
        `SELECT created_at FROM players ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      ),
      pool.query<{ d: Date | null }>(`SELECT MAX(last_seen) AS d FROM players`),
      pool.query<{ d: Date | null }>(`SELECT MAX(updated_at) AS d FROM players`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM players`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM matchs`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matchs WHERE created_at >= $1`,
        [since1h],
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matchs m WHERE ${MATCH_PENDING_AGG_SQL}`,
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matchs m
         WHERE ${MATCH_PENDING_AGG_SQL} AND m.created_at < $1`,
        [since1h],
      ),
      pool.query<{ d: Date | null }>(
        `SELECT MIN(m.created_at) AS d FROM matchs m WHERE ${MATCH_PENDING_AGG_SQL}`,
      ),
      pool.query<{ status: string; c: string }>(
        `SELECT
           CASE WHEN ma.riot_match_id IS NULL THEN 'pending' ELSE 'aggregated' END AS status,
           COUNT(*)::text AS c
         FROM matchs m
         LEFT JOIN match_aggregated ma ON ma.riot_match_id = m.riot_match_id
         GROUP BY 1`,
      ),
      pool.query<{ d: Date | null }>(
        `SELECT MAX(aggregated_at) AS d FROM match_aggregated`,
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
    ])
    const lp = lastPlayer.rows[0]
    return {
      adminDataSource: 'statistiques_db',
      totalPlayers: parseInt(totalPlayers.rows[0]?.c ?? '0', 10),
      playersWrongKeyVersion: parseInt(playersWrongKeyVersion.rows[0]?.c ?? '0', 10),
      lastNewPlayerAt: lp?.created_at?.toISOString() ?? null,
      lastPlayerLastSeenAt: maxLastSeen.rows[0]?.d?.toISOString() ?? null,
      lastPlayerUpdatedAt: maxUpdated.rows[0]?.d?.toISOString() ?? null,
      totalTrackedMatches: parseInt(matchTotal.rows[0]?.c ?? '0', 10),
      trackedMatchesCreatedLast1h: parseInt(match1h.rows[0]?.c ?? '0', 10),
      trackedMatchesPendingNow: parseInt(matchPendingNow.rows[0]?.c ?? '0', 10),
      trackedMatchesPendingOver1h: parseInt(matchPendingOver1h.rows[0]?.c ?? '0', 10),
      trackedOldestPendingCreatedAt: matchOldestPending.rows[0]?.d?.toISOString() ?? null,
      trackedAggregateStatus: Object.fromEntries(
        matchAggStatus.rows.map((r) => [r.status, parseInt(r.c ?? '0', 10)]),
      ),
      trackedLastAggregatedAt: matchLastAggregated.rows[0]?.d?.toISOString() ?? null,
      playersCreatedLast1h: parseInt(playersCreated1h.rows[0]?.c ?? '0', 10),
      playersLastSeenLast1h: parseInt(playersLastSeen1h.rows[0]?.c ?? '0', 10),
      playersUpdatedLast1h: parseInt(playersUpdated1h.rows[0]?.c ?? '0', 10),
      matchIngestRaw: null,
      trackedMatchesDeferredRankPending: 0,
    }
  } catch (error) {
    console.error(
      '[AdminDataCollectService] query failed:',
      error instanceof Error ? error.message : String(error),
    )
    return emptyStats()
  }
}
