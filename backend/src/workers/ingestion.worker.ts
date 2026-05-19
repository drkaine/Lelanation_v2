import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import { CHAMPION_STATS_METRIC_COLUMNS } from "../constants/championStatsMetricColumns.js";
import type { IngestionJobData, ParsedParticipantDto } from "../dto/match.dto.js";
import { championStatsMetricValue } from "../parsers/champion-stats-metric-value.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { INGESTION_QUEUE } from "../queues/definitions.js";
import { rankQueue } from "../queues/index.js";
import { redis } from "../redis/client.js";

class AlreadyProcessedMatchError extends Error {
  constructor(matchId: string) {
    super(`match_already_processed:${matchId}`);
    this.name = "AlreadyProcessedMatchError";
  }
}

function participantWinCount(participant: ParsedParticipantDto): number {
  return participant.win ? 1 : 0;
}

function numericMetric(participant: ParsedParticipantDto, key: string): number {
  const raw = (participant as Record<string, unknown>)[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.trunc(raw);
}

/** Métriques lane / challenges : colonnes SQL passées en double precision (0008) — pas de troncature. */
function laneEconomyNumber(participant: ParsedParticipantDto, sumKey: string): number {
  const raw = (participant as Record<string, unknown>)[sumKey];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Clé `rank_tier` pour botlane (même logique que les autres upserts : libellé participant). */
function botlaneRankTierKey(p: ParsedParticipantDto): string {
  const t = String(p.rankTier ?? "").trim().toUpperCase();
  return t.length > 0 ? t : "UNRANKED";
}

function firstBotlaneParticipant(
  participants: ParsedParticipantDto[],
  teamId: 100 | 200,
  role: "ADC" | "SUPPORT",
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

/** Métriques agrégées côté champion principal (aligné agg_champion_duo_role_stats / vs). */
function championDuoRoleEconomyFromParticipant(p: ParsedParticipantDto) {
  return {
    goldEarned: Math.trunc(Number(p.goldEarned) || 0),
    goldSpent: Math.trunc(Number(p.goldSpent) || 0),
    maxLevelLeadLaneOpponent: laneEconomyNumber(p, "sum_max_level_lead_lane_opponent"),
    maxKillDeficit: laneEconomyNumber(p, "sum_max_kill_deficit"),
    moreEnemyJungleThanOpponent: laneEconomyNumber(p, "sum_more_enemy_jungle_than_opponent"),
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

/** Tiers solo flex (ordre elo), comme `rank_tier` en base. */
const SOLO_TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

const SOLO_TIER_INDEX: Record<string, number> = Object.fromEntries(
  SOLO_TIER_ORDER.map((tier, i) => [tier, i + 1]),
) as Record<string, number>;

function normalizeRankTier(value: string | null | undefined): string | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

/**
 * Tier « moyen » du match : moyenne des ordres de tier des participants classés,
 * arrondie au tier le plus proche (libellé identique à rank_tier).
 */
function averageMatchRankTierLabel(participants: ParsedParticipantDto[]): string | null {
  const ordinals: number[] = [];
  for (const participant of participants) {
    const tier = normalizeRankTier(participant.rankTierValue ?? participant.rankTier);
    if (!tier) continue;
    const idx = SOLO_TIER_INDEX[tier];
    if (idx == null) continue;
    ordinals.push(idx);
  }
  if (ordinals.length === 0) return null;
  const mean = ordinals.reduce((a, b) => a + b, 0) / ordinals.length;
  const rounded = Math.min(SOLO_TIER_ORDER.length, Math.max(1, Math.round(mean)));
  return SOLO_TIER_ORDER[rounded - 1] ?? null;
}

async function insertProcessedMatchSentinel(
  tx: any,
  payload: IngestionJobData,
): Promise<void> {
  const first = payload.participants[0];
  if (!first) throw new Error("ingestion_empty_participants");
  const rankTier = averageMatchRankTierLabel(payload.participants);
  const inserted = await tx<{ riot_match_id: string }[]>`
    INSERT INTO processed_matches (patch, game_date, riot_match_id, status, rank)
    VALUES (${payload.teamStats.patch}, ${first.gameDate}, ${payload.teamStats.matchId}, 'DONE', ${rankTier})
    ON CONFLICT (patch, riot_match_id) DO NOTHING
    RETURNING riot_match_id
  `;
  if (inserted.length === 0) {
    throw new AlreadyProcessedMatchError(payload.teamStats.matchId);
  }
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
    const region = String(participant.region ?? "").trim().toLowerCase();
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
        ${region || "euw1"},
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
        region = ${region || "euw1"},
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
    const region = String(participant.region ?? "").trim().toLowerCase();
    const gameDate = new Date(participant.gameDate);
    if (!puuid || !region || !Number.isFinite(gameDate.getTime())) continue;
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
    const region = String(participant.region ?? "").trim().toLowerCase();
    const gameDate = new Date(participant.gameDate);
    if (!Number.isFinite(gameDate.getTime())) continue;
    const normalizedTier = normalizeRankTier(participant.rankTierValue ?? participant.rankTier);
    const normalizedDivision = normalizeRankDivision(participant.rankDivision);
    const normalizedLp = normalizeRankLp(participant.lp);
    const hasResolvedRank = !!normalizedTier && !!normalizedDivision && normalizedLp != null;
    const rankTier = hasResolvedRank ? normalizedTier : "UNRANKED";
    const rankDivision = hasResolvedRank ? normalizedDivision : "UNRANKED";
    const rankLp = hasResolvedRank ? normalizedLp : 0;

    await tx`
      INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
      VALUES (${puuid}, ${gameDate.toISOString().slice(0, 10)}::date, ${region}, ${rankTier}, ${rankDivision}, ${rankLp})
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
  const baseCols = ["patch", "role", "rank_tier", "region", "champion_id", "team", "count_game", "count_win"];
  const metricCols = CHAMPION_STATS_METRIC_COLUMNS;
  const allCols = [...baseCols, ...metricCols];
  const updateParts = [
    "count_game = champion_stats.count_game + EXCLUDED.count_game",
    "count_win = champion_stats.count_win + EXCLUDED.count_win",
    ...metricCols.map((c) => `${c} = champion_stats.${c} + EXCLUDED.${c}`),
    "updated_at = NOW()",
  ];
  const insertHeader = `INSERT INTO champion_stats (${allCols.join(", ")})`;
  const conflict = `ON CONFLICT (patch, role, rank_tier, region, champion_id, team) DO UPDATE SET ${updateParts.join(", ")}`;

  for (const participant of participants) {
    const values: unknown[] = [
      participant.patch,
      participant.role,
      participant.rankTier,
      participant.region,
      participant.championId,
      participant.teamId,
      1,
      participantWinCount(participant),
      ...metricCols.map((c) => championStatsMetricValue(participant, c)),
    ];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const q = `${insertHeader} VALUES (${placeholders}) ${conflict}`;
    await (tx as { unsafe: (query: string, params?: unknown[]) => Promise<unknown> }).unsafe(q, values);
  }
}

async function upsertChampionVsStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants.filter((p) => p.opponentChampionId > 0)) {
    const m = championDuoRoleEconomyFromParticipant(participant);
    const u = u15IngestSums(participant.u15);
    await tx`
      INSERT INTO champion_vs_stats (
        patch, role, rank_tier, region, champion_id, opponent_champion_id,
        count_win, count_game,
        sum_gold_earned, sum_gold_spent,
        sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent,
        sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent,
        sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage,
        sum_physique_damage_done_to_champion_u15, sum_magic_damage_done_to_champion_u15, sum_true_damage_done_to_champion_u15,
        sum_kill_u15, sum_assist_u15, sum_death_u15, sum_vision_score_u15, sum_shield_and_heal_u15, sum_minions_killed_u15
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${participant.opponentChampionId},
        ${participantWinCount(participant)}, 1,
        ${m.goldEarned}, ${m.goldSpent},
        ${m.maxLevelLeadLaneOpponent}, ${m.maxKillDeficit}, ${m.moreEnemyJungleThanOpponent},
        ${m.maxCsAdvantageOnLaneOpponent}, ${m.visionScoreAdvantageLaneOpponent},
        ${m.laningPhaseGoldExpAdvantage}, ${m.earlyLaningPhaseGoldExpAdvantage},
        ${u.phys}, ${u.magic}, ${u.trueDmg},
        ${u.kill}, ${u.assist}, ${u.death}, ${u.vision}, ${u.shield}, ${u.cs}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, opponent_champion_id)
      DO UPDATE SET
        count_game = champion_vs_stats.count_game + 1,
        count_win = champion_vs_stats.count_win + EXCLUDED.count_win,
        sum_gold_earned = champion_vs_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
        sum_gold_spent = champion_vs_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
        sum_max_level_lead_lane_opponent =
          champion_vs_stats.sum_max_level_lead_lane_opponent + EXCLUDED.sum_max_level_lead_lane_opponent,
        sum_max_kill_deficit = champion_vs_stats.sum_max_kill_deficit + EXCLUDED.sum_max_kill_deficit,
        sum_more_enemy_jungle_than_opponent =
          champion_vs_stats.sum_more_enemy_jungle_than_opponent + EXCLUDED.sum_more_enemy_jungle_than_opponent,
        sum_max_cs_advantage_on_lane_opponent =
          champion_vs_stats.sum_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
        sum_vision_score_advantage_lane_opponent =
          champion_vs_stats.sum_vision_score_advantage_lane_opponent + EXCLUDED.sum_vision_score_advantage_lane_opponent,
        sum_laning_phase_gold_exp_advantage =
          champion_vs_stats.sum_laning_phase_gold_exp_advantage + EXCLUDED.sum_laning_phase_gold_exp_advantage,
        sum_early_laning_phase_gold_exp_advantage =
          champion_vs_stats.sum_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_early_laning_phase_gold_exp_advantage,
        sum_physique_damage_done_to_champion_u15 =
          champion_vs_stats.sum_physique_damage_done_to_champion_u15 + EXCLUDED.sum_physique_damage_done_to_champion_u15,
        sum_magic_damage_done_to_champion_u15 =
          champion_vs_stats.sum_magic_damage_done_to_champion_u15 + EXCLUDED.sum_magic_damage_done_to_champion_u15,
        sum_true_damage_done_to_champion_u15 =
          champion_vs_stats.sum_true_damage_done_to_champion_u15 + EXCLUDED.sum_true_damage_done_to_champion_u15,
        sum_kill_u15 = champion_vs_stats.sum_kill_u15 + EXCLUDED.sum_kill_u15,
        sum_assist_u15 = champion_vs_stats.sum_assist_u15 + EXCLUDED.sum_assist_u15,
        sum_death_u15 = champion_vs_stats.sum_death_u15 + EXCLUDED.sum_death_u15,
        sum_vision_score_u15 = champion_vs_stats.sum_vision_score_u15 + EXCLUDED.sum_vision_score_u15,
        sum_shield_and_heal_u15 = champion_vs_stats.sum_shield_and_heal_u15 + EXCLUDED.sum_shield_and_heal_u15,
        sum_minions_killed_u15 = champion_vs_stats.sum_minions_killed_u15 + EXCLUDED.sum_minions_killed_u15,
        updated_at = NOW()
    `;
  }
}

async function upsertChampionDuoRoleStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const allies = participants.filter(
      (ally) => ally.matchId === participant.matchId && ally.teamId === participant.teamId && ally.puuid !== participant.puuid,
    );
    const m = championDuoRoleEconomyFromParticipant(participant);
    for (const ally of allies) {
      await tx`
        INSERT INTO champion_duo_role_stats (
          patch, rank_tier, region, champion_id, role, ally_champion_id, ally_role,
          count_game, count_win,
          sum_gold_earned, sum_gold_spent,
          sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent,
          sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent,
          sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage
        )
        VALUES (
          ${participant.patch}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${participant.role}, ${ally.championId}, ${ally.role},
          1, ${participantWinCount(participant)},
          ${m.goldEarned}, ${m.goldSpent},
          ${m.maxLevelLeadLaneOpponent}, ${m.maxKillDeficit}, ${m.moreEnemyJungleThanOpponent},
          ${m.maxCsAdvantageOnLaneOpponent}, ${m.visionScoreAdvantageLaneOpponent},
          ${m.laningPhaseGoldExpAdvantage}, ${m.earlyLaningPhaseGoldExpAdvantage}
        )
        ON CONFLICT (patch, rank_tier, region, champion_id, role, ally_champion_id, ally_role)
        DO UPDATE SET
          count_game = champion_duo_role_stats.count_game + 1,
          count_win = champion_duo_role_stats.count_win + EXCLUDED.count_win,
          sum_gold_earned = champion_duo_role_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
          sum_gold_spent = champion_duo_role_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
          sum_max_level_lead_lane_opponent =
            champion_duo_role_stats.sum_max_level_lead_lane_opponent + EXCLUDED.sum_max_level_lead_lane_opponent,
          sum_max_kill_deficit = champion_duo_role_stats.sum_max_kill_deficit + EXCLUDED.sum_max_kill_deficit,
          sum_more_enemy_jungle_than_opponent =
            champion_duo_role_stats.sum_more_enemy_jungle_than_opponent + EXCLUDED.sum_more_enemy_jungle_than_opponent,
          sum_max_cs_advantage_on_lane_opponent =
            champion_duo_role_stats.sum_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
          sum_vision_score_advantage_lane_opponent =
            champion_duo_role_stats.sum_vision_score_advantage_lane_opponent + EXCLUDED.sum_vision_score_advantage_lane_opponent,
          sum_laning_phase_gold_exp_advantage =
            champion_duo_role_stats.sum_laning_phase_gold_exp_advantage + EXCLUDED.sum_laning_phase_gold_exp_advantage,
          sum_early_laning_phase_gold_exp_advantage =
            champion_duo_role_stats.sum_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_early_laning_phase_gold_exp_advantage,
          updated_at = NOW()
      `;
    }
  }
}

async function upsertSpellOrderStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const spellTs = Math.max(0, Math.trunc(Number(participant.spellLevelUpTimestampSumMs ?? 0)));
    await tx`
      INSERT INTO champion_spell_stats (
        patch, role, rank_tier, region, champion_id,
        spell_order,
        spell1_casts, spell2_casts, spell3_casts, spell4_casts,
        count_game, count_win, sum_timestamp_ms
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId},
        ${participant.spellOrder},
        ${participant.spell1Casts}, ${participant.spell2Casts}, ${participant.spell3Casts}, ${participant.spell4Casts},
        1, ${participantWinCount(participant)}, ${spellTs}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, spell_order_hash)
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
  for (const participant of participants) {
    const rows: Array<{ type: string; key: string }> = [
      { type: "starter", key: participant.starterKey },
      { type: "core", key: participant.coreKey },
      { type: "final", key: participant.finalKey },
    ];
    for (const row of rows) {
      await tx`
        INSERT INTO champion_item_set_stats (
          patch, role, rank_tier, region, champion_id, phase, item_set_key,
          count_game, count_win
        )
        VALUES (
          ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${row.type}, ${row.key},
          1, ${participantWinCount(participant)}
        )
        ON CONFLICT (patch, role, rank_tier, region, champion_id, phase, item_set_key)
        DO UPDATE SET
          count_game = champion_item_set_stats.count_game + 1,
          count_win = champion_item_set_stats.count_win + EXCLUDED.count_win
      `;
    }
  }
}

async function upsertItemSoloStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const distinctItems = Array.from(new Set(participant.items.map((item) => item.itemId).filter((itemId) => itemId > 0)));
    for (const itemId of distinctItems) {
      const starterCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "starter").length;
      const coreCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "core").length;
      const finalCount = participant.items.filter((item) => item.itemId === itemId && item.phase === "final").length;
      const countWinStarter = participant.win ? starterCount : 0;
      const countWinCore = participant.win ? coreCount : 0;
      const countWinFinal = participant.win ? finalCount : 0;
      const avgTimestamp = participant.items
        .filter((item) => item.itemId === itemId)
        .reduce((acc, item) => acc + item.timestampMs, 0);

      await tx`
        INSERT INTO champion_item_solo_stats (
          patch, role, rank_tier, region, champion_id, item_id,
          count_starter, count_win_starter, count_core, count_win_core, count_final, count_win_final,
          count_game, count_win, sum_timestamp_ms
        )
        VALUES (
          ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${itemId},
          ${starterCount}, ${countWinStarter}, ${coreCount}, ${countWinCore}, ${finalCount}, ${countWinFinal},
          1, ${participantWinCount(participant)}, ${avgTimestamp}
        )
        ON CONFLICT (patch, role, rank_tier, region, champion_id, item_id)
        DO UPDATE SET
          count_starter = champion_item_solo_stats.count_starter + EXCLUDED.count_starter,
          count_win_starter = champion_item_solo_stats.count_win_starter + EXCLUDED.count_win_starter,
          count_core = champion_item_solo_stats.count_core + EXCLUDED.count_core,
          count_win_core = champion_item_solo_stats.count_win_core + EXCLUDED.count_win_core,
          count_final = champion_item_solo_stats.count_final + EXCLUDED.count_final,
          count_win_final = champion_item_solo_stats.count_win_final + EXCLUDED.count_win_final,
          count_game = champion_item_solo_stats.count_game + EXCLUDED.count_game,
          count_win = champion_item_solo_stats.count_win + EXCLUDED.count_win,
          sum_timestamp_ms = champion_item_solo_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms
      `;
    }
  }
}

async function upsertRuneStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    await tx`
      INSERT INTO champion_runes_stats (
        patch, role, rank_tier, region, champion_id, rune_list, shard_list,
        count_game, count_win
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${participant.runeList}, ${participant.shardList},
        1, ${participantWinCount(participant)}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, rune_list, shard_list)
      DO UPDATE SET
        count_game = champion_runes_stats.count_game + 1,
        count_win = champion_runes_stats.count_win + EXCLUDED.count_win
    `;

    for (const runeId of participant.perks) {
      await tx`
        INSERT INTO champion_runes_solo_stats (
          patch, role, rank_tier, region, champion_id, perk_id,
          count_game, count_win
        )
        VALUES (
          ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${runeId},
          1, ${participantWinCount(participant)}
        )
        ON CONFLICT (patch, role, rank_tier, region, champion_id, perk_id)
        DO UPDATE SET
          count_game = champion_runes_solo_stats.count_game + 1,
          count_win = champion_runes_solo_stats.count_win + EXCLUDED.count_win
      `;
    }

    for (const [slot, shardId] of participant.shardList
      .split("_")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .entries()) {
      await tx`
        INSERT INTO champion_shard_solo_stats (
          patch, role, rank_tier, region, champion_id, shard_id, slot,
          count_game, count_win
        )
        VALUES (
          ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${shardId}, ${slot},
          1, ${participantWinCount(participant)}
        )
        ON CONFLICT (patch, role, rank_tier, region, champion_id, shard_id, slot)
        DO UPDATE SET
          count_game = champion_shard_solo_stats.count_game + 1,
          count_win = champion_shard_solo_stats.count_win + EXCLUDED.count_win
      `;
    }
  }
}

async function upsertSummonerSpellStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const [spellD, spellF] = [participant.spellD, participant.spellF].sort((a, b) => a - b);
    const spellDCasts = spellD === participant.spellD ? participant.spellDCasts : participant.spellFCasts;
    const spellFCasts = spellF === participant.spellF ? participant.spellFCasts : participant.spellDCasts;
    await tx`
      INSERT INTO champion_summoner_spell_pair_stats (
        patch, role, rank_tier, region, champion_id, spell_d, spell_f, spell_d_casts, spell_f_casts, count_game, count_win
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${spellD}, ${spellF}, ${spellDCasts}, ${spellFCasts},
        1, ${participantWinCount(participant)}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, spell_d, spell_f)
      DO UPDATE SET
        count_game = champion_summoner_spell_pair_stats.count_game + 1,
        count_win = champion_summoner_spell_pair_stats.count_win + EXCLUDED.count_win,
        spell_d_casts = champion_summoner_spell_pair_stats.spell_d_casts + EXCLUDED.spell_d_casts,
        spell_f_casts = champion_summoner_spell_pair_stats.spell_f_casts + EXCLUDED.spell_f_casts
    `;

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
      await tx`
        INSERT INTO champion_summoner_spells (
          patch, role, rank_tier, region, champion_id, spell_id,
          count_win_d, count_win_f, count_game_d, count_game_f, count_slotd, count_slotf
        )
        VALUES (
          ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
          ${participant.championId}, ${spellId},
          ${countWinD}, ${countWinF}, ${countGameD}, ${countGameF}, ${countSlotD}, ${countSlotF}
        )
        ON CONFLICT (patch, role, rank_tier, region, champion_id, spell_id)
        DO UPDATE SET
          count_win_d = champion_summoner_spells.count_win_d + EXCLUDED.count_win_d,
          count_win_f = champion_summoner_spells.count_win_f + EXCLUDED.count_win_f,
          count_game_d = champion_summoner_spells.count_game_d + EXCLUDED.count_game_d,
          count_game_f = champion_summoner_spells.count_game_f + EXCLUDED.count_game_f,
          count_slotd = champion_summoner_spells.count_slotd + EXCLUDED.count_slotd,
          count_slotf = champion_summoner_spells.count_slotf + EXCLUDED.count_slotf
      `;
    }
  }
}

async function upsertBansByBanner(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
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

    await tx`
      INSERT INTO champion_bans_by_banner (
        patch, rank_tier, region, banned_champion_id,
        count_banner_team_100, count_banner_team_200, count_banner_top, count_banner_jungle, count_banner_mid, count_banner_adc, count_banner_support
      )
      VALUES (
        ${participant.patch}, ${participant.rankTier}, ${participant.region},
        ${participant.bannedChampionId},
        ${isTeam100 ? 1 : 0},
        ${isTeam100 ? 0 : 1},
        ${roleColumn === "count_banner_top" ? 1 : 0},
        ${roleColumn === "count_banner_jungle" ? 1 : 0},
        ${roleColumn === "count_banner_mid" ? 1 : 0},
        ${roleColumn === "count_banner_adc" ? 1 : 0},
        ${roleColumn === "count_banner_support" ? 1 : 0}
      )
      ON CONFLICT (patch, rank_tier, region, banned_champion_id)
      DO UPDATE SET
        count_banner_team_100 = champion_bans_by_banner.count_banner_team_100 + EXCLUDED.count_banner_team_100,
        count_banner_team_200 = champion_bans_by_banner.count_banner_team_200 + EXCLUDED.count_banner_team_200,
        count_banner_top = champion_bans_by_banner.count_banner_top + EXCLUDED.count_banner_top,
        count_banner_jungle = champion_bans_by_banner.count_banner_jungle + EXCLUDED.count_banner_jungle,
        count_banner_mid = champion_bans_by_banner.count_banner_mid + EXCLUDED.count_banner_mid,
        count_banner_adc = champion_bans_by_banner.count_banner_adc + EXCLUDED.count_banner_adc,
        count_banner_support = champion_bans_by_banner.count_banner_support + EXCLUDED.count_banner_support
    `;
  }
}

async function upsertChampionPickOrder(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    await tx`
      INSERT INTO champion_pick_order (
        patch, role, rank_tier, region, champion_id, team, pick_order, count_win, count_game
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${participant.teamId}, ${participant.pickOrder},
        ${participantWinCount(participant)}, 1
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, team, pick_order)
      DO UPDATE SET
        count_game = champion_pick_order.count_game + 1,
        count_win = champion_pick_order.count_win + EXCLUDED.count_win
    `;
  }
}

async function upsertChampionBucket(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    const durationSeconds =
      Math.max(0, Math.trunc(numericMetric(participant, "sum_game_length"))) ||
      Math.max(0, Math.trunc((participant.gameEndTimestamp > 0 ? participant.gameEndTimestamp : 0) / 1000));
    const durationBucket = durationSeconds > 0 ? Math.max(0, Math.trunc(durationSeconds / 60)) : 0;
    const sumCurrentGold = numericMetric(participant, "sum_current_gold");
    const sumMagicDamageDone = numericMetric(participant, "sum_magic_damage_done");
    const sumMagicDamageDoneToChampion = numericMetric(participant, "sum_magic_damage_done_to_champion");
    const sumMagicDamageTaken = numericMetric(participant, "sum_magic_damage_taken");
    const sumPhysicalDamageDone = numericMetric(participant, "sum_physical_damage_done");
    const sumPhysicalDamageDoneToChampion = numericMetric(participant, "sum_physical_damage_done_to_champion");
    const sumPhysicalDamageTaken = numericMetric(participant, "sum_physical_damage_taken");
    const sumTrueDamageDone = numericMetric(participant, "sum_true_damage_done");
    const sumTrueDamageDoneToChampion = numericMetric(participant, "sum_true_damage_done_to_champion");
    const sumTrueDamageTaken = numericMetric(participant, "sum_true_damage_taken");
    const sumJungleMinionsKilled = numericMetric(participant, "sum_jungle_minions_killed");
    const sumLevel = numericMetric(participant, "sum_level");
    const sumMinionsKilled = numericMetric(participant, "sum_minions_killed");
    const sumTotalGold = participant.goldEarned;
    const sumTimePlayed = durationSeconds;
    const sumKills = participant.kills;
    const sumAssists = participant.assists;
    const sumDeaths = participant.deaths;
    const sumKillsAssists = participant.kills + participant.assists;
    const sumKdDiff10 = numericMetric(participant, "sum_kd_diff_10");
    const sumKdDiff20 = numericMetric(participant, "sum_kd_diff_20");
    const countKdDiff10PositiveGame = sumKdDiff10 > 0 ? 1 : 0;
    const countKdDiff10PositiveWin = sumKdDiff10 > 0 && participant.win ? 1 : 0;
    const countKdDiff20PositiveGame = sumKdDiff20 > 0 ? 1 : 0;
    const countKdDiff20PositiveWin = sumKdDiff20 > 0 && participant.win ? 1 : 0;
    const countTimeEnemySpentControlled = numericMetric(participant, "sum_time_enemy_spent_controlled") > 0 ? 1 : 0;

    await tx`
      INSERT INTO champion_bucket (
        patch, role, rank_tier, region, champion_id, duration_bucket,
        count_win, count_game,
        sum_current_gold, sum_magic_damage_done, sum_magic_damage_done_to_champion, sum_magic_damage_taken,
        sum_physical_damage_done, sum_physical_damage_done_to_champion, sum_physical_damage_taken,
        sum_true_damage_done, sum_true_damage_done_to_champion, sum_true_damage_taken,
        sum_jungle_minions_killed, sum_level, sum_minions_killed, sum_total_gold, sum_time_played,
        sum_kills, sum_assists, sum_deaths, sum_kills_assists, sum_kd_diff_10, sum_kd_diff_20,
        count_kd_diff_10_positive_game, count_kd_diff_10_positive_win,
        count_kd_diff_20_positive_game, count_kd_diff_20_positive_win, count_game_end, count_time_enemy_spent_controlled
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region}, ${participant.championId}, ${durationBucket},
        ${participantWinCount(participant)}, 1,
        ${sumCurrentGold}, ${sumMagicDamageDone}, ${sumMagicDamageDoneToChampion}, ${sumMagicDamageTaken},
        ${sumPhysicalDamageDone}, ${sumPhysicalDamageDoneToChampion}, ${sumPhysicalDamageTaken},
        ${sumTrueDamageDone}, ${sumTrueDamageDoneToChampion}, ${sumTrueDamageTaken},
        ${sumJungleMinionsKilled}, ${sumLevel}, ${sumMinionsKilled}, ${sumTotalGold}, ${sumTimePlayed},
        ${sumKills}, ${sumAssists}, ${sumDeaths}, ${sumKillsAssists}, ${sumKdDiff10}, ${sumKdDiff20},
        ${countKdDiff10PositiveGame}, ${countKdDiff10PositiveWin},
        ${countKdDiff20PositiveGame}, ${countKdDiff20PositiveWin}, 1, ${countTimeEnemySpentControlled}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, duration_bucket)
      DO UPDATE SET
        count_win = champion_bucket.count_win + EXCLUDED.count_win,
        count_game = champion_bucket.count_game + EXCLUDED.count_game,
        sum_current_gold = champion_bucket.sum_current_gold + EXCLUDED.sum_current_gold,
        sum_magic_damage_done = champion_bucket.sum_magic_damage_done + EXCLUDED.sum_magic_damage_done,
        sum_magic_damage_done_to_champion = champion_bucket.sum_magic_damage_done_to_champion + EXCLUDED.sum_magic_damage_done_to_champion,
        sum_magic_damage_taken = champion_bucket.sum_magic_damage_taken + EXCLUDED.sum_magic_damage_taken,
        sum_physical_damage_done = champion_bucket.sum_physical_damage_done + EXCLUDED.sum_physical_damage_done,
        sum_physical_damage_done_to_champion = champion_bucket.sum_physical_damage_done_to_champion + EXCLUDED.sum_physical_damage_done_to_champion,
        sum_physical_damage_taken = champion_bucket.sum_physical_damage_taken + EXCLUDED.sum_physical_damage_taken,
        sum_true_damage_done = champion_bucket.sum_true_damage_done + EXCLUDED.sum_true_damage_done,
        sum_true_damage_done_to_champion = champion_bucket.sum_true_damage_done_to_champion + EXCLUDED.sum_true_damage_done_to_champion,
        sum_true_damage_taken = champion_bucket.sum_true_damage_taken + EXCLUDED.sum_true_damage_taken,
        sum_jungle_minions_killed = champion_bucket.sum_jungle_minions_killed + EXCLUDED.sum_jungle_minions_killed,
        sum_level = champion_bucket.sum_level + EXCLUDED.sum_level,
        sum_minions_killed = champion_bucket.sum_minions_killed + EXCLUDED.sum_minions_killed,
        sum_total_gold = champion_bucket.sum_total_gold + EXCLUDED.sum_total_gold,
        sum_time_played = champion_bucket.sum_time_played + EXCLUDED.sum_time_played,
        sum_kills = champion_bucket.sum_kills + EXCLUDED.sum_kills,
        sum_assists = champion_bucket.sum_assists + EXCLUDED.sum_assists,
        sum_deaths = champion_bucket.sum_deaths + EXCLUDED.sum_deaths,
        sum_kills_assists = champion_bucket.sum_kills_assists + EXCLUDED.sum_kills_assists,
        sum_kd_diff_10 = champion_bucket.sum_kd_diff_10 + EXCLUDED.sum_kd_diff_10,
        sum_kd_diff_20 = champion_bucket.sum_kd_diff_20 + EXCLUDED.sum_kd_diff_20,
        count_kd_diff_10_positive_game = champion_bucket.count_kd_diff_10_positive_game + EXCLUDED.count_kd_diff_10_positive_game,
        count_kd_diff_10_positive_win = champion_bucket.count_kd_diff_10_positive_win + EXCLUDED.count_kd_diff_10_positive_win,
        count_kd_diff_20_positive_game = champion_bucket.count_kd_diff_20_positive_game + EXCLUDED.count_kd_diff_20_positive_game,
        count_kd_diff_20_positive_win = champion_bucket.count_kd_diff_20_positive_win + EXCLUDED.count_kd_diff_20_positive_win,
        count_game_end = champion_bucket.count_game_end + EXCLUDED.count_game_end,
        count_time_enemy_spent_controlled = champion_bucket.count_time_enemy_spent_controlled + EXCLUDED.count_time_enemy_spent_controlled
    `;
  }
}

async function upsertBotlaneDuoVsDuoStats(tx: any, payload: IngestionJobData): Promise<void> {
  const { participants, teamStats } = payload;
  const adc100 = firstBotlaneParticipant(participants, 100, "ADC");
  const sup100 = firstBotlaneParticipant(participants, 100, "SUPPORT");
  const adc200 = firstBotlaneParticipant(participants, 200, "ADC");
  const sup200 = firstBotlaneParticipant(participants, 200, "SUPPORT");
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

async function upsertTierDailySnapshots(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    await tx`
      INSERT INTO champion_tier_daily_snapshots (
        patch, role, rank_tier, region, champion_id, date_of_game,
        games, wins, count_ban
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region},
        ${participant.championId}, ${participant.gameDate},
        1, ${participantWinCount(participant)}, ${participant.bannedChampionId > 0 ? 1 : 0}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, date_of_game)
      DO UPDATE SET
        games = champion_tier_daily_snapshots.games + EXCLUDED.games,
        wins = champion_tier_daily_snapshots.wins + EXCLUDED.wins,
        count_ban = champion_tier_daily_snapshots.count_ban + EXCLUDED.count_ban
    `;
  }
}

async function upsertObjectiveOutcomeHistogram(tx: any, payload: IngestionJobData): Promise<void> {
  for (const objective of payload.teamStats.objectives) {
    const sumTs = Math.max(0, Math.trunc(Number(objective.sumTimestampMs ?? 0)));
    await tx`
      INSERT INTO objective_outcome_histogram (
        patch, rank_tier, region, team, objective_type, outcome, obj_count, count_games, sum_timestamp_ms
      )
      VALUES (
        ${payload.teamStats.patch}, ${payload.teamStats.rankTier}, ${payload.teamStats.region},
        ${objective.team}, ${objective.type}, ${objective.outcome}, ${objective.count}, 1, ${sumTs}
      )
      ON CONFLICT (patch, rank_tier, region, team, objective_type, outcome, obj_count)
      DO UPDATE SET
        count_games = objective_outcome_histogram.count_games + 1,
        sum_timestamp_ms = objective_outcome_histogram.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms,
        updated_at = NOW()
    `;
  }
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
      region = EXCLUDED.region
  `;
}

async function upsertTeamCoreStat(tx: any, payload: IngestionJobData): Promise<void> {
  await tx`
    INSERT INTO team_core_stat (
      patch, rank_tier, region, team, count_win, count_game, count_team_early_surrendered, count_team_surrendered
    )
    VALUES (
      ${payload.teamStats.patch},
      ${payload.teamStats.rankTier},
      ${payload.teamStats.region},
      100,
      ${payload.teamStats.team100Win ? 1 : 0},
      1,
      ${payload.teamStats.earlySurrendered ? 1 : 0},
      ${payload.teamStats.surrendered ? 1 : 0}
    )
    ON CONFLICT (patch, rank_tier, region, team)
    DO UPDATE SET
      count_game = team_core_stat.count_game + 1,
      count_win = team_core_stat.count_win + EXCLUDED.count_win,
      count_team_early_surrendered = team_core_stat.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = team_core_stat.count_team_surrendered + EXCLUDED.count_team_surrendered
  `;

  await tx`
    INSERT INTO team_core_stat (
      patch, rank_tier, region, team, count_win, count_game, count_team_early_surrendered, count_team_surrendered
    )
    VALUES (
      ${payload.teamStats.patch},
      ${payload.teamStats.rankTier},
      ${payload.teamStats.region},
      200,
      ${payload.teamStats.team100Win ? 0 : 1},
      1,
      ${payload.teamStats.earlySurrendered ? 1 : 0},
      ${payload.teamStats.surrendered ? 1 : 0}
    )
    ON CONFLICT (patch, rank_tier, region, team)
    DO UPDATE SET
      count_game = team_core_stat.count_game + 1,
      count_win = team_core_stat.count_win + EXCLUDED.count_win,
      count_team_early_surrendered = team_core_stat.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = team_core_stat.count_team_surrendered + EXCLUDED.count_team_surrendered
  `;
}

async function runIngestionTransaction(payload: IngestionJobData): Promise<number> {
  if (payload.participants.length === 0) return 0;

  let insertedPlayers = 0;
  await sql.begin(async (tx) => {
    await insertProcessedMatchSentinel(tx, payload);
    insertedPlayers = await upsertPlayersFromParticipants(tx, payload.participants);
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
    await upsertObjectiveOutcomeHistogram(tx, payload);
    await upsertMatchOutcomeStats(tx, payload);
    await upsertTeamCoreStat(tx, payload);
  });

  return insertedPlayers;
}

async function enqueueRankFetchJobs(participants: ParsedParticipantDto[]): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const rankJobs = participants
    .filter((p) => p.needsRankFetch)
    .map((p) => ({
      name: "fetch-rank",
      data: { puuid: p.puuid, region: p.region, matchDate: p.gameDate },
      opts: {
        jobId: `rank:${p.puuid}:${today}`,
        attempts: 2,
        backoff: { type: "fixed" as const, delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    }));

  if (rankJobs.length > 0) {
    await rankQueue.addBulk(rankJobs);
  }
}

export const ingestionWorker = new Worker<IngestionJobData>(
  INGESTION_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    pollerV2Observability.recordIngestionStart();
    try {
      const insertedPlayers = await runIngestionTransaction(job.data);
      await enqueueRankFetchJobs(job.data.participants);
      pollerV2Observability.recordIngestionSuccess(job.data.participants.length);
      if (insertedPlayers > 0) pollerV2Observability.recordPlayersAdded(insertedPlayers);
    } catch (error) {
      if (error instanceof AlreadyProcessedMatchError) {
        pollerV2Observability.recordIngestionDuplicate();
        return;
      }
      pollerV2Observability.recordIngestionFailure(error);
      throw error;
    } finally {
      pollerV2Observability.recordDuration("ingestionJobMs", Date.now() - startedAt);
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);
