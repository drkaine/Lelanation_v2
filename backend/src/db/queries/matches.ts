import { sql } from '../client.js'

export async function filterNewMatches(matchIds: string[], patch: string): Promise<string[]> {
  if (matchIds.length === 0) return []

  const knownRows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id
    FROM processed_matches
    WHERE riot_match_id = ANY(${sql.array(matchIds, 25)})
      AND patch = ${patch}
  `

  const known = new Set(knownRows.map((row) => row.riot_match_id))
  return matchIds.filter((matchId) => !known.has(matchId))
}

export async function insertPendingMatch(
  matchId: string,
  patch: string,
  rank: string,
  gameDate: Date
): Promise<void> {
  await sql`
    INSERT INTO processed_matches (patch, game_date, riot_match_id, status, rank)
    VALUES (${patch}, ${gameDate.toISOString().slice(0, 10)}::date, ${matchId}, 'pending', ${rank})
    ON CONFLICT (patch, riot_match_id) DO NOTHING
  `
}

export async function insertPendingMatches(matchIds: string[], patch: string, rank: string): Promise<void> {
  if (matchIds.length === 0) return
  const uniqueIds = Array.from(new Set(matchIds))
  await sql`
    INSERT INTO processed_matches (patch, game_date, riot_match_id, status, rank)
    SELECT ${patch}, CURRENT_DATE, x.match_id, 'pending', ${rank}
    FROM UNNEST(${sql.array(uniqueIds, 25)}) AS x(match_id)
    ON CONFLICT (patch, riot_match_id) DO NOTHING
  `
}

export async function updateMatchStatus(
  matchId: string,
  patch: string,
  status: 'done' | 'error'
): Promise<void> {
  await sql`
    UPDATE processed_matches
    SET status = ${status}
    WHERE patch = ${patch}
      AND riot_match_id = ${matchId}
  `
}
