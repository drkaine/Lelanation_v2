-- Rebuild all champion/team materialized views in tier-only mode.
-- rank_division is kept as a compatibility column but fixed to '' in MV keys/aggregations.

-- Drop satellites first, then core/vs/team.
DROP MATERIALIZED VIEW IF EXISTS mv_champion_bucket;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spells;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_spell_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_challenge_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_matchup_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_combat_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vision_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_objectif_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_first_objectif_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vs_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_core_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_team_core_stats;

CREATE MATERIALIZED VIEW mv_champion_core_stats AS
WITH base AS (
  SELECT
    mp.champion_id,
    COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier) AS rank_tier,
    ''::text AS rank_division,
    m.game_version,
    mp.role,
    m.region,
    t.win,
    t.team,
    m.game_duration,
    m.game_ended_in_surrender,
    m.game_ended_in_early_surrender,
    t.team_early_surrendered,
    c.kills, c.deaths, c.assists, c.champ_level, c.champ_experience,
    c.gold_earned, c.gold_spent, c.total_minions_killed, c.consumables_purchased, c.items_purchased
  FROM match_players mp
  JOIN matchs m ON m.id = mp.match_id
  JOIN teams t ON t.id = mp.team_id
  LEFT JOIN match_player_core c ON c.match_player_id = mp.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
),
ban_counts AS (
  SELECT
    b.champion_id,
    m.rank_tier,
    ''::text AS rank_division,
    m.game_version,
    m.region,
    COUNT(*)::int AS cnt
  FROM bans b
  JOIN matchs m ON m.id = b.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  GROUP BY b.champion_id, m.rank_tier, m.game_version, m.region
)
SELECT
  core_stat_id(b.champion_id, b.rank_tier, ''::text, b.game_version, b.role, b.region) AS id,
  b.champion_id,
  b.rank_tier,
  b.rank_division,
  b.game_version,
  b.role,
  b.region,
  SUM(CASE WHEN b.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(b.game_duration)::bigint AS sum_game_duration,
  SUM(CASE WHEN b.team = 100 THEN 1 ELSE 0 END)::int AS count_team_100,
  SUM(CASE WHEN b.team = 200 THEN 1 ELSE 0 END)::int AS count_team_200,
  SUM(CASE WHEN b.game_ended_in_surrender THEN 1 ELSE 0 END)::int AS count_game_ended_in_surrender,
  SUM(CASE WHEN b.game_ended_in_early_surrender THEN 1 ELSE 0 END)::int AS count_game_ended_in_early_surrender,
  SUM(CASE WHEN b.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
  COALESCE(MAX(bc.cnt), 0)::int AS count_ban,
  SUM(COALESCE(b.kills, 0))::bigint AS sum_kills,
  SUM(COALESCE(b.deaths, 0))::bigint AS sum_deaths,
  SUM(COALESCE(b.assists, 0))::bigint AS sum_assists,
  SUM(COALESCE(b.champ_level, 0))::bigint AS sum_champ_level,
  SUM(COALESCE(b.champ_experience, 0))::bigint AS sum_champ_experience,
  SUM(COALESCE(b.gold_earned, 0))::bigint AS sum_gold_earned,
  SUM(COALESCE(b.gold_spent, 0))::bigint AS sum_gold_spent,
  SUM(COALESCE(b.total_minions_killed, 0))::bigint AS sum_total_minions_killed,
  SUM(COALESCE(b.consumables_purchased, 0))::bigint AS sum_consumables_purchased,
  SUM(COALESCE(b.items_purchased, 0))::bigint AS sum_items_purchased
FROM base b
LEFT JOIN ban_counts bc ON bc.champion_id = b.champion_id
  AND bc.rank_tier = b.rank_tier
  AND bc.game_version = b.game_version AND bc.region = b.region
GROUP BY b.champion_id, b.rank_tier, b.rank_division, b.game_version, b.role, b.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_core_stats (id);
CREATE UNIQUE INDEX ON mv_champion_core_stats (champion_id, rank_tier, rank_division, game_version, role, region);

CREATE MATERIALIZED VIEW mv_champion_vs_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  opp.champion_id AS opponent_champion_id,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  mp.role,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier) AS rank_tier,
  m.game_version,
  m.region
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_players opp ON opp.match_id = mp.match_id AND opp.team_id != mp.team_id AND opp.role = mp.role
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY
  mp.champion_id,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
  m.game_version,
  mp.role,
  m.region,
  opp.champion_id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_vs_stats (champion_stat_id, opponent_champion_id);

CREATE MATERIALIZED VIEW mv_champion_first_objectif_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
  SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
  SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
  SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
  SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
  SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
  SUM(CASE WHEN o.first_blood_kill THEN 1 ELSE 0 END)::int AS count_first_blood_kill,
  SUM(CASE WHEN o.first_blood_assist THEN 1 ELSE 0 END)::int AS count_first_blood_assist,
  SUM(CASE WHEN o.first_tower_kill THEN 1 ELSE 0 END)::int AS count_first_tower_kill,
  SUM(CASE WHEN o.first_tower_assist THEN 1 ELSE 0 END)::int AS count_first_tower_assist
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN match_player_objectives o ON o.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_first_objectif_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_objectif_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  0::int AS sum_baron_kills,
  SUM(COALESCE(o.dragon_kills, 0))::int AS sum_dragon_kills,
  SUM(COALESCE(o.turret_kills, 0))::int AS sum_turret_kills,
  0::int AS sum_horde_kills,
  SUM(COALESCE(o.rift_herald_takedowns, 0))::int AS count_rift_herald_kills,
  SUM(COALESCE(o.inhibitor_kills, 0))::int AS sum_inhibitor_kills,
  0::int AS sum_champion_kills,
  0::int AS sum_elder_kills,
  SUM(COALESCE(o.inhibitor_takedowns, 0))::int AS sum_inhibitor_takedowns,
  SUM(COALESCE(o.inhibitors_lost, 0))::int AS sum_inhibitors_lost,
  SUM(COALESCE(o.objectives_stolen, 0))::int AS sum_objectives_stolen,
  SUM(COALESCE(o.objectives_stolen_assists, 0))::int AS sum_objectives_stolen_assists,
  SUM(COALESCE(o.turret_takedowns, 0))::int AS sum_turret_takedowns,
  SUM(COALESCE(o.turrets_lost, 0))::int AS sum_turrets_lost,
  0::int AS count_earth_drake, 0::int AS count_water_drake, 0::int AS count_wind_drake, 0::int AS count_fire_drake, 0::int AS count_hextec_drake, 0::int AS count_chem_drake,
  0::int AS count_earth_drake_soul, 0::int AS count_water_drake_soul, 0::int AS count_wind_drake_soul, 0::int AS count_fire_drake_soul, 0::int AS count_hextec_drake_soul, 0::int AS count_chem_drake_soul,
  SUM(COALESCE(o.dragon_takedowns, 0))::int AS sum_dragon_takedowns,
  SUM(COALESCE(o.earliest_baron, 0))::int AS sum_earliest_baron,
  SUM(COALESCE(o.elder_dragon_kills_with_opposing_soul, 0))::int AS sum_elder_dragon_kills_with_opposing_soul,
  SUM(COALESCE(o.elder_dragon_multikills, 0))::int AS sum_elder_dragon_multikills,
  SUM(COALESCE(o.epic_monster_kills_near_enemy_jungler, 0))::int AS sum_epic_monster_kills_near_enemy_jungler,
  SUM(COALESCE(o.epic_monster_kills_within_30_seconds_of_spawn, 0))::int AS sum_epic_monster_kills_within_30_seconds_of_spawn,
  SUM(COALESCE(o.epic_monster_steals, 0))::int AS sum_epic_monster_steals,
  SUM(COALESCE(o.epic_monster_stolen_without_smite, 0))::int AS sum_epic_monster_stolen_without_smite,
  SUM(COALESCE(o.first_turret_killed_time, 0))::int AS sum_first_turret_killed_time,
  SUM(COALESCE(o.multi_turret_rift_herald_count, 0))::int AS sum_multi_turret_rift_herald_count,
  SUM(COALESCE(o.quick_first_turret, 0))::int AS sum_quick_first_turret,
  SUM(COALESCE(o.rift_herald_takedowns, 0))::int AS sum_rift_herald_takedowns,
  SUM(COALESCE(o.solo_baron_kills, 0))::int AS sum_solo_baron_kills,
  SUM(COALESCE(o.solo_turrets_lategame, 0))::int AS sum_solo_turrets_lategame,
  SUM(COALESCE(o.takedown_on_first_turret, 0))::int AS sum_takedown_on_first_turret,
  SUM(COALESCE(o.turrets_taken_with_rift_herald, 0))::int AS sum_turrets_taken_with_rift_herald
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_objectives o ON o.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_objectif_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_vision_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  SUM(COALESCE(v.detector_wards_placed, 0))::int AS sum_detector_wards_placed,
  SUM(COALESCE(v.vision_score, 0))::int AS sum_vision_score,
  SUM(COALESCE(v.vision_wards_bought_in_game, 0))::int AS sum_vision_wards_bought_in_game,
  SUM(COALESCE(v.wards_killed, 0))::int AS sum_wards_killed,
  SUM(COALESCE(v.wards_placed, 0))::int AS sum_wards_placed,
  SUM(COALESCE(v.control_wards_placed, 0))::int AS sum_control_wards_placed,
  0::int AS sum_stealth_wards_placed,
  SUM(COALESCE(v.unseen_recalls, 0))::int AS sum_unseen_recalls,
  SUM(COALESCE(v.vision_score_advantage_lane_opponent, 0))::int AS sum_vision_score_advantage_lane_opponent,
  SUM(COALESCE(v.ward_takedowns, 0))::int AS sum_ward_takedowns,
  SUM(COALESCE(v.ward_takedowns_before_20_m, 0))::int AS sum_ward_takedowns_before_20_m,
  SUM(COALESCE(v.wards_guarded, 0))::int AS sum_wards_guarded
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_visions v ON v.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_vision_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_combat_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  SUM(COALESCE(c.damage_dealt_to_buildings, 0))::int AS sum_damage_dealt_to_buildings,
  SUM(COALESCE(c.damage_dealt_to_epic_monsters, 0))::int AS sum_damage_dealt_to_epic_monsters,
  SUM(COALESCE(c.damage_dealt_to_objectives, 0))::int AS sum_damage_dealt_to_objectives,
  SUM(COALESCE(c.damage_dealt_to_turrets, 0))::int AS sum_damage_dealt_to_turrets,
  SUM(COALESCE(c.damage_self_mitigated, 0))::int AS sum_damage_self_mitigated,
  SUM(COALESCE(c.double_kills, 0))::int AS sum_double_kills,
  SUM(COALESCE(c.killing_sprees, 0))::int AS sum_killing_sprees,
  SUM(COALESCE(c.largest_critical_strike, 0))::int AS sum_largest_critical_strike,
  SUM(COALESCE(c.largest_killing_spree, 0))::int AS sum_largest_killing_spree,
  SUM(COALESCE(c.longest_time_spent_living, 0))::int AS sum_longest_time_spent_living,
  SUM(COALESCE(c.magic_damage_dealt, 0))::int AS sum_magic_damage_dealt,
  SUM(COALESCE(c.magic_damage_dealt_to_champions, 0))::int AS sum_magic_damage_dealt_to_champions,
  SUM(COALESCE(c.magic_damage_taken, 0))::int AS sum_magic_damage_taken,
  SUM(COALESCE(c.penta_kills, 0))::int AS sum_penta_kills,
  SUM(COALESCE(c.physical_damage_dealt, 0))::int AS sum_physical_damage_dealt,
  SUM(COALESCE(c.physical_damage_dealt_to_champions, 0))::int AS sum_physical_damage_dealt_to_champions,
  SUM(COALESCE(c.physical_damage_taken, 0))::int AS sum_physical_damage_taken,
  SUM(COALESCE(c.quadra_kills, 0))::int AS sum_quadra_kills,
  SUM(COALESCE(c.time_ccing_others, 0))::int AS sum_time_ccing_others,
  SUM(COALESCE(c.total_damage_shielded_on_teammates, 0))::int AS sum_total_damage_shielded_on_teammates,
  SUM(COALESCE(c.total_damage_taken, 0))::int AS sum_total_damage_taken,
  SUM(COALESCE(c.total_heal, 0))::int AS sum_total_heal,
  SUM(COALESCE(c.total_heals_on_teammates, 0))::int AS sum_total_heals_on_teammates,
  SUM(COALESCE(c.total_time_cc_dealt, 0))::int AS sum_total_time_cc_dealt,
  SUM(COALESCE(c.total_units_healed, 0))::int AS sum_total_units_healed,
  SUM(COALESCE(c.triple_kills, 0))::int AS sum_triple_kills,
  SUM(COALESCE(c.true_damage_dealt, 0))::int AS sum_true_damage_dealt,
  SUM(COALESCE(c.true_damage_dealt_to_champions, 0))::int AS sum_true_damage_dealt_to_champions,
  SUM(COALESCE(c.true_damage_taken, 0))::int AS sum_true_damage_taken,
  SUM(COALESCE(c.effective_heal_and_shielding, 0))::int AS sum_effective_heal_and_shielding,
  SUM(COALESCE(c.enemy_champion_immobilizations, 0))::int AS sum_immobilize_and_kill_with_ally,
  0::int AS sum_outnumbered_kills
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_combats c ON c.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_combat_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_matchup_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  SUM(COALESCE(u.total_enemy_jungle_minions_killed, 0))::int AS sum_total_enemy_jungle_minions_killed,
  SUM(COALESCE(u.neutral_minions_killed, 0))::int AS sum_neutral_minions_killed,
  SUM(COALESCE(u.total_ally_jungle_minions_killed, 0))::int AS sum_total_ally_jungle_minions_killed,
  SUM(COALESCE(u.bounty_gold, 0))::int AS sum_bounty_gold,
  SUM(COALESCE(u.complete_support_quest_in_time, 0))::int AS sum_complete_support_quest_in_time,
  SUM(COALESCE(u.deaths_by_enemy_champs, 0))::int AS sum_deaths_by_enemy_champs,
  SUM(COALESCE(u.early_laning_phase_gold_exp_advantage, 0))::int AS sum_early_laning_phase_gold_exp_advantage,
  SUM(COALESCE(u.initial_crab_count, 0))::int AS sum_initial_crab_count,
  SUM(COALESCE(u.jungle_cs_before_10_minutes, 0))::int AS sum_jungle_cs_before_10_minutes,
  SUM(COALESCE(u.kills_near_enemy_turret, 0))::int AS sum_kills_near_enemy_turret,
  SUM(COALESCE(u.kills_on_other_lanes_early_jungle_as_laner, 0))::int AS sum_kills_on_other_lanes_early_jungle_as_laner,
  SUM(COALESCE(u.kills_under_own_turret, 0))::int AS sum_kills_under_own_turret,
  SUM(COALESCE(u.land_skill_shots_early_game, 0))::int AS sum_land_skill_shots_early_game,
  SUM(COALESCE(u.lane_minions_first_10_minutes, 0))::int AS sum_lane_minions_first_10_minutes,
  SUM(COALESCE(u.laning_phase_gold_exp_advantage, 0))::int AS sum_laning_phase_gold_exp_advantage,
  SUM(COALESCE(u.max_cs_advantage_on_lane_opponent, 0))::int AS sum_max_cs_advantage_on_lane_opponent,
  SUM(COALESCE(u.max_kill_deficit, 0))::int AS sum_max_kill_deficit,
  SUM(COALESCE(u.max_level_lead_lane_opponent, 0))::int AS sum_max_level_lead_lane_opponent,
  SUM(COALESCE(u.more_enemy_jungle_than_opponent, 0))::int AS sum_more_enemy_jungle_than_opponent,
  SUM(COALESCE(obj.turret_plates_taken, 0))::int AS sum_turret_plates_taken,
  SUM(COALESCE(u.takedowns_after_gaining_level_advantage, 0))::int AS sum_takedowns_after_gaining_level_advantage
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_matchup u ON u.match_player_id = mp.id
LEFT JOIN match_player_objectives obj ON obj.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_matchup_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_challenge_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  SUM(COALESCE(ch.heal_from_map_sources, 0))::int AS sum_heal_from_map_sources,
  SUM(COALESCE(obj_ch.baron_takedowns, 0))::int AS sum_baron_takedowns,
  SUM(COALESCE(ch.buffs_stolen, 0))::int AS sum_buffs_stolen,
  SUM(COALESCE(ch.dodge_skill_shots_small_window, 0))::int AS sum_dodge_skill_shots_small_window,
  0::int AS sum_get_takedowns_in_all_lanes_early_jungle_as_laner,
  SUM(CASE WHEN COALESCE(ch.had_open_nexus, 0) != 0 THEN 1 ELSE 0 END)::int AS count_had_open_nexus,
  SUM(COALESCE(ch.jungler_takedowns_near_damaged_epic_monster, 0))::int AS sum_jungler_takedowns_near_damaged_epic_monster,
  SUM(COALESCE(ch.kill_after_hidden_with_ally, 0))::int AS sum_kill_after_hidden_with_ally,
  SUM(COALESCE(ch.killed_champ_took_full_team_damage_survived, 0))::int AS sum_killed_champ_took_full_team_damage_survived,
  SUM(COALESCE(ch.kills_with_help_from_epic_monster, 0))::int AS sum_kills_with_help_from_epic_monster,
  SUM(COALESCE(ch.knock_enemy_into_team_and_kill, 0))::int AS sum_knock_enemy_into_team_and_kill,
  SUM(COALESCE(ch.mejais_full_stack_in_time, 0))::int AS sum_mejais_full_stack_in_time,
  SUM(COALESCE(ch.multikills_after_aggressive_flash, 0))::int AS sum_multikills_after_aggressive_flash,
  SUM(COALESCE(ch.quick_cleanse, 0))::int AS sum_quick_cleanse,
  SUM(COALESCE(u_ch.quick_solo_kills, 0))::int AS sum_quick_solo_kills,
  SUM(COALESCE(ch.save_ally_from_death, 0))::int AS sum_save_ally_from_death,
  SUM(COALESCE(ch.scuttle_crab_kills, 0))::int AS sum_scuttle_crab_kills,
  SUM(COALESCE(ch.skillshots_dodged, 0))::int AS sum_skillshots_dodged,
  SUM(COALESCE(ch.skillshots_hit, 0))::int AS sum_skillshots_hit,
  SUM(COALESCE(ch.survived_single_digit_hp_count, 0))::int AS sum_survived_single_digit_hp_count,
  SUM(COALESCE(ch.survived_three_immobilizes_in_fight, 0))::int AS sum_survived_three_immobilizes_in_fight,
  SUM(COALESCE(ch.takedowns_before_jungle_minion_spawn, 0))::int AS sum_takedowns_before_jungle_minion_spawn,
  SUM(COALESCE(ch.takedowns_in_alcove, 0))::int AS sum_takedowns_in_alcove,
  SUM(COALESCE(ch.takedowns_in_enemy_fountain, 0))::int AS sum_takedowns_in_enemy_fountain,
  SUM(COALESCE(ch.took_large_damage_survived, 0))::int AS sum_took_large_damage_survived
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_challenges ch ON ch.match_player_id = mp.id
LEFT JOIN match_player_objectives obj_ch ON obj_ch.match_player_id = mp.id
LEFT JOIN match_player_matchup u_ch ON u_ch.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_challenge_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_shard_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  s.shard_id,
  s.slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_shards s ON s.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, s.shard_id, s.slot
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_shard_solo_stats (champion_stat_id, shard_id, slot);

CREATE MATERIALIZED VIEW mv_champion_runes_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  r.perk_id,
  r.style,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_runes r ON r.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, r.perk_id, r.style
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_runes_solo_stats (champion_stat_id, perk_id, style);

CREATE MATERIALIZED VIEW mv_champion_shard_stats AS
WITH shard_lists AS (
  SELECT match_player_id, COALESCE(string_agg(shard_id::text, ',' ORDER BY slot), '') AS shard_list
  FROM match_player_shards
  GROUP BY match_player_id
)
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE(sl.shard_list, '') AS shard_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN shard_lists sl ON sl.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE(sl.shard_list, '')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_shard_stats (champion_stat_id, shard_list);

CREATE MATERIALIZED VIEW mv_champion_runes_stats AS
WITH rune_lists AS (
  SELECT match_player_id, string_agg(perk_id::text || '-' || style::text, ',' ORDER BY style, perk_id) AS rune_list
  FROM match_player_runes
  GROUP BY match_player_id
)
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE(rl.rune_list, '') AS rune_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN rune_lists rl ON rl.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE(rl.rune_list, '')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_runes_stats (champion_stat_id, rune_list);

CREATE MATERIALIZED VIEW mv_champion_item_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  i.item_id,
  SUM(CASE WHEN i.starter THEN 1 ELSE 0 END)::int AS count_starter,
  SUM(CASE WHEN i.core THEN 1 ELSE 0 END)::int AS count_core,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE(i.timestamp_ms, 0))::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_items i ON i.match_player_id = mp.id AND i.order < 6
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, i.item_id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_item_solo_stats (champion_stat_id, item_id);

CREATE MATERIALIZED VIEW mv_champion_item_stats AS
WITH item_lists AS (
  SELECT match_player_id, ('[' || string_agg(item_id::text, ',' ORDER BY "order") || ']') AS item_list
  FROM match_player_items
  WHERE "order" < 6 AND item_id > 0
  GROUP BY match_player_id
),
item_ts AS (
  SELECT match_player_id, COALESCE(SUM(timestamp_ms), 0)::int AS ts
  FROM match_player_items
  WHERE "order" < 6
  GROUP BY match_player_id
)
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE(il.item_list, '[]') AS item_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE(its.ts, 0))::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN item_lists il ON il.match_player_id = mp.id
LEFT JOIN item_ts its ON its.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE(il.item_list, '[]')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_item_stats (champion_stat_id, item_list);

CREATE MATERIALIZED VIEW mv_champion_spell_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  so.spell_slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  MIN(so."order")::int AS first_up_order,
  MAX(so."order")::int AS max_order
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN (SELECT match_player_id, spell_slot, MIN("order") AS "order" FROM match_player_spell_orders GROUP BY match_player_id, spell_slot) so ON so.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, so.spell_slot
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_spell_solo_stats (champion_stat_id, spell_slot);

CREATE MATERIALIZED VIEW mv_champion_summoner_spells AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  ss.spell_id,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(CASE WHEN ss.spell_slot = 0 THEN 1 ELSE 0 END)::int AS count_slot0,
  SUM(CASE WHEN ss.spell_slot = 1 THEN 1 ELSE 0 END)::int AS count_slot1
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_summoner_spells ss ON ss.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, ss.spell_id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_summoner_spells (champion_stat_id, spell_id);

CREATE MATERIALIZED VIEW mv_champion_bucket AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  b.duration_bucket,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE(b.current_gold, 0))::int AS sum_current_gold,
  SUM(COALESCE(b.magic_damage_done, 0))::int AS sum_magic_damage_done,
  SUM(COALESCE(b.magic_damage_done_to_champion, 0))::int AS sum_magic_damage_done_to_champion,
  SUM(COALESCE(b.magic_damage_taken, 0))::int AS sum_magic_damage_taken,
  SUM(COALESCE(b.physical_damage_done, 0))::int AS sum_physical_damage_done,
  SUM(COALESCE(b.physical_damage_done_to_champion, 0))::int AS sum_physical_damage_done_to_champion,
  SUM(COALESCE(b.physical_damage_taken, 0))::int AS sum_physical_damage_taken,
  SUM(COALESCE(b.total_damage_done, 0))::int AS sum_total_damage_done,
  SUM(COALESCE(b.total_damage_done_to_champion, 0))::int AS sum_total_damage_done_to_champion,
  SUM(COALESCE(b.total_damage_taken, 0))::int AS sum_total_damage_taken,
  SUM(COALESCE(b.true_damage_done, 0))::int AS sum_true_damage_done,
  SUM(COALESCE(b.true_damage_done_to_champion, 0))::int AS sum_true_damage_done_to_champion,
  SUM(COALESCE(b.true_damage_taken, 0))::int AS sum_true_damage_taken,
  SUM(COALESCE(b.gold_per_second, 0))::int AS sum_gold_per_second,
  SUM(COALESCE(b.jungle_minions_killed, 0))::int AS sum_jungle_minions_killed,
  SUM(COALESCE(b.level, 0))::int AS sum_level,
  SUM(COALESCE(b.minions_killed, 0))::int AS sum_minions_killed,
  SUM(COALESCE(b.time_enemy_spent_controlled, 0))::int AS sum_time_enemy_spent_controlled,
  SUM(COALESCE(b.total_gold, 0))::int AS sum_total_gold,
  SUM(COALESCE(b.xp, 0))::int AS sum_xp
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_bucket b ON b.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, b.duration_bucket
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_bucket (champion_stat_id, duration_bucket);

CREATE MATERIALIZED VIEW mv_team_core_stats AS
SELECT
  team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region) AS id,
  t.team,
  m.rank_tier,
  ''::text AS rank_division,
  m.game_version,
  m.region,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(CASE WHEN t.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
  SUM(t.baron_kills)::int AS sum_baron_kills,
  SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
  SUM(t.dragon_kills)::int AS sum_dragon_kills,
  SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
  SUM(t.tower_kills)::int AS sum_tower_kills,
  SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
  SUM(t.horde_kills)::int AS sum_horde_kills,
  SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
  SUM(t.rift_herald_kills)::int AS sum_rift_herald_kills,
  SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
  SUM(t.inhibitor_kills)::int AS sum_inhibitor_kills,
  SUM(t.champion_kills)::int AS sum_champion_kills,
  SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
  SUM(t.elder_kills)::int AS sum_elder_kills
FROM matchs m
JOIN teams t ON t.match_id = m.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY t.team, m.rank_tier, m.game_version, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_team_core_stats (id);
CREATE UNIQUE INDEX ON mv_team_core_stats (team, rank_tier, rank_division, game_version, region);

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
DECLARE
  mv_name TEXT;
BEGIN
  FOREACH mv_name IN ARRAY ARRAY[
    'mv_champion_core_stats',
    'mv_champion_vs_stats',
    'mv_team_core_stats',
    'mv_champion_first_objectif_stats',
    'mv_champion_objectif_stats',
    'mv_champion_vision_stats',
    'mv_champion_combat_stats',
    'mv_champion_matchup_stats',
    'mv_champion_challenge_stats',
    'mv_champion_shard_solo_stats',
    'mv_champion_runes_solo_stats',
    'mv_champion_shard_stats',
    'mv_champion_runes_stats',
    'mv_champion_item_solo_stats',
    'mv_champion_item_stats',
    'mv_champion_spell_solo_stats',
    'mv_champion_summoner_spells',
    'mv_champion_bucket'
  ]
  LOOP
    BEGIN
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
    EXCEPTION
      WHEN OTHERS THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
