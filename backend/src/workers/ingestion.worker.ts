import type { Job } from "bullmq";
import { config } from "../config/index.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { normalizeLolRankTier, normalizeLolRole } from "../constants/lolEnums.js";
import { sql } from "../db/client.js";
import { CHAMPION_STATS_METRIC_COLUMNS } from "../constants/championStatsMetricColumns.js";
import { CHAMPION_VS_STATS_ALL_METRIC_COLUMNS } from "../constants/championVsStatsMetricColumns.js";
import { championVsMetricValue } from "../parsers/champion-vs-metric-value.js";
import type { IngestionJobData, ParsedParticipantDto, TeamObjectiveDto } from "../dto/match.dto.js";
import { championStatsMetricValue } from "../parsers/champion-stats-metric-value.js";
import { recordIngestionWorker } from "../observability/poller-metrics/instrumentation.js";
// Effets de bord Redis/queues chargés paresseusement dans processIngestionJob
// (queues/index, queues/rank-jobs, redis/ingestion-metrics) afin que l'import de
// ce module reste sans connexion. `shouldPauseMatchPipelines` est pur (config only).
import { shouldPauseMatchPipelines } from "../queues/rank-backlog-policy.js";
import {
  normalizeParticipantRankTier,
} from "./match-rank-readiness.js";
import { buildStarterLegendaryOrderByItemId } from "../parsers/itemOrderSnapshot.js";
import {
  buildGameOrderItemsJson,
  buildOrderItemsGenericMergeSqlExpr,
  mergeOrderItemsJson,
  orderedEligibleItemIds,
  type PurchaseOrderItemsJson,
} from "../parsers/purchaseOrderItemsJson.js";
import { itemTierRoleGameWinCounts } from "../parsers/itemTierDailySnapshotRole.js";
import { rehydrateParticipantRanksForIngestion } from "../services/matchIngestionPayload.js";
import { insertMatchAggregated,
  isMatchAlreadyAggregated,
} from "../services/normalizedMatchPersistence.js";
import { loadIngestionPayloadFromNormalizedTables } from "../services/normalizedMatchLoader.js";
import {
  buildDuoRoleAggregationRows,
  championTransformFields,
  laneEconomyNumber,
  participantWinCount,
} from "./duoRoleAggregation.js";
import { runAdditiveUpsert } from "./aggregationUpsert.js";

export class AlreadyProcessedMatchError extends Error {
  constructor(matchId: string) {
    super(`match_already_processed:${matchId}`);
    this.name = "AlreadyProcessedMatchError";
  }
}

function numericMetric(participant: ParsedParticipantDto, key: string): number {
  const raw = (participant as Record<string, unknown>)[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.trunc(raw);
}

/** Clé `rank_tier` pour botlane (même logique que les autres upserts : libellé participant). */
function botlaneRankTierKey(p: ParsedParticipantDto): string {
  const t = String(p.rankTier ?? "").trim().toUpperCase();
  return t.length > 0 ? t : "UNRANKED";
}

function firstBotlaneParticipant(
  participants: ParsedParticipantDto[],
  teamId: 100 | 200,
  role: "BOTTOM" | "UTILITY",
): ParsedParticipantDto | undefined {
  return participants.find((row) => row.teamId === teamId && row.role === role);
}

/** Champs économie / lane (challenges → `sum_*` via mapChallengeSums dans le parseur). */
function botlaneEconomyFromParticipant(p: ParsedParticipantDto) {
  return {
    goldEarned: Math.trunc(Number(p.goldEarned) || 0),
    goldSpent: Math.trunc(Number(p.goldSpent) || 0),
    maxLevelLeadLaneOpponent: laneEconomyNumber(p, "sum_max_level_lead_lane_opponent"),
    maxKillDeficit: laneEconomyNumber(p, "sum_max_kill_deficit"),
    maxCsAdvantageOnLaneOpponent: laneEconomyNumber(p, "sum_max_cs_advantage_on_lane_opponent"),
    visionScoreAdvantageLaneOpponent: laneEconomyNumber(p, "sum_vision_score_advantage_lane_opponent"),
    laningPhaseGoldExpAdvantage: laneEconomyNumber(p, "sum_laning_phase_gold_exp_advantage"),
    earlyLaningPhaseGoldExpAdvantage: laneEconomyNumber(p, "sum_early_laning_phase_gold_exp_advantage"),
  };
}

function u15IngestSums(u: ParsedParticipantDto["u15"]) {
  return {
    phys: Math.trunc(Number(u.physDmgToChampion) || 0),
    magic: Math.trunc(Number(u.magicDmgToChampion) || 0),
    trueDmg: Math.trunc(Number(u.trueDmgToChampion) || 0),
    kill: Math.trunc(Number(u.kills) || 0),
    assist: Math.trunc(Number(u.assists) || 0),
    death: Math.trunc(Number(u.deaths) || 0),
    vision: Math.trunc(Number(u.visionScore) || 0),
    shield: Math.trunc(Number(u.shieldAndHeal) || 0),
    cs: Math.trunc(Number(u.cs) || 0),
  };
}

function normalizeRankDivision(value: string | null | undefined): string | null {
  const division = String(value ?? "")
    .trim()
    .toUpperCase();
  return division || null;
}

function normalizeRankLp(value: number | null | undefined): number | null {
  const lp = Number(value);
  if (!Number.isFinite(lp)) return null;
  return Math.max(0, Math.trunc(lp));
}

async function upsertPlayersFromParticipants(tx: any, participants: ParsedParticipantDto[]): Promise<number> {
  const latestByPuuid = new Map<string, ParsedParticipantDto>();
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;
    const previous = latestByPuuid.get(puuid);
    if (!previous || Number(participant.gameEndTimestamp ?? 0) >= Number(previous.gameEndTimestamp ?? 0)) {
      latestByPuuid.set(puuid, participant);
    }
  }

  let insertedPlayers = 0;
  const orderedParticipants = Array.from(latestByPuuid.values()).sort((a, b) => a.puuid.localeCompare(b.puuid));

  for (const participant of orderedParticipants) {
    const puuid = String(participant.puuid).trim();
    const region = normalizePlatformRegion(participant.region);
    const gameDate = new Date(participant.gameDate);
    const snapshotDate = Number.isFinite(gameDate.getTime()) ? gameDate : new Date();
    const inserted = await tx<{ puuid: string }[]>`
      INSERT INTO players (
        puuid,
        region,
        puuid_key_version,
        last_seen
      )
      VALUES (
        ${puuid},
        ${region}::lol_region,
        ${config.PLAYER_KEY_VERSION},
        ${snapshotDate}
      )
      ON CONFLICT (puuid) DO NOTHING
      RETURNING puuid
    `;
    insertedPlayers += inserted.length;

    await tx`
      UPDATE players
      SET
        region = ${region}::lol_region,
        last_seen = GREATEST(COALESCE(last_seen, ${snapshotDate}), ${snapshotDate}),
        puuid_key_version = ${config.PLAYER_KEY_VERSION}
      WHERE puuid = ${puuid}
    `;
  }

  return insertedPlayers;
}

async function upsertPlayerRankHistoryFromParticipants(
  tx: any,
  participants: ParsedParticipantDto[],
): Promise<void> {
  const latestByDay = new Map<string, ParsedParticipantDto>();
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? "").trim();
    const region = normalizePlatformRegion(participant.region);
    const gameDate = new Date(participant.gameDate);
    if (!puuid || !Number.isFinite(gameDate.getTime())) continue;
    const dateOnly = gameDate.toISOString().slice(0, 10);
    const key = `${puuid}|${region}|${dateOnly}`;
    const previous = latestByDay.get(key);
    if (!previous || Number(participant.gameEndTimestamp ?? 0) >= Number(previous.gameEndTimestamp ?? 0)) {
      latestByDay.set(key, participant);
    }
  }

  for (const participant of latestByDay.values()) {
    if (participant.needsRankFetch) continue;

    const puuid = String(participant.puuid ?? "").trim();
    const region = normalizePlatformRegion(participant.region);
    const gameDate = new Date(participant.gameDate);
    if (!Number.isFinite(gameDate.getTime())) continue;
    const normalizedTier = normalizeParticipantRankTier(participant.rankTierValue ?? participant.rankTier);
    const normalizedDivision = normalizeRankDivision(participant.rankDivision);
    const normalizedLp = normalizeRankLp(participant.lp);
    const hasResolvedRank = !!normalizedTier && !!normalizedDivision && normalizedLp != null;
    const rankTier = hasResolvedRank ? normalizedTier : "UNRANKED";
    const rankDivision = hasResolvedRank ? normalizedDivision : "UNRANKED";
    const rankLp = hasResolvedRank ? normalizedLp : 0;

    await tx`
      INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
      VALUES (${puuid}, ${gameDate.toISOString().slice(0, 10)}::date, ${region}::lol_region, ${rankTier}::lol_rank_tier, ${rankDivision}, ${rankLp})
      ON CONFLICT (puuid, date, region)
      DO UPDATE SET
        rank_tier = CASE
          WHEN EXCLUDED.rank_tier = 'UNRANKED' AND player_rank_history.rank_tier <> 'UNRANKED'
            THEN player_rank_history.rank_tier
          ELSE EXCLUDED.rank_tier
        END,
        rank_division = CASE
          WHEN EXCLUDED.rank_tier = 'UNRANKED' AND player_rank_history.rank_tier <> 'UNRANKED'
            THEN player_rank_history.rank_division
          ELSE EXCLUDED.rank_division
        END,
        rank_lp = CASE
          WHEN EXCLUDED.rank_tier = 'UNRANKED' AND player_rank_history.rank_tier <> 'UNRANKED'
            THEN player_rank_history.rank_lp
          ELSE EXCLUDED.rank_lp
        END
    `;
  }
}

async function upsertChampionStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const baseCols = [
    "patch",
    "role",
    "rank_tier",
    "region",
    "champion_id",
    "champion_transform",
    "team",
    "count_game",
    "count_win",
  ];
  const metricCols = CHAMPION_STATS_METRIC_COLUMNS;
  const allCols = [...baseCols, ...metricCols];
  const updateParts = [
    "count_game = champion_stats.count_game + EXCLUDED.count_game",
    "count_win = champion_stats.count_win + EXCLUDED.count_win",
    ...metricCols.map((c) => `${c} = champion_stats.${c} + EXCLUDED.${c}`),
    "updated_at = NOW()",
  ];
  if (participants.length === 0) return;

  // Pré-agrégation en mémoire par clé de conflit : plusieurs participants du même
  // match peuvent partager (champion, role, transform, team) → on somme comptages
  // et métriques en amont pour un unique INSERT multi-lignes (au lieu de 10 upserts
  // séquentiels). Équivalent aux upserts additifs successifs (`+ EXCLUDED`).
  type ChampionStatsRow = { base: unknown[]; countGame: number; countWin: number; metrics: number[] };
  const rows = new Map<string, ChampionStatsRow>();
  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const key = [
      participant.patch,
      participant.role,
      participant.rankTier,
      participant.region,
      participant.championId,
      championTransform,
      participant.teamId,
    ].join("\u0001");
    const metrics = metricCols.map((c) => championStatsMetricValue(participant, c));
    const win = participantWinCount(participant);
    const existing = rows.get(key);
    if (existing) {
      existing.countGame += 1;
      existing.countWin += win;
      for (let i = 0; i < metrics.length; i++) existing.metrics[i] += metrics[i]!;
    } else {
      rows.set(key, {
        base: [
          participant.patch,
          participant.role,
          participant.rankTier,
          participant.region,
          participant.championId,
          championTransform,
          participant.teamId,
        ],
        countGame: 1,
        countWin: win,
        metrics,
      });
    }
  }

  const params: unknown[] = [];
  const valueTuples = [...rows.values()].map((r) => {
    const tuple = [...r.base, r.countGame, r.countWin, ...r.metrics];
    const start = params.length;
    for (const value of tuple) params.push(value);
    return `(${tuple.map((_, i) => `$${start + i + 1}`).join(", ")})`;
  });

  const q = `INSERT INTO champion_stats (${allCols.join(", ")}) VALUES ${valueTuples.join(", ")} ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, team) DO UPDATE SET ${updateParts.join(", ")}`;
  await (tx as { unsafe: (query: string, params?: unknown[]) => Promise<unknown> }).unsafe(q, params);
}

async function upsertChampionVsStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const metricCols = CHAMPION_VS_STATS_ALL_METRIC_COLUMNS;

  // Pré-agrégation en mémoire par clé de conflit : nécessaire pour l'INSERT
  // multi-lignes `ON CONFLICT` (Postgres interdit d'affecter deux fois la même
  // ligne). On somme comptages + métriques et on fusionne order_items (games/wins
  // par itemId). La fusion avec l'existant en base se fait via une expression SQL
  // générique unique, valable pour toutes les lignes du statement.
  type VsRow = {
    keys: unknown[];
    countWin: number;
    countGame: number;
    orderItems: PurchaseOrderItemsJson;
    metrics: number[];
  };
  const rows = new Map<string, VsRow>();
  for (const participant of participants.filter((p) => p.opponentChampionId > 0)) {
    const { championTransform } = championTransformFields(participant);
    const winCount = participantWinCount(participant);
    const setItem = participant.finalKey ?? "";
    const orderItemIds = orderedEligibleItemIds(buildStarterLegendaryOrderByItemId(participant.items));
    const orderItems = buildGameOrderItemsJson(orderItemIds, winCount);
    const metrics = metricCols.map((col) => championVsMetricValue(participant, col));
    const keys = [
      participant.patch,
      participant.role,
      participant.rankTier,
      participant.region,
      participant.championId,
      championTransform,
      participant.opponentChampionId,
      setItem,
    ];
    const key = keys.map((v) => String(v)).join("\u0001");
    const existing = rows.get(key);
    if (existing) {
      existing.countWin += winCount;
      existing.countGame += 1;
      existing.orderItems = mergeOrderItemsJson(existing.orderItems, orderItems);
      for (let i = 0; i < metrics.length; i++) existing.metrics[i]! += metrics[i]!;
    } else {
      rows.set(key, { keys, countWin: winCount, countGame: 1, orderItems, metrics });
    }
  }

  if (rows.size === 0) return;

  const params: unknown[] = [];
  const valueTuples = [...rows.values()].map((r) => {
    // order_items : on passe l'OBJET (sérialisé une seule fois par postgres.js).
    // Passer JSON.stringify(...) double-encode en string JSON (bug historique visible
    // en prod sur ~95 % des lignes vs). `sql.json(...)` force le type jsonb correct.
    const tuple = [...r.keys, r.countWin, r.countGame, sql.json(r.orderItems), ...r.metrics];
    const start = params.length;
    for (const value of tuple) params.push(value);
    return `(${tuple.map((_, i) => `$${start + i + 1}`).join(", ")})`;
  });

  const metricUpdateParts = metricCols.map(
    (col) => `${col} = champion_vs_stats.${col} + EXCLUDED.${col}`,
  );
  const orderItemsMergeSql = buildOrderItemsGenericMergeSqlExpr(
    "champion_vs_stats.order_items",
    "EXCLUDED.order_items",
  );

  const q = `
    INSERT INTO champion_vs_stats (
      patch, role, rank_tier, region, champion_id, champion_transform, opponent_champion_id, set_item,
      count_win, count_game, order_items,
      ${metricCols.join(", ")}
    )
    VALUES ${valueTuples.join(", ")}
    ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, opponent_champion_id, set_item)
    DO UPDATE SET
      count_game = champion_vs_stats.count_game + EXCLUDED.count_game,
      count_win = champion_vs_stats.count_win + EXCLUDED.count_win,
      order_items = ${orderItemsMergeSql},
      ${metricUpdateParts.join(", ")},
      updated_at = NOW()
  `;
  await (tx as { unsafe: (query: string, params?: unknown[]) => Promise<unknown> }).unsafe(q, params);
}

async function upsertChampionDuoRoleStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows = buildDuoRoleAggregationRows(participants);
  if (rows.length === 0) return;

  const cols = [
    "patch",
    "rank_tier",
    "region",
    "champion_id",
    "champion_transform",
    "role",
    "ally_champion_id",
    "ally_role",
    "count_game",
    "count_win",
    "sum_gold_earned",
    "sum_gold_spent",
    "sum_max_level_lead_lane_opponent",
    "sum_max_kill_deficit",
    "sum_more_enemy_jungle_than_opponent",
    "sum_max_cs_advantage_on_lane_opponent",
    "sum_vision_score_advantage_lane_opponent",
    "sum_laning_phase_gold_exp_advantage",
    "sum_early_laning_phase_gold_exp_advantage",
  ];
  const sumCols = cols.slice(cols.indexOf("sum_gold_earned"));

  const params: unknown[] = [];
  const valueTuples = rows.map((r) => {
    const tuple = [
      r.patch,
      r.rankTier,
      r.region,
      r.championId,
      r.championTransform,
      r.role,
      r.allyChampionId,
      r.allyRole,
      r.countGame,
      r.countWin,
      r.sumGoldEarned,
      r.sumGoldSpent,
      r.sumMaxLevelLeadLaneOpponent,
      r.sumMaxKillDeficit,
      r.sumMoreEnemyJungleThanOpponent,
      r.sumMaxCsAdvantageOnLaneOpponent,
      r.sumVisionScoreAdvantageLaneOpponent,
      r.sumLaningPhaseGoldExpAdvantage,
      r.sumEarlyLaningPhaseGoldExpAdvantage,
    ];
    const base = params.length;
    for (const value of tuple) params.push(value);
    return `(${tuple.map((_, i) => `$${base + i + 1}`).join(", ")})`;
  });

  const updateParts = [
    "count_game = champion_duo_role_stats.count_game + EXCLUDED.count_game",
    "count_win = champion_duo_role_stats.count_win + EXCLUDED.count_win",
    ...sumCols.map((c) => `${c} = champion_duo_role_stats.${c} + EXCLUDED.${c}`),
    "updated_at = NOW()",
  ];

  const q = `
    INSERT INTO champion_duo_role_stats (${cols.join(", ")})
    VALUES ${valueTuples.join(", ")}
    ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, ally_champion_id, ally_role)
    DO UPDATE SET
      ${updateParts.join(",\n      ")}
  `;
  await (tx as { unsafe: (query: string, params?: unknown[]) => Promise<unknown> }).unsafe(q, params);
}

const SPELL_ORDER_MIN_GAME_DURATION_SEC = 15 * 60;

export async function upsertSpellOrderStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const gameDurationSec = Math.max(0, Math.trunc(Number(participant.gameDurationSec ?? 0)));
    if (gameDurationSec < SPELL_ORDER_MIN_GAME_DURATION_SEC) continue;
    const spellOrder = String(participant.spellOrder ?? "").trim();
    if (!spellOrder) continue;
    const spellTs = Math.max(0, Math.trunc(Number(participant.spellLevelUpTimestampSumMs ?? 0)));
    const { championTransform } = championTransformFields(participant);
    await tx`
      INSERT INTO champion_spell_stats (
        patch, role, rank_tier, region, champion_id, champion_transform,
        spell_order,
        spell1_casts, spell2_casts, spell3_casts, spell4_casts,
        count_game, count_win, sum_timestamp_ms
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${championTransform},
        ${spellOrder},
        ${participant.spell1Casts}, ${participant.spell2Casts}, ${participant.spell3Casts}, ${participant.spell4Casts},
        1, ${participantWinCount(participant)}, ${spellTs}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, spell_order_hash)
      DO UPDATE SET
        count_game = champion_spell_stats.count_game + 1,
        count_win = champion_spell_stats.count_win + EXCLUDED.count_win,
        spell1_casts = champion_spell_stats.spell1_casts + EXCLUDED.spell1_casts,
        spell2_casts = champion_spell_stats.spell2_casts + EXCLUDED.spell2_casts,
        spell3_casts = champion_spell_stats.spell3_casts + EXCLUDED.spell3_casts,
        spell4_casts = champion_spell_stats.spell4_casts + EXCLUDED.spell4_casts,
        sum_timestamp_ms = champion_spell_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms,
        updated_at = NOW()
    `;
  }
}

async function upsertItemSetStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows: Array<{ keys: unknown[]; sums: number[] }> = [];
  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const win = participantWinCount(participant);
    for (const { type, key } of [
      { type: "starter", key: participant.starterKey },
      { type: "core", key: participant.coreKey },
      { type: "final", key: participant.finalKey },
    ]) {
      rows.push({
        keys: [
          participant.patch,
          participant.role,
          participant.rankTier,
          participant.region,
          participant.championId,
          championTransform,
          type,
          key,
        ],
        sums: [1, win],
      });
    }
  }
  await runAdditiveUpsert(tx, {
    table: "champion_item_set_stats",
    keyColumns: [
      "patch",
      "role",
      "rank_tier",
      "region",
      "champion_id",
      "champion_transform",
      "phase",
      "item_set_key",
    ],
    sumColumns: ["count_game", "count_win"],
    rows,
  });
}

async function upsertItemSoloStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows: Array<{ keys: unknown[]; sums: number[] }> = [];
  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const win = participantWinCount(participant);
    const distinctItems = Array.from(new Set(participant.items.map((item) => item.itemId).filter((itemId) => itemId > 0)));
    for (const itemId of distinctItems) {
      const starterCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "starter").length;
      const coreCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "core").length;
      const finalCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "final").length;
      const countWinStarter = participant.win ? starterCount : 0;
      const countWinCore = participant.win ? coreCount : 0;
      const countWinFinal = participant.win ? finalCount : 0;
      const sumTimestamp = participant.items
        .filter((item) => item.itemId === itemId)
        .reduce((acc, item) => acc + item.timestampMs, 0);

      rows.push({
        keys: [
          participant.patch,
          participant.role,
          participant.rankTier,
          participant.region,
          participant.championId,
          championTransform,
          itemId,
        ],
        sums: [
          starterCount,
          countWinStarter,
          coreCount,
          countWinCore,
          finalCount,
          countWinFinal,
          1,
          win,
          sumTimestamp,
        ],
      });
    }
  }
  await runAdditiveUpsert(tx, {
    table: "champion_item_solo_stats",
    keyColumns: [
      "patch",
      "role",
      "rank_tier",
      "region",
      "champion_id",
      "champion_transform",
      "item_id",
    ],
    sumColumns: [
      "count_starter",
      "count_win_starter",
      "count_core",
      "count_win_core",
      "count_final",
      "count_win_final",
      "count_game",
      "count_win",
      "sum_timestamp_ms",
    ],
    rows,
  });
}

async function upsertRuneStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const runeRows: Array<{ keys: unknown[]; sums: number[] }> = [];
  const runeSoloRows: Array<{ keys: unknown[]; sums: number[] }> = [];
  const shardRows: Array<{ keys: unknown[]; sums: number[] }> = [];

  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const win = participantWinCount(participant);
    const base = [
      participant.patch,
      participant.role,
      participant.rankTier,
      participant.region,
      participant.championId,
      championTransform,
    ];

    runeRows.push({ keys: [...base, participant.runeList, participant.shardList], sums: [1, win] });

    for (const runeId of participant.perks) {
      runeSoloRows.push({ keys: [...base, runeId], sums: [1, win] });
    }

    for (const [slot, shardId] of participant.shardList
      .split("_")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .entries()) {
      shardRows.push({ keys: [...base, shardId, slot], sums: [1, win] });
    }
  }

  const base = ["patch", "role", "rank_tier", "region", "champion_id", "champion_transform"];
  await runAdditiveUpsert(tx, {
    table: "champion_runes_stats",
    keyColumns: [...base, "rune_list", "shard_list"],
    sumColumns: ["count_game", "count_win"],
    rows: runeRows,
  });
  await runAdditiveUpsert(tx, {
    table: "champion_runes_solo_stats",
    keyColumns: [...base, "perk_id"],
    sumColumns: ["count_game", "count_win"],
    rows: runeSoloRows,
  });
  await runAdditiveUpsert(tx, {
    table: "champion_shard_solo_stats",
    keyColumns: [...base, "shard_id", "slot"],
    sumColumns: ["count_game", "count_win"],
    rows: shardRows,
  });
}

async function upsertSummonerSpellStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const base = ["patch", "role", "rank_tier", "region", "champion_id", "champion_transform"];
  const pairRows: Array<{ keys: unknown[]; sums: number[] }> = [];
  const soloRows: Array<{ keys: unknown[]; sums: number[] }> = [];

  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const win = participantWinCount(participant);
    const baseVals = [
      participant.patch,
      participant.role,
      participant.rankTier,
      participant.region,
      participant.championId,
      championTransform,
    ];
    const [spellD, spellF] = [participant.spellD, participant.spellF].sort((a, b) => a - b);
    const spellDCasts = spellD === participant.spellD ? participant.spellDCasts : participant.spellFCasts;
    const spellFCasts = spellF === participant.spellF ? participant.spellFCasts : participant.spellDCasts;

    pairRows.push({ keys: [...baseVals, spellD, spellF], sums: [1, win, spellDCasts, spellFCasts] });

    for (const [slot, spellId] of [
      ["d", participant.spellD] as const,
      ["f", participant.spellF] as const,
    ]) {
      const countGameD = slot === "d" ? 1 : 0;
      const countGameF = slot === "f" ? 1 : 0;
      const countWinD = slot === "d" && participant.win ? 1 : 0;
      const countWinF = slot === "f" && participant.win ? 1 : 0;
      const countSlotD = slot === "d" ? 1 : 0;
      const countSlotF = slot === "f" ? 1 : 0;
      soloRows.push({
        keys: [...baseVals, spellId],
        sums: [countWinD, countWinF, countGameD, countGameF, countSlotD, countSlotF],
      });
    }
  }

  await runAdditiveUpsert(tx, {
    table: "champion_summoner_spell_pair_stats",
    keyColumns: [...base, "spell_d", "spell_f"],
    sumColumns: ["count_game", "count_win", "spell_d_casts", "spell_f_casts"],
    rows: pairRows,
  });
  await runAdditiveUpsert(tx, {
    table: "champion_summoner_spells",
    keyColumns: [...base, "spell_id"],
    sumColumns: [
      "count_win_d",
      "count_win_f",
      "count_game_d",
      "count_game_f",
      "count_slotd",
      "count_slotf",
    ],
    rows: soloRows,
  });
}

async function upsertBansByBanner(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows: Array<{ keys: unknown[]; sums: number[] }> = [];
  for (const participant of participants.filter((row) => row.bannedChampionId > 0)) {
    const isTeam100 = participant.teamId === 100;
    const roleKey = participant.role.toLowerCase();
    const roleColumn =
      roleKey === "top"
        ? "count_banner_top"
        : roleKey === "jungle"
          ? "count_banner_jungle"
          : roleKey === "mid"
            ? "count_banner_mid"
            : roleKey === "adc"
              ? "count_banner_adc"
              : roleKey === "support"
                ? "count_banner_support"
                : null;

    rows.push({
      keys: [participant.patch, participant.rankTier, participant.region, participant.bannedChampionId],
      sums: [
        isTeam100 ? 1 : 0,
        isTeam100 ? 0 : 1,
        roleColumn === "count_banner_top" ? 1 : 0,
        roleColumn === "count_banner_jungle" ? 1 : 0,
        roleColumn === "count_banner_mid" ? 1 : 0,
        roleColumn === "count_banner_adc" ? 1 : 0,
        roleColumn === "count_banner_support" ? 1 : 0,
        participant.win ? 1 : 0,
        participant.win ? 0 : 1,
      ],
    });
  }
  await runAdditiveUpsert(tx, {
    table: "champion_bans_by_banner",
    keyColumns: ["patch", "rank_tier", "region", "banned_champion_id"],
    sumColumns: [
      "count_banner_team_100",
      "count_banner_team_200",
      "count_banner_top",
      "count_banner_jungle",
      "count_banner_mid",
      "count_banner_adc",
      "count_banner_support",
      "count_ban_when_team_won",
      "count_ban_when_team_lost",
    ],
    rows,
  });
}

async function upsertChampionPickOrder(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows: Array<{ keys: unknown[]; sums: number[] }> = [];
  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    rows.push({
      keys: [
        participant.patch,
        participant.role,
        participant.rankTier,
        participant.region,
        participant.championId,
        championTransform,
        participant.teamId,
        participant.pickOrder,
      ],
      sums: [1, participantWinCount(participant)],
    });
  }
  await runAdditiveUpsert(tx, {
    table: "champion_pick_order",
    keyColumns: [
      "patch",
      "role",
      "rank_tier",
      "region",
      "champion_id",
      "champion_transform",
      "team",
      "pick_order",
    ],
    sumColumns: ["count_game", "count_win"],
    rows,
  });
}

async function upsertChampionBucket(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  const rows: Array<{ keys: unknown[]; sums: number[] }> = [];
  for (const participant of participants) {
    const { championTransform, transformTimestampMs } = championTransformFields(participant);
    const durationSeconds =
      Math.max(0, Math.trunc(numericMetric(participant, "sum_game_length"))) ||
      Math.max(0, Math.trunc((participant.gameEndTimestamp > 0 ? participant.gameEndTimestamp : 0) / 1000));
    const durationBucket = durationSeconds > 0 ? Math.max(0, Math.trunc(durationSeconds / 60)) : 0;
    const sumKdDiff10 = numericMetric(participant, "sum_kd_diff_10");
    const sumKdDiff20 = numericMetric(participant, "sum_kd_diff_20");

    rows.push({
      keys: [
        participant.patch,
        participant.role,
        participant.rankTier,
        participant.region,
        participant.championId,
        championTransform,
        transformTimestampMs,
        durationBucket,
      ],
      sums: [
        participantWinCount(participant),
        1,
        numericMetric(participant, "sum_current_gold"),
        numericMetric(participant, "sum_magic_damage_done"),
        numericMetric(participant, "sum_magic_damage_done_to_champion"),
        numericMetric(participant, "sum_magic_damage_taken"),
        numericMetric(participant, "sum_physical_damage_done"),
        numericMetric(participant, "sum_physical_damage_done_to_champion"),
        numericMetric(participant, "sum_physical_damage_taken"),
        numericMetric(participant, "sum_true_damage_done"),
        numericMetric(participant, "sum_true_damage_done_to_champion"),
        numericMetric(participant, "sum_true_damage_taken"),
        numericMetric(participant, "sum_jungle_minions_killed"),
        numericMetric(participant, "sum_level"),
        numericMetric(participant, "sum_minions_killed"),
        participant.goldEarned,
        durationSeconds,
        participant.kills,
        participant.assists,
        participant.deaths,
        participant.kills + participant.assists,
        sumKdDiff10,
        sumKdDiff20,
        sumKdDiff10 > 0 ? 1 : 0,
        sumKdDiff10 > 0 && participant.win ? 1 : 0,
        sumKdDiff20 > 0 ? 1 : 0,
        sumKdDiff20 > 0 && participant.win ? 1 : 0,
        1,
        numericMetric(participant, "sum_time_enemy_spent_controlled") > 0 ? 1 : 0,
      ],
    });
  }
  await runAdditiveUpsert(tx, {
    table: "champion_bucket",
    keyColumns: [
      "patch",
      "role",
      "rank_tier",
      "region",
      "champion_id",
      "champion_transform",
      "transform_timestamp_ms",
      "duration_bucket",
    ],
    sumColumns: [
      "count_win",
      "count_game",
      "sum_current_gold",
      "sum_magic_damage_done",
      "sum_magic_damage_done_to_champion",
      "sum_magic_damage_taken",
      "sum_physical_damage_done",
      "sum_physical_damage_done_to_champion",
      "sum_physical_damage_taken",
      "sum_true_damage_done",
      "sum_true_damage_done_to_champion",
      "sum_true_damage_taken",
      "sum_jungle_minions_killed",
      "sum_level",
      "sum_minions_killed",
      "sum_total_gold",
      "sum_time_played",
      "sum_kills",
      "sum_assists",
      "sum_deaths",
      "sum_kills_assists",
      "sum_kd_diff_10",
      "sum_kd_diff_20",
      "count_kd_diff_10_positive_game",
      "count_kd_diff_10_positive_win",
      "count_kd_diff_20_positive_game",
      "count_kd_diff_20_positive_win",
      "count_game_end",
      "count_time_enemy_spent_controlled",
    ],
    rows,
  });
}

async function upsertBotlaneDuoVsDuoStats(tx: any, payload: IngestionJobData): Promise<void> {
  const { participants, teamStats } = payload;
  const adc100 = firstBotlaneParticipant(participants, 100, "BOTTOM");
  const sup100 = firstBotlaneParticipant(participants, 100, "UTILITY");
  const adc200 = firstBotlaneParticipant(participants, 200, "BOTTOM");
  const sup200 = firstBotlaneParticipant(participants, 200, "UTILITY");
  if (!adc100 || !sup100 || !adc200 || !sup200) return;

  const championIds = [adc100.championId, sup100.championId, adc200.championId, sup200.championId];
  if (championIds.some((id) => !Number.isFinite(id) || id <= 0)) return;

  const patch = teamStats.patch;
  const region = teamStats.region;

  const perspectives = [
    {
      rankTier: botlaneRankTierKey(adc100),
      adc: adc100,
      sup: sup100,
      oppAdc: adc200,
      oppSup: sup200,
      win: adc100.win ? 1 : 0,
    },
    {
      rankTier: botlaneRankTierKey(adc200),
      adc: adc200,
      sup: sup200,
      oppAdc: adc100,
      oppSup: sup100,
      win: adc200.win ? 1 : 0,
    },
  ] as const;

  for (const row of perspectives) {
    const am = botlaneEconomyFromParticipant(row.adc);
    const sm = botlaneEconomyFromParticipant(row.sup);
    const a15 = u15IngestSums(row.adc.u15);
    const s15 = u15IngestSums(row.sup.u15);

    await tx`
      INSERT INTO botlane_duo_vs_duo_stats (
        patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id,
        count_win, count_game,
        sum_adc_gold_earned, sum_adc_gold_spent,
        sum_adc_max_level_lead_lane_opponent, sum_adc_max_kill_deficit, sum_adc_max_cs_advantage_on_lane_opponent,
        sum_adc_vision_score_advantage_lane_opponent, sum_adc_laning_phase_gold_exp_advantage, sum_adc_early_laning_phase_gold_exp_advantage,
        sum_adc_physique_damage_done_to_champion_u15, sum_adc_magic_damage_done_to_champion_u15, sum_adc_true_damage_done_to_champion_u15,
        sum_adc_kill_u15, sum_adc_assist_u15, sum_adc_death_u15, sum_adc_vision_score_u15, sum_adc_shield_and_heal_u15, sum_adc_minions_killed_u15,
        sum_support_gold_earned, sum_support_gold_spent,
        sum_support_max_level_lead_lane_opponent, sum_support_max_kill_deficit, sum_support_max_cs_advantage_on_lane_opponent,
        sum_support_vision_score_advantage_lane_opponent, sum_support_laning_phase_gold_exp_advantage, sum_support_early_laning_phase_gold_exp_advantage,
        sum_support_physique_damage_done_to_champion_u15, sum_support_magic_damage_done_to_champion_u15, sum_support_true_damage_done_to_champion_u15,
        sum_support_kill_u15, sum_support_assist_u15, sum_support_death_u15, sum_support_vision_score_u15, sum_support_shield_and_heal_u15, sum_support_minions_killed_u15
      )
      VALUES (
        ${patch}, ${row.rankTier}, ${region},
        ${row.adc.championId}, ${row.sup.championId}, ${row.oppAdc.championId}, ${row.oppSup.championId},
        ${row.win}, 1,
        ${am.goldEarned}, ${am.goldSpent},
        ${am.maxLevelLeadLaneOpponent}, ${am.maxKillDeficit}, ${am.maxCsAdvantageOnLaneOpponent},
        ${am.visionScoreAdvantageLaneOpponent}, ${am.laningPhaseGoldExpAdvantage}, ${am.earlyLaningPhaseGoldExpAdvantage},
        ${a15.phys}, ${a15.magic}, ${a15.trueDmg}, ${a15.kill}, ${a15.assist}, ${a15.death}, ${a15.vision}, ${a15.shield}, ${a15.cs},
        ${sm.goldEarned}, ${sm.goldSpent},
        ${sm.maxLevelLeadLaneOpponent}, ${sm.maxKillDeficit}, ${sm.maxCsAdvantageOnLaneOpponent},
        ${sm.visionScoreAdvantageLaneOpponent}, ${sm.laningPhaseGoldExpAdvantage}, ${sm.earlyLaningPhaseGoldExpAdvantage},
        ${s15.phys}, ${s15.magic}, ${s15.trueDmg}, ${s15.kill}, ${s15.assist}, ${s15.death}, ${s15.vision}, ${s15.shield}, ${s15.cs}
      )
      ON CONFLICT (patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id)
      DO UPDATE SET
        count_win = botlane_duo_vs_duo_stats.count_win + EXCLUDED.count_win,
        count_game = botlane_duo_vs_duo_stats.count_game + EXCLUDED.count_game,
        sum_adc_gold_earned = botlane_duo_vs_duo_stats.sum_adc_gold_earned + EXCLUDED.sum_adc_gold_earned,
        sum_adc_gold_spent = botlane_duo_vs_duo_stats.sum_adc_gold_spent + EXCLUDED.sum_adc_gold_spent,
        sum_adc_max_level_lead_lane_opponent =
          botlane_duo_vs_duo_stats.sum_adc_max_level_lead_lane_opponent + EXCLUDED.sum_adc_max_level_lead_lane_opponent,
        sum_adc_max_kill_deficit = botlane_duo_vs_duo_stats.sum_adc_max_kill_deficit + EXCLUDED.sum_adc_max_kill_deficit,
        sum_adc_max_cs_advantage_on_lane_opponent =
          botlane_duo_vs_duo_stats.sum_adc_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_adc_max_cs_advantage_on_lane_opponent,
        sum_adc_vision_score_advantage_lane_opponent =
          botlane_duo_vs_duo_stats.sum_adc_vision_score_advantage_lane_opponent + EXCLUDED.sum_adc_vision_score_advantage_lane_opponent,
        sum_adc_laning_phase_gold_exp_advantage =
          botlane_duo_vs_duo_stats.sum_adc_laning_phase_gold_exp_advantage + EXCLUDED.sum_adc_laning_phase_gold_exp_advantage,
        sum_adc_early_laning_phase_gold_exp_advantage =
          botlane_duo_vs_duo_stats.sum_adc_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_adc_early_laning_phase_gold_exp_advantage,
        sum_adc_physique_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_adc_physique_damage_done_to_champion_u15 + EXCLUDED.sum_adc_physique_damage_done_to_champion_u15,
        sum_adc_magic_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_adc_magic_damage_done_to_champion_u15 + EXCLUDED.sum_adc_magic_damage_done_to_champion_u15,
        sum_adc_true_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_adc_true_damage_done_to_champion_u15 + EXCLUDED.sum_adc_true_damage_done_to_champion_u15,
        sum_adc_kill_u15 = botlane_duo_vs_duo_stats.sum_adc_kill_u15 + EXCLUDED.sum_adc_kill_u15,
        sum_adc_assist_u15 = botlane_duo_vs_duo_stats.sum_adc_assist_u15 + EXCLUDED.sum_adc_assist_u15,
        sum_adc_death_u15 = botlane_duo_vs_duo_stats.sum_adc_death_u15 + EXCLUDED.sum_adc_death_u15,
        sum_adc_vision_score_u15 = botlane_duo_vs_duo_stats.sum_adc_vision_score_u15 + EXCLUDED.sum_adc_vision_score_u15,
        sum_adc_shield_and_heal_u15 = botlane_duo_vs_duo_stats.sum_adc_shield_and_heal_u15 + EXCLUDED.sum_adc_shield_and_heal_u15,
        sum_adc_minions_killed_u15 = botlane_duo_vs_duo_stats.sum_adc_minions_killed_u15 + EXCLUDED.sum_adc_minions_killed_u15,
        sum_support_gold_earned = botlane_duo_vs_duo_stats.sum_support_gold_earned + EXCLUDED.sum_support_gold_earned,
        sum_support_gold_spent = botlane_duo_vs_duo_stats.sum_support_gold_spent + EXCLUDED.sum_support_gold_spent,
        sum_support_max_level_lead_lane_opponent =
          botlane_duo_vs_duo_stats.sum_support_max_level_lead_lane_opponent + EXCLUDED.sum_support_max_level_lead_lane_opponent,
        sum_support_max_kill_deficit =
          botlane_duo_vs_duo_stats.sum_support_max_kill_deficit + EXCLUDED.sum_support_max_kill_deficit,
        sum_support_max_cs_advantage_on_lane_opponent =
          botlane_duo_vs_duo_stats.sum_support_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_support_max_cs_advantage_on_lane_opponent,
        sum_support_vision_score_advantage_lane_opponent =
          botlane_duo_vs_duo_stats.sum_support_vision_score_advantage_lane_opponent + EXCLUDED.sum_support_vision_score_advantage_lane_opponent,
        sum_support_laning_phase_gold_exp_advantage =
          botlane_duo_vs_duo_stats.sum_support_laning_phase_gold_exp_advantage + EXCLUDED.sum_support_laning_phase_gold_exp_advantage,
        sum_support_early_laning_phase_gold_exp_advantage =
          botlane_duo_vs_duo_stats.sum_support_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_support_early_laning_phase_gold_exp_advantage,
        sum_support_physique_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_support_physique_damage_done_to_champion_u15 + EXCLUDED.sum_support_physique_damage_done_to_champion_u15,
        sum_support_magic_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_support_magic_damage_done_to_champion_u15 + EXCLUDED.sum_support_magic_damage_done_to_champion_u15,
        sum_support_true_damage_done_to_champion_u15 =
          botlane_duo_vs_duo_stats.sum_support_true_damage_done_to_champion_u15 + EXCLUDED.sum_support_true_damage_done_to_champion_u15,
        sum_support_kill_u15 = botlane_duo_vs_duo_stats.sum_support_kill_u15 + EXCLUDED.sum_support_kill_u15,
        sum_support_assist_u15 = botlane_duo_vs_duo_stats.sum_support_assist_u15 + EXCLUDED.sum_support_assist_u15,
        sum_support_death_u15 = botlane_duo_vs_duo_stats.sum_support_death_u15 + EXCLUDED.sum_support_death_u15,
        sum_support_vision_score_u15 = botlane_duo_vs_duo_stats.sum_support_vision_score_u15 + EXCLUDED.sum_support_vision_score_u15,
        sum_support_shield_and_heal_u15 =
          botlane_duo_vs_duo_stats.sum_support_shield_and_heal_u15 + EXCLUDED.sum_support_shield_and_heal_u15,
        sum_support_minions_killed_u15 =
          botlane_duo_vs_duo_stats.sum_support_minions_killed_u15 + EXCLUDED.sum_support_minions_killed_u15,
        updated_at = NOW()
    `;
  }
}

function snapshotDateOfGame(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return trimmed.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

async function upsertTierDailySnapshots(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const { championTransform } = championTransformFields(participant);
    const dateOfGame = snapshotDateOfGame(participant.gameDate);
    await tx`
      INSERT INTO champion_tier_daily_snapshots (
        patch, role, rank_tier, region, champion_id, champion_transform, date_of_game,
        games, wins, count_ban
      )
      VALUES (
        ${participant.patch}, ${participant.role}::lol_role, ${participant.rankTier}::lol_rank_tier,
        ${participant.region}::lol_region,
        ${participant.championId}, ${championTransform}, ${dateOfGame}::date,
        1, ${participantWinCount(participant)}, 0
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, date_of_game)
      DO UPDATE SET
        games = champion_tier_daily_snapshots.games + EXCLUDED.games,
        wins = champion_tier_daily_snapshots.wins + EXCLUDED.wins
    `;
  }
  for (const participant of participants) {
    const bannedId = Number(participant.bannedChampionId ?? 0)
    if (!Number.isFinite(bannedId) || bannedId <= 0) continue
    const dateOfGame = snapshotDateOfGame(participant.gameDate);
    await tx`
      INSERT INTO champion_tier_daily_snapshots (
        patch, role, rank_tier, region, champion_id, champion_transform, date_of_game,
        games, wins, count_ban
      )
      VALUES (
        ${participant.patch}, ${participant.role}::lol_role, ${participant.rankTier}::lol_rank_tier,
        ${participant.region}::lol_region,
        ${bannedId}, 0, ${dateOfGame}::date,
        0, 0, 1
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, champion_transform, date_of_game)
      DO UPDATE SET
        count_ban = champion_tier_daily_snapshots.count_ban + EXCLUDED.count_ban
    `;
  }
}

async function upsertItemTierDailySnapshots(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const gameDate = new Date(participant.gameDate);
    if (!Number.isFinite(gameDate.getTime())) continue;
    const dateOfGame = gameDate.toISOString().slice(0, 10);

    const orderByItemId = buildStarterLegendaryOrderByItemId(participant.items);
    if (orderByItemId.size === 0) continue;

    const firstTsByItem = new Map<number, number>();
    for (const row of participant.items) {
      const itemId = Number(row.itemId ?? 0);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      const ts = Math.max(0, Math.trunc(Number(row.timestampMs ?? 0)));
      const prev = firstTsByItem.get(itemId);
      if (prev == null || ts < prev) firstTsByItem.set(itemId, ts);
    }

    const winCount = participantWinCount(participant);
    const roleCounts = itemTierRoleGameWinCounts(participant.role, winCount);
    for (const [itemId, orderPos] of orderByItemId) {
      const orderKey = String(orderPos);
      // Passer l'OBJET (via sql.json) et non JSON.stringify(...) : ce dernier
      // double-encode la valeur en string JSON (même bug historique que order_items).
      const orderJson = sql.json({ [orderKey]: { games: 1, wins: winCount } });
      const ts = firstTsByItem.get(itemId) ?? 0;
      await tx`
        INSERT INTO item_tier_daily_snapshots (
          patch, rank_tier, region, item_id, date_of_game,
          games, wins, "order", sum_achat_tmps,
          top_game, top_win, jungle_game, jungle_win, mid_game, mid_win,
          adc_game, adc_win, support_game, support_win
        )
        VALUES (
          ${participant.patch}, ${participant.rankTier}, ${participant.region}, ${itemId}, ${dateOfGame}::date,
          1, ${winCount}, ${orderJson}, ${ts},
          ${roleCounts.top_game}, ${roleCounts.top_win},
          ${roleCounts.jungle_game}, ${roleCounts.jungle_win},
          ${roleCounts.mid_game}, ${roleCounts.mid_win},
          ${roleCounts.adc_game}, ${roleCounts.adc_win},
          ${roleCounts.support_game}, ${roleCounts.support_win}
        )
        ON CONFLICT (patch, rank_tier, region, item_id, date_of_game)
        DO UPDATE SET
          games = item_tier_daily_snapshots.games + EXCLUDED.games,
          wins = item_tier_daily_snapshots.wins + EXCLUDED.wins,
          "order" = jsonb_set(
            CASE
              WHEN jsonb_typeof(COALESCE(item_tier_daily_snapshots."order", '{}'::jsonb)) = 'object'
              THEN COALESCE(item_tier_daily_snapshots."order", '{}'::jsonb)
              ELSE '{}'::jsonb
            END,
            ARRAY[${orderKey}]::text[],
            jsonb_build_object(
              'games',
              CASE
                WHEN jsonb_typeof(item_tier_daily_snapshots."order") = 'object'
                THEN COALESCE((item_tier_daily_snapshots."order"->${orderKey}->>'games')::bigint, 0) + 1
                ELSE 1
              END,
              'wins',
              CASE
                WHEN jsonb_typeof(item_tier_daily_snapshots."order") = 'object'
                THEN COALESCE((item_tier_daily_snapshots."order"->${orderKey}->>'wins')::bigint, 0) + ${winCount}
                ELSE ${winCount}
              END
            ),
            true
          ),
          sum_achat_tmps = item_tier_daily_snapshots.sum_achat_tmps + EXCLUDED.sum_achat_tmps,
          top_game = item_tier_daily_snapshots.top_game + EXCLUDED.top_game,
          top_win = item_tier_daily_snapshots.top_win + EXCLUDED.top_win,
          jungle_game = item_tier_daily_snapshots.jungle_game + EXCLUDED.jungle_game,
          jungle_win = item_tier_daily_snapshots.jungle_win + EXCLUDED.jungle_win,
          mid_game = item_tier_daily_snapshots.mid_game + EXCLUDED.mid_game,
          mid_win = item_tier_daily_snapshots.mid_win + EXCLUDED.mid_win,
          adc_game = item_tier_daily_snapshots.adc_game + EXCLUDED.adc_game,
          adc_win = item_tier_daily_snapshots.adc_win + EXCLUDED.adc_win,
          support_game = item_tier_daily_snapshots.support_game + EXCLUDED.support_game,
          support_win = item_tier_daily_snapshots.support_win + EXCLUDED.support_win
      `;
    }
  }
}

async function upsertObjectiveOutcomeHistogram(tx: any, payload: IngestionJobData): Promise<void> {
  for (const objective of payload.teamStats.objectives) {
    const sumTs = Math.max(0, Math.trunc(Number(objective.sumTimestampMs ?? 0)));
    const dbKey = objectiveHistogramDbKey(objective);
    await tx`
      INSERT INTO objective_outcome_histogram (
        patch, rank_tier, region, team, objective_type, type_drake, is_soul, outcome, obj_count, count_games, sum_timestamp_ms
      )
      VALUES (
        ${payload.teamStats.patch}, ${payload.teamStats.rankTier}, ${payload.teamStats.region},
        ${objective.team}, ${dbKey.objectiveType}, ${dbKey.typeDrake}, ${dbKey.isSoul},
        ${objective.outcome}, ${objective.count}, 1, ${sumTs}
      )
      ON CONFLICT (patch, rank_tier, region, team, objective_type, type_drake_key, is_soul, outcome, obj_count)
      DO UPDATE SET
        count_games = objective_outcome_histogram.count_games + 1,
        sum_timestamp_ms = objective_outcome_histogram.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms,
        updated_at = NOW()
    `;
  }
}

/** Aligne les types parser (`fire_drake`, `fire_soul`, …) sur le schéma SQL (migration 0013). */
function objectiveHistogramDbKey(objective: TeamObjectiveDto): {
  objectiveType: string;
  typeDrake: string | null;
  isSoul: boolean;
} {
  const type = String(objective.type ?? "").trim();
  const drakeMatch = /^([a-z]+)_drake$/.exec(type);
  if (drakeMatch) {
    return { objectiveType: "dragon", typeDrake: drakeMatch[1]!, isSoul: false };
  }
  const soulMatch = /^([a-z]+)_soul$/.exec(type);
  if (soulMatch) {
    return { objectiveType: "dragon", typeDrake: soulMatch[1]!, isSoul: true };
  }
  if (type === "elder") {
    return { objectiveType: "dragon", typeDrake: "elder", isSoul: false };
  }
  return { objectiveType: type, typeDrake: null, isSoul: false };
}

async function upsertMatchOutcomeStats(tx: any, payload: IngestionJobData): Promise<void> {
  await tx`
    INSERT INTO match_outcome_stats (
      patch, rank_tier, region, count_match
    )
    VALUES (
      ${payload.teamStats.patch}, ${payload.teamStats.rankTier}, ${payload.teamStats.region}, 1
    )
    ON CONFLICT (patch, rank_tier)
    DO UPDATE SET
      count_match = match_outcome_stats.count_match + 1,
      region = EXCLUDED.region,
      updated_at = NOW()
  `;
}

function surrenderCountForTeam(
  team: 100 | 200,
  stats: IngestionJobData['teamStats']
): number {
  if (team === 100) {
    if (stats.surrenderedTeam100 === true) return 1
    if (stats.surrenderedTeam100 === false) return 0
  } else {
    if (stats.surrenderedTeam200 === true) return 1
    if (stats.surrenderedTeam200 === false) return 0
  }
  if (!stats.surrendered) return 0
  return team === 100 ? (stats.team100Win ? 0 : 1) : stats.team100Win ? 1 : 0
}

function earlySurrenderCountForTeam(
  team: 100 | 200,
  stats: IngestionJobData['teamStats']
): number {
  if (team === 100) {
    if (stats.earlySurrenderedTeam100 === true) return 1
    if (stats.earlySurrenderedTeam100 === false) return 0
  } else {
    if (stats.earlySurrenderedTeam200 === true) return 1
    if (stats.earlySurrenderedTeam200 === false) return 0
  }
  if (!stats.earlySurrendered) return 0
  return team === 100 ? (stats.team100Win ? 0 : 1) : stats.team100Win ? 1 : 0
}

async function upsertTeamCoreStat(tx: any, payload: IngestionJobData): Promise<void> {
  const team100Surrendered = surrenderCountForTeam(100, payload.teamStats)
  const team200Surrendered = surrenderCountForTeam(200, payload.teamStats)
  const team100EarlySurrendered = earlySurrenderCountForTeam(100, payload.teamStats)
  const team200EarlySurrendered = earlySurrenderCountForTeam(200, payload.teamStats)
  const stats = payload.teamStats

  await tx`
    INSERT INTO team_core_stat (
      patch, rank_tier, region, team, count_win, count_game,
      count_team_early_surrendered, count_team_surrendered,
      sum_champion_kills, count_elder_drake_first
    )
    VALUES (
      ${stats.patch},
      ${stats.rankTier},
      ${stats.region},
      100,
      ${stats.team100Win ? 1 : 0},
      1,
      ${team100EarlySurrendered},
      ${team100Surrendered},
      ${Math.max(0, Math.trunc(Number(stats.team100ChampionKills) || 0))},
      ${stats.team100ElderDrakeFirst ? 1 : 0}
    )
    ON CONFLICT (patch, rank_tier, region, team)
    DO UPDATE SET
      count_game = team_core_stat.count_game + 1,
      count_win = team_core_stat.count_win + EXCLUDED.count_win,
      count_team_early_surrendered = team_core_stat.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = team_core_stat.count_team_surrendered + EXCLUDED.count_team_surrendered,
      sum_champion_kills = team_core_stat.sum_champion_kills + EXCLUDED.sum_champion_kills,
      count_elder_drake_first = team_core_stat.count_elder_drake_first + EXCLUDED.count_elder_drake_first
  `;

  await tx`
    INSERT INTO team_core_stat (
      patch, rank_tier, region, team, count_win, count_game,
      count_team_early_surrendered, count_team_surrendered,
      sum_champion_kills, count_elder_drake_first
    )
    VALUES (
      ${stats.patch},
      ${stats.rankTier},
      ${stats.region},
      200,
      ${stats.team100Win ? 0 : 1},
      1,
      ${team200EarlySurrendered},
      ${team200Surrendered},
      ${Math.max(0, Math.trunc(Number(stats.team200ChampionKills) || 0))},
      ${stats.team200ElderDrakeFirst ? 1 : 0}
    )
    ON CONFLICT (patch, rank_tier, region, team)
    DO UPDATE SET
      count_game = team_core_stat.count_game + 1,
      count_win = team_core_stat.count_win + EXCLUDED.count_win,
      count_team_early_surrendered = team_core_stat.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = team_core_stat.count_team_surrendered + EXCLUDED.count_team_surrendered,
      sum_champion_kills = team_core_stat.sum_champion_kills + EXCLUDED.sum_champion_kills,
      count_elder_drake_first = team_core_stat.count_elder_drake_first + EXCLUDED.count_elder_drake_first
  `;
}

async function upsertChampionJunglePath(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    if (participant.role !== "JUNGLE") continue;
    if (participant.opponentChampionId <= 0) continue;
    const doc = participant.jungleCampHistory;
    const earlyPath = doc?.early_path as { path_hash?: unknown } | undefined;
    const pathHash = String(earlyPath?.path_hash ?? "").trim();
    if (!pathHash) continue;

    const winCount = participantWinCount(participant);
    const historyJson = JSON.stringify(doc ?? {});

    await tx.unsafe(
      `INSERT INTO champion_jungle_path (
         patch, rank_tier, region, champion_id, opponent_champion_id, path_hash,
         count_win, count_game, jungle_camp_history
       ) VALUES ($1, $2, $3::lol_region, $4, $5, $6, $7, 1, $8::jsonb)
       ON CONFLICT (patch, rank_tier, region, champion_id, opponent_champion_id, path_hash)
       DO UPDATE SET
         count_game = champion_jungle_path.count_game + 1,
         count_win = champion_jungle_path.count_win + EXCLUDED.count_win,
         jungle_camp_history = EXCLUDED.jungle_camp_history`,
      [
        participant.patch,
        participant.rankTier,
        participant.region,
        participant.championId,
        participant.opponentChampionId,
        pathHash,
        winCount,
        historyJson,
      ],
    );
  }
}

export async function runAggregationTransaction(payload: IngestionJobData): Promise<void> {
  const matchId = String(payload.teamStats.matchId ?? "").trim();
  if (payload.participants.length === 0) {
    throw new Error("aggregation_empty_participants");
  }
  if (matchId && (await isMatchAlreadyAggregated(matchId))) {
    throw new AlreadyProcessedMatchError(matchId);
  }

  payload.teamStats.region = normalizePlatformRegion(payload.teamStats.region);
  payload.teamStats.rankTier = normalizeLolRankTier(payload.teamStats.rankTier);
  for (const participant of payload.participants) {
    participant.region = normalizePlatformRegion(participant.region);
    participant.role = normalizeLolRole(participant.role);
    participant.rankTier = normalizeLolRankTier(participant.rankTier);
    if (participant.rankTierValue) {
      participant.rankTierValue = normalizeLolRankTier(participant.rankTierValue);
    }
  }

  await sql.begin(async (tx) => {
    await upsertPlayersFromParticipants(tx, payload.participants);
    await upsertPlayerRankHistoryFromParticipants(tx, payload.participants);
    await upsertChampionStats(tx, payload.participants);
    await upsertChampionVsStats(tx, payload.participants);
    await upsertChampionDuoRoleStats(tx, payload.participants);
    await upsertSpellOrderStats(tx, payload.participants);
    await upsertItemSetStats(tx, payload.participants);
    await upsertItemSoloStats(tx, payload.participants);
    await upsertRuneStats(tx, payload.participants);
    await upsertSummonerSpellStats(tx, payload.participants);
    await upsertBansByBanner(tx, payload.participants);
    await upsertChampionPickOrder(tx, payload.participants);
    await upsertChampionBucket(tx, payload.participants);
    await upsertBotlaneDuoVsDuoStats(tx, payload);
    await upsertTierDailySnapshots(tx, payload.participants);
    await upsertItemTierDailySnapshots(tx, payload.participants);
    await upsertObjectiveOutcomeHistogram(tx, payload);
    await upsertMatchOutcomeStats(tx, payload);
    await upsertTeamCoreStat(tx, payload);
    await upsertChampionJunglePath(tx, payload.participants);
    if (matchId) {
      await insertMatchAggregated(tx, matchId);
    }
  });
}

/** Ingestion immédiate : joueurs + rangs uniquement. Agrégats = batch 30 min. */
export async function runIngestionTransaction(payload: IngestionJobData): Promise<{ insertedPlayers: number; aggregated: boolean }> {
  if (payload.participants.length === 0) return { insertedPlayers: 0, aggregated: false };

  const matchId = String(payload.teamStats.matchId ?? "").trim();
  const fromDb = matchId ? await loadIngestionPayloadFromNormalizedTables(matchId) : null;
  const effectivePayload = fromDb ?? payload;

  await rehydrateParticipantRanksForIngestion(effectivePayload);

  let insertedPlayers = 0;
  await sql.begin(async (tx) => {
    insertedPlayers = await upsertPlayersFromParticipants(tx, effectivePayload.participants);
    await upsertPlayerRankHistoryFromParticipants(tx, effectivePayload.participants);
  });

  return { insertedPlayers, aggregated: false };
}

export interface IngestionJobDeps {
  runTransaction: (
    payload: IngestionJobData,
  ) => Promise<{ insertedPlayers: number; aggregated: boolean }>;
}

const defaultIngestionJobDeps: IngestionJobDeps = {
  runTransaction: (payload) => runIngestionTransaction(payload),
};

export async function processIngestionJob(
  job: Job<IngestionJobData>,
  deps: IngestionJobDeps = defaultIngestionJobDeps,
): Promise<void> {
  const startedAt = Date.now();
  const matchId = String(job.data.participants[0]?.matchId ?? "").trim();
  const patch = String(job.data.participants[0]?.patch ?? "").trim();
  const rank = String(job.data.participants[0]?.rankTier ?? "UNRANKED").trim();
  recordIngestionWorker({ matchId, patch, rank, type: "started" });
  try {
    const { insertedPlayers, aggregated } = await deps.runTransaction(job.data);
    const durationMs = Date.now() - startedAt;
    recordIngestionWorker({
      matchId,
      patch,
      rank,
      type: "completed",
      durationMs,
      completedReason: "processed",
      tablesWritten: {
        match_aggregated: aggregated ? 1 : 0,
        participants: insertedPlayers,
      },
    });
    const [{ getRankBacklogCount }, { enqueueRankFetchJobsForParticipants }] = await Promise.all([
      import("../queues/index.js"),
      import("../queues/rank-jobs.js"),
    ]);
    const rankBacklog = await getRankBacklogCount();
    if (!shouldPauseMatchPipelines(rankBacklog)) {
      await enqueueRankFetchJobsForParticipants(job.data.participants);
    }
    if (aggregated) {
      const aggregatedMatchId = String(job.data.participants[0]?.matchId ?? "").trim();
      if (aggregatedMatchId) {
        const { recordAggregatedMatch } = await import("../redis/ingestion-metrics.js");
        await recordAggregatedMatch(aggregatedMatchId);
      }
    }
  } catch (error) {
    if (error instanceof AlreadyProcessedMatchError) {
      recordIngestionWorker({
        matchId,
        patch,
        rank,
        type: "completed",
        durationMs: Date.now() - startedAt,
        completedReason: "already_done",
      });
      return;
    }
    recordIngestionWorker({
      matchId,
      patch,
      rank,
      type: "failed",
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
