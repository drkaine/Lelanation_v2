/**
 * Métriques admin « collecte » (sans lecture du log unifié / résumé poller).
 * - Priorité : `DATABASE_URL_STATISTIQUES` → `players` + `processed_matches`.
 * - Sinon `DATABASE_URL` (Prisma) → file d’ingestion `tracked_matches`, `match_ingest_raw`, etc.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { getStatistiquesPool, isStatistiquesDatabaseConfigured } from '../drizzle/statistiquesDb.js'
import { countRawIngestByStatus, isRawIngestQueueEnabled } from '../worker/matchIngestRawQueue.js'

/** Même règle que `config.PLAYER_KEY_VERSION` sans importer `../config` (évite d’exiger `ENV` au chargement du module). */
function playerKeyVersionForAdminStats(): string {
  const explicit = process.env.PLAYER_KEY_VERSION?.trim()
  if (explicit) return explicit
  const env = process.env.ENV?.trim()
  if (env === 'dev' || env === 'prod') return env
  return 'dev'
}

export type AdminDataCollectStats = {
  adminDataSource: 'stats_db' | 'statistiques_db'
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
  matchIngestRaw: {
    pending: number
    processing: number
    error: number
    errorRankPending: number
  } | null
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

async function getAdminDataCollectStatsFromPrisma(): Promise<AdminDataCollectStats> {
  const empty = { ...emptyStats(), adminDataSource: 'stats_db' as const }
  const since1h = new Date(Date.now() - 60 * 60 * 1000)
  try {
    const [
      lastPlayer,
      maxLastSeenAgg,
      maxUpdatedAgg,
      totalPlayers,
      trackedTotal,
      tracked1h,
      trackedPendingNow,
      trackedPendingOver1h,
      trackedOldestPendingCreatedAt,
      trackedAggByStatus,
      trackedLastAggregatedAt,
      playersWrongKeyVersion,
      playersCreated1h,
      playersLastSeen1h,
      playersUpdated1h,
      trackedDeferredRank,
      rawRankPendingErr,
    ] = await Promise.all([
      prisma.player.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.player.aggregate({ _max: { lastSeen: true } }),
      prisma.player.aggregate({ _max: { updatedAt: true } }),
      prisma.player.count(),
      prisma.$queryRaw<Array<{ c: bigint }>>`SELECT COUNT(*)::bigint AS c FROM tracked_matches`,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c FROM tracked_matches WHERE created_at >= ${since1h}
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c FROM tracked_matches WHERE aggregate_status = 'PENDING'
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM tracked_matches
        WHERE aggregate_status = 'PENDING'
          AND created_at < ${since1h}
      `,
      prisma.$queryRaw<Array<{ d: Date | null }>>`
        SELECT MIN(created_at) AS d
        FROM tracked_matches
        WHERE aggregate_status = 'PENDING'
      `,
      prisma.$queryRaw<Array<{ aggregate_status: string; c: bigint }>>`
        SELECT aggregate_status, COUNT(*)::bigint AS c
        FROM tracked_matches
        GROUP BY aggregate_status
      `,
      prisma.$queryRaw<Array<{ d: Date | null }>>`
        SELECT MAX(aggregated_at) AS d
        FROM tracked_matches
      `,
      prisma.player.count({ where: { puuidKeyVersion: null } }),
      prisma.player.count({ where: { createdAt: { gte: since1h } } }),
      prisma.player.count({ where: { lastSeen: { gte: since1h } } }),
      prisma.player.count({ where: { updatedAt: { gte: since1h } } }),
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM tracked_matches
        WHERE status = 'DEFERRED_RANK_PENDING'
          AND aggregate_status = 'PENDING'
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM match_ingest_raw
        WHERE status = 'error'
          AND last_error = 'tracked_rank_pending'
      `,
    ])
    const rawCounts = isRawIngestQueueEnabled()
      ? await countRawIngestByStatus().catch(() => ({ pending: 0, processing: 0, error: 0 }))
      : null
    return {
      adminDataSource: 'stats_db',
      totalPlayers,
      playersWrongKeyVersion,
      lastNewPlayerAt: lastPlayer?.createdAt?.toISOString() ?? null,
      lastPlayerLastSeenAt: maxLastSeenAgg._max.lastSeen?.toISOString() ?? null,
      lastPlayerUpdatedAt: maxUpdatedAgg._max.updatedAt?.toISOString() ?? null,
      totalTrackedMatches: Number(trackedTotal[0]?.c ?? 0),
      trackedMatchesCreatedLast1h: Number(tracked1h[0]?.c ?? 0),
      trackedMatchesPendingNow: Number(trackedPendingNow[0]?.c ?? 0),
      trackedMatchesPendingOver1h: Number(trackedPendingOver1h[0]?.c ?? 0),
      trackedOldestPendingCreatedAt: trackedOldestPendingCreatedAt[0]?.d?.toISOString() ?? null,
      trackedAggregateStatus: Object.fromEntries(
        trackedAggByStatus.map((r) => [r.aggregate_status, Number(r.c ?? 0)]),
      ),
      trackedLastAggregatedAt: trackedLastAggregatedAt[0]?.d?.toISOString() ?? null,
      playersCreatedLast1h: playersCreated1h,
      playersLastSeenLast1h: playersLastSeen1h,
      playersUpdatedLast1h: playersUpdated1h,
      matchIngestRaw: rawCounts
        ? {
            ...rawCounts,
            errorRankPending: Number(rawRankPendingErr[0]?.c ?? 0),
          }
        : null,
      trackedMatchesDeferredRankPending: Number(trackedDeferredRank[0]?.c ?? 0),
    }
  } catch {
    return empty
  }
}

/**
 * Vue admin depuis `lelanation_statistiques` : `processed_matches` remplace la file `tracked_matches`
 * pour les compteurs agrégés ; pas de `match_ingest_raw`.
 */
async function getAdminDataCollectStatsFromStatistiques(): Promise<AdminDataCollectStats> {
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
        pmAggByStatus.rows.map((r) => [r.aggregate_status, parseInt(r.c ?? '0', 10)]),
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

export async function getAdminDataCollectStats(): Promise<AdminDataCollectStats> {
  if (isStatistiquesDatabaseConfigured()) {
    return getAdminDataCollectStatsFromStatistiques()
  }
  if (isDatabaseConfigured()) {
    return getAdminDataCollectStatsFromPrisma()
  }
  return emptyStats()
}
