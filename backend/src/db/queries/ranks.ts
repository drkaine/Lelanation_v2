import { sql } from '../client.js'
import { normalizeLolRankTier, normalizeLolRegion } from '../../constants/lolEnums.js'
import { sweepDay } from '../../poll-orchestration/leagueSweep.js'

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
      AND date = ${sweepDay(new Date())}::date
    LIMIT 1
  `
  return rows.length > 0
}

export async function insertRankHistory(entry: RankHistoryRow): Promise<void> {
  // Jour du balayage (local, 00:01), comme les cibles : la date UTC décalait d'un jour de 00:01 à 01:00/02:00.
  const dateOnly = sweepDay(entry.rankedAt)
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
    ON CONFLICT (puuid, date, region) DO UPDATE SET
      rank_tier = EXCLUDED.rank_tier,
      rank_division = EXCLUDED.rank_division,
      rank_lp = EXCLUDED.rank_lp
    WHERE EXCLUDED.rank_tier <> 'UNRANKED'
       OR player_rank_history.rank_tier = 'UNRANKED'
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
          AND prh.date = ${sweepDay(new Date())}::date
      )
  `
  return rows.map((row) => row.puuid)
}
