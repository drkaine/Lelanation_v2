import type { ParticipantDto } from "../riot/types.js";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
}

/**
 * Champs match-v5 → clés `sum_*` / `count_*` de `champion_stats` (hors challenges déjà couverts par mapChallengeSums
 * et hors métriques déjà posées par mapParticipantBucketIngestMetrics).
 */
export function mapChampionStatsRiotMetrics(participant: ParticipantDto): Record<string, number> {
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
    sum_total_units_healed_to_champions: n(
      (participant as { totalUnitsHealedToChampions?: number }).totalUnitsHealedToChampions,
    ),
    sum_heal_from_map_sources: n((participant as { healFromMapSources?: number }).healFromMapSources),
    sum_vision_score: n(participant.visionScore),
    sum_wards_placed: n(participant.wardsPlaced),
    sum_wards_killed: n(participant.wardsKilled),
    sum_control_wards_placed: n(participant.detectorWardsPlaced),
    sum_sight_wards_bought_in_game: n(participant.sightWardsBoughtInGame),
    sum_vision_wards_bought_in_game: n(participant.visionWardsBoughtInGame),
    sum_total_minions_killed: n(participant.totalMinionsKilled),
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
    sum_damage_dealt_to_epic_monsters: n((participant as { damageDealtToEpicMonsters?: number }).damageDealtToEpicMonsters),
    sum_physical_damage_taken: n(participant.physicalDamageTaken),
    sum_magic_damage_taken: n(participant.magicDamageTaken),
    sum_true_damage_taken: n(participant.trueDamageTaken),
    sum_damage_self_mitigated: n(participant.damageSelfMitigated),
    sum_largest_critical_strike: n(participant.largestCriticalStrike),
  };
}
 