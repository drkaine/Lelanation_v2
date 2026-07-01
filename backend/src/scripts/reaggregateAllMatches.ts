/**
 * Vide les tables d'agrégats puis ré-agrège tous les matchs depuis matchs / teams / participants.
 * Utile après changement du pipeline normalisé (2026-06-22) ou correction du mapping objectives.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/reaggregateAllMatches.ts
 */
import { sql } from "../db/client.js";
import { runMatchBatchAggregationOnce, getMatchAggregationBatchLimit } from "../services/matchBatchAggregation.js";

const AGGREGATE_TABLES = [
  "champion_stats",
  "champion_vs_stats",
  "champion_duo_role_stats",
  "champion_spell_stats",
  "champion_item_set_stats",
  "champion_item_solo_stats",
  "champion_bucket",
  "champion_pick_order",
  "champion_runes_solo_stats",
  "champion_runes_stats",
  "champion_shard_solo_stats",
  "champion_summoner_spell_pair_stats",
  "champion_summoner_spells",
  "champion_bans_by_banner",
  "botlane_duo_vs_duo_stats",
  "champion_tier_daily_snapshots",
  "item_tier_daily_snapshots",
  "objective_outcome_histogram",
  "match_outcome_stats",
  "team_core_stat",
  "match_aggregated",
] as const;

async function truncateAggregateTables(): Promise<void> {
  const list = AGGREGATE_TABLES.join(", ");
  await sql.unsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  console.log(`[reaggregate] truncated ${AGGREGATE_TABLES.length} aggregate tables`);
}

async function main(): Promise<void> {
  await truncateAggregateTables();

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
