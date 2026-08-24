/**
 * Séries temporelles admin depuis `lelanation_statistiques` (nouveaux joueurs, matchs ingérés).
 * Requêtes index-friendly : pas de jointure participants×matchs (trop lente sur ~2,4M lignes).
 */
import { getStatistiquesPool, isStatistiquesDatabaseConfigured } from '../drizzle/statistiquesDb.js'

export type CollectTimeseriesGranularity = 'hour' | 'day'

export type CollectTimeseriesBucket = {
  bucket: string
  newPlayers: number
  playersWithMatches: number
  matchesIngested: number
  matchesPerPlayer: number | null
}

export type CollectTimeseriesAverages = {
  newPlayers: number
  playersWithMatches: number
  matchesIngested: number
  matchesPerPlayer: number | null
}

export type CollectTimeseriesView = {
  granularity: CollectTimeseriesGranularity
  bucketCount: number
  averages: CollectTimeseriesAverages
  buckets: CollectTimeseriesBucket[]
}

export type AdminCollectTimeseriesResponse = {
  configured: boolean
  range: { from: string; to: string; days: number; hourDays: number }
  byDay: CollectTimeseriesView | null
  byHour: CollectTimeseriesView | null
  error?: string
}

type BucketRow = {
  bucket: Date
  count: string
}

const QUERY_TIMEOUT_MS = 15_000

const GRANULARITY_SQL: Record<CollectTimeseriesGranularity, string> = {
  hour: `date_trunc('hour', ts AT TIME ZONE 'UTC')`,
  day: `date_trunc('day', ts AT TIME ZONE 'UTC')`,
}

function parseCount(value: string | undefined): number {
  return parseInt(value ?? '0', 10) || 0
}

function roundAverage(total: number, count: number): number {
  if (count <= 0) return 0
  return Math.round((total / count) * 100) / 100
}

function roundRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 100) / 100
}

function bucketIso(date: Date): string {
  return date.toISOString()
}

async function queryBuckets(
  sql: string,
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const pool = getStatistiquesPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL statement_timeout = '${QUERY_TIMEOUT_MS}'`)
    const result = await client.query<BucketRow>(sql, [from, to])
    await client.query('COMMIT')

    const map = new Map<string, number>()
    for (const row of result.rows) {
      map.set(bucketIso(row.bucket), parseCount(row.count))
    }
    return map
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

function buildView(
  granularity: CollectTimeseriesGranularity,
  newPlayersByBucket: Map<string, number>,
  playersWithMatchesByBucket: Map<string, number>,
  matchesIngestedByBucket: Map<string, number>,
): CollectTimeseriesView {
  const bucketKeys = new Set([
    ...newPlayersByBucket.keys(),
    ...playersWithMatchesByBucket.keys(),
    ...matchesIngestedByBucket.keys(),
  ])
  const sortedKeys = [...bucketKeys].sort()

  const buckets: CollectTimeseriesBucket[] = sortedKeys.map(key => {
    const newPlayers = newPlayersByBucket.get(key) ?? 0
    const playersWithMatches = playersWithMatchesByBucket.get(key) ?? 0
    const matchesIngested = matchesIngestedByBucket.get(key) ?? 0
    return {
      bucket: key,
      newPlayers,
      playersWithMatches,
      matchesIngested,
      matchesPerPlayer: roundRatio(matchesIngested, playersWithMatches),
    }
  })

  const bucketCount = buckets.length
  const totals = buckets.reduce(
    (acc, bucket) => {
      acc.newPlayers += bucket.newPlayers
      acc.playersWithMatches += bucket.playersWithMatches
      acc.matchesIngested += bucket.matchesIngested
      if (bucket.matchesPerPlayer != null) {
        acc.matchesPerPlayerSum += bucket.matchesPerPlayer
        acc.matchesPerPlayerBuckets += 1
      }
      return acc
    },
    {
      newPlayers: 0,
      playersWithMatches: 0,
      matchesIngested: 0,
      matchesPerPlayerSum: 0,
      matchesPerPlayerBuckets: 0,
    },
  )

  return {
    granularity,
    bucketCount,
    averages: {
      newPlayers: roundAverage(totals.newPlayers, bucketCount),
      playersWithMatches: roundAverage(totals.playersWithMatches, bucketCount),
      matchesIngested: roundAverage(totals.matchesIngested, bucketCount),
      matchesPerPlayer:
        totals.matchesPerPlayerBuckets > 0
          ? roundAverage(totals.matchesPerPlayerSum, totals.matchesPerPlayerBuckets)
          : null,
    },
    buckets,
  }
}

async function buildTimeseriesView(
  granularity: CollectTimeseriesGranularity,
  from: Date,
  to: Date,
): Promise<CollectTimeseriesView> {
  const newPlayersTrunc = GRANULARITY_SQL[granularity].replace(/ts/g, 'created_at')
  const playersActiveTrunc = GRANULARITY_SQL[granularity].replace(/ts/g, 'last_seen')
  const matchesTrunc = GRANULARITY_SQL[granularity].replace(/ts/g, 'created_at')

  const [newPlayersByBucket, playersWithMatchesByBucket, matchesIngestedByBucket] =
    await Promise.all([
      queryBuckets(
        `SELECT ${newPlayersTrunc} AS bucket, COUNT(*)::text AS count
         FROM players
         WHERE created_at >= $1 AND created_at < $2
         GROUP BY 1
         ORDER BY 1`,
        from,
        to,
      ),
      queryBuckets(
        `SELECT ${playersActiveTrunc} AS bucket, COUNT(*)::text AS count
         FROM players
         WHERE last_seen >= $1 AND last_seen < $2
         GROUP BY 1
         ORDER BY 1`,
        from,
        to,
      ),
      queryBuckets(
        `SELECT ${matchesTrunc} AS bucket, COUNT(*)::text AS count
         FROM matchs
         WHERE created_at >= $1 AND created_at < $2
         GROUP BY 1
         ORDER BY 1`,
        from,
        to,
      ),
    ])

  return buildView(
    granularity,
    newPlayersByBucket,
    playersWithMatchesByBucket,
    matchesIngestedByBucket,
  )
}

export async function getAdminCollectTimeseries(options?: {
  days?: number
  hourDays?: number
}): Promise<AdminCollectTimeseriesResponse> {
  const days = Math.max(1, Math.min(90, options?.days ?? 30))
  const hourDays = Math.max(1, Math.min(14, options?.hourDays ?? 7))
  const to = new Date()
  const dayFrom = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const hourFrom = new Date(to.getTime() - hourDays * 24 * 60 * 60 * 1000)

  const range = { from: dayFrom.toISOString(), to: to.toISOString(), days, hourDays }

  if (!isStatistiquesDatabaseConfigured()) {
    return {
      configured: false,
      range,
      byDay: null,
      byHour: null,
    }
  }

  try {
    const [byDay, byHour] = await Promise.all([
      buildTimeseriesView('day', dayFrom, to),
      buildTimeseriesView('hour', hourFrom, to),
    ])
    return {
      configured: true,
      range,
      byDay,
      byHour,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[AdminCollectTimeseriesService] query failed:', message)
    return {
      configured: true,
      range,
      byDay: null,
      byHour: null,
      error: message,
    }
  }
}
