import { prisma } from '../db.js'

function dedupeNonEmptyTrackedIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const k = String(raw ?? '').trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

export async function tryReserveTrackedMatch(matchId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ match_id: string }>>`
    INSERT INTO tracked_matches (match_id)
    VALUES (${matchId})
    ON CONFLICT (match_id) DO UPDATE
      SET status = 'PENDING',
          created_at = NOW(),
          aggregate_status = 'PENDING',
          aggregate_last_error = NULL,
          aggregated_at = NULL
    WHERE tracked_matches.status = 'ERROR'
       OR tracked_matches.status LIKE 'DEFERRED_%'
    RETURNING match_id;
  `
  return rows.length > 0
}

export async function setTrackedMatchStatus(matchId: string, status: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE tracked_matches
    SET status = ${status}
    WHERE match_id = ${matchId}
  `
}

export async function markTrackedMatchAggregateError(matchId: string, message: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE tracked_matches
    SET aggregate_status = 'ERROR',
        aggregate_attempt_count = aggregate_attempt_count + 1,
        aggregate_last_error = LEFT(${message}, 2000),
        aggregated_at = NULL
    WHERE match_id = ${matchId}
  `
}

export async function markTrackedMatchAggregated(matchId: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO tracked_matches (
      match_id,
      status,
      created_at,
      aggregate_status,
      aggregate_attempt_count,
      aggregate_last_error,
      aggregated_at
    )
    VALUES (
      ${matchId},
      'INGESTED',
      NOW(),
      'AGGREGATED',
      1,
      NULL,
      NOW()
    )
    ON CONFLICT (match_id) DO UPDATE
    SET status = 'INGESTED',
        aggregate_status = 'AGGREGATED',
        aggregate_attempt_count = tracked_matches.aggregate_attempt_count + 1,
        aggregate_last_error = NULL,
        aggregated_at = NOW()
  `
}

/** Same as {@link markTrackedMatchAggregated} for every distinct id (queue vs canonical riot id). */
export async function markTrackedMatchAggregatedForAliases(ids: string[]): Promise<void> {
  for (const id of dedupeNonEmptyTrackedIds(ids)) {
    await markTrackedMatchAggregated(id)
  }
}

export async function markTrackedMatchAggregateErrorForAliases(ids: string[], message: string): Promise<void> {
  for (const id of dedupeNonEmptyTrackedIds(ids)) {
    await markTrackedMatchAggregateError(id, message)
  }
}

export async function setTrackedMatchStatusForAliases(ids: string[], status: string): Promise<void> {
  for (const id of dedupeNonEmptyTrackedIds(ids)) {
    await setTrackedMatchStatus(id, status)
  }
}

export async function releaseTrackedMatchForAliases(ids: string[]): Promise<void> {
  for (const id of dedupeNonEmptyTrackedIds(ids)) {
    await releaseTrackedMatch(id)
  }
}

export async function releaseTrackedMatch(matchId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM tracked_matches
    WHERE match_id = ${matchId}
  `
}

export async function releaseTrackedErrorMatches(limit: number): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ match_id: string }>>`
    WITH candidates AS (
      SELECT match_id
      FROM tracked_matches
      WHERE status = 'ERROR'
      ORDER BY created_at ASC
      LIMIT ${Math.max(1, limit)}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE tracked_matches t
    SET
      status = 'PENDING',
      created_at = NOW()
    FROM candidates c
    WHERE t.match_id = c.match_id
    RETURNING t.match_id
  `
  return rows.length
}

export async function releaseStalePendingTrackedMatches(
  limit: number,
  olderThan: Date
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ match_id: string }>>`
    WITH candidates AS (
      SELECT match_id
      FROM tracked_matches
      WHERE status = 'PENDING'
        AND created_at < ${olderThan}
      ORDER BY created_at ASC
      LIMIT ${Math.max(1, limit)}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM tracked_matches t
    USING candidates c
    WHERE t.match_id = c.match_id
    RETURNING t.match_id
  `
  return rows.length
}
