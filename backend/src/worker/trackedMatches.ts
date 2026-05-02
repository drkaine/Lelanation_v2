import { prisma } from '../db.js'

export type TrackedMatchPlayerSlot = {
  puuid?: string | null
  gameName?: string | null
  tagName?: string | null
  region?: string | null
  rankTier?: string | null
  rankDivision?: string | null
}

function normalizeSlotsTo10(
  slots: Array<TrackedMatchPlayerSlot | null | undefined>
): Array<TrackedMatchPlayerSlot | null> {
  const out: Array<TrackedMatchPlayerSlot | null> = Array.from({ length: 10 }, () => null)
  for (let i = 0; i < Math.min(10, slots.length); i++) {
    const s = slots[i]
    if (!s) continue
    out[i] = {
      puuid: s.puuid ?? null,
      gameName: s.gameName ?? null,
      tagName: s.tagName ?? null,
      region: s.region ?? null,
      rankTier: s.rankTier ?? null,
      rankDivision: s.rankDivision ?? null,
    }
  }
  return out
}

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

export async function upsertTrackedMatchPlayers(
  matchId: string,
  slots: Array<TrackedMatchPlayerSlot | null | undefined>,
  status: string = 'PENDING'
): Promise<void> {
  const s = normalizeSlotsTo10(slots)
  await prisma.$executeRaw`
    INSERT INTO tracked_matches (
      match_id,
      status,
      created_at,
      aggregate_status,
      aggregate_last_error,
      player1,
      player2,
      player3,
      player4,
      player5,
      player6,
      player7,
      player8,
      player9,
      player10
    )
    VALUES (
      ${matchId},
      ${status},
      NOW(),
      'PENDING',
      NULL,
      ${s[0]}::jsonb,
      ${s[1]}::jsonb,
      ${s[2]}::jsonb,
      ${s[3]}::jsonb,
      ${s[4]}::jsonb,
      ${s[5]}::jsonb,
      ${s[6]}::jsonb,
      ${s[7]}::jsonb,
      ${s[8]}::jsonb,
      ${s[9]}::jsonb
    )
    ON CONFLICT (match_id) DO UPDATE
    SET status = EXCLUDED.status,
        aggregate_status = 'PENDING',
        aggregate_last_error = NULL,
        player1 = COALESCE(EXCLUDED.player1, tracked_matches.player1),
        player2 = COALESCE(EXCLUDED.player2, tracked_matches.player2),
        player3 = COALESCE(EXCLUDED.player3, tracked_matches.player3),
        player4 = COALESCE(EXCLUDED.player4, tracked_matches.player4),
        player5 = COALESCE(EXCLUDED.player5, tracked_matches.player5),
        player6 = COALESCE(EXCLUDED.player6, tracked_matches.player6),
        player7 = COALESCE(EXCLUDED.player7, tracked_matches.player7),
        player8 = COALESCE(EXCLUDED.player8, tracked_matches.player8),
        player9 = COALESCE(EXCLUDED.player9, tracked_matches.player9),
        player10 = COALESCE(EXCLUDED.player10, tracked_matches.player10)
  `
}

export async function upsertTrackedMatchPlayersForAliases(
  ids: string[],
  slots: Array<TrackedMatchPlayerSlot | null | undefined>,
  status: string = 'PENDING'
): Promise<void> {
  for (const id of dedupeNonEmptyTrackedIds(ids)) {
    await upsertTrackedMatchPlayers(id, slots, status)
  }
}

export async function fetchTrackedMatchesForRankHydration(limit: number): Promise<
  Array<{
    matchId: string
    players: Array<TrackedMatchPlayerSlot | null>
  }>
> {
  const capped = Math.max(1, Math.min(1000, limit))
  const rows = await prisma.$queryRaw<
    Array<{
      match_id: string
      player1: unknown | null
      player2: unknown | null
      player3: unknown | null
      player4: unknown | null
      player5: unknown | null
      player6: unknown | null
      player7: unknown | null
      player8: unknown | null
      player9: unknown | null
      player10: unknown | null
    }>
  >`
    SELECT
      match_id,
      player1, player2, player3, player4, player5,
      player6, player7, player8, player9, player10
    FROM tracked_matches
    WHERE aggregate_status IN ('PENDING', 'ERROR')
      AND status IN ('PENDING', 'QUEUED', 'DEFERRED_RANK_PENDING', 'DEFERRED_AGGREGATE_RANK_WAIT')
    ORDER BY created_at ASC
    LIMIT ${capped}
  `
  return rows.map((r) => ({
    matchId: r.match_id,
    players: normalizeSlotsTo10([
      r.player1 as TrackedMatchPlayerSlot | null,
      r.player2 as TrackedMatchPlayerSlot | null,
      r.player3 as TrackedMatchPlayerSlot | null,
      r.player4 as TrackedMatchPlayerSlot | null,
      r.player5 as TrackedMatchPlayerSlot | null,
      r.player6 as TrackedMatchPlayerSlot | null,
      r.player7 as TrackedMatchPlayerSlot | null,
      r.player8 as TrackedMatchPlayerSlot | null,
      r.player9 as TrackedMatchPlayerSlot | null,
      r.player10 as TrackedMatchPlayerSlot | null,
    ]),
  }))
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
    UPDATE tracked_matches
    SET status = 'DEFERRED_RELEASED',
        aggregate_status = 'PENDING',
        aggregate_last_error = COALESCE(aggregate_last_error, 'released_without_delete'),
        aggregated_at = NULL
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
    UPDATE tracked_matches t
    SET status = 'ERROR',
        aggregate_status = 'ERROR',
        aggregate_last_error = 'stale_pending_requeued',
        created_at = NOW()
    FROM candidates c
    WHERE t.match_id = c.match_id
    RETURNING t.match_id
  `
  return rows.length
}
