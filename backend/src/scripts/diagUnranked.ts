/**
 * Diagnostic: agrégation en attente et rangs UNRANKED.
 * Usage: npx tsx src/scripts/diagUnranked.ts
 */
import 'dotenv/config';
import { sql } from '../db/client.js';

async function main(): Promise<void> {
  const matchStats = await sql<
    Array<{ total: number; aggregated: number; pending_agg: number }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ma.riot_match_id IS NOT NULL)::int AS aggregated,
      COUNT(*) FILTER (WHERE ma.riot_match_id IS NULL)::int AS pending_agg
    FROM matchs m
    LEFT JOIN match_aggregated ma ON ma.riot_match_id = m.riot_match_id
    WHERE m.patch LIKE '16.%'
  `;
  console.log('matchs (16.*):', matchStats[0]);

  const hist = await sql<Array<{ rank_tier: string; c: number }>>`
    SELECT rank_tier, COUNT(*)::int AS c
    FROM player_rank_history
    WHERE date >= CURRENT_DATE - 14
    GROUP BY rank_tier
    ORDER BY c DESC
  `;
  console.log('player_rank_history (14d):', hist);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
