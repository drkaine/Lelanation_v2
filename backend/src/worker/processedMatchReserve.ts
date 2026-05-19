/**
 * Reserve a match id for poller ingestion via `processed_matches` (companion app).
 */
import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'
import { normalizePatchMajorMinor } from '../stats/statsPatchQuery.js'
import { loadCurrentGameVersion } from '../services/RiotConfigService.js'

export async function tryReserveTrackedMatch(riotMatchId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const versionRes = await loadCurrentGameVersion()
  const patch =
    versionRes.isOk() && versionRes.unwrap()
      ? normalizePatchMajorMinor(versionRes.unwrap()!.currentVersion)
      : '0.0'
  const today = new Date().toISOString().slice(0, 10)
  const rows = await sql<Array<{ ok: boolean }>>`
    INSERT INTO processed_matches (patch, riot_match_id, game_date, status, aggregate_status)
    VALUES (${patch}, ${riotMatchId}, ${today}::date, 'PENDING', 'PENDING')
    ON CONFLICT (patch, riot_match_id) DO NOTHING
    RETURNING true AS ok
  `
  return rows.length > 0
}
