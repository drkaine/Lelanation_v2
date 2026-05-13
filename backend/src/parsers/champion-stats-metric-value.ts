import type { ChampionStatsMetricColumn } from "../constants/championStatsMetricColumns.js";
import type { ParsedParticipantDto } from "../dto/match.dto.js";

/**
 * Colonnes `champion_stats` en double precision (migration 0008) : challenges Riot
 * ou agrégats « par minute » / temps souvent non entiers sur match-id.json de référence.
 * Analyse : `npx tsx scripts/analyzeParsedMetricFractions.ts`
 */
export const CHAMPION_STATS_DOUBLE_METRIC_COLUMNS = new Set<string>([
  "sum_bounty_gold",
  "sum_max_level_lead_lane_opponent",
  "sum_max_kill_deficit",
  "sum_more_enemy_jungle_than_opponent",
  "sum_max_cs_advantage_on_lane_opponent",
  "sum_vision_score_advantage_lane_opponent",
  "sum_laning_phase_gold_exp_advantage",
  "sum_early_laning_phase_gold_exp_advantage",
  "sum_damage_per_minute",
  "sum_effective_heal_and_shielding",
  "sum_earliest_baron",
  "sum_first_turret_killed_time",
  "sum_game_length",
  "sum_gold_per_minute",
  "sum_vision_score_per_minute",
]);

function metricRaw(participant: ParsedParticipantDto, key: string): number {
  const raw = (participant as Record<string, unknown>)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Valeur d’agrégat pour une colonne `champion_stats` (une partie de match). */
export function championStatsMetricValue(
  participant: ParsedParticipantDto,
  col: ChampionStatsMetricColumn,
): number {
  switch (col) {
    case "sum_gold_earned":
      return Math.trunc(Number(participant.goldEarned) || 0);
    case "sum_gold_spent":
      return Math.trunc(Number(participant.goldSpent) || 0);
    case "sum_kills":
      return Math.trunc(Number(participant.kills) || 0);
    case "sum_assists":
      return Math.trunc(Number(participant.assists) || 0);
    case "count_first_blood_kill_true":
      return participant.firstBloodKill ? 1 : 0;
    case "count_first_blood_assist_true":
      return participant.firstBloodAssist ? 1 : 0;
    case "count_first_tower_kill_true":
      return participant.firstTowerKill ? 1 : 0;
    case "count_first_tower_assist_true":
      return participant.firstTowerAssist ? 1 : 0;
    case "sum_game_ended_in_early_surrender":
      return participant.gameEndedInEarlySurrender ? 1 : 0;
    case "sum_game_ended_in_surrender":
      return participant.gameEndedInSurrender ? 1 : 0;
    case "sum_team_early_surrendered":
      return participant.teamEarlySurrendered ? 1 : 0;
    case "count_time_enemy_spent_controlled":
      return metricRaw(participant, "sum_time_enemy_spent_controlled") > 0 ? 1 : 0;
    default: {
      const x = metricRaw(participant, col);
      if (CHAMPION_STATS_DOUBLE_METRIC_COLUMNS.has(col)) return x;
      return Math.trunc(x);
    }
  }
}
