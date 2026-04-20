import { prisma } from '../db.js'

export async function tryReserveTrackedMatch(matchId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ match_id: string }>>`
    INSERT INTO tracked_matches (match_id)
    VALUES (${matchId})
    ON CONFLICT (match_id) DO UPDATE
      SET status = CASE
        WHEN tracked_matches.status = 'ERROR' THEN 'PENDING'
        ELSE tracked_matches.status
      END,
      created_at = CASE
        WHEN tracked_matches.status = 'ERROR' THEN NOW()
        ELSE tracked_matches.created_at
      END
    WHERE tracked_matches.status = 'ERROR'
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
