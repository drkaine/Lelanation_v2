/**
 * Réhydrate les champs ParsedParticipantDto depuis une ligne `participants` normalisée
 * (chemin agrégation sans re-parse timeline live).
 */
import { CHAMPION_STATS_METRIC_COLUMN_SET } from "../constants/championStatsMetricColumns.js";
import { isBootsItemId, isBootsTier2Or3ItemId } from "../parsers/bootItemClassification.js";
import { isLegendaryCompleteItem } from "../parsers/itemLegendaryClassification.js";
import { readEarlyPath, type JungleCampHistoryDoc } from "../parsers/junglePathExtract.js";

type Row = Record<string, unknown>;

const U15_MS = 900_000;
const CONSUMABLE_IDS = new Set([2003, 2009, 2010, 2031, 2032, 2033, 2055, 2060]);

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function tb(v: unknown): boolean {
  return v === true;
}

function setDtoMetric(dto: Record<string, unknown>, key: string, value: number): void {
  dto[key] = value;
}

const BOOLEAN_CHALLENGE_TO_SUM: Record<string, string> = {
  lost_an_inhibitor: "sum_lost_an_inhibitor",
  mejais_full_stack_in_time: "sum_mejais_full_stack_in_time",
  perfect_dragon_souls_taken: "sum_perfect_dragon_souls_taken",
  perfect_game: "sum_perfect_game",
  quick_first_turret: "sum_quick_first_turret",
};

/** Stats Riot racine absentes de CHALLENGE_COLUMN_MAP. */
export const NORMALIZED_RIOT_ROOT_TO_SUM: Record<string, string> = {
  champ_experience: "sum_champ_experience",
  champ_level: "sum_champ_level",
  consumables_purchased: "sum_consumables_purchased",
  double_kills: "sum_double_kills",
  triple_kills: "sum_triple_kills",
  quadra_kills: "sum_quadra_kills",
  penta_kills: "sum_penta_kills",
  killing_sprees: "sum_killing_sprees",
  largest_killing_spree: "sum_largest_killing_spree",
  largest_multi_kill: "sum_largest_multi_kill",
  longest_time_spent_living: "sum_longest_time_spent_living",
  inhibitor_takedowns: "sum_inhibitor_takedowns",
  inhibitors_lost: "sum_inhibitors_lost",
  nexus_kills: "sum_nexus_kills",
  nexus_takedowns: "sum_nexus_takedowns",
  objectives_stolen: "sum_objectives_stolen",
  objectives_stolen_assists: "sum_objectives_stolen_assists",
  time_ccing_others: "sum_time_ccing_others",
  time_played: "sum_time_played",
  total_time_cc_dealt: "sum_total_time_cc_dealt",
  total_time_spent_dead: "sum_total_time_spent_dead",
  total_damage_shielded_on_teammates: "sum_total_damage_shielded_on_teammates",
  turret_takedowns: "sum_turret_takedowns",
  turrets_lost: "sum_turrets_lost",
  largest_critical_strike: "sum_largest_critical_strike",
};

function bucketIndex(minute: number): number {
  return Math.trunc(minute / 5) - 1;
}

function bucketValue(raw: unknown, minute: number): number {
  if (!Array.isArray(raw)) return 0;
  const idx = bucketIndex(minute);
  if (idx < 0 || idx >= raw.length) return 0;
  return n(raw[idx]);
}

type HistoryEntry = { timestamp_ms?: unknown; kill_who?: unknown; death_by?: unknown };

function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object") as HistoryEntry[];
}

function countHistoryTargetBefore(
  history: HistoryEntry[],
  targetId: number,
  cutoffMs: number,
  field: "kill_who" | "death_by",
): number {
  let count = 0;
  for (const row of history) {
    if (n(row.timestamp_ms) >= cutoffMs) continue;
    if (n(row[field]) === targetId) count += 1;
  }
  return count;
}

function wardScoreFromHistories(row: Row, cutoffMs: number): number {
  let score = 0;
  for (const entry of parseHistory(row.ward_history)) {
    if (n(entry.timestamp_ms) >= cutoffMs) continue;
    score += 1;
  }
  for (const entry of parseHistory(row.ward_killed_history)) {
    if (n(entry.timestamp_ms) >= cutoffMs) continue;
    score += 1;
  }
  return score;
}

function itemsFromHistory(raw: unknown): Array<{ itemId: number; timestampMs: number }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, number>)
    .map(([itemId, timestampMs]) => ({
      itemId: Math.trunc(Number(itemId)),
      timestampMs: Math.trunc(Number(timestampMs)),
    }))
    .filter((item) => item.itemId > 0)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function firstPurchaseTimestamp(
  items: Array<{ itemId: number; timestampMs: number }>,
  predicate: (itemId: number) => boolean,
): number {
  for (const item of items) {
    if (predicate(item.itemId)) return item.timestampMs;
  }
  return 0;
}

function countConsumablePurchases(items: Array<{ itemId: number; timestampMs: number }>): number {
  return items.filter((item) => CONSUMABLE_IDS.has(item.itemId)).length;
}

function applyMinuteLaneDiffs(
  dto: Record<string, unknown>,
  self: Row,
  opp: Row,
  minute: number,
): void {
  const suffix = `${minute}min`;
  const selfGold = bucketValue(self.gold_buckets, minute);
  const oppGold = bucketValue(opp.gold_buckets, minute);
  const selfCs = bucketValue(self.cs_buckets, minute);
  const oppCs = bucketValue(opp.cs_buckets, minute);
  const selfLevel = bucketValue(self.level_buckets, minute);
  const oppLevel = bucketValue(opp.level_buckets, minute);
  const selfXp = bucketValue(self.xp_buckets, minute);
  const oppXp = bucketValue(opp.xp_buckets, minute);
  const selfGoldSpent = bucketValue(self.gold_spent_buckets, minute);
  const oppGoldSpent = bucketValue(opp.gold_spent_buckets, minute);
  const visionSelf = wardScoreFromHistories(self, minute * 60_000);
  const visionOpp = wardScoreFromHistories(opp, minute * 60_000);

  setDtoMetric(dto, `sum_gold_difference_${suffix}`, selfGold - oppGold);
  setDtoMetric(dto, `sum_gold_spent_${suffix}`, selfGoldSpent);
  setDtoMetric(dto, `sum_gold_spent_by_opponent_${suffix}`, oppGoldSpent);
  setDtoMetric(dto, `sum_gold_possessed_${suffix}`, selfGold);
  setDtoMetric(dto, `sum_gold_possessed_by_opponent_${suffix}`, oppGold);
  setDtoMetric(dto, `sum_cs_difference_${suffix}`, selfCs - oppCs);
  setDtoMetric(dto, `sum_cs_${suffix}`, selfCs);
  setDtoMetric(dto, `sum_cs_opponent_${suffix}`, oppCs);
  setDtoMetric(dto, `sum_level_${suffix}`, selfLevel);
  setDtoMetric(dto, `sum_level_opponent_${suffix}`, oppLevel);
  setDtoMetric(dto, `sum_xp_${suffix}`, selfXp);
  setDtoMetric(dto, `sum_xp_opponent_${suffix}`, oppXp);
  setDtoMetric(dto, `sum_vision_${suffix}`, visionSelf);
  setDtoMetric(dto, `sum_vision_opponent_${suffix}`, visionOpp);
  setDtoMetric(dto, `sum_vision_score_difference_${suffix}`, visionSelf - visionOpp);
}

function applyLaneEventColumns(dto: Record<string, unknown>, self: Row, opp: Row): void {
  const selfToOpp: Array<[string, string]> = [
    ["kill_by_dive", "sum_kill_by_dive"],
    ["death_by_dive", "sum_death_by_dive"],
    ["kill_by_gank", "sum_kill_by_gank"],
    ["death_by_gank", "sum_death_by_gank"],
    ["kill_by_roaming", "sum_kill_by_roaming"],
    ["death_by_roaming", "sum_death_by_roaming"],
    ["kill_on_objective", "sum_kill_on_objective"],
    ["death_on_objective", "sum_death_on_objective"],
  ];
  const oppToSelf: Array<[string, string]> = [
    ["kill_by_dive", "sum_kill_by_dive_by_opponent"],
    ["death_by_dive", "sum_death_by_dive_by_opponent"],
    ["kill_by_gank", "sum_kill_by_gank_by_opponent"],
    ["death_by_gank", "sum_death_by_gank_by_opponent"],
    ["kill_by_roaming", "sum_kill_by_roaming_by_opponent"],
    ["death_by_roaming", "sum_death_by_roaming_by_opponent"],
    ["kill_on_objective", "sum_kill_on_objective_by_opponent"],
    ["death_on_objective", "sum_death_on_objective_by_opponent"],
  ];

  for (const [col, sumKey] of selfToOpp) setDtoMetric(dto, sumKey, n(self[col]));
  for (const [col, sumKey] of oppToSelf) setDtoMetric(dto, sumKey, n(opp[col]));
}

function applyKillDeathOpponentMinutes(
  dto: Record<string, unknown>,
  self: Row,
  opponentParticipantId: number,
): void {
  if (opponentParticipantId <= 0) return;
  const kills = parseHistory(self.kill_history);
  const deaths = parseHistory(self.death_history);
  for (const minute of [5, 10, 15] as const) {
    const cutoff = minute * 60_000;
    setDtoMetric(
      dto,
      `sum_kill_opponent_${minute}min`,
      countHistoryTargetBefore(kills, opponentParticipantId, cutoff, "kill_who"),
    );
    setDtoMetric(
      dto,
      `sum_death_by_opponent_${minute}min`,
      countHistoryTargetBefore(deaths, opponentParticipantId, cutoff, "death_by"),
    );
  }
}

function applyItemTimingLaneMetrics(dto: Record<string, unknown>, self: Row, opp: Row): void {
  const selfItems = itemsFromHistory(self.item_history);
  const oppItems = itemsFromHistory(opp.item_history);
  const selfFinal = new Set(selfItems.map((i) => i.itemId));

  const selfLegendaryTs = firstPurchaseTimestamp(selfItems, (id) =>
    isLegendaryCompleteItem(id, selfFinal),
  );
  const oppLegendaryTs = firstPurchaseTimestamp(oppItems, (id) =>
    isLegendaryCompleteItem(id, new Set(oppItems.map((i) => i.itemId))),
  );
  if (selfLegendaryTs > 0) setDtoMetric(dto, "sum_buy_legendary_item_timestamp", selfLegendaryTs);
  if (oppLegendaryTs > 0) {
    setDtoMetric(dto, "sum_opponent_buy_legendary_item_timestamp", oppLegendaryTs);
  }
  if (selfLegendaryTs > 0 && (oppLegendaryTs === 0 || selfLegendaryTs < oppLegendaryTs)) {
    setDtoMetric(dto, "sum_have_legendary_item_first", 1);
  }
  if (oppLegendaryTs > 0 && (selfLegendaryTs === 0 || oppLegendaryTs < selfLegendaryTs)) {
    setDtoMetric(dto, "sum_opponent_have_legendary_item_first", 1);
  }

  const selfBootsTs = firstPurchaseTimestamp(selfItems, isBootsItemId);
  const oppBootsTs = firstPurchaseTimestamp(oppItems, isBootsItemId);
  if (selfBootsTs > 0) setDtoMetric(dto, "sum_buy_boots_item_timestamp", selfBootsTs);
  if (oppBootsTs > 0) setDtoMetric(dto, "sum_opponent_buy_boots_item_timestamp", oppBootsTs);
  if (selfBootsTs > 0 && (oppBootsTs === 0 || selfBootsTs < oppBootsTs)) {
    setDtoMetric(dto, "sum_have_boots_item_first", 1);
  }
  if (oppBootsTs > 0 && (selfBootsTs === 0 || oppBootsTs < selfBootsTs)) {
    setDtoMetric(dto, "sum_opponent_have_boots_item_first", 1);
  }

  const selfBootsT2Ts = firstPurchaseTimestamp(selfItems, isBootsTier2Or3ItemId);
  const oppBootsT2Ts = firstPurchaseTimestamp(oppItems, isBootsTier2Or3ItemId);
  if (selfBootsT2Ts > 0) setDtoMetric(dto, "sum_buy_boots_tier2_item_timestamp", selfBootsT2Ts);
  if (oppBootsT2Ts > 0) {
    setDtoMetric(dto, "sum_opponent_buy_boots_tier2_item_timestamp", oppBootsT2Ts);
  }
  if (selfBootsT2Ts > 0 && (oppBootsT2Ts === 0 || selfBootsT2Ts < oppBootsT2Ts)) {
    setDtoMetric(dto, "sum_have_boots_tier2_item_first", 1);
  }
  if (oppBootsT2Ts > 0 && (selfBootsT2Ts === 0 || oppBootsT2Ts < selfBootsT2Ts)) {
    setDtoMetric(dto, "sum_opponent_have_boots_tier2_item_first", 1);
  }

  setDtoMetric(dto, "sum_consumable_item_bought", countConsumablePurchases(selfItems));
  setDtoMetric(dto, "sum_consumable_item_bought_by_opponent", countConsumablePurchases(oppItems));
}

function applyTowerAndObjectiveExtras(dto: Record<string, unknown>, self: Row, opp: Row): void {
  if (self.first_tower_kill === true || self.first_tower_assist === true) {
    setDtoMetric(dto, "sum_first_tower", 1);
  }
  if (opp.first_tower_kill === true || opp.first_tower_assist === true) {
    setDtoMetric(dto, "sum_first_tower_by_opponent", 1);
  }
  setDtoMetric(dto, "sum_turret_plate_taken", n(self.turret_plates_taken));
  setDtoMetric(dto, "sum_turret_plate_taken_by_opponent", n(opp.turret_plates_taken));
  setDtoMetric(dto, "sum_objective_stolen", n(self.epic_monster_steals));
  setDtoMetric(dto, "sum_objective_stolen_by_opponent", n(opp.epic_monster_steals));
}

export function applyNormalizedLaneMetrics(
  dto: Record<string, unknown>,
  self: Row,
  opp: Row | undefined,
  opponentParticipantId: number,
): void {
  if (!opp) return;
  for (const minute of [5, 10, 15] as const) {
    applyMinuteLaneDiffs(dto, self, opp, minute);
  }
  applyLaneEventColumns(dto, self, opp);
  applyKillDeathOpponentMinutes(dto, self, opponentParticipantId);
  applyItemTimingLaneMetrics(dto, self, opp);
  applyTowerAndObjectiveExtras(dto, self, opp);
}

export function applyNormalizedBooleanChallenges(dto: Record<string, unknown>, row: Row): void {
  for (const [col, sumKey] of Object.entries(BOOLEAN_CHALLENGE_TO_SUM)) {
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has(sumKey)) {
      dto[sumKey] = tb(row[col]) ? 1 : 0;
    }
  }
}

export function applyNormalizedRiotRootMetrics(dto: Record<string, unknown>, row: Row): void {
  for (const [col, sumKey] of Object.entries(NORMALIZED_RIOT_ROOT_TO_SUM)) {
    if (CHAMPION_STATS_METRIC_COLUMN_SET.has(sumKey) && row[col] != null) {
      dto[sumKey] = n(row[col]);
    }
  }
  const durationMin = Math.max(1, n(dto.gameDurationSec) / 60);
  if (CHAMPION_STATS_METRIC_COLUMN_SET.has("sum_damage_per_minute")) {
    const dmg =
      n(row.physical_damage_dealt) + n(row.magic_damage_dealt) + n(row.true_damage_dealt);
    dto.sum_damage_per_minute = dmg / durationMin;
  }
  if (CHAMPION_STATS_METRIC_COLUMN_SET.has("sum_gold_per_minute")) {
    dto.sum_gold_per_minute = n(row.gold_earned) / durationMin;
  }
}

export function applyNormalizedBucketMetrics(
  dto: Record<string, unknown>,
  row: Row,
  gameDurationSec: number,
): void {
  dto.sum_game_length = Math.max(0, Math.trunc(gameDurationSec));

  const lastGoldIdx = Array.isArray(row.gold_buckets) ? row.gold_buckets.length - 1 : -1;
  const lastGold =
    lastGoldIdx >= 0 && Array.isArray(row.gold_buckets) ? n(row.gold_buckets[lastGoldIdx]) : 0;
  setDtoMetric(dto, "sum_current_gold", lastGold > 0 ? lastGold : n(row.gold_earned));

  const kill10 = bucketValue(row.kill_buckets, 10);
  const death10 = bucketValue(row.death_buckets, 10);
  const kill20 = bucketValue(row.kill_buckets, 20);
  const death20 = bucketValue(row.death_buckets, 20);
  setDtoMetric(dto, "sum_kd_diff_10", kill10 - death10);
  setDtoMetric(dto, "sum_kd_diff_20", kill20 - death20);

  const dmgMinute = 15;
  setDtoMetric(dto, "sum_physical_damage_done_to_champion", bucketValue(row.physical_damage_buckets, dmgMinute));
  setDtoMetric(dto, "sum_magic_damage_done_to_champion", bucketValue(row.magic_damage_buckets, dmgMinute));
  setDtoMetric(dto, "sum_true_damage_done_to_champion", bucketValue(row.true_damage_buckets, dmgMinute));
  setDtoMetric(dto, "sum_physical_damage_taken", bucketValue(row.physical_damage_taken_buckets, dmgMinute));
  setDtoMetric(dto, "sum_magic_damage_taken", bucketValue(row.magic_damage_taken_buckets, dmgMinute));
  setDtoMetric(dto, "sum_true_damage_taken", bucketValue(row.true_damage_taken_buckets, dmgMinute));
  setDtoMetric(dto, "sum_level", bucketValue(row.level_buckets, dmgMinute) || n(row.champ_level));
  setDtoMetric(
    dto,
    "sum_jungle_minions_killed",
    bucketValue(row.jungle_buckets, dmgMinute) || n(row.neutral_minions_killed),
  );

  const ccBuckets = row.cc_time_buckets;
  if (Array.isArray(ccBuckets) && ccBuckets.length > 0) {
    const ccTotal = ccBuckets.reduce((acc: number, v) => acc + n(v), 0);
    setDtoMetric(dto, "sum_time_enemy_spent_controlled", ccTotal);
  }
}

export function buildU15FromNormalizedRow(row: Row, _opponentParticipantId: number): Record<string, number> {
  const minute = 15;
  const cutoff = U15_MS;
  const kills = parseHistory(row.kill_history);
  const deaths = parseHistory(row.death_history);
  const assists = parseHistory(row.assist_history);

  let killCount = 0;
  let deathCount = 0;
  let assistCount = 0;
  for (const entry of kills) {
    if (n(entry.timestamp_ms) < cutoff) killCount += 1;
  }
  for (const entry of deaths) {
    if (n(entry.timestamp_ms) < cutoff) deathCount += 1;
  }
  for (const entry of assists) {
    if (n(entry.timestamp_ms) < cutoff) assistCount += 1;
  }

  return {
    goldEarned: bucketValue(row.gold_buckets, minute),
    cs: bucketValue(row.cs_buckets, minute),
    kills: killCount,
    deaths: deathCount,
    assists: assistCount,
    visionScore: n(row.vision_score),
    physDmgToChampion: bucketValue(row.physical_damage_buckets, minute),
    magicDmgToChampion: bucketValue(row.magic_damage_buckets, minute),
    trueDmgToChampion: bucketValue(row.true_damage_buckets, minute),
    shieldAndHeal: n(row.effective_heal_and_shielding),
  };
}

export function readJungleCampHistoryDoc(raw: unknown): JungleCampHistoryDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as JungleCampHistoryDoc;
  if (!Array.isArray(doc.camps)) return null;
  return doc;
}

export function junglePathDocForAggregation(raw: unknown): JungleCampHistoryDoc | null {
  const doc = readJungleCampHistoryDoc(raw);
  if (!doc) return null;
  const early = readEarlyPath(doc);
  return {
    camps: doc.camps,
    early_path: early
      ? {
          path_sequence: early.pathSequence,
          path_hash: early.pathHash,
          clear_time_ms: early.clearTimeMs,
        }
      : doc.early_path ?? null,
  };
}
