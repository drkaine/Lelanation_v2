/**
 * Mappe une ligne `participants` + contexte match → ParsedParticipantDto pour l'agrégation.
 */
import type { ParsedItemDto, ParsedParticipantDto } from "../dto/match.dto.js";
import { CHAMPION_STATS_METRIC_COLUMN_SET } from "../constants/championStatsMetricColumns.js";
import { normalizeLolRole } from "../constants/lolEnums.js";
import { CHALLENGE_COLUMN_MAP } from "./normalizedMatchPersistence.js";
import {
  applyNormalizedBooleanChallenges,
  applyNormalizedBucketMetrics,
  applyNormalizedLaneMetrics,
  applyNormalizedRiotRootMetrics,
  buildU15FromNormalizedRow,
  junglePathDocForAggregation,
} from "./normalizedParticipantRehydration.js";

type ParticipantRow = Record<string, unknown>;

type MatchContext = {
  riotMatchId: string;
  patch: string;
  region: string;
  gameDate: string;
  gameDurationSec: number;
  earlySurrender: boolean;
  surrender: boolean;
};

function mapRole(teamPosition: unknown): ParsedParticipantDto["role"] {
  return normalizeLolRole(String(teamPosition ?? ""));
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function itemsFromItemHistory(raw: unknown, win: boolean): ParsedItemDto[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, number>)
    .map(([itemId, timestampMs]) => ({
      itemId: Math.trunc(Number(itemId)),
      phase: "core" as const,
      timestampMs: Math.trunc(Number(timestampMs)),
      win,
    }))
    .filter((item) => item.itemId > 0);
}

import {
  spellOrderFromHistoryDoc,
  spellTimestampSumFromHistoryDoc,
} from '../parsers/spellHistoryDoc.js'
import {
  readTeamFirstObjectiveFlags,
  type TeamFirstObjectiveFlags,
} from '../parsers/teamFirstObjectives.js'

function perksFromRow(row: ParticipantRow): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const sel = row[`primary_selection_${i}`];
    if (Array.isArray(sel)) {
      const perk = Math.trunc(Number(sel[0]));
      if (perk > 0) out.push(perk);
    }
  }
  for (const key of ["secondary_selection_1", "secondary_selection_2"] as const) {
    const sel = row[key];
    if (Array.isArray(sel)) {
      const perk = Math.trunc(Number(sel[0]));
      if (perk > 0) out.push(perk);
    }
  }
  for (const key of ["offense_perk_id", "flex_perk_id", "defense_perk_id"] as const) {
    const id = Math.trunc(Number(row[key]));
    if (id > 0) out.push(id);
  }
  return out;
}

const ROW_TO_SUM_METRIC: Record<string, string> = {
  physical_damage_dealt: "sum_physical_damage_done",
  magic_damage_dealt: "sum_magic_damage_done",
  true_damage_dealt: "sum_true_damage_done",
  total_heal: "sum_total_heal",
  total_heals_on_teammates: "sum_total_heals_on_teammates",
  total_units_healed: "sum_total_units_healed",
  wards_placed: "sum_wards_placed",
  wards_killed: "sum_wards_killed",
  detector_wards_placed: "sum_control_wards_placed",
  control_wards_placed: "sum_control_wards_placed",
  stealth_wards_placed: "sum_stealth_wards_placed",
  ward_takedowns: "sum_ward_takedowns",
  ward_takedowns_before_20m: "sum_ward_takedowns_before_20_m",
  wards_guarded: "sum_wards_guarded",
  two_wards_one_sweeper_count: "sum_two_wards_one_sweeper_count",
  vision_wards_bought_in_game: "sum_vision_wards_bought_in_game",
  total_minions_killed: "sum_total_minions_killed",
  neutral_minions_killed: "sum_neutral_minions_killed",
  total_ally_jungle_minions_killed: "sum_total_ally_jungle_minions_killed",
  total_enemy_jungle_minions_killed: "sum_total_enemy_jungle_minions_killed",
  baron_kills: "sum_baron_kills",
  dragon_kills: "sum_dragon_kills",
  inhibitor_kills: "sum_inhibitor_kills",
  turret_kills: "sum_turret_kills",
  damage_dealt_to_buildings: "sum_damage_dealt_to_buildings",
  damage_dealt_to_turrets: "sum_damage_dealt_to_turrets",
  damage_dealt_to_objectives: "sum_damage_dealt_to_objectives",
  damage_dealt_to_epic_monsters: "sum_damage_dealt_to_epic_monsters",
  all_in_pings: "sum_all_in_pings",
  assist_me_pings: "sum_assist_me_pings",
  command_pings: "sum_command_pings",
  get_back_pings: "sum_get_back_pings",
  enemy_missing_pings: "sum_enemy_missing_pings",
  enemy_vision_pings: "sum_enemy_vision_pings",
  need_vision_pings: "sum_need_vision_pings",
  on_my_way_pings: "sum_on_my_way_pings",
  push_pings: "sum_push_pings",
  retreat_pings: "sum_retreat_pings",
  vision_score: "sum_vision_score",
};

function applySumMetrics(dto: Record<string, unknown>, row: ParticipantRow): void {
  for (const col of Object.values(CHALLENGE_COLUMN_MAP)) {
    const sumKey = `sum_${col}`;
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has(sumKey) && row[col] != null) {
      dto[sumKey] = n(row[col]);
    }
  }
  for (const [col, sumKey] of Object.entries(ROW_TO_SUM_METRIC)) {
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has(sumKey) && row[col] != null) {
      dto[sumKey] = n(row[col]);
    }
  }
}

function findOpponent(
  row: ParticipantRow,
  allRows: ParticipantRow[],
): { championId: number; participantId: number; role: string } {
  const role = mapRole(row.team_position);
  const teamId = n(row.team_id);
  const opponent = allRows.find(
    (other) => n(other.team_id) !== teamId && mapRole(other.team_position) === role,
  );
  return {
    championId: n(opponent?.champion_id),
    participantId: n(opponent?.participant_id),
    role: opponent ? mapRole(opponent.team_position) : "UNKNOWN",
  };
}

function teamFirstFlagsFromRow(teamRow: ParticipantRow | undefined): TeamFirstObjectiveFlags {
  if (!teamRow) {
    return readTeamFirstObjectiveFlags(null)
  }
  return {
    teamFirstBaron: teamRow.baron_first === true,
    teamFirstDragon: teamRow.dragon_first === true,
    teamFirstTower: teamRow.tower_first === true,
    teamFirstInhibitor: teamRow.inhibitor_first === true,
    teamFirstRiftHerald: teamRow.rift_herald_first === true,
    teamFirstHorde: teamRow.horde_first === true,
  }
}

export function participantRowsToParsedDtos(
  rows: ParticipantRow[],
  match: MatchContext,
  teamRows: ParticipantRow[] = [],
): ParsedParticipantDto[] {
  const teamById = new Map<number, ParticipantRow>()
  for (const team of teamRows) {
    teamById.set(n(team.team_id), team)
  }
  const sorted = [...rows].sort((a, b) => n(a.participant_id) - n(b.participant_id));
  const rowByParticipantId = new Map<number, ParticipantRow>();
  for (const row of sorted) {
    rowByParticipantId.set(n(row.participant_id), row);
  }
  const out: ParsedParticipantDto[] = [];

  for (const row of sorted) {
    const win = row.win === true;
    const items = itemsFromItemHistory(row.item_history, win);
    const finalIds = items.map((i) => i.itemId);
    const opponent = findOpponent(row, sorted);
    const opponentRow = rowByParticipantId.get(opponent.participantId);
    const perks = perksFromRow(row);
    const gameDateIso = match.gameDate.includes("T") ? match.gameDate : `${match.gameDate}T00:00:00.000Z`;
    const teamFirst = teamFirstFlagsFromRow(teamById.get(n(row.team_id)));

    const dto: Record<string, unknown> = {
      matchId: match.riotMatchId,
      puuid: String(row.puuid ?? ""),
      patch: match.patch,
      gameDate: gameDateIso,
      gameEndTimestamp: 0,
      gameDurationSec: match.gameDurationSec,
      region: match.region,
      rankTier: "UNRANKED",
      needsRankFetch: false,
      role: mapRole(row.team_position),
      championId: n(row.champion_id),
      championTransform: n(row.champion_transform),
      transformTimestampMs: n(row.transform_timestamp_ms),
      teamId: n(row.team_id) as 100 | 200,
      win,
      firstBloodKill: row.first_blood_kill === true,
      firstBloodAssist: row.first_blood_assist === true,
      firstTowerKill: row.first_tower_kill === true,
      firstTowerAssist: row.first_tower_assist === true,
      teamFirstBaron: teamFirst.teamFirstBaron,
      teamFirstDragon: teamFirst.teamFirstDragon,
      teamFirstTower: teamFirst.teamFirstTower,
      teamFirstInhibitor: teamFirst.teamFirstInhibitor,
      teamFirstRiftHerald: teamFirst.teamFirstRiftHerald,
      teamFirstHorde: teamFirst.teamFirstHorde,
      gameEndedInEarlySurrender: match.earlySurrender,
      gameEndedInSurrender: match.surrender,
      teamEarlySurrendered: match.earlySurrender,
      kills: n(row.kills),
      deaths: n(row.deaths),
      assists: n(row.assists),
      goldEarned: n(row.gold_earned),
      goldSpent: n(row.gold_spent),
      opponentChampionId: opponent.championId,
      opponentParticipantId: opponent.participantId,
      opponentRole: opponent.role,
      spellOrder: spellOrderFromHistoryDoc(row.spell_history),
      spell1Casts: n(row.spell1_casts),
      spell2Casts: n(row.spell2_casts),
      spell3Casts: n(row.spell3_casts),
      spell4Casts: n(row.spell4_casts),
      spellLevelUpTimestampSumMs: spellTimestampSumFromHistoryDoc(row.spell_history),
      starterKey: "",
      coreKey: "",
      materialKey: "",
      bootsKey: "",
      finalKey: finalIds.join("_"),
      items,
      runeList: perks.slice(0, 6).join("_"),
      shardList: perks.slice(6).join("_"),
      perks,
      spellD: n(row.summoner1_id),
      spellF: n(row.summoner2_id),
      spellDCasts: n(row.summoner1_casts),
      spellFCasts: n(row.summoner2_casts),
      rankTierValue: "UNRANKED",
      rankDivision: "",
      lp: 0,
      bannedChampionId: n(row.id_champion_ban),
      pickOrder: 0,
      jungleCampHistory: junglePathDocForAggregation(row.jungle_camp_history),
      u15: buildU15FromNormalizedRow(row, opponent.participantId),
    };

    applySumMetrics(dto, row);
    applyNormalizedBooleanChallenges(dto, row);
    applyNormalizedRiotRootMetrics(dto, row);
    applyNormalizedBucketMetrics(dto, row, match.gameDurationSec);
    applyNormalizedLaneMetrics(dto, row, opponentRow, opponent.participantId);

    const pinkWards = Math.max(n(row.detector_wards_placed), n(row.control_wards_placed));
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has("sum_detector_wards_placed")) {
      dto.sum_detector_wards_placed = pinkWards;
    }

    const visionScore = n(row.vision_score);
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has("sum_vision_score")) {
      dto.sum_vision_score = visionScore;
    }
    const durationMin = Math.max(1, match.gameDurationSec / 60);
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has("sum_vision_score_per_minute")) {
      dto.sum_vision_score_per_minute = visionScore / durationMin;
    }

    out.push(dto as ParsedParticipantDto);
  }

  return out;
}
