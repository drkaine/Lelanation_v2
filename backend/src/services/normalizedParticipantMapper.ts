/**
 * Mappe une ligne `participants` + contexte match → ParsedParticipantDto pour l'agrégation.
 */
import type { ParsedItemDto, ParsedParticipantDto } from "../dto/match.dto.js";
import { CHAMPION_STATS_METRIC_COLUMN_SET } from "../constants/championStatsMetricColumns.js";
import { normalizeLolRole } from "../constants/lolEnums.js";
import { CHALLENGE_COLUMN_MAP } from "./normalizedMatchPersistence.js";

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

function spellOrderFromHistory(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return Object.entries(raw as Record<string, number>)
    .sort(([, a], [, b]) => a - b)
    .map(([slot]) => slot)
    .join("-");
}

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
  total_minions_killed: "sum_total_minions_killed",
  baron_kills: "sum_baron_kills",
  dragon_kills: "sum_dragon_kills",
  inhibitor_kills: "sum_inhibitor_kills",
  turret_kills: "sum_turret_kills",
  damage_dealt_to_buildings: "sum_damage_dealt_to_buildings",
  damage_dealt_to_turrets: "sum_damage_dealt_to_turrets",
  damage_dealt_to_objectives: "sum_damage_dealt_to_objectives",
  damage_dealt_to_epic_monsters: "sum_damage_dealt_to_epic_monsters",
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

export function participantRowsToParsedDtos(
  rows: ParticipantRow[],
  match: MatchContext,
): ParsedParticipantDto[] {
  const sorted = [...rows].sort((a, b) => n(a.participant_id) - n(b.participant_id));
  const out: ParsedParticipantDto[] = [];

  for (const row of sorted) {
    const win = row.win === true;
    const items = itemsFromItemHistory(row.item_history, win);
    const finalIds = items.map((i) => i.itemId);
    const opponent = findOpponent(row, sorted);
    const perks = perksFromRow(row);
    const gameDateIso = match.gameDate.includes("T") ? match.gameDate : `${match.gameDate}T00:00:00.000Z`;

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
      spellOrder: spellOrderFromHistory(row.spell_history),
      spell1Casts: n(row.spell1_casts),
      spell2Casts: n(row.spell2_casts),
      spell3Casts: n(row.spell3_casts),
      spell4Casts: n(row.spell4_casts),
      spellLevelUpTimestampSumMs: 0,
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
      u15: {
        goldEarned: 0,
        cs: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        visionScore: 0,
        physDmgToChampion: 0,
        magicDmgToChampion: 0,
        trueDmgToChampion: 0,
        shieldAndHeal: 0,
      },
    };

    applySumMetrics(dto, row);
    out.push(dto as ParsedParticipantDto);
  }

  return out;
}
