/**
 * Raw SQL helpers for `lelanation_statistiques` (postgres.js).
 */
import { sql } from "./client.js";

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Execute raw SQL (caller must sanitize identifiers / values). */
export async function queryRawUnsafe<T>(query: string): Promise<T> {
  return (await sql.unsafe(query)) as T;
}

export type RankSnapshot = {
  rankTier: string;
  rankDivision: string;
  rankLp: number;
  date: Date;
};

type RankHistoryRow = {
  puuid: string;
  rank_tier: string | null;
  rank_division: string | null;
  rank_lp: number | null;
  date: Date;
};

/** Earliest player_rank_history row with date >= matchDate (one per puuid). */
export async function getClosestRankSnapshotsAtOrAfter(
  puuids: string[],
  matchDate: Date,
): Promise<Map<string, RankSnapshot>> {
  if (puuids.length === 0) {
    return new Map();
  }

  const matchDateIso = matchDate.toISOString().slice(0, 10);
  const rows = await sql<RankHistoryRow[]>`
    SELECT DISTINCT ON (puuid)
      puuid, rank_tier, rank_division, rank_lp, date
    FROM player_rank_history
    WHERE puuid = ANY(${sql.array(puuids, 25)})
      AND date >= ${matchDateIso}::date
    ORDER BY puuid, date ASC
  `;

  const out = new Map<string, RankSnapshot>();
  for (const row of rows) {
    const tier = String(row.rank_tier ?? "")
      .trim()
      .toUpperCase();
    out.set(row.puuid, {
      rankTier: tier.length > 0 ? tier : "UNRANKED",
      rankDivision: String(row.rank_division ?? "").trim(),
      rankLp: Number(row.rank_lp ?? 0),
      date: row.date instanceof Date ? row.date : new Date(row.date),
    });
  }
  return out;
}

/**
 * Best-effort rank snapshot per puuid with this priority:
 * 1) exact date == matchDate
 * 2) closest date before matchDate
 * 3) closest date after matchDate
 */
export async function getBestEffortRankSnapshotsForMatch(
  puuids: string[],
  matchDate: Date,
): Promise<Map<string, RankSnapshot>> {
  if (puuids.length === 0) {
    return new Map();
  }

  const matchDateIso = matchDate.toISOString().slice(0, 10);
  const rows = await sql<RankHistoryRow[]>`
    SELECT DISTINCT ON (puuid)
      puuid, rank_tier, rank_division, rank_lp, date
    FROM player_rank_history
    WHERE puuid = ANY(${sql.array(puuids, 25)})
    ORDER BY
      puuid,
      CASE
        WHEN date = ${matchDateIso}::date THEN 0
        WHEN date < ${matchDateIso}::date THEN 1
        ELSE 2
      END ASC,
      CASE WHEN date < ${matchDateIso}::date THEN date END DESC,
      CASE WHEN date >= ${matchDateIso}::date THEN date END ASC
  `;

  const out = new Map<string, RankSnapshot>();
  for (const row of rows) {
    const tier = String(row.rank_tier ?? "")
      .trim()
      .toUpperCase();
    out.set(row.puuid, {
      rankTier: tier.length > 0 ? tier : "UNRANKED",
      rankDivision: String(row.rank_division ?? "").trim(),
      rankLp: Number(row.rank_lp ?? 0),
      date: row.date instanceof Date ? row.date : new Date(row.date),
    });
  }
  return out;
}
