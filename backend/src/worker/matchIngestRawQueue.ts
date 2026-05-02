import { prisma } from '../db.js'
import type { MatchIngestQueuePayloadV1 } from './matchIngestQueue.js'

export type MatchIngestRawRow = {
  id: bigint
  riotMatchId: string
  region: string
  payloadJson: unknown
  timelineJson: unknown | null
  attemptCount: number
  ingestedAt: Date
}

export function isRawIngestQueueEnabled(): boolean {
  const raw = (process.env.MATCH_INGEST_RAW_QUEUE ?? '').trim().toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'off')
}

export async function tryInsertRawIngestPayload(
  payload: MatchIngestQueuePayloadV1
): Promise<'written'> {
  await prisma.$executeRaw`
    INSERT INTO match_ingest_raw (
      riot_match_id,
      region,
      payload_json,
      timeline_json,
      status,
      ingested_at
    )
    VALUES (
      ${payload.matchId},
      ${payload.region},
      ${payload.matchDto}::jsonb,
      ${payload.timelineDto == null ? null : payload.timelineDto}::jsonb,
      'pending',
      NOW()
    )
    ON CONFLICT (riot_match_id) DO NOTHING
  `
  return 'written'
}

export async function countRawIngestByStatus(): Promise<{
  pending: number
  processing: number
  error: number
}> {
  const rows = await prisma.$queryRaw<Array<{ status: string; cnt: bigint | number }>>`
    SELECT status, COUNT(*) AS cnt
    FROM match_ingest_raw
    GROUP BY status
  `
  const out = { pending: 0, processing: 0, error: 0 }
  for (const r of rows) {
    const n = typeof r.cnt === 'bigint' ? Number(r.cnt) : Number(r.cnt ?? 0)
    if (r.status === 'pending') out.pending = n
    else if (r.status === 'processing') out.processing = n
    else if (r.status === 'error') out.error = n
  }
  return out
}

export async function claimRawIngestRows(limit: number): Promise<MatchIngestRawRow[]> {
  if (limit <= 0) return []
  const rows = await prisma.$queryRaw<MatchIngestRawRow[]>`
    WITH claim AS (
      SELECT id
      FROM match_ingest_raw
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE match_ingest_raw q
    SET status = 'processing',
        processing_started_at = NOW()
    FROM claim
    WHERE q.id = claim.id
    RETURNING
      q.id,
      q.riot_match_id AS "riotMatchId",
      q.region,
      q.payload_json AS "payloadJson",
      q.timeline_json AS "timelineJson",
      q.attempt_count AS "attemptCount",
      q.ingested_at AS "ingestedAt"
  `
  return rows
}

export async function markRawIngestDone(id: bigint): Promise<void> {
  await prisma.$executeRaw`
    UPDATE match_ingest_raw
    SET status = 'done',
        normalized_at = NOW(),
        processing_started_at = NULL,
        last_error = NULL,
        next_retry_at = NULL
    WHERE id = ${id}
  `
}

export async function deleteRawIngestRow(id: bigint): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM match_ingest_raw
    WHERE id = ${id}
  `
}

export async function markRawIngestError(
  id: bigint,
  message: string,
  retryAfterMs: number
): Promise<void> {
  const retrySec = Math.max(1, Math.ceil(retryAfterMs / 1000))
  await prisma.$executeRaw`
    UPDATE match_ingest_raw
    SET status = 'error',
        attempt_count = attempt_count + 1,
        last_error = LEFT(${message}, 2000),
        processing_started_at = NULL,
        next_retry_at = NOW() + (${retrySec} * INTERVAL '1 second')
    WHERE id = ${id}
  `
}

export async function requeueRawIngestErrors(limit: number): Promise<number> {
  const capped = Math.max(1, Math.min(10_000, limit))
  const moved = await prisma.$executeRaw`
    WITH candidates AS (
      SELECT id
      FROM match_ingest_raw
      WHERE status = 'error'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY COALESCE(next_retry_at, ingested_at), id
      LIMIT ${capped}
    )
    UPDATE match_ingest_raw q
    SET status = 'pending',
        processing_started_at = NULL,
        next_retry_at = NULL
    FROM candidates
    WHERE q.id = candidates.id
  `
  return Number(moved ?? 0)
}

export async function requeueRawIngestStaleProcessing(maxAgeMs: number, limit: number): Promise<number> {
  const cappedLimit = Math.max(1, Math.min(10_000, limit))
  const cappedAgeSec = Math.max(1, Math.ceil(maxAgeMs / 1000))
  const moved = await prisma.$executeRaw`
    WITH candidates AS (
      SELECT id
      FROM match_ingest_raw
      WHERE status = 'processing'
        AND processing_started_at IS NOT NULL
        AND processing_started_at <= NOW() - (${cappedAgeSec} * INTERVAL '1 second')
      ORDER BY processing_started_at, id
      LIMIT ${cappedLimit}
    )
    UPDATE match_ingest_raw q
    SET status = 'pending',
        processing_started_at = NULL,
        next_retry_at = NULL,
        last_error = COALESCE(NULLIF(q.last_error, ''), 'stale_processing_recovered')
    FROM candidates
    WHERE q.id = candidates.id
  `
  return Number(moved ?? 0)
}

/**
 * Purge `match_ingest_raw` rows in `done` status once `normalized_at` is older than `minRetentionMs`.
 * Pass `0` to delete eligible `done` rows regardless of age (still requires `normalized_at` set).
 */
export async function deleteDoneRawIngestRows(batchSize: number, minRetentionMs: number): Promise<number> {
  const capped = Math.max(1, Math.min(200_000, batchSize))
  const retentionMs =
    Number.isFinite(minRetentionMs) && minRetentionMs >= 0
      ? Math.min(30 * 24 * 60 * 60 * 1000, minRetentionMs)
      : 0
  const retentionSec = Math.max(0, Math.ceil(retentionMs / 1000))
  const deleted = await prisma.$executeRaw`
    WITH candidates AS (
      SELECT id
      FROM match_ingest_raw
      WHERE status = 'done'
        AND normalized_at IS NOT NULL
        AND normalized_at <= NOW() - (${retentionSec} * INTERVAL '1 second')
      ORDER BY normalized_at, id
      LIMIT ${capped}
    )
    DELETE FROM match_ingest_raw q
    USING candidates
    WHERE q.id = candidates.id
  `
  return Number(deleted ?? 0)
}
