/**
 * Persistance normalisée à l'ingestion : matchs / teams / participants (INSERT only).
 * `match_aggregated` est créé uniquement après agrégation réussie (`insertMatchAggregated`).
 */
import type { Sql, TransactionSql } from "postgres";
import type { ParsedParticipantDto } from "../dto/match.dto.js";
import { parseMatch } from "../parsers/match.parser.js";
import { countTeamDrakeAndSoulMetrics } from "../parsers/team-objective-histogram.js";
import {
  extractParticipantTimelineData,
  extractTeamObjectiveHistogram,
} from "../parsers/matchTimelineExtract.js";
import { toJungleCampHistoryDoc } from "../parsers/junglePathExtract.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { classifyParticipantLaneEvents, toParticipantMeta } from "../analysis/timelineAdapter.js";
import type { ChallengesDto, MatchDto, MatchTimelineDto, ParticipantDto, TeamDto } from "../riot/types.js";

function ti(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function tf(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function tb(v: unknown): boolean {
  return v === true;
}

/** Riot challenge flags are sent as booleans or 0/1 integers. */
function challengeBool(v: unknown): boolean {
  return v === true || v === 1;
}


function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) return "unknown";
  return `${major}.${minor}`;
}

function gameDateFromMatch(match: MatchDto): string {
  const ts =
    Number(match.info?.gameStartTimestamp ?? 0) ||
    Number(match.info?.gameCreation ?? 0) ||
    Date.now();
  const date = new Date(ts);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function perkSelections(style: { selections?: Array<{ perk: number; var1: number; var2: number; var3: number }> } | undefined): number[][] {
  const selections = style?.selections ?? [];
  return selections.map((s) => [ti(s.perk), ti(s.var1), ti(s.var2), ti(s.var3)]);
}

/** Colonnes participants mappées depuis challenges (camelCase → snake_case SQL). */
export const CHALLENGE_COLUMN_MAP: Record<string, string> = {
  "12AssistStreakCount": "assist_streak_count",
  InfernalScalePickup: "infernal_scale_pickup",
  HealFromMapSources: "heal_from_map_sources",
  abilityUses: "ability_uses",
  acesBefore15Minutes: "aces_before_15_minutes",
  baronTakedowns: "baron_takedowns",
  blastConeOppositeOpponentCount: "blast_cone_opposite_opponent_count",
  bountyGold: "bounty_gold",
  buffsStolen: "buffs_stolen",
  completeSupportQuestInTime: "complete_support_quest_in_time",
  controlWardsPlaced: "control_wards_placed",
  deathsByEnemyChamps: "deaths_by_enemy_champs",
  dodgeSkillShotsSmallWindow: "dodge_skill_shots_small_window",
  doubleAces: "double_aces",
  dragonTakedowns: "dragon_takedowns",
  earliestBaron: "earliest_baron",
  earlyLaningPhaseGoldExpAdvantage: "early_laning_phase_gold_exp_advantage",
  effectiveHealAndShielding: "effective_heal_and_shielding",
  elderDragonKillsWithOpposingSoul: "elder_dragon_kills_with_opposing_soul",
  elderDragonMultikills: "elder_dragon_multikills",
  enemyChampionImmobilizations: "enemy_champion_immobilizations",
  epicMonsterKillsNearEnemyJungler: "epic_monster_kills_near_enemy_jungler",
  epicMonsterKillsWithin30SecondsOfSpawn: "epic_monster_kills_within_30_seconds_of_spawn",
  epicMonsterSteals: "epic_monster_steals",
  epicMonsterStolenWithoutSmite: "epic_monster_stolen_without_smite",
  firstTurretKilled: "first_turret_killed",
  firstTurretKilledTime: "first_turret_killed_time",
  flawlessAces: "flawless_aces",
  fullTeamTakedown: "full_team_takedown",
  getTakedownsInAllLanesEarlyJungleAsLaner: "get_takedowns_in_all_lanes_early_jungle_as_laner",
  hadOpenNexus: "had_open_nexus",
  immobilizeAndKillWithAlly: "immobilize_and_kill_with_ally",
  initialBuffCount: "initial_buff_count",
  initialCrabCount: "initial_crab_count",
  jungleCsBefore10Minutes: "jungle_cs_before_10_minutes",
  junglerKillsEarlyJungle: "jungler_takedowns_near_damaged_epic_monster",
  killAfterHiddenWithAlly: "kill_after_hidden_with_ally",
  killedChampTookFullTeamDamageSurvived: "killed_champ_took_full_team_damage_survived",
  killsNearEnemyTurret: "kills_near_enemy_turret",
  killsOnOtherLanesEarlyJungleAsLaner: "kills_on_other_lanes_early_jungle_as_laner",
  killsUnderOwnTurret: "kills_under_own_turret",
  killsWithHelpFromEpicMonster: "kills_with_help_from_epic_monster",
  knockEnemyIntoTeamAndKill: "knock_enemy_into_team_and_kill",
  landSkillShotsEarlyGame: "land_skill_shots_early_game",
  laneMinionsFirst10Minutes: "lane_minions_first_10_minutes",
  laningPhaseGoldExpAdvantage: "laning_phase_gold_exp_advantage",
  maxCsAdvantageOnLaneOpponent: "max_cs_advantage_on_lane_opponent",
  maxKillDeficit: "max_kill_deficit",
  maxLevelLeadLaneOpponent: "max_level_lead_lane_opponent",
  moreEnemyJungleThanOpponent: "more_enemy_jungle_than_opponent",
  multiKillOneSpell: "multi_kill_one_spell",
  multiTurretRiftHeraldCount: "multi_turret_rift_herald_count",
  multikills: "multikills",
  multikillsAfterAggressiveFlash: "multikills_after_aggressive_flash",
  outerTurretExecutesBefore10Minutes: "outer_turret_executes_before_10_minutes",
  outnumberedKills: "outnumbered_kills",
  outnumberedNexusKill: "outnumbered_nexus_kill",
  pickKillWithAlly: "pick_kill_with_ally",
  playedChampSelectPosition: "played_champ_select_position",
  quickCleanse: "quick_cleanse",
  quickSoloKills: "quick_solo_kills",
  riftHeraldTakedowns: "rift_herald_takedowns",
  saveAllyFromDeath: "save_ally_from_death",
  scuttleCrabKills: "scuttle_crab_kills",
  skillshotsDodged: "skillshots_dodged",
  skillshotsHit: "skillshots_hit",
  soloBaronKills: "solo_baron_kills",
  soloKills: "solo_kills",
  soloTurretsLategame: "solo_turrets_lategame",
  stealthWardsPlaced: "stealth_wards_placed",
  survivedSingleDigitHpCount: "survived_single_digit_hp_count",
  survivedThreeImmobilizesInFight: "survived_three_immobilizes_in_fight",
  takedownOnFirstTurret: "takedown_on_first_turret",
  takedowns: "takedowns",
  takedownsAfterGainingLevelAdvantage: "takedowns_after_gaining_level_advantage",
  takedownsBeforeJungleMinionSpawn: "takedowns_before_jungle_minion_spawn",
  takedownsFirstXMinutes: "takedowns_first_x_minutes",
  takedownsInAlcove: "takedowns_in_alcove",
  takedownsInEnemyFountain: "takedowns_in_enemy_fountain",
  tookLargeDamageSurvived: "took_large_damage_survived",
  turretPlatesTaken: "turret_plates_taken",
  turretsTakenWithRiftHerald: "turrets_taken_with_rift_herald",
  twoWardsOneSweeperCount: "two_wards_one_sweeper_count",
  unseenRecalls: "unseen_recalls",
  voidMonsterKill: "void_monster_kill",
  visionScoreAdvantageLaneOpponent: "vision_score_advantage_lane_opponent",
  wardTakedowns: "ward_takedowns",
  wardTakedownsBefore20M: "ward_takedowns_before_20m",
  wardsGuarded: "wards_guarded",
};

const PARTICIPANT_FLOAT_COLUMNS = new Set([
  "heal_from_map_sources",
  "early_laning_phase_gold_exp_advantage",
  "effective_heal_and_shielding",
  "laning_phase_gold_exp_advantage",
  "vision_score_advantage_lane_opponent",
]);

function challengeNumericForColumn(col: string, raw: number): number {
  if (PARTICIPANT_FLOAT_COLUMNS.has(col)) return tf(raw);
  return ti(raw);
}

function isValidParticipantColumn(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

function applyChallengesToRow(row: Record<string, unknown>, challenges: ChallengesDto | undefined): void {
  if (!challenges) return;
  for (const [key, raw] of Object.entries(challenges)) {
    const col = CHALLENGE_COLUMN_MAP[key];
    if (!col || !isValidParticipantColumn(col)) continue;
    if (col in row) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    row[col] = challengeNumericForColumn(col, raw);
  }
  if (challenges.lostAnInhibitor != null) row.lost_an_inhibitor = challengeBool(challenges.lostAnInhibitor);
  if (challenges.mejaisFullStackInTime != null) {
    row.mejais_full_stack_in_time = challengeBool(challenges.mejaisFullStackInTime);
  }
  if (challenges.perfectDragonSoulsTaken != null) {
    row.perfect_dragon_souls_taken = challengeBool(challenges.perfectDragonSoulsTaken);
  }
  if (challenges.perfectGame != null) row.perfect_game = challengeBool(challenges.perfectGame);
  if (challenges.quickFirstTurret != null) row.quick_first_turret = challengeBool(challenges.quickFirstTurret);
}

function buildParticipantRow(
  matchId: string,
  participant: ParticipantDto,
  timeline: MatchTimelineDto,
  bannedChampionId: number,
  transformTimestampMs: number,
): Record<string, unknown> {
  const gameDurationSec = Math.max(0, ti(participant.timePlayed));
  const timelineData = extractParticipantTimelineData(timeline, participant.participantId, gameDurationSec);
  const perks = participant.perks;
  const primaryStyle = perks?.styles?.find((s) => s.description === "primaryStyle");
  const secondaryStyle = perks?.styles?.find((s) => s.description === "subStyle");
  const primarySelections = perkSelections(primaryStyle);
  const secondarySelections = perkSelections(secondaryStyle);

  const teamPosition = String(participant.teamPosition ?? "").trim().toUpperCase();

  const row: Record<string, unknown> = {
    riot_match_id: matchId,
    participant_id: ti(participant.participantId),
    puuid: String(participant.puuid ?? ""),
    riot_id_game_name: String(participant.riotIdGameName ?? participant.summonerName ?? ""),
    riot_id_tagline: String(participant.riotIdTagline ?? ""),
    team_id: ti(participant.teamId),
    team_position: String(participant.teamPosition ?? ""),
    id_champion_ban: bannedChampionId,
    all_in_pings: ti(participant.allInPings),
    assist_me_pings: ti(participant.assistMePings),
    assists: ti(participant.assists),
    baron_kills: ti(participant.baronKills),
    basic_pings: ti(participant.basicPings),
    champ_experience: ti(participant.champExperience),
    champ_level: ti(participant.champLevel),
    champion_id: ti(participant.championId),
    champion_transform: ti(participant.championTransform),
    transform_timestamp_ms: transformTimestampMs,
    command_pings: ti(participant.commandPings),
    consumables_purchased: ti(participant.consumablesPurchased),
    damage_dealt_to_buildings: ti(participant.damageDealtToBuildings),
    damage_dealt_to_epic_monsters: ti(participant.damageDealtToEpicMonsters),
    damage_dealt_to_objectives: ti(participant.damageDealtToObjectives),
    damage_dealt_to_turrets: ti(participant.damageDealtToTurrets),
    danger_pings: ti(participant.dangerPings),
    deaths: ti(participant.deaths),
    detector_wards_placed: ti(participant.detectorWardsPlaced),
    double_kills: ti(participant.doubleKills),
    dragon_kills: ti(participant.dragonKills),
    enemy_missing_pings: ti(participant.enemyMissingPings),
    enemy_vision_pings: ti(participant.enemyVisionPings),
    first_blood_assist: tb(participant.firstBloodAssist),
    first_blood_kill: tb(participant.firstBloodKill),
    first_tower_assist: tb(participant.firstTowerAssist),
    first_tower_kill: tb(participant.firstTowerKill),
    get_back_pings: ti(participant.getBackPings),
    gold_earned: ti(participant.goldEarned),
    gold_spent: ti(participant.goldSpent),
    hold_pings: ti(participant.holdPings),
    inhibitor_kills: ti(participant.inhibitorKills),
    inhibitor_takedowns: ti(participant.inhibitorTakedowns),
    inhibitors_lost: ti(participant.inhibitorsLost),
    kills: ti(participant.kills),
    killing_sprees: ti(participant.killingSprees),
    largest_critical_strike: ti(participant.largestCriticalStrike),
    largest_killing_spree: ti(participant.largestKillingSpree),
    largest_multi_kill: ti(participant.largestMultiKill),
    longest_time_spent_living: ti(participant.longestTimeSpentLiving),
    magic_damage_dealt: ti(participant.magicDamageDealt),
    need_vision_pings: ti(participant.needVisionPings),
    neutral_minions_killed: ti(participant.neutralMinionsKilled),
    nexus_kills: ti(participant.nexusKills),
    nexus_takedowns: ti(participant.nexusTakedowns),
    objectives_stolen: ti(participant.objectivesStolen),
    objectives_stolen_assists: ti(participant.objectivesStolenAssists),
    on_my_way_pings: ti(participant.onMyWayPings),
    penta_kills: ti(participant.pentaKills),
    defense_perk_id: ti(perks?.statPerks?.defense),
    flex_perk_id: ti(perks?.statPerks?.flex),
    offense_perk_id: ti(perks?.statPerks?.offense),
    primary_style: ti(primaryStyle?.style),
    primary_selection_0: primarySelections[0] ?? [],
    primary_selection_1: primarySelections[1] ?? [],
    primary_selection_2: primarySelections[2] ?? [],
    primary_selection_3: primarySelections[3] ?? [],
    secondary_style: ti(secondaryStyle?.style),
    secondary_selection_1: secondarySelections[0] ?? [],
    secondary_selection_2: secondarySelections[1] ?? [],
    physical_damage_dealt: ti(participant.physicalDamageDealt),
    push_pings: ti(participant.pushPings),
    quadra_kills: ti(participant.quadraKills),
    retreat_pings: ti(participant.retreatPings),
    spell1_casts: ti(participant.spell1Casts),
    spell2_casts: ti(participant.spell2Casts),
    spell3_casts: ti(participant.spell3Casts),
    spell4_casts: ti(participant.spell4Casts),
    summoner1_casts: ti(participant.summoner1Casts),
    summoner1_id: ti(participant.summoner1Id),
    summoner2_casts: ti(participant.summoner2Casts),
    summoner2_id: ti(participant.summoner2Id),
    time_ccing_others: ti(participant.timeCCingOthers),
    time_played: ti(participant.timePlayed),
    total_ally_jungle_minions_killed: ti(participant.totalAllyJungleMinionsKilled),
    total_damage_shielded_on_teammates: ti(participant.totalDamageShieldedOnTeammates),
    total_enemy_jungle_minions_killed: ti(participant.totalEnemyJungleMinionsKilled),
    total_heal: ti(participant.totalHeal),
    total_heals_on_teammates: ti(participant.totalHealsOnTeammates),
    total_minions_killed: ti(participant.totalMinionsKilled),
    total_time_cc_dealt: ti(participant.totalTimeCCDealt),
    total_time_spent_dead: ti(participant.totalTimeSpentDead),
    total_units_healed: ti(participant.totalUnitsHealed),
    triple_kills: ti(participant.tripleKills),
    true_damage_dealt: ti(participant.trueDamageDealt),
    turret_kills: ti(participant.turretKills),
    turret_takedowns: ti(participant.turretTakedowns),
    turrets_lost: ti(participant.turretsLost),
    vision_cleared_pings: ti(participant.visionClearedPings),
    vision_wards_bought_in_game: ti(participant.visionWardsBoughtInGame),
    wards_killed: ti(participant.wardsKilled),
    wards_placed: ti(participant.wardsPlaced),
    item_history: timelineData.itemHistory,
    spell_history: timelineData.spellHistory,
    death_history: timelineData.deathHistory,
    kill_history: timelineData.killHistory,
    assist_history: timelineData.assistHistory,
    ward_history: timelineData.wardHistory,
    ward_killed_history: timelineData.wardKilledHistory,
    jungle_camp_history: toJungleCampHistoryDoc(
      timelineData.jungleCampHistory,
      teamPosition === "JUNGLE",
    ),
    gold_buckets: timelineData.buckets.goldBuckets,
    cs_buckets: timelineData.buckets.csBuckets,
    level_buckets: timelineData.buckets.levelBuckets,
    xp_buckets: timelineData.buckets.xpBuckets,
    kill_buckets: timelineData.buckets.killBuckets,
    assist_buckets: timelineData.buckets.assistBuckets,
    death_buckets: timelineData.buckets.deathBuckets,
    jungle_buckets: timelineData.buckets.jungleBuckets,
    physical_damage_buckets: timelineData.buckets.physicalDamageBuckets,
    physical_damage_taken_buckets: timelineData.buckets.physicalDamageTakenBuckets,
    magic_damage_buckets: timelineData.buckets.magicDamageBuckets,
    magic_damage_taken_buckets: timelineData.buckets.magicDamageTakenBuckets,
    true_damage_buckets: timelineData.buckets.trueDamageBuckets,
    true_damage_taken_buckets: timelineData.buckets.trueDamageTakenBuckets,
    ward_placed_buckets: timelineData.buckets.wardPlacedBuckets,
    ward_killed_buckets: timelineData.buckets.wardKilledBuckets,
    cc_time_buckets: timelineData.buckets.ccTimeBuckets,
    gold_spent_buckets: timelineData.buckets.goldSpentBuckets,
    turret_damage_buckets: timelineData.buckets.turretDamageBuckets,
    objective_damage_buckets: timelineData.buckets.objectiveDamageBuckets,
    win: tb(participant.win),
  };

  applyChallengesToRow(row, participant.challenges);
  if (row.heal_from_map_sources == null) {
    row.heal_from_map_sources = tf(participant.healFromMapSources);
  }
  return row;
}

function buildTeamRow(
  matchId: string,
  team: TeamDto,
  timeline: MatchTimelineDto,
  participants: ParticipantDto[],
  drakeMetrics: ReturnType<typeof countTeamDrakeAndSoulMetrics>,
): Record<string, unknown> {
  const teamId = team.teamId as 100 | 200;
  const objs = team.objectives ?? {};
  const championById = new Map<number, number>();
  for (const p of participants) championById.set(ti(p.participantId), ti(p.championId));

  const drakes = drakeMetrics.drakes.get(teamId) ?? {};
  const souls = drakeMetrics.souls.get(teamId) ?? {};
  const elderKills = drakeMetrics.elders.get(teamId) ?? 0;
  const soulEntry = Object.entries(souls).find(([, v]) => v > 0);

  return {
    riot_match_id: matchId,
    team_id: teamId,
    win: tb(team.win),
    first_blood: tb(objs.champion?.first),
    champion_kills: ti(objs.champion?.kills),
    baron_first: tb(objs.baron?.first),
    baron_kills: ti(objs.baron?.kills),
    dragon_first: tb(objs.dragon?.first),
    dragon_kills: ti(objs.dragon?.kills),
    tower_first: tb(objs.tower?.first),
    tower_kills: ti(objs.tower?.kills),
    horde_first: tb(objs.horde?.first),
    horde_kills: ti(objs.horde?.kills),
    rift_herald_first: tb(objs.riftHerald?.first),
    rift_herald_kills: ti(objs.riftHerald?.kills),
    inhibitor_first: tb(objs.inhibitor?.first),
    inhibitor_kills: ti(objs.inhibitor?.kills),
    elder_drake_first: elderKills > 0,
    earth_drake_kills: ti(drakes.earth),
    hextec_drake_kills: ti(drakes.hextec),
    fire_drake_kills: ti(drakes.fire),
    wind_drake_kills: ti(drakes.wind),
    water_drake_kills: ti(drakes.water),
    elder_drake_kills: elderKills,
    chem_drake_kills: ti(drakes.chem),
    have_soul: soulEntry != null,
    soul_type: soulEntry?.[0] ?? null,
    objective_outcome_histogram: extractTeamObjectiveHistogram(timeline, teamId, championById),
  };
}

function getTeamBanChampionIdsSorted(match: MatchDto, teamId: 100 | 200): number[] {
  const team = (match.info.teams ?? []).find((value) => value.teamId === teamId);
  if (!team?.bans?.length) return [];
  return [...team.bans]
    .filter((b) => Number(b.championId) > 0)
    .sort((a, b) => a.pickTurn - b.pickTurn || Number(a.championId) - Number(b.championId))
    .map((b) => Number(b.championId));
}

type DbTx = Sql | TransactionSql;

export async function persistNormalizedMatch(
  tx: DbTx,
  match: MatchDto,
  timeline: MatchTimelineDto,
  queueRegion?: string,
): Promise<void> {
  const matchId = String(match.metadata?.matchId ?? "").trim();
  if (!matchId) throw new Error("persist_normalized_match_missing_id");

  const patch = extractPatch(String(match.info?.gameVersion ?? ""));
  const region = normalizePlatformRegion(String(match.info?.platformId ?? queueRegion ?? "euw1"));
  const gameDate = gameDateFromMatch(match);
  const participantsInMatch = match.info?.participants ?? [];
  const earlySurrender = participantsInMatch.some((p) => p.gameEndedInEarlySurrender === true);
  const surrender = participantsInMatch.some((p) => p.gameEndedInSurrender === true);
  const gameDuration = ti(match.info?.gameDuration);

  await tx.unsafe(
    `INSERT INTO matchs (
       patch, riot_match_id, region, queue_id, game_date,
       early_surrender, surrender, game_duration
     ) VALUES ($1, $2, $3::lol_region, $4, $5::date, $6, $7, $8)
     ON CONFLICT (riot_match_id) DO NOTHING`,
    [
      patch,
      matchId,
      region,
      ti(match.info?.queueId),
      gameDate,
      earlySurrender,
      surrender,
      gameDuration,
    ],
  );

  const drakeMetrics = countTeamDrakeAndSoulMetrics(timeline, participantsInMatch);
  const parsedForBans = parseMatch(match, timeline, patch, region).filter(
    (p): p is ParsedParticipantDto => p !== null,
  );
  const banByParticipant = new Map<number, number>();
  for (const p of parsedForBans) {
    banByParticipant.set(
      participantsInMatch.find((x) => x.puuid === p.puuid)?.participantId ?? 0,
      p.bannedChampionId,
    );
  }

  for (const team of match.info?.teams ?? []) {
    const teamRow = buildTeamRow(matchId, team, timeline, participantsInMatch, drakeMetrics);
    const cols = Object.keys(teamRow);
    const vals = cols.map((c) => {
      const v = teamRow[c];
      if (c === "objective_outcome_histogram") return JSON.stringify(v);
      return v;
    });
    const placeholders = cols
      .map((c, i) => (c === "objective_outcome_histogram" ? `$${i + 1}::jsonb` : `$${i + 1}`))
      .join(", ");
    await tx.unsafe(
      `INSERT INTO teams (${cols.join(", ")}) VALUES (${placeholders})
       ON CONFLICT (riot_match_id, team_id) DO NOTHING`,
      vals as (string | number | boolean | null)[],
    );
  }

  for (const participant of participantsInMatch) {
    const parsed = parsedForBans.find((p) => p.puuid === participant.puuid);
    const jsonCols = new Set([
      "item_history",
      "spell_history",
      "death_history",
      "kill_history",
      "assist_history",
      "ward_history",
      "ward_killed_history",
      "jungle_camp_history",
    ]);
    const arrayCols = new Set([
      "primary_selection_0",
      "primary_selection_1",
      "primary_selection_2",
      "primary_selection_3",
      "secondary_selection_1",
      "secondary_selection_2",
      "gold_buckets",
      "cs_buckets",
      "level_buckets",
      "xp_buckets",
      "kill_buckets",
      "assist_buckets",
      "death_buckets",
      "jungle_buckets",
      "physical_damage_buckets",
      "physical_damage_taken_buckets",
      "magic_damage_buckets",
      "magic_damage_taken_buckets",
      "true_damage_buckets",
      "true_damage_taken_buckets",
      "ward_placed_buckets",
      "ward_killed_buckets",
      "cc_time_buckets",
      "gold_spent_buckets",
      "turret_damage_buckets",
      "objective_damage_buckets",
    ]);
    const bannedId =
      banByParticipant.get(participant.participantId) ??
      (() => {
        const tid = participant.teamId as 100 | 200;
        const bans = getTeamBanChampionIdsSorted(match, tid);
        const sorted = participantsInMatch
          .filter((p) => p.teamId === tid)
          .sort((a, b) => a.participantId - b.participantId);
        const idx = sorted.findIndex((p) => p.participantId === participant.participantId);
        return idx >= 0 && idx < bans.length ? bans[idx]! : 0;
      })();
    const row = buildParticipantRow(
      matchId,
      participant,
      timeline,
      bannedId,
      parsed?.transformTimestampMs ?? 0,
    );
    const cols = Object.keys(row).filter(isValidParticipantColumn);
    const vals = cols.map((c) => {
      const v = row[c];
      if (jsonCols.has(c)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
      if (typeof v === "number") {
        if (PARTICIPANT_FLOAT_COLUMNS.has(c)) return tf(v);
        return ti(v);
      }
      return v;
    });
    const castPlaceholders = cols
      .map((c, i) => {
        if (jsonCols.has(c)) return `$${i + 1}::jsonb`;
        if (arrayCols.has(c)) return `$${i + 1}::integer[]`;
        return `$${i + 1}`;
      })
      .join(", ");
    await tx.unsafe(
      `INSERT INTO participants (${cols.join(", ")}) VALUES (${castPlaceholders})
       ON CONFLICT (riot_match_id, participant_id) DO NOTHING`,
      vals as (string | number | boolean | null | number[])[],
    );
  }

  const participantsMeta = participantsInMatch
    .map((p) =>
      toParticipantMeta({
        participantId: ti(p.participantId),
        teamId: ti(p.teamId),
        teamPosition: String(p.teamPosition ?? ""),
        championId: ti(p.championId),
      }),
    )
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (participantsMeta.length > 0 && (timeline.info?.frames?.length ?? 0) > 0) {
    const eventCounts = classifyParticipantLaneEvents(matchId, timeline, participantsMeta);
    for (const counts of eventCounts) {
      await tx.unsafe(
        `UPDATE participants SET
           kill_by_dive = $1,
           death_by_dive = $2,
           kill_by_gank = $3,
           death_by_gank = $4,
           kill_by_roaming = $5,
           death_by_roaming = $6
         WHERE riot_match_id = $7 AND participant_id = $8`,
        [
          counts.killByDive,
          counts.deathByDive,
          counts.killByGank,
          counts.deathByGank,
          counts.killByRoam,
          counts.deathByRoam,
          matchId,
          counts.participantId,
        ],
      );
    }
  }
}

export async function isMatchAlreadyAggregated(riotMatchId: string): Promise<boolean> {
  const { sql } = await import("../db/client.js");
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id FROM match_aggregated WHERE riot_match_id = ${riotMatchId} LIMIT 1
  `;
  return rows.length > 0;
}

/** Crée la ligne `match_aggregated` une seule fois, après agrégation réussie. */
export async function insertMatchAggregated(tx: DbTx, riotMatchId: string): Promise<void> {
  await tx.unsafe(
    `INSERT INTO match_aggregated (riot_match_id, aggregated, aggregated_at)
     VALUES ($1, TRUE, NOW())
     ON CONFLICT (riot_match_id) DO NOTHING`,
    [riotMatchId],
  );
}
