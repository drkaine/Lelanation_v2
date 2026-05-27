import { sql } from '../client.js'
import type { PlayerJob } from '../../poller/types.js'

type PlayerRow = {
  puuid: string
  region: string
  last_seen: Date | null
}

export async function fetchNextPlayerBatch(limit: number): Promise<PlayerJob[]> {
  const rows = await sql<PlayerRow[]>`
    SELECT puuid, region, last_seen
    FROM players
    WHERE LENGTH(TRIM(puuid)) > 0
    ORDER BY last_seen ASC NULLS FIRST
    LIMIT ${Math.max(1, limit)}
  `
  return rows.map((row) => ({
    puuid: row.puuid,
    region: row.region,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
  }))
}

export async function upsertPlayer(puuid: string, region: string): Promise<void> {
  await sql`
    INSERT INTO players (puuid, region, last_seen, updated_at)
    VALUES (${puuid}, ${region}, NOW(), NOW())
    ON CONFLICT (puuid)
    DO UPDATE SET
      region = EXCLUDED.region,
      last_seen = NOW(),
      updated_at = NOW()
  `
}

export async function upsertPlayersIfMissing(puuids: string[], region: string): Promise<void> {
  const deduped = Array.from(new Set(puuids.map((puuid) => String(puuid ?? '').trim()).filter(Boolean)))
  if (deduped.length === 0) return

  await sql`
    INSERT INTO players (puuid, region, last_seen, updated_at)
    SELECT x.puuid, ${region}, NOW(), NOW()
    FROM UNNEST(${sql.array(deduped, 25)}) AS x(puuid)
    ON CONFLICT (puuid) DO NOTHING
  `
}

export async function updatePlayerLastSeen(puuid: string): Promise<void> {
  await sql`
    UPDATE players
    SET
      last_seen = NOW(),
      updated_at = NOW()
    WHERE puuid = ${puuid}
  `
}
