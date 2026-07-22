import type { ParticipantDto } from "../riot/types.js";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

/** Première valeur numérique finie parmi des clés optionnelles du participant (variantes Riot). */
function nParticipantKey(participant: ParticipantDto, ...keys: string[]): number {
  const rec = participant as unknown as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    const x = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(x)) return Math.max(0, Math.trunc(x));
  }
  return 0;
}

/**
 * Champs match-v5 → clés `sum_*` / `count_*` de `champion_stats` (hors autres challenges déjà couverts par
 * `mapChallengeSums` et hors métriques posées par `mapParticipantBucketIngestMetrics`).
 * Les wards « challenges » listés ici sont repris volontairement pour être la dernière couche du spread sur le DTO.
 */
export function mapChampionStatsRiotMetrics(participant: ParticipantDto): Record<string, number> {
  /** Pink wards : racine `detectorWardsPlaced` ; si l’API ne la met pas, reprendre `challenges.controlWardsPlaced` (sinon mapChallengeSums puis écrasement à 0). */
  const pinkWardsPlaced = Math.max(n(participant.detectorWardsPlaced), n(participant.challenges?.controlWardsPlaced));
  const ch = participant.challenges;

  return {
    sum_physical_damage_done: n(participant.physicalDamageDealt),
    sum_magic_damage_done: n(participant.magicDamageDealt),
    sum_true_damage_done: n(participant.trueDamageDealt),
    sum_physical_damage_done_to_champions: n(participant.physicalDamageDealtToChampions),
    sum_magic_damage_done_to_champions: n(participant.magicDamageDealtToChampions),
    sum_true_damage_done_to_champions: n(participant.trueDamageDealtToChampions),
    sum_total_heal: n(participant.totalHeal),
    sum_total_heals_on_teammates: n(participant.totalHealsOnTeammates),
    sum_total_units_healed: n(participant.totalUnitsHealed),
    sum_total_units_healed_to_champions: nParticipantKey(
      participant,
      "totalUnitsHealedToChampions",
      "totalUnitsHealedToChampion",
    ),
    sum_heal_from_map_sources: nParticipantKey(participant, "healFromMapSources"),
    sum_vision_score: n(participant.visionScore),
    sum_wards_placed: n(participant.wardsPlaced),
    sum_wards_killed: n(participant.wardsKilled),
    sum_control_wards_placed: pinkWardsPlaced,
    sum_detector_wards_placed: pinkWardsPlaced,
    /** Même source que `mapChallengeSums` ; repris ici pour rester la dernière couche du spread (wards challenges). */
    sum_stealth_wards_placed: n(ch?.stealthWardsPlaced),
    sum_ward_takedowns: n(ch?.wardTakedowns),
    sum_ward_takedowns_before_20_m: n(ch?.wardTakedownsBefore20M),
    sum_wards_guarded: n(ch?.wardsGuarded),
    sum_two_wards_one_sweeper_count: n(ch?.twoWardsOneSweeperCount),
    sum_sight_wards_bought_in_game: n(participant.sightWardsBoughtInGame),
    sum_vision_wards_bought_in_game: n(participant.visionWardsBoughtInGame),
    sum_total_minions_killed: n(participant.totalMinionsKilled),
    sum_total_ally_jungle_minions_killed: nParticipantKey(
      participant,
      "totalAllyJungleMinionsKilled",
      "totalAllyJungleMonsterKills",
    ),
    sum_total_enemy_jungle_minions_killed: nParticipantKey(
      participant,
      "totalEnemyJungleMinionsKilled",
      "totalEnemyJungleMonsterKills",
    ),
    sum_neutral_minions_killed: n(participant.neutralMinionsKilled),
    sum_baron_kills: n(participant.baronKills),
    sum_dragon_kills: n(participant.dragonKills),
    sum_double_kills: n(participant.doubleKills),
    sum_triple_kills: n(participant.tripleKills),
    sum_quadra_kills: n(participant.quadraKills),
    sum_penta_kills: n(participant.pentaKills),
    sum_unreal_kills: n(participant.unrealKills),
    sum_inhibitor_kills: n(participant.inhibitorKills),
    sum_inhibitor_takedowns: n(participant.inhibitorTakedowns),
    sum_inhibitors_lost: n(participant.inhibitorsLost),
    sum_turret_kills: n(participant.turretKills),
    sum_turret_takedowns: n(participant.turretTakedowns),
    sum_turrets_lost: n(participant.turretsLost),
    sum_consumables_purchased: n(participant.consumablesPurchased),
    sum_items_purchased: n(participant.itemsPurchased),
    sum_killing_sprees: n(participant.killingSprees),
    sum_largest_killing_spree: n(participant.largestKillingSpree),
    sum_largest_multi_kill: n(participant.largestMultiKill),
    sum_longest_time_spent_living: n(participant.longestTimeSpentLiving),
    sum_objectives_stolen: n(participant.objectivesStolen),
    sum_objectives_stolen_assists: n(participant.objectivesStolenAssists),
    sum_total_time_spent_dead: n(participant.totalTimeSpentDead),
    sum_total_time_cc_dealt: n(participant.totalTimeCCDealt),
    sum_time_ccing_others: n(participant.timeCCingOthers),
    sum_total_damage_shielded_on_teammates: n(participant.totalDamageShieldedOnTeammates),
    sum_damage_dealt_to_buildings: n(participant.damageDealtToBuildings),
    sum_damage_dealt_to_turrets: n(participant.damageDealtToTurrets),
    sum_damage_dealt_to_objectives: n(participant.damageDealtToObjectives),
    sum_damage_dealt_to_epic_monsters: nParticipantKey(participant, "damageDealtToEpicMonsters"),
    sum_physical_damage_taken: n(participant.physicalDamageTaken),
    sum_magic_damage_taken: n(participant.magicDamageTaken),
    sum_true_damage_taken: n(participant.trueDamageTaken),
    sum_damage_self_mitigated: n(participant.damageSelfMitigated),
    sum_largest_critical_strike: n(participant.largestCriticalStrike),
    /** Compteurs de ping au niveau racine du participant match-v5 (hors `challenges`). */
    sum_all_in_pings: n(participant.allInPings),
    sum_assist_me_pings: n(participant.assistMePings),
    sum_command_pings: n(participant.commandPings),
    sum_enemy_missing_pings: n(participant.enemyMissingPings),
    sum_enemy_vision_pings: n(participant.enemyVisionPings),
    sum_get_back_pings: n(participant.getBackPings),
    sum_need_vision_pings: n(participant.needVisionPings),
    sum_on_my_way_pings: n(participant.onMyWayPings),
    sum_push_pings: n(participant.pushPings),
    sum_retreat_pings: n(participant.retreatPings),
  };
}
 