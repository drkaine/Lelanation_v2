import { sql } from '../client.js'
import { normalizeLolRankTier, normalizeLolRegion } from '../../constants/lolEnums.js'

export type RankHistoryRow = {
  puuid: string
  region: string
  rankTier: string
  rankDivision: string
  rankLp: number
  rankedAt: Date
}

export async function hasRankToday(puuid: string, region: string): Promise<boolean> {
  const normalizedRegion = normalizeLolRegion(region)
  const rows = await sql<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM player_rank_history
    WHERE puuid = ${puuid}
      AND region::text = ${normalizedRegion}
      AND date = CURRENT_DATE
    LIMIT 1
  `
  return rows.length > 0
}

export async function insertRankHistory(entry: RankHistoryRow): Promise<void> {
  const dateOnly = entry.rankedAt.toISOString().slice(0, 10)
  const region = normalizeLolRegion(entry.region)
  const rankTier = normalizeLolRankTier(entry.rankTier)
  await sql`
    INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
    VALUES (
      ${entry.puuid},
      ${dateOnly}::date,
      ${region}::lol_region,
      ${rankTier}::lol_rank_tier,
      ${entry.rankDivision},
      ${entry.rankLp}
    )
    ON CONFLICT (puuid, date, region) DO NOTHING
  `
}

export async function getMissingRanksToday(puuids: string[], region: string): Promise<string[]> {
  const deduped = Array.from(new Set(puuids.map((puuid) => String(puuid ?? '').trim()).filter(Boolean)))
  if (deduped.length === 0) return []

  const normalizedRegion = normalizeLolRegion(region)
  const rows = await sql<{ puuid: string }[]>`
    SELECT p.puuid
    FROM players p
    WHERE p.puuid = ANY(${sql.array(deduped, 25)})
      AND NOT EXISTS (
        SELECT 1
        FROM player_rank_history prh
        WHERE prh.puuid = p.puuid
          AND prh.region::text = ${normalizedRegion}
          AND prh.date = CURRENT_DATE
      )
  `
  return rows.map((row) => row.puuid)
}
