/**
 * Diagnostic: why many matches are UNRANKED.
 * Usage: npx tsx src/scripts/diagUnranked.ts
 */
import 'dotenv/config';
import { sql } from '../db/client.js';

async function main(): Promise<void> {
  const pm = await sql<
    Array<{ total: number; unranked: number; pending: number; error: number }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE rank = 'UNRANKED')::int AS unranked,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'ERROR')::int AS error
    FROM processed_matches
    WHERE patch LIKE '16.%'
  `;
  console.log('processed_matches (16.*):', pm[0]);

  const byRank = await sql<Array<{ rank: string; c: number }>>`
    SELECT COALESCE(rank, '(null)') AS rank, COUNT(*)::int AS c
    FROM processed_matches
    WHERE status = 'DONE' AND patch LIKE '16.%'
    GROUP BY rank
    ORDER BY c DESC
    LIMIT 20
  `;
  console.log('DONE by rank:', byRank);

  const hist = await sql<Array<{ rank_tier: string; c: number }>>`
    SELECT rank_tier, COUNT(*)::int AS c
    FROM player_rank_history
    WHERE date >= CURRENT_DATE - 14
    GROUP BY rank_tier
    ORDER BY c DESC
  `;
  console.log('player_rank_history (14d):', hist);

  const knownUnrankedWithRankedHist = await sql<Array<{ c: number }>>`
    SELECT COUNT(DISTINCT pm.riot_match_id)::int AS c
    FROM processed_matches pm
    JOIN LATERAL (
      SELECT 1
      FROM player_rank_history prh
      WHERE prh.rank_tier <> 'UNRANKED'
        AND prh.date >= CURRENT_DATE - 14
      LIMIT 1
    ) x ON true
    WHERE pm.rank = 'UNRANKED'
      AND pm.status = 'DONE'
      AND pm.patch LIKE '16.%'
  `;
  console.log(
    '(sanity) UNRANKED matches with any ranked history row in 14d:',
    knownUnrankedWithRankedHist[0]?.c,
  );

  const champ = await sql<Array<{ rank_tier: string; games: string }>>`
    SELECT rank_tier, SUM(count_game)::text AS games
    FROM champion_stats
    WHERE patch LIKE '16.11%'
    GROUP BY rank_tier
    ORDER BY SUM(count_game) DESC
    LIMIT 12
  `;
  console.log('champion_stats 16.11 by participant rank_tier:', champ);

  const mo = await sql<Array<{ rank_tier: string; games: string }>>`
    SELECT rank_tier, SUM(count_match)::text AS games
    FROM match_outcome_stats
    WHERE patch LIKE '16.11%'
    GROUP BY rank_tier
    ORDER BY SUM(count_match) DESC
    LIMIT 12
  `;
  console.log('match_outcome_stats 16.11 (match-level tier):', mo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
