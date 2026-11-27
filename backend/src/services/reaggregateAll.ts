/**
 * Ré-agrège tous les matchs depuis matchs / teams / participants dans des tables fantômes, puis bascule.
 * Utilisé par le script manuel et par le recalcul OTP nocturne (flags changés).
 */
import { createSchemaSqlClient, sql, withSqlClient } from "../db/client.js";
import {
  runMatchBatchAggregationOnce,
  getMatchAggregationBatchLimit,
} from "./matchBatchAggregation.js";
import { redis } from "../redis/client.js";
import { redisLockStore, withAggregationLock } from "./aggregationLock.js";
import {
  SHADOW_SCHEMA,
  buildShadowDdl,
  buildSwapDdl,
  loadAggregateCatalog,
  runShadowReaggregation,
} from "./aggregateShadow.js";

/** Attente max du batch poller en cours (≈ 5 min observées). */
const WAIT_FOR_POLLER_BATCH_MS = 20 * 60_000;

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
  await sql.unsafe(
    `TRUNCATE ${AGGREGATE_TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Renvoie le nombre de matchs ré-agrégés. Construction dans les tables fantômes hors verrou
 * (le batch du poller continue), puis rattrapage et bascule sous le verrou d'agrégation.
 */
export async function reaggregateAllMatches(
  onPass?: (line: string) => void,
): Promise<number> {
  const catalog = await loadAggregateCatalog(sql, AGGREGATE_TABLES);
  const shadowClient = createSchemaSqlClient(SHADOW_SCHEMA);
  try {
    return await runShadowReaggregation({
      batchLimit: getMatchAggregationBatchLimit(),
      setupShadow: async () => {
        for (const stmt of buildShadowDdl(catalog)) await sql.unsafe(stmt);
      },
      runShadowPass: () => withSqlClient(shadowClient, runMatchBatchAggregationOnce),
      withLock: (fn) =>
        withAggregationLock(redisLockStore(redis), "reaggregate-all", fn, {
          waitMs: WAIT_FOR_POLLER_BATCH_MS,
        }),
      swap: async () => {
        const ddl = buildSwapDdl(catalog);
        await sql.begin(async (tx) => {
          for (const stmt of ddl) await tx.unsafe(stmt);
        });
      },
      dropShadow: async () => {
        await sql.unsafe(`DROP SCHEMA IF EXISTS ${SHADOW_SCHEMA} CASCADE`);
      },
      onPass,
    });
  } finally {
    await shadowClient.end();
  }
}
