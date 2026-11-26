/**
 * Vide les tables d'agrégats puis ré-agrège tous les matchs depuis matchs / teams / participants.
 * Utilisé par le script manuel et par le recalcul OTP nocturne (flags changés).
 */
import { sql } from "../db/client.js";
import { runMatchBatchAggregationOnce, getMatchAggregationBatchLimit } from "./matchBatchAggregation.js";

export const AGGREGATE_TABLES = [
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
  "champion_jungle_path",
  "match_aggregated",
] as const;

export async function truncateAggregateTables(): Promise<void> {
  await sql.unsafe(`TRUNCATE ${AGGREGATE_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Renvoie le nombre de matchs ré-agrégés. */
export async function reaggregateAllMatches(onPass?: (line: string) => void): Promise<number> {
  await truncateAggregateTables();
  let total = 0;
  let pass = 0;
  const limit = getMatchAggregationBatchLimit();
  for (;;) {
    pass += 1;
    const result = await runMatchBatchAggregationOnce();
    total += result.aggregated;
    onPass?.(
      `pass=${pass} candidates=${result.candidates} aggregated=${result.aggregated} ` +
        `skipped_not_ready=${result.skippedNotReady} failed=${result.failed}`,
    );
    if (result.candidates < limit) break;
  }
  return total;
}
