import { sql } from '../client.js'

export function minuteBucket(date = new Date()): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  return d
}

export async function insertRateLimitWindow(input: {
  windowStart: number
  windowEnd: number
  requestsSent: number
  requestsTarget: number
  count429: number
  avgQueueDepth: number
  headerSyncs: number
  headroomMin: number
}): Promise<void> {
  await sql`
    INSERT INTO obs_rate_limit_windows (
      window_start, window_end, requests_sent, requests_target, count_429, avg_queue_depth, header_syncs, headroom_min
    )
    VALUES (
      ${new Date(input.windowStart)},
      ${new Date(input.windowEnd)},
      ${input.requestsSent},
      ${input.requestsTarget},
      ${input.count429},
      ${input.avgQueueDepth},
      ${input.headerSyncs},
      ${input.headroomMin}
    )
  `
}

export async function upsertPipelineMinute(input: {
  bucketStart: Date
  stage: string
  itemsProcessed: number
  itemsFailed: number
  avgDurationMs: number
  p95DurationMs: number
  queueDepthAvg: number
}): Promise<void> {
  await sql`
    INSERT INTO obs_pipeline_minutes (
      bucket_start, stage, items_processed, items_failed, avg_duration_ms, p95_duration_ms, queue_depth_avg
    )
    VALUES (
      ${input.bucketStart},
      ${input.stage},
      ${input.itemsProcessed},
      ${input.itemsFailed},
      ${input.avgDurationMs},
      ${input.p95DurationMs},
      ${input.queueDepthAvg}
    )
    ON CONFLICT (bucket_start, stage)
    DO UPDATE SET
      items_processed = EXCLUDED.items_processed,
      items_failed = EXCLUDED.items_failed,
      avg_duration_ms = EXCLUDED.avg_duration_ms,
      p95_duration_ms = EXCLUDED.p95_duration_ms,
      queue_depth_avg = EXCLUDED.queue_depth_avg
  `
}

export async function upsertDBWriteStat(input: {
  bucketStart: Date
  tableName: string
  rowsWritten: number
  writeErrors: number
  avgMs: number
}): Promise<void> {
  await sql`
    INSERT INTO obs_db_write_stats (
      bucket_start, table_name, rows_written, write_errors, avg_ms
    )
    VALUES (
      ${input.bucketStart},
      ${input.tableName},
      ${input.rowsWritten},
      ${input.writeErrors},
      ${input.avgMs}
    )
    ON CONFLICT (bucket_start, table_name)
    DO UPDATE SET
      rows_written = EXCLUDED.rows_written,
      write_errors = EXCLUDED.write_errors,
      avg_ms = EXCLUDED.avg_ms
  `
}

export async function insertHourlySummary(input: {
  hourStart: number
  totalApiRequests: number
  total429s: number
  totalMatchesProcessed: number
  totalPlayersUpdated: number
  totalRanksFetched: number
  totalDbRowsWritten: number
  totalErrors: number
  avgRequestsPer120s: number
  minRequestsPer120s: number
  maxRequestsPer120s: number
  headroomAvg: number
}): Promise<void> {
  await sql`
    INSERT INTO obs_hourly_summaries (
      hour_start,
      total_api_requests,
      total_429s,
      total_matches_processed,
      total_players_updated,
      total_ranks_fetched,
      total_db_rows_written,
      total_errors,
      avg_requests_per_120s,
      min_requests_per_120s,
      max_requests_per_120s,
      headroom_avg
    )
    VALUES (
      ${new Date(input.hourStart)},
      ${input.totalApiRequests},
      ${input.total429s},
      ${input.totalMatchesProcessed},
      ${input.totalPlayersUpdated},
      ${input.totalRanksFetched},
      ${input.totalDbRowsWritten},
      ${input.totalErrors},
      ${input.avgRequestsPer120s},
      ${input.minRequestsPer120s},
      ${input.maxRequestsPer120s},
      ${input.headroomAvg}
    )
    ON CONFLICT (hour_start)
    DO UPDATE SET
      total_api_requests = EXCLUDED.total_api_requests,
      total_429s = EXCLUDED.total_429s,
      total_matches_processed = EXCLUDED.total_matches_processed,
      total_players_updated = EXCLUDED.total_players_updated,
      total_ranks_fetched = EXCLUDED.total_ranks_fetched,
      total_db_rows_written = EXCLUDED.total_db_rows_written,
      total_errors = EXCLUDED.total_errors,
      avg_requests_per_120s = EXCLUDED.avg_requests_per_120s,
      min_requests_per_120s = EXCLUDED.min_requests_per_120s,
      max_requests_per_120s = EXCLUDED.max_requests_per_120s,
      headroom_avg = EXCLUDED.headroom_avg
  `
}

export async function insertObsError(input: {
  stage?: string
  errorType?: string
  message?: string
  context?: Record<string, unknown>
  matchId?: string
  puuid?: string
}): Promise<void> {
  await sql`
    INSERT INTO obs_errors (
      stage, error_type, message, context, match_id, puuid
    )
    VALUES (
      ${input.stage ?? null},
      ${input.errorType ?? null},
      ${input.message ?? null},
      ${input.context ? JSON.stringify(input.context) : null}::jsonb,
      ${input.matchId ?? null},
      ${input.puuid ?? null}
    )
  `
}
