/**
 * Companion : vérifie si un match est déjà connu (table `matchs`).
 * Retourne true si le match n'est pas encore ingéré (peut être soumis).
 */
import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'

export async function tryReserveTrackedMatch(riotMatchId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const matchId = String(riotMatchId ?? '').trim()
  if (!matchId) return false
  const rows = await sql<Array<{ ok: boolean }>>`
    SELECT NOT EXISTS (
      SELECT 1 FROM matchs WHERE riot_match_id = ${matchId}
    ) AS ok
  `
  return rows[0]?.ok === true
}
