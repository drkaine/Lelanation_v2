/**
 * Vide `match_aggregated` puis ré-agrège tous les matchs normalisés.
 * Utile après migration enum ou perte de données dans les tables stats.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/reaggregateAllMatches.ts
 */
import { sql } from "../db/client.js";
import { runMatchBatchAggregationOnce, getMatchAggregationBatchLimit } from "../services/matchBatchAggregation.js";

async function main(): Promise<void> {
  const deleted = await sql<{ count: string }[]>`
    WITH d AS (DELETE FROM match_aggregated RETURNING 1)
    SELECT COUNT(*)::text AS count FROM d
  `;
  const cleared = Number(deleted[0]?.count ?? 0);
  console.log(`[reaggregate] cleared match_aggregated rows=${cleared}`);

  let totalAggregated = 0;
  let pass = 0;
  const limit = getMatchAggregationBatchLimit();

  for (;;) {
    pass += 1;
    const result = await runMatchBatchAggregationOnce();
    totalAggregated += result.aggregated;
    console.log(
      `[reaggregate] pass=${pass} candidates=${result.candidates} aggregated=${result.aggregated} ` +
        `skipped_not_ready=${result.skippedNotReady} failed=${result.failed}`,
    );
    if (result.candidates < limit) break;
  }

  console.log(`[reaggregate] done total_aggregated=${totalAggregated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
