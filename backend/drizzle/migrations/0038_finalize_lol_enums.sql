-- Merge doublons role (MID/SUPPORT) puis conversion enum (idempotent si déjà appliqué).

CREATE OR REPLACE FUNCTION normalize_stats_role_text(t TEXT) RETURNS TEXT AS $$
  SELECT CASE upper(trim(t))
    WHEN 'MID' THEN 'MIDDLE' WHEN 'MIDLANE' THEN 'MIDDLE'
    WHEN 'ADC' THEN 'BOTTOM' WHEN 'BOT' THEN 'BOTTOM'
    WHEN 'SUPPORT' THEN 'UTILITY' WHEN 'SUP' THEN 'UTILITY' WHEN 'UNKNOWN' THEN 'UTILITY'
    ELSE upper(trim(t)) END;
$$ LANGUAGE sql IMMUTABLE;
CREATE OR REPLACE FUNCTION text_to_lol_role(t TEXT) RETURNS lol_role AS $$
  SELECT normalize_stats_role_text(t)::lol_role;
$$ LANGUAGE sql IMMUTABLE;
CREATE OR REPLACE FUNCTION text_to_lol_rank_tier(t TEXT) RETURNS lol_rank_tier AS $$
  SELECT upper(trim(t))::lol_rank_tier;
$$ LANGUAGE sql IMMUTABLE;
CREATE OR REPLACE FUNCTION text_to_lol_region(t TEXT) RETURNS lol_region AS $$
BEGIN
  RETURN CASE lower(trim(t))
    WHEN 'euw' THEN 'EUW1'::lol_region WHEN 'eune' THEN 'EUN1'::lol_region WHEN 'eun' THEN 'EUN1'::lol_region
    WHEN 'na' THEN 'NA1'::lol_region WHEN 'oce' THEN 'OC1'::lol_region WHEN 'oc' THEN 'OC1'::lol_region
    WHEN 'br' THEN 'BR1'::lol_region WHEN 'lan' THEN 'LA1'::lol_region WHEN 'las' THEN 'LA2'::lol_region
    WHEN 'jp' THEN 'JP1'::lol_region WHEN 'tr' THEN 'TR1'::lol_region WHEN 'me' THEN 'ME1'::lol_region
    ELSE upper(trim(t))::lol_region END;
END; $$ LANGUAGE plpgsql IMMUTABLE;

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_stats;
    CREATE UNLOGGED TABLE _migrate_champion_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, team, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game, SUM(sum_gold_earned)::bigint AS sum_gold_earned, SUM(sum_gold_spent)::bigint AS sum_gold_spent, SUM(sum_bounty_gold) AS sum_bounty_gold, SUM(sum_max_level_lead_lane_opponent) AS sum_max_level_lead_lane_opponent, SUM(sum_max_kill_deficit) AS sum_max_kill_deficit, SUM(sum_more_enemy_jungle_than_opponent) AS sum_more_enemy_jungle_than_opponent, SUM(sum_max_cs_advantage_on_lane_opponent) AS sum_max_cs_advantage_on_lane_opponent, SUM(sum_vision_score_advantage_lane_opponent) AS sum_vision_score_advantage_lane_opponent, SUM(sum_laning_phase_gold_exp_advantage) AS sum_laning_phase_gold_exp_advantage, SUM(sum_early_laning_phase_gold_exp_advantage) AS sum_early_laning_phase_gold_exp_advantage, SUM(sum_physical_damage_done)::bigint AS sum_physical_damage_done, SUM(sum_magic_damage_done)::bigint AS sum_magic_damage_done, SUM(sum_true_damage_done)::bigint AS sum_true_damage_done, SUM(sum_physical_damage_done_to_champions)::bigint AS sum_physical_damage_done_to_champions, SUM(sum_magic_damage_done_to_champions)::bigint AS sum_magic_damage_done_to_champions, SUM(sum_true_damage_done_to_champions)::bigint AS sum_true_damage_done_to_champions, SUM(sum_damage_dealt_to_buildings)::bigint AS sum_damage_dealt_to_buildings, SUM(sum_damage_dealt_to_turrets)::bigint AS sum_damage_dealt_to_turrets, SUM(sum_damage_dealt_to_objectives)::bigint AS sum_damage_dealt_to_objectives, SUM(sum_damage_dealt_to_epic_monsters)::bigint AS sum_damage_dealt_to_epic_monsters, SUM(sum_largest_critical_strike)::bigint AS sum_largest_critical_strike, SUM(sum_damage_per_minute) AS sum_damage_per_minute, SUM(sum_physical_damage_taken)::bigint AS sum_physical_damage_taken, SUM(sum_magic_damage_taken)::bigint AS sum_magic_damage_taken, SUM(sum_true_damage_taken)::bigint AS sum_true_damage_taken, SUM(sum_damage_self_mitigated)::bigint AS sum_damage_self_mitigated, SUM(sum_total_heal)::bigint AS sum_total_heal, SUM(sum_total_heals_on_teammates)::bigint AS sum_total_heals_on_teammates, SUM(sum_total_units_healed)::bigint AS sum_total_units_healed, SUM(sum_total_units_healed_to_champions)::bigint AS sum_total_units_healed_to_champions, SUM(sum_heal_from_map_sources)::bigint AS sum_heal_from_map_sources, SUM(sum_effective_heal_and_shielding) AS sum_effective_heal_and_shielding, SUM(sum_vision_score)::bigint AS sum_vision_score, SUM(sum_wards_placed)::bigint AS sum_wards_placed, SUM(sum_wards_killed)::bigint AS sum_wards_killed, SUM(sum_control_wards_placed)::bigint AS sum_control_wards_placed, SUM(sum_kills)::bigint AS sum_kills, SUM(sum_assists)::bigint AS sum_assists, SUM(sum_total_time_cc_dealt)::bigint AS sum_total_time_cc_dealt, SUM(count_time_enemy_spent_controlled)::bigint AS count_time_enemy_spent_controlled, SUM(sum_total_minions_killed)::bigint AS sum_total_minions_killed, SUM(sum_baron_kills)::bigint AS sum_baron_kills, SUM(sum_all_in_pings)::bigint AS sum_all_in_pings, SUM(sum_assist_me_pings)::bigint AS sum_assist_me_pings, SUM(sum_basic_pings)::bigint AS sum_basic_pings, SUM(count_first_blood_kill_true)::bigint AS count_first_blood_kill_true, SUM(count_first_blood_assist_true)::bigint AS count_first_blood_assist_true, SUM(count_first_tower_kill_true)::bigint AS count_first_tower_kill_true, SUM(count_first_tower_assist_true)::bigint AS count_first_tower_assist_true, SUM(count_baron_assist)::bigint AS count_baron_assist, SUM(count_dragon_kill)::bigint AS count_dragon_kill, SUM(count_dragon_assist)::bigint AS count_dragon_assist, SUM(count_rift_herald_kill)::bigint AS count_rift_herald_kill, SUM(count_rift_herald_assist)::bigint AS count_rift_herald_assist, SUM(count_horde_kill)::bigint AS count_horde_kill, SUM(count_horde_assist)::bigint AS count_horde_assist, SUM(count_elder_kill)::bigint AS count_elder_kill, SUM(count_elder_assist)::bigint AS count_elder_assist, SUM(count_tower_kill)::bigint AS count_tower_kill, SUM(count_tower_assist)::bigint AS count_tower_assist, SUM(count_inhibitor_kill)::bigint AS count_inhibitor_kill, SUM(count_inhibitor_assist)::bigint AS count_inhibitor_assist, SUM(count_baron_involved_win)::bigint AS count_baron_involved_win, SUM(count_dragon_involved_win)::bigint AS count_dragon_involved_win, SUM(count_rift_herald_involved_win)::bigint AS count_rift_herald_involved_win, SUM(count_horde_involved_win)::bigint AS count_horde_involved_win, SUM(count_elder_involved_win)::bigint AS count_elder_involved_win, SUM(count_tower_involved_win)::bigint AS count_tower_involved_win, SUM(count_inhibitor_involved_win)::bigint AS count_inhibitor_involved_win, SUM(count_earth_drake_kill)::bigint AS count_earth_drake_kill, SUM(count_earth_drake_assist)::bigint AS count_earth_drake_assist, SUM(count_water_drake_kill)::bigint AS count_water_drake_kill, SUM(count_water_drake_assist)::bigint AS count_water_drake_assist, SUM(count_wind_drake_kill)::bigint AS count_wind_drake_kill, SUM(count_wind_drake_assist)::bigint AS count_wind_drake_assist, SUM(count_fire_drake_kill)::bigint AS count_fire_drake_kill, SUM(count_fire_drake_assist)::bigint AS count_fire_drake_assist, SUM(count_hextec_drake_kill)::bigint AS count_hextec_drake_kill, SUM(count_hextec_drake_assist)::bigint AS count_hextec_drake_assist, SUM(count_chem_drake_kill)::bigint AS count_chem_drake_kill, SUM(count_chem_drake_assist)::bigint AS count_chem_drake_assist, SUM(count_earth_soul)::bigint AS count_earth_soul, SUM(count_water_soul)::bigint AS count_water_soul, SUM(count_wind_soul)::bigint AS count_wind_soul, SUM(count_fire_soul)::bigint AS count_fire_soul, SUM(count_hextec_soul)::bigint AS count_hextec_soul, SUM(count_chem_soul)::bigint AS count_chem_soul, SUM(sum_12_assist_streak_count)::bigint AS sum_12_assist_streak_count, SUM(sum_infernal_scale_pickup)::bigint AS sum_infernal_scale_pickup, SUM(sum_aces_before_15_minutes)::bigint AS sum_aces_before_15_minutes, SUM(sum_allied_jungle_monster_kills)::bigint AS sum_allied_jungle_monster_kills, SUM(sum_baron_takedowns)::bigint AS sum_baron_takedowns, SUM(sum_buffs_stolen)::bigint AS sum_buffs_stolen, SUM(sum_complete_support_quest_in_time)::bigint AS sum_complete_support_quest_in_time, SUM(sum_damage_taken_on_team_percentage) AS sum_damage_taken_on_team_percentage, SUM(sum_deaths_by_enemy_champs)::bigint AS sum_deaths_by_enemy_champs, SUM(sum_dodge_skill_shots_small_window)::bigint AS sum_dodge_skill_shots_small_window, SUM(sum_double_aces)::bigint AS sum_double_aces, SUM(sum_dragon_takedowns)::bigint AS sum_dragon_takedowns, SUM(sum_earliest_baron) AS sum_earliest_baron, SUM(sum_elder_dragon_kills_with_opposing_soul)::bigint AS sum_elder_dragon_kills_with_opposing_soul, SUM(sum_elder_dragon_multikills)::bigint AS sum_elder_dragon_multikills, SUM(sum_enemy_champion_immobilizations)::bigint AS sum_enemy_champion_immobilizations, SUM(sum_enemy_jungle_monster_kills)::bigint AS sum_enemy_jungle_monster_kills, SUM(sum_epic_monster_kills_near_enemy_jungler)::bigint AS sum_epic_monster_kills_near_enemy_jungler, SUM(sum_epic_monster_kills_within_30_seconds_of_spawn)::bigint AS sum_epic_monster_kills_within_30_seconds_of_spawn, SUM(sum_epic_monster_steals)::bigint AS sum_epic_monster_steals, SUM(sum_epic_monster_stolen_without_smite)::bigint AS sum_epic_monster_stolen_without_smite, SUM(sum_first_turret_killed_time) AS sum_first_turret_killed_time, SUM(sum_fist_bump_participation)::bigint AS sum_fist_bump_participation, SUM(sum_flawless_aces)::bigint AS sum_flawless_aces, SUM(sum_full_team_takedown)::bigint AS sum_full_team_takedown, SUM(sum_game_length) AS sum_game_length, SUM(sum_gold_per_minute) AS sum_gold_per_minute, SUM(sum_had_open_nexus)::bigint AS sum_had_open_nexus, SUM(sum_immobilize_and_kill_with_ally)::bigint AS sum_immobilize_and_kill_with_ally, SUM(sum_initial_buff_count)::bigint AS sum_initial_buff_count, SUM(sum_initial_crab_count)::bigint AS sum_initial_crab_count, SUM(sum_jungle_cs_before_10_minutes)::bigint AS sum_jungle_cs_before_10_minutes, SUM(sum_jungler_takedowns_near_damaged_epic_monster)::bigint AS sum_jungler_takedowns_near_damaged_epic_monster, SUM(sum_k_turrets_destroyed_before_plates_fall)::bigint AS sum_k_turrets_destroyed_before_plates_fall, SUM(sum_kill_after_hidden_with_ally)::bigint AS sum_kill_after_hidden_with_ally, SUM(sum_killed_champ_took_full_team_damage_survived)::bigint AS sum_killed_champ_took_full_team_damage_survived, SUM(sum_kills_near_enemy_turret)::bigint AS sum_kills_near_enemy_turret, SUM(sum_kills_on_other_lanes_early_jungle_as_laner)::bigint AS sum_kills_on_other_lanes_early_jungle_as_laner, SUM(sum_kills_under_own_turret)::bigint AS sum_kills_under_own_turret, SUM(sum_kills_with_help_from_epic_monster)::bigint AS sum_kills_with_help_from_epic_monster, SUM(sum_knock_enemy_into_team_and_kill)::bigint AS sum_knock_enemy_into_team_and_kill, SUM(sum_land_skill_shots_early_game)::bigint AS sum_land_skill_shots_early_game, SUM(sum_lane_minions_first_10_minutes)::bigint AS sum_lane_minions_first_10_minutes, SUM(sum_lost_an_inhibitor)::bigint AS sum_lost_an_inhibitor, SUM(sum_mejais_full_stack_in_time)::bigint AS sum_mejais_full_stack_in_time, SUM(sum_multi_kill_one_spell)::bigint AS sum_multi_kill_one_spell, SUM(sum_multi_turret_rift_herald_count)::bigint AS sum_multi_turret_rift_herald_count, SUM(sum_multikills)::bigint AS sum_multikills, SUM(sum_multikills_after_aggressive_flash)::bigint AS sum_multikills_after_aggressive_flash, SUM(sum_outer_turret_executes_before_10_minutes)::bigint AS sum_outer_turret_executes_before_10_minutes, SUM(sum_outnumbered_kills)::bigint AS sum_outnumbered_kills, SUM(sum_outnumbered_nexus_kill)::bigint AS sum_outnumbered_nexus_kill, SUM(sum_perfect_dragon_souls_taken)::bigint AS sum_perfect_dragon_souls_taken, SUM(sum_perfect_game)::bigint AS sum_perfect_game, SUM(sum_pick_kill_with_ally)::bigint AS sum_pick_kill_with_ally, SUM(sum_quick_cleanse)::bigint AS sum_quick_cleanse, SUM(sum_quick_first_turret)::bigint AS sum_quick_first_turret, SUM(sum_quick_solo_kills)::bigint AS sum_quick_solo_kills, SUM(sum_rift_herald_takedowns)::bigint AS sum_rift_herald_takedowns, SUM(sum_save_ally_from_death)::bigint AS sum_save_ally_from_death, SUM(sum_scuttle_crab_kills)::bigint AS sum_scuttle_crab_kills, SUM(sum_skillshots_dodged)::bigint AS sum_skillshots_dodged, SUM(sum_skillshots_hit)::bigint AS sum_skillshots_hit, SUM(sum_solo_baron_kills)::bigint AS sum_solo_baron_kills, SUM(sum_solo_kills)::bigint AS sum_solo_kills, SUM(sum_solo_turrets_lategame)::bigint AS sum_solo_turrets_lategame, SUM(sum_stealth_wards_placed)::bigint AS sum_stealth_wards_placed, SUM(sum_survived_single_digit_hp_count)::bigint AS sum_survived_single_digit_hp_count, SUM(sum_survived_three_immobilizes_in_fight)::bigint AS sum_survived_three_immobilizes_in_fight, SUM(sum_takedown_on_first_turret)::bigint AS sum_takedown_on_first_turret, SUM(sum_takedowns)::bigint AS sum_takedowns, SUM(sum_takedowns_after_gaining_level_advantage)::bigint AS sum_takedowns_after_gaining_level_advantage, SUM(sum_takedowns_before_jungle_minion_spawn)::bigint AS sum_takedowns_before_jungle_minion_spawn, SUM(sum_takedowns_first_x_minutes)::bigint AS sum_takedowns_first_x_minutes, SUM(sum_takedowns_in_alcove)::bigint AS sum_takedowns_in_alcove, SUM(sum_takedowns_in_enemy_fountain)::bigint AS sum_takedowns_in_enemy_fountain, SUM(sum_team_damage_percentage) AS sum_team_damage_percentage, SUM(sum_took_large_damage_survived)::bigint AS sum_took_large_damage_survived, SUM(sum_turret_plates_taken)::bigint AS sum_turret_plates_taken, SUM(sum_turret_takedowns)::bigint AS sum_turret_takedowns, SUM(sum_turrets_taken_with_rift_herald)::bigint AS sum_turrets_taken_with_rift_herald, SUM(sum_twenty_minions_in_3_seconds_count)::bigint AS sum_twenty_minions_in_3_seconds_count, SUM(sum_two_wards_one_sweeper_count)::bigint AS sum_two_wards_one_sweeper_count, SUM(sum_unseen_recalls)::bigint AS sum_unseen_recalls, SUM(sum_vision_score_per_minute) AS sum_vision_score_per_minute, SUM(sum_ward_takedowns)::bigint AS sum_ward_takedowns, SUM(sum_ward_takedowns_before_20_m)::bigint AS sum_ward_takedowns_before_20_m, SUM(sum_wards_guarded)::bigint AS sum_wards_guarded, SUM(sum_command_pings)::bigint AS sum_command_pings, SUM(sum_consumables_purchased)::bigint AS sum_consumables_purchased, SUM(sum_danger_pings)::bigint AS sum_danger_pings, SUM(sum_detector_wards_placed)::bigint AS sum_detector_wards_placed, SUM(sum_double_kills)::bigint AS sum_double_kills, SUM(sum_dragon_kills)::bigint AS sum_dragon_kills, SUM(sum_enemy_missing_pings)::bigint AS sum_enemy_missing_pings, SUM(sum_enemy_vision_pings)::bigint AS sum_enemy_vision_pings, SUM(sum_game_ended_in_early_surrender)::bigint AS sum_game_ended_in_early_surrender, SUM(sum_game_ended_in_surrender)::bigint AS sum_game_ended_in_surrender, SUM(sum_get_back_pings)::bigint AS sum_get_back_pings, SUM(sum_hold_pings)::bigint AS sum_hold_pings, SUM(sum_inhibitor_kills)::bigint AS sum_inhibitor_kills, SUM(sum_inhibitor_takedowns)::bigint AS sum_inhibitor_takedowns, SUM(sum_inhibitors_lost)::bigint AS sum_inhibitors_lost, SUM(sum_items_purchased)::bigint AS sum_items_purchased, SUM(sum_killing_sprees)::bigint AS sum_killing_sprees, SUM(sum_largest_killing_spree)::bigint AS sum_largest_killing_spree, SUM(sum_largest_multi_kill)::bigint AS sum_largest_multi_kill, SUM(sum_longest_time_spent_living)::bigint AS sum_longest_time_spent_living, SUM(sum_need_vision_pings)::bigint AS sum_need_vision_pings, SUM(sum_neutral_minions_killed)::bigint AS sum_neutral_minions_killed, SUM(sum_objectives_stolen)::bigint AS sum_objectives_stolen, SUM(sum_objectives_stolen_assists)::bigint AS sum_objectives_stolen_assists, SUM(sum_on_my_way_pings)::bigint AS sum_on_my_way_pings, SUM(sum_penta_kills)::bigint AS sum_penta_kills, SUM(sum_push_pings)::bigint AS sum_push_pings, SUM(sum_quadra_kills)::bigint AS sum_quadra_kills, SUM(sum_retreat_pings)::bigint AS sum_retreat_pings, SUM(sum_sight_wards_bought_in_game)::bigint AS sum_sight_wards_bought_in_game, SUM(sum_team_early_surrendered)::bigint AS sum_team_early_surrendered, SUM(sum_time_ccing_others)::bigint AS sum_time_ccing_others, SUM(sum_total_ally_jungle_minions_killed)::bigint AS sum_total_ally_jungle_minions_killed, SUM(sum_total_damage_shielded_on_teammates)::bigint AS sum_total_damage_shielded_on_teammates, SUM(sum_total_enemy_jungle_minions_killed)::bigint AS sum_total_enemy_jungle_minions_killed, SUM(sum_total_time_spent_dead)::bigint AS sum_total_time_spent_dead, SUM(sum_triple_kills)::bigint AS sum_triple_kills, SUM(sum_turret_kills)::bigint AS sum_turret_kills, SUM(sum_turrets_lost)::bigint AS sum_turrets_lost, SUM(sum_unreal_kills)::bigint AS sum_unreal_kills, SUM(sum_vision_cleared_pings)::bigint AS sum_vision_cleared_pings, SUM(sum_vision_wards_bought_in_game)::bigint AS sum_vision_wards_bought_in_game, SUM(count_baron_kill_ge1_game)::bigint AS count_baron_kill_ge1_game, SUM(count_baron_kill_ge2_game)::bigint AS count_baron_kill_ge2_game, SUM(count_baron_kill_ge3p_game)::bigint AS count_baron_kill_ge3p_game, SUM(count_dragon_kill_ge1_game)::bigint AS count_dragon_kill_ge1_game, SUM(count_dragon_kill_ge2_game)::bigint AS count_dragon_kill_ge2_game, SUM(count_dragon_kill_ge3p_game)::bigint AS count_dragon_kill_ge3p_game, SUM(count_tower_kill_ge1_game)::bigint AS count_tower_kill_ge1_game, SUM(count_tower_kill_ge2_game)::bigint AS count_tower_kill_ge2_game, SUM(count_tower_kill_ge3p_game)::bigint AS count_tower_kill_ge3p_game, SUM(count_inhibitor_kill_ge1_game)::bigint AS count_inhibitor_kill_ge1_game, SUM(count_inhibitor_kill_ge2_game)::bigint AS count_inhibitor_kill_ge2_game, SUM(count_inhibitor_kill_ge3p_game)::bigint AS count_inhibitor_kill_ge3p_game, SUM(count_horde_kill_ge1_game)::bigint AS count_horde_kill_ge1_game, SUM(count_horde_kill_ge2_game)::bigint AS count_horde_kill_ge2_game, SUM(count_horde_kill_ge3p_game)::bigint AS count_horde_kill_ge3p_game, SUM(count_horde_kill_ge4_game)::bigint AS count_horde_kill_ge4_game, SUM(count_horde_kill_ge5p_game)::bigint AS count_horde_kill_ge5p_game, SUM(count_rift_herald_kill_ge1_game)::bigint AS count_rift_herald_kill_ge1_game, SUM(count_rift_herald_kill_ge2p_game)::bigint AS count_rift_herald_kill_ge2p_game
    FROM champion_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_stats;
    INSERT INTO champion_stats (patch, role, rank_tier, region, champion_id, team, champion_transform, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_bounty_gold, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage, sum_physical_damage_done, sum_magic_damage_done, sum_true_damage_done, sum_physical_damage_done_to_champions, sum_magic_damage_done_to_champions, sum_true_damage_done_to_champions, sum_damage_dealt_to_buildings, sum_damage_dealt_to_turrets, sum_damage_dealt_to_objectives, sum_damage_dealt_to_epic_monsters, sum_largest_critical_strike, sum_damage_per_minute, sum_physical_damage_taken, sum_magic_damage_taken, sum_true_damage_taken, sum_damage_self_mitigated, sum_total_heal, sum_total_heals_on_teammates, sum_total_units_healed, sum_total_units_healed_to_champions, sum_heal_from_map_sources, sum_effective_heal_and_shielding, sum_vision_score, sum_wards_placed, sum_wards_killed, sum_control_wards_placed, sum_kills, sum_assists, sum_total_time_cc_dealt, count_time_enemy_spent_controlled, sum_total_minions_killed, sum_baron_kills, sum_all_in_pings, sum_assist_me_pings, sum_basic_pings, count_first_blood_kill_true, count_first_blood_assist_true, count_first_tower_kill_true, count_first_tower_assist_true, count_baron_assist, count_dragon_kill, count_dragon_assist, count_rift_herald_kill, count_rift_herald_assist, count_horde_kill, count_horde_assist, count_elder_kill, count_elder_assist, count_tower_kill, count_tower_assist, count_inhibitor_kill, count_inhibitor_assist, count_baron_involved_win, count_dragon_involved_win, count_rift_herald_involved_win, count_horde_involved_win, count_elder_involved_win, count_tower_involved_win, count_inhibitor_involved_win, count_earth_drake_kill, count_earth_drake_assist, count_water_drake_kill, count_water_drake_assist, count_wind_drake_kill, count_wind_drake_assist, count_fire_drake_kill, count_fire_drake_assist, count_hextec_drake_kill, count_hextec_drake_assist, count_chem_drake_kill, count_chem_drake_assist, count_earth_soul, count_water_soul, count_wind_soul, count_fire_soul, count_hextec_soul, count_chem_soul, sum_12_assist_streak_count, sum_infernal_scale_pickup, sum_aces_before_15_minutes, sum_allied_jungle_monster_kills, sum_baron_takedowns, sum_buffs_stolen, sum_complete_support_quest_in_time, sum_damage_taken_on_team_percentage, sum_deaths_by_enemy_champs, sum_dodge_skill_shots_small_window, sum_double_aces, sum_dragon_takedowns, sum_earliest_baron, sum_elder_dragon_kills_with_opposing_soul, sum_elder_dragon_multikills, sum_enemy_champion_immobilizations, sum_enemy_jungle_monster_kills, sum_epic_monster_kills_near_enemy_jungler, sum_epic_monster_kills_within_30_seconds_of_spawn, sum_epic_monster_steals, sum_epic_monster_stolen_without_smite, sum_first_turret_killed_time, sum_fist_bump_participation, sum_flawless_aces, sum_full_team_takedown, sum_game_length, sum_gold_per_minute, sum_had_open_nexus, sum_immobilize_and_kill_with_ally, sum_initial_buff_count, sum_initial_crab_count, sum_jungle_cs_before_10_minutes, sum_jungler_takedowns_near_damaged_epic_monster, sum_k_turrets_destroyed_before_plates_fall, sum_kill_after_hidden_with_ally, sum_killed_champ_took_full_team_damage_survived, sum_kills_near_enemy_turret, sum_kills_on_other_lanes_early_jungle_as_laner, sum_kills_under_own_turret, sum_kills_with_help_from_epic_monster, sum_knock_enemy_into_team_and_kill, sum_land_skill_shots_early_game, sum_lane_minions_first_10_minutes, sum_lost_an_inhibitor, sum_mejais_full_stack_in_time, sum_multi_kill_one_spell, sum_multi_turret_rift_herald_count, sum_multikills, sum_multikills_after_aggressive_flash, sum_outer_turret_executes_before_10_minutes, sum_outnumbered_kills, sum_outnumbered_nexus_kill, sum_perfect_dragon_souls_taken, sum_perfect_game, sum_pick_kill_with_ally, sum_quick_cleanse, sum_quick_first_turret, sum_quick_solo_kills, sum_rift_herald_takedowns, sum_save_ally_from_death, sum_scuttle_crab_kills, sum_skillshots_dodged, sum_skillshots_hit, sum_solo_baron_kills, sum_solo_kills, sum_solo_turrets_lategame, sum_stealth_wards_placed, sum_survived_single_digit_hp_count, sum_survived_three_immobilizes_in_fight, sum_takedown_on_first_turret, sum_takedowns, sum_takedowns_after_gaining_level_advantage, sum_takedowns_before_jungle_minion_spawn, sum_takedowns_first_x_minutes, sum_takedowns_in_alcove, sum_takedowns_in_enemy_fountain, sum_team_damage_percentage, sum_took_large_damage_survived, sum_turret_plates_taken, sum_turret_takedowns, sum_turrets_taken_with_rift_herald, sum_twenty_minions_in_3_seconds_count, sum_two_wards_one_sweeper_count, sum_unseen_recalls, sum_vision_score_per_minute, sum_ward_takedowns, sum_ward_takedowns_before_20_m, sum_wards_guarded, sum_command_pings, sum_consumables_purchased, sum_danger_pings, sum_detector_wards_placed, sum_double_kills, sum_dragon_kills, sum_enemy_missing_pings, sum_enemy_vision_pings, sum_game_ended_in_early_surrender, sum_game_ended_in_surrender, sum_get_back_pings, sum_hold_pings, sum_inhibitor_kills, sum_inhibitor_takedowns, sum_inhibitors_lost, sum_items_purchased, sum_killing_sprees, sum_largest_killing_spree, sum_largest_multi_kill, sum_longest_time_spent_living, sum_need_vision_pings, sum_neutral_minions_killed, sum_objectives_stolen, sum_objectives_stolen_assists, sum_on_my_way_pings, sum_penta_kills, sum_push_pings, sum_quadra_kills, sum_retreat_pings, sum_sight_wards_bought_in_game, sum_team_early_surrendered, sum_time_ccing_others, sum_total_ally_jungle_minions_killed, sum_total_damage_shielded_on_teammates, sum_total_enemy_jungle_minions_killed, sum_total_time_spent_dead, sum_triple_kills, sum_turret_kills, sum_turrets_lost, sum_unreal_kills, sum_vision_cleared_pings, sum_vision_wards_bought_in_game, count_baron_kill_ge1_game, count_baron_kill_ge2_game, count_baron_kill_ge3p_game, count_dragon_kill_ge1_game, count_dragon_kill_ge2_game, count_dragon_kill_ge3p_game, count_tower_kill_ge1_game, count_tower_kill_ge2_game, count_tower_kill_ge3p_game, count_inhibitor_kill_ge1_game, count_inhibitor_kill_ge2_game, count_inhibitor_kill_ge3p_game, count_horde_kill_ge1_game, count_horde_kill_ge2_game, count_horde_kill_ge3p_game, count_horde_kill_ge4_game, count_horde_kill_ge5p_game, count_rift_herald_kill_ge1_game, count_rift_herald_kill_ge2p_game)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, team, champion_transform, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_bounty_gold, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage, sum_physical_damage_done, sum_magic_damage_done, sum_true_damage_done, sum_physical_damage_done_to_champions, sum_magic_damage_done_to_champions, sum_true_damage_done_to_champions, sum_damage_dealt_to_buildings, sum_damage_dealt_to_turrets, sum_damage_dealt_to_objectives, sum_damage_dealt_to_epic_monsters, sum_largest_critical_strike, sum_damage_per_minute, sum_physical_damage_taken, sum_magic_damage_taken, sum_true_damage_taken, sum_damage_self_mitigated, sum_total_heal, sum_total_heals_on_teammates, sum_total_units_healed, sum_total_units_healed_to_champions, sum_heal_from_map_sources, sum_effective_heal_and_shielding, sum_vision_score, sum_wards_placed, sum_wards_killed, sum_control_wards_placed, sum_kills, sum_assists, sum_total_time_cc_dealt, count_time_enemy_spent_controlled, sum_total_minions_killed, sum_baron_kills, sum_all_in_pings, sum_assist_me_pings, sum_basic_pings, count_first_blood_kill_true, count_first_blood_assist_true, count_first_tower_kill_true, count_first_tower_assist_true, count_baron_assist, count_dragon_kill, count_dragon_assist, count_rift_herald_kill, count_rift_herald_assist, count_horde_kill, count_horde_assist, count_elder_kill, count_elder_assist, count_tower_kill, count_tower_assist, count_inhibitor_kill, count_inhibitor_assist, count_baron_involved_win, count_dragon_involved_win, count_rift_herald_involved_win, count_horde_involved_win, count_elder_involved_win, count_tower_involved_win, count_inhibitor_involved_win, count_earth_drake_kill, count_earth_drake_assist, count_water_drake_kill, count_water_drake_assist, count_wind_drake_kill, count_wind_drake_assist, count_fire_drake_kill, count_fire_drake_assist, count_hextec_drake_kill, count_hextec_drake_assist, count_chem_drake_kill, count_chem_drake_assist, count_earth_soul, count_water_soul, count_wind_soul, count_fire_soul, count_hextec_soul, count_chem_soul, sum_12_assist_streak_count, sum_infernal_scale_pickup, sum_aces_before_15_minutes, sum_allied_jungle_monster_kills, sum_baron_takedowns, sum_buffs_stolen, sum_complete_support_quest_in_time, sum_damage_taken_on_team_percentage, sum_deaths_by_enemy_champs, sum_dodge_skill_shots_small_window, sum_double_aces, sum_dragon_takedowns, sum_earliest_baron, sum_elder_dragon_kills_with_opposing_soul, sum_elder_dragon_multikills, sum_enemy_champion_immobilizations, sum_enemy_jungle_monster_kills, sum_epic_monster_kills_near_enemy_jungler, sum_epic_monster_kills_within_30_seconds_of_spawn, sum_epic_monster_steals, sum_epic_monster_stolen_without_smite, sum_first_turret_killed_time, sum_fist_bump_participation, sum_flawless_aces, sum_full_team_takedown, sum_game_length, sum_gold_per_minute, sum_had_open_nexus, sum_immobilize_and_kill_with_ally, sum_initial_buff_count, sum_initial_crab_count, sum_jungle_cs_before_10_minutes, sum_jungler_takedowns_near_damaged_epic_monster, sum_k_turrets_destroyed_before_plates_fall, sum_kill_after_hidden_with_ally, sum_killed_champ_took_full_team_damage_survived, sum_kills_near_enemy_turret, sum_kills_on_other_lanes_early_jungle_as_laner, sum_kills_under_own_turret, sum_kills_with_help_from_epic_monster, sum_knock_enemy_into_team_and_kill, sum_land_skill_shots_early_game, sum_lane_minions_first_10_minutes, sum_lost_an_inhibitor, sum_mejais_full_stack_in_time, sum_multi_kill_one_spell, sum_multi_turret_rift_herald_count, sum_multikills, sum_multikills_after_aggressive_flash, sum_outer_turret_executes_before_10_minutes, sum_outnumbered_kills, sum_outnumbered_nexus_kill, sum_perfect_dragon_souls_taken, sum_perfect_game, sum_pick_kill_with_ally, sum_quick_cleanse, sum_quick_first_turret, sum_quick_solo_kills, sum_rift_herald_takedowns, sum_save_ally_from_death, sum_scuttle_crab_kills, sum_skillshots_dodged, sum_skillshots_hit, sum_solo_baron_kills, sum_solo_kills, sum_solo_turrets_lategame, sum_stealth_wards_placed, sum_survived_single_digit_hp_count, sum_survived_three_immobilizes_in_fight, sum_takedown_on_first_turret, sum_takedowns, sum_takedowns_after_gaining_level_advantage, sum_takedowns_before_jungle_minion_spawn, sum_takedowns_first_x_minutes, sum_takedowns_in_alcove, sum_takedowns_in_enemy_fountain, sum_team_damage_percentage, sum_took_large_damage_survived, sum_turret_plates_taken, sum_turret_takedowns, sum_turrets_taken_with_rift_herald, sum_twenty_minions_in_3_seconds_count, sum_two_wards_one_sweeper_count, sum_unseen_recalls, sum_vision_score_per_minute, sum_ward_takedowns, sum_ward_takedowns_before_20_m, sum_wards_guarded, sum_command_pings, sum_consumables_purchased, sum_danger_pings, sum_detector_wards_placed, sum_double_kills, sum_dragon_kills, sum_enemy_missing_pings, sum_enemy_vision_pings, sum_game_ended_in_early_surrender, sum_game_ended_in_surrender, sum_get_back_pings, sum_hold_pings, sum_inhibitor_kills, sum_inhibitor_takedowns, sum_inhibitors_lost, sum_items_purchased, sum_killing_sprees, sum_largest_killing_spree, sum_largest_multi_kill, sum_longest_time_spent_living, sum_need_vision_pings, sum_neutral_minions_killed, sum_objectives_stolen, sum_objectives_stolen_assists, sum_on_my_way_pings, sum_penta_kills, sum_push_pings, sum_quadra_kills, sum_retreat_pings, sum_sight_wards_bought_in_game, sum_team_early_surrendered, sum_time_ccing_others, sum_total_ally_jungle_minions_killed, sum_total_damage_shielded_on_teammates, sum_total_enemy_jungle_minions_killed, sum_total_time_spent_dead, sum_triple_kills, sum_turret_kills, sum_turrets_lost, sum_unreal_kills, sum_vision_cleared_pings, sum_vision_wards_bought_in_game, count_baron_kill_ge1_game, count_baron_kill_ge2_game, count_baron_kill_ge3p_game, count_dragon_kill_ge1_game, count_dragon_kill_ge2_game, count_dragon_kill_ge3p_game, count_tower_kill_ge1_game, count_tower_kill_ge2_game, count_tower_kill_ge3p_game, count_inhibitor_kill_ge1_game, count_inhibitor_kill_ge2_game, count_inhibitor_kill_ge3p_game, count_horde_kill_ge1_game, count_horde_kill_ge2_game, count_horde_kill_ge3p_game, count_horde_kill_ge4_game, count_horde_kill_ge5p_game, count_rift_herald_kill_ge1_game, count_rift_herald_kill_ge2p_game
    FROM _migrate_champion_stats;
    DROP TABLE _migrate_champion_stats;
    ALTER TABLE champion_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_vs_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_vs_stats;
    CREATE UNLOGGED TABLE _migrate_champion_vs_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, opponent_champion_id, champion_transform, set_item, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game, SUM(sum_gold_earned)::bigint AS sum_gold_earned, SUM(sum_gold_spent)::bigint AS sum_gold_spent, SUM(sum_max_level_lead_lane_opponent) AS sum_max_level_lead_lane_opponent, SUM(sum_max_kill_deficit) AS sum_max_kill_deficit, SUM(sum_more_enemy_jungle_than_opponent) AS sum_more_enemy_jungle_than_opponent, SUM(sum_max_cs_advantage_on_lane_opponent) AS sum_max_cs_advantage_on_lane_opponent, SUM(sum_vision_score_advantage_lane_opponent) AS sum_vision_score_advantage_lane_opponent, SUM(sum_laning_phase_gold_exp_advantage) AS sum_laning_phase_gold_exp_advantage, SUM(sum_early_laning_phase_gold_exp_advantage) AS sum_early_laning_phase_gold_exp_advantage, SUM(sum_physique_damage_done_to_champion_u15)::bigint AS sum_physique_damage_done_to_champion_u15, SUM(sum_magic_damage_done_to_champion_u15)::bigint AS sum_magic_damage_done_to_champion_u15, SUM(sum_true_damage_done_to_champion_u15)::bigint AS sum_true_damage_done_to_champion_u15, SUM(sum_kill_u15)::bigint AS sum_kill_u15, SUM(sum_assist_u15)::bigint AS sum_assist_u15, SUM(sum_death_u15)::bigint AS sum_death_u15, SUM(sum_vision_score_u15)::bigint AS sum_vision_score_u15, SUM(sum_shield_and_heal_u15)::bigint AS sum_shield_and_heal_u15, SUM(sum_minions_killed_u15)::bigint AS sum_minions_killed_u15, SUM(order_items) AS order_items, SUM(sum_kill_opponent_5min)::bigint AS sum_kill_opponent_5min, SUM(sum_kill_opponent_10min)::bigint AS sum_kill_opponent_10min, SUM(sum_kill_opponent_15min)::bigint AS sum_kill_opponent_15min, SUM(sum_death_by_opponent_5min)::bigint AS sum_death_by_opponent_5min, SUM(sum_death_by_opponent_10min)::bigint AS sum_death_by_opponent_10min, SUM(sum_death_by_opponent_15min)::bigint AS sum_death_by_opponent_15min, SUM(sum_death_by_dive)::bigint AS sum_death_by_dive, SUM(sum_kill_by_dive)::bigint AS sum_kill_by_dive, SUM(sum_kill_by_gank)::bigint AS sum_kill_by_gank, SUM(sum_death_by_gank)::bigint AS sum_death_by_gank, SUM(sum_gold_difference_5min)::bigint AS sum_gold_difference_5min, SUM(sum_gold_difference_10min)::bigint AS sum_gold_difference_10min, SUM(sum_gold_difference_15min)::bigint AS sum_gold_difference_15min, SUM(sum_gold_spent_5min)::bigint AS sum_gold_spent_5min, SUM(sum_gold_spent_10min)::bigint AS sum_gold_spent_10min, SUM(sum_gold_spent_15min)::bigint AS sum_gold_spent_15min, SUM(sum_gold_spent_by_opponent_5min)::bigint AS sum_gold_spent_by_opponent_5min, SUM(sum_gold_spent_by_opponent_10min)::bigint AS sum_gold_spent_by_opponent_10min, SUM(sum_gold_spent_by_opponent_15min)::bigint AS sum_gold_spent_by_opponent_15min, SUM(sum_gold_possessed_5min)::bigint AS sum_gold_possessed_5min, SUM(sum_gold_possessed_10min)::bigint AS sum_gold_possessed_10min, SUM(sum_gold_possessed_15min)::bigint AS sum_gold_possessed_15min, SUM(sum_gold_possessed_by_opponent_5min)::bigint AS sum_gold_possessed_by_opponent_5min, SUM(sum_gold_possessed_by_opponent_10min)::bigint AS sum_gold_possessed_by_opponent_10min, SUM(sum_gold_possessed_by_opponent_15min)::bigint AS sum_gold_possessed_by_opponent_15min, SUM(sum_cs_difference_5min)::bigint AS sum_cs_difference_5min, SUM(sum_cs_difference_10min)::bigint AS sum_cs_difference_10min, SUM(sum_cs_difference_15min)::bigint AS sum_cs_difference_15min, SUM(sum_cs_5min)::bigint AS sum_cs_5min, SUM(sum_cs_10min)::bigint AS sum_cs_10min, SUM(sum_cs_15min)::bigint AS sum_cs_15min, SUM(sum_cs_opponent_5min)::bigint AS sum_cs_opponent_5min, SUM(sum_cs_opponent_10min)::bigint AS sum_cs_opponent_10min, SUM(sum_cs_opponent_15min)::bigint AS sum_cs_opponent_15min, SUM(sum_vision_score_difference_5min)::bigint AS sum_vision_score_difference_5min, SUM(sum_vision_score_difference_10min)::bigint AS sum_vision_score_difference_10min, SUM(sum_vision_score_difference_15min)::bigint AS sum_vision_score_difference_15min, SUM(sum_vision_5min)::bigint AS sum_vision_5min, SUM(sum_vision_10min)::bigint AS sum_vision_10min, SUM(sum_vision_15min)::bigint AS sum_vision_15min, SUM(sum_vision_opponent_5min)::bigint AS sum_vision_opponent_5min, SUM(sum_vision_opponent_10min)::bigint AS sum_vision_opponent_10min, SUM(sum_vision_opponent_15min)::bigint AS sum_vision_opponent_15min, SUM(sum_level_5min)::bigint AS sum_level_5min, SUM(sum_level_10min)::bigint AS sum_level_10min, SUM(sum_level_15min)::bigint AS sum_level_15min, SUM(sum_level_opponent_5min)::bigint AS sum_level_opponent_5min, SUM(sum_level_opponent_10min)::bigint AS sum_level_opponent_10min, SUM(sum_level_opponent_15min)::bigint AS sum_level_opponent_15min, SUM(sum_xp_5min)::bigint AS sum_xp_5min, SUM(sum_xp_10min)::bigint AS sum_xp_10min, SUM(sum_xp_15min)::bigint AS sum_xp_15min, SUM(sum_xp_opponent_5min)::bigint AS sum_xp_opponent_5min, SUM(sum_xp_opponent_10min)::bigint AS sum_xp_opponent_10min, SUM(sum_xp_opponent_15min)::bigint AS sum_xp_opponent_15min, SUM(sum_have_legendary_item_first)::bigint AS sum_have_legendary_item_first, SUM(sum_opponent_have_legendary_item_first)::bigint AS sum_opponent_have_legendary_item_first, SUM(sum_buy_legendary_item_timestamp)::bigint AS sum_buy_legendary_item_timestamp, SUM(sum_opponent_buy_legendary_item_timestamp)::bigint AS sum_opponent_buy_legendary_item_timestamp, SUM(sum_have_boots_item_first)::bigint AS sum_have_boots_item_first, SUM(sum_opponent_have_boots_item_first)::bigint AS sum_opponent_have_boots_item_first, SUM(sum_buy_boots_item_timestamp)::bigint AS sum_buy_boots_item_timestamp, SUM(sum_opponent_buy_boots_item_timestamp)::bigint AS sum_opponent_buy_boots_item_timestamp, SUM(sum_have_boots_tier2_item_first)::bigint AS sum_have_boots_tier2_item_first, SUM(sum_opponent_have_boots_tier2_item_first)::bigint AS sum_opponent_have_boots_tier2_item_first, SUM(sum_buy_boots_tier2_item_timestamp)::bigint AS sum_buy_boots_tier2_item_timestamp, SUM(sum_opponent_buy_boots_tier2_item_timestamp)::bigint AS sum_opponent_buy_boots_tier2_item_timestamp, SUM(sum_consumable_item_bought)::bigint AS sum_consumable_item_bought, SUM(sum_consumable_item_bought_by_opponent)::bigint AS sum_consumable_item_bought_by_opponent, SUM(sum_kill_by_roaming)::bigint AS sum_kill_by_roaming, SUM(sum_kill_by_roaming_by_opponent)::bigint AS sum_kill_by_roaming_by_opponent, SUM(sum_death_by_roaming)::bigint AS sum_death_by_roaming, SUM(sum_death_by_roaming_by_opponent)::bigint AS sum_death_by_roaming_by_opponent, SUM(sum_first_tower)::bigint AS sum_first_tower, SUM(sum_first_tower_by_opponent)::bigint AS sum_first_tower_by_opponent, SUM(sum_turret_plate_taken)::bigint AS sum_turret_plate_taken, SUM(sum_turret_plate_taken_by_opponent)::bigint AS sum_turret_plate_taken_by_opponent, SUM(sum_drake_kill)::bigint AS sum_drake_kill, SUM(sum_drake_assist)::bigint AS sum_drake_assist, SUM(sum_drake_kill_by_opponent)::bigint AS sum_drake_kill_by_opponent, SUM(sum_drake_assist_by_opponent)::bigint AS sum_drake_assist_by_opponent, SUM(sum_void_kill)::bigint AS sum_void_kill, SUM(sum_void_assist)::bigint AS sum_void_assist, SUM(sum_void_kill_by_opponent)::bigint AS sum_void_kill_by_opponent, SUM(sum_void_assist_by_opponent)::bigint AS sum_void_assist_by_opponent, SUM(sum_herald_kill)::bigint AS sum_herald_kill, SUM(sum_herald_assist)::bigint AS sum_herald_assist, SUM(sum_herald_kill_by_opponent)::bigint AS sum_herald_kill_by_opponent, SUM(sum_herald_assist_by_opponent)::bigint AS sum_herald_assist_by_opponent, SUM(sum_objective_stolen)::bigint AS sum_objective_stolen, SUM(sum_objective_stolen_by_opponent)::bigint AS sum_objective_stolen_by_opponent, SUM(sum_kill_on_objective)::bigint AS sum_kill_on_objective, SUM(sum_kill_on_objective_by_opponent)::bigint AS sum_kill_on_objective_by_opponent, SUM(sum_death_on_objective)::bigint AS sum_death_on_objective, SUM(sum_death_on_objective_by_opponent)::bigint AS sum_death_on_objective_by_opponent
    FROM champion_vs_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_vs_stats;
    INSERT INTO champion_vs_stats (patch, role, rank_tier, region, champion_id, opponent_champion_id, champion_transform, set_item, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage, sum_physique_damage_done_to_champion_u15, sum_magic_damage_done_to_champion_u15, sum_true_damage_done_to_champion_u15, sum_kill_u15, sum_assist_u15, sum_death_u15, sum_vision_score_u15, sum_shield_and_heal_u15, sum_minions_killed_u15, order_items, sum_kill_opponent_5min, sum_kill_opponent_10min, sum_kill_opponent_15min, sum_death_by_opponent_5min, sum_death_by_opponent_10min, sum_death_by_opponent_15min, sum_death_by_dive, sum_kill_by_dive, sum_kill_by_gank, sum_death_by_gank, sum_gold_difference_5min, sum_gold_difference_10min, sum_gold_difference_15min, sum_gold_spent_5min, sum_gold_spent_10min, sum_gold_spent_15min, sum_gold_spent_by_opponent_5min, sum_gold_spent_by_opponent_10min, sum_gold_spent_by_opponent_15min, sum_gold_possessed_5min, sum_gold_possessed_10min, sum_gold_possessed_15min, sum_gold_possessed_by_opponent_5min, sum_gold_possessed_by_opponent_10min, sum_gold_possessed_by_opponent_15min, sum_cs_difference_5min, sum_cs_difference_10min, sum_cs_difference_15min, sum_cs_5min, sum_cs_10min, sum_cs_15min, sum_cs_opponent_5min, sum_cs_opponent_10min, sum_cs_opponent_15min, sum_vision_score_difference_5min, sum_vision_score_difference_10min, sum_vision_score_difference_15min, sum_vision_5min, sum_vision_10min, sum_vision_15min, sum_vision_opponent_5min, sum_vision_opponent_10min, sum_vision_opponent_15min, sum_level_5min, sum_level_10min, sum_level_15min, sum_level_opponent_5min, sum_level_opponent_10min, sum_level_opponent_15min, sum_xp_5min, sum_xp_10min, sum_xp_15min, sum_xp_opponent_5min, sum_xp_opponent_10min, sum_xp_opponent_15min, sum_have_legendary_item_first, sum_opponent_have_legendary_item_first, sum_buy_legendary_item_timestamp, sum_opponent_buy_legendary_item_timestamp, sum_have_boots_item_first, sum_opponent_have_boots_item_first, sum_buy_boots_item_timestamp, sum_opponent_buy_boots_item_timestamp, sum_have_boots_tier2_item_first, sum_opponent_have_boots_tier2_item_first, sum_buy_boots_tier2_item_timestamp, sum_opponent_buy_boots_tier2_item_timestamp, sum_consumable_item_bought, sum_consumable_item_bought_by_opponent, sum_kill_by_roaming, sum_kill_by_roaming_by_opponent, sum_death_by_roaming, sum_death_by_roaming_by_opponent, sum_first_tower, sum_first_tower_by_opponent, sum_turret_plate_taken, sum_turret_plate_taken_by_opponent, sum_drake_kill, sum_drake_assist, sum_drake_kill_by_opponent, sum_drake_assist_by_opponent, sum_void_kill, sum_void_assist, sum_void_kill_by_opponent, sum_void_assist_by_opponent, sum_herald_kill, sum_herald_assist, sum_herald_kill_by_opponent, sum_herald_assist_by_opponent, sum_objective_stolen, sum_objective_stolen_by_opponent, sum_kill_on_objective, sum_kill_on_objective_by_opponent, sum_death_on_objective, sum_death_on_objective_by_opponent)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, opponent_champion_id, champion_transform, set_item, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage, sum_physique_damage_done_to_champion_u15, sum_magic_damage_done_to_champion_u15, sum_true_damage_done_to_champion_u15, sum_kill_u15, sum_assist_u15, sum_death_u15, sum_vision_score_u15, sum_shield_and_heal_u15, sum_minions_killed_u15, order_items, sum_kill_opponent_5min, sum_kill_opponent_10min, sum_kill_opponent_15min, sum_death_by_opponent_5min, sum_death_by_opponent_10min, sum_death_by_opponent_15min, sum_death_by_dive, sum_kill_by_dive, sum_kill_by_gank, sum_death_by_gank, sum_gold_difference_5min, sum_gold_difference_10min, sum_gold_difference_15min, sum_gold_spent_5min, sum_gold_spent_10min, sum_gold_spent_15min, sum_gold_spent_by_opponent_5min, sum_gold_spent_by_opponent_10min, sum_gold_spent_by_opponent_15min, sum_gold_possessed_5min, sum_gold_possessed_10min, sum_gold_possessed_15min, sum_gold_possessed_by_opponent_5min, sum_gold_possessed_by_opponent_10min, sum_gold_possessed_by_opponent_15min, sum_cs_difference_5min, sum_cs_difference_10min, sum_cs_difference_15min, sum_cs_5min, sum_cs_10min, sum_cs_15min, sum_cs_opponent_5min, sum_cs_opponent_10min, sum_cs_opponent_15min, sum_vision_score_difference_5min, sum_vision_score_difference_10min, sum_vision_score_difference_15min, sum_vision_5min, sum_vision_10min, sum_vision_15min, sum_vision_opponent_5min, sum_vision_opponent_10min, sum_vision_opponent_15min, sum_level_5min, sum_level_10min, sum_level_15min, sum_level_opponent_5min, sum_level_opponent_10min, sum_level_opponent_15min, sum_xp_5min, sum_xp_10min, sum_xp_15min, sum_xp_opponent_5min, sum_xp_opponent_10min, sum_xp_opponent_15min, sum_have_legendary_item_first, sum_opponent_have_legendary_item_first, sum_buy_legendary_item_timestamp, sum_opponent_buy_legendary_item_timestamp, sum_have_boots_item_first, sum_opponent_have_boots_item_first, sum_buy_boots_item_timestamp, sum_opponent_buy_boots_item_timestamp, sum_have_boots_tier2_item_first, sum_opponent_have_boots_tier2_item_first, sum_buy_boots_tier2_item_timestamp, sum_opponent_buy_boots_tier2_item_timestamp, sum_consumable_item_bought, sum_consumable_item_bought_by_opponent, sum_kill_by_roaming, sum_kill_by_roaming_by_opponent, sum_death_by_roaming, sum_death_by_roaming_by_opponent, sum_first_tower, sum_first_tower_by_opponent, sum_turret_plate_taken, sum_turret_plate_taken_by_opponent, sum_drake_kill, sum_drake_assist, sum_drake_kill_by_opponent, sum_drake_assist_by_opponent, sum_void_kill, sum_void_assist, sum_void_kill_by_opponent, sum_void_assist_by_opponent, sum_herald_kill, sum_herald_assist, sum_herald_kill_by_opponent, sum_herald_assist_by_opponent, sum_objective_stolen, sum_objective_stolen_by_opponent, sum_kill_on_objective, sum_kill_on_objective_by_opponent, sum_death_on_objective, sum_death_on_objective_by_opponent
    FROM _migrate_champion_vs_stats;
    DROP TABLE _migrate_champion_vs_stats;
    ALTER TABLE champion_vs_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_duo_role_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_duo_role_stats;
    CREATE UNLOGGED TABLE _migrate_champion_duo_role_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, ally_champion_id, normalize_stats_role_text(ally_role::text) AS ally_role, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game, SUM(sum_gold_earned)::bigint AS sum_gold_earned, SUM(sum_gold_spent)::bigint AS sum_gold_spent, SUM(sum_max_level_lead_lane_opponent) AS sum_max_level_lead_lane_opponent, SUM(sum_max_kill_deficit) AS sum_max_kill_deficit, SUM(sum_more_enemy_jungle_than_opponent) AS sum_more_enemy_jungle_than_opponent, SUM(sum_max_cs_advantage_on_lane_opponent) AS sum_max_cs_advantage_on_lane_opponent, SUM(sum_vision_score_advantage_lane_opponent) AS sum_vision_score_advantage_lane_opponent, SUM(sum_laning_phase_gold_exp_advantage) AS sum_laning_phase_gold_exp_advantage, SUM(sum_early_laning_phase_gold_exp_advantage) AS sum_early_laning_phase_gold_exp_advantage
    FROM champion_duo_role_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_duo_role_stats;
    INSERT INTO champion_duo_role_stats (patch, role, rank_tier, region, champion_id, ally_champion_id, ally_role, champion_transform, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, ally_champion_id, normalize_stats_role_text(ally_role), champion_transform, count_win, count_game, sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage
    FROM _migrate_champion_duo_role_stats;
    DROP TABLE _migrate_champion_duo_role_stats;
    ALTER TABLE champion_duo_role_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN ally_role TYPE lol_role USING text_to_lol_role(ally_role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_spell_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_spell_stats;
    CREATE UNLOGGED TABLE _migrate_champion_spell_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, spell_order_hash, champion_transform, SUM(spell_order) AS spell_order, SUM(spell1_casts)::bigint AS spell1_casts, SUM(spell2_casts)::bigint AS spell2_casts, SUM(spell3_casts)::bigint AS spell3_casts, SUM(spell4_casts)::bigint AS spell4_casts, SUM(count_game)::bigint AS count_game, SUM(count_win)::bigint AS count_win, SUM(sum_timestamp_ms)::bigint AS sum_timestamp_ms
    FROM champion_spell_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_spell_stats;
    INSERT INTO champion_spell_stats (patch, role, rank_tier, region, champion_id, spell_order_hash, champion_transform, spell_order, spell1_casts, spell2_casts, spell3_casts, spell4_casts, count_game, count_win, sum_timestamp_ms)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, spell_order_hash, champion_transform, spell_order, spell1_casts, spell2_casts, spell3_casts, spell4_casts, count_game, count_win, sum_timestamp_ms
    FROM _migrate_champion_spell_stats;
    DROP TABLE _migrate_champion_spell_stats;
    ALTER TABLE champion_spell_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_item_set_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_item_set_stats;
    CREATE UNLOGGED TABLE _migrate_champion_item_set_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, phase, item_set_key, champion_transform, SUM(count_game)::bigint AS count_game, SUM(count_win)::bigint AS count_win
    FROM champion_item_set_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_item_set_stats;
    INSERT INTO champion_item_set_stats (patch, role, rank_tier, region, champion_id, phase, item_set_key, champion_transform, count_game, count_win)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, phase, item_set_key, champion_transform, count_game, count_win
    FROM _migrate_champion_item_set_stats;
    DROP TABLE _migrate_champion_item_set_stats;
    ALTER TABLE champion_item_set_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_item_solo_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_item_solo_stats;
    CREATE UNLOGGED TABLE _migrate_champion_item_solo_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, item_id, champion_transform, SUM(count_starter)::bigint AS count_starter, SUM(count_win_starter)::bigint AS count_win_starter, SUM(count_core)::bigint AS count_core, SUM(count_win_core)::bigint AS count_win_core, SUM(count_final)::bigint AS count_final, SUM(count_win_final)::bigint AS count_win_final, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game, SUM(sum_timestamp_ms)::bigint AS sum_timestamp_ms
    FROM champion_item_solo_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_item_solo_stats;
    INSERT INTO champion_item_solo_stats (patch, role, rank_tier, region, champion_id, item_id, champion_transform, count_starter, count_win_starter, count_core, count_win_core, count_final, count_win_final, count_win, count_game, sum_timestamp_ms)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, item_id, champion_transform, count_starter, count_win_starter, count_core, count_win_core, count_final, count_win_final, count_win, count_game, sum_timestamp_ms
    FROM _migrate_champion_item_solo_stats;
    DROP TABLE _migrate_champion_item_solo_stats;
    ALTER TABLE champion_item_solo_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_bucket'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_bucket;
    CREATE UNLOGGED TABLE _migrate_champion_bucket AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, duration_bucket, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game, SUM(sum_current_gold)::bigint AS sum_current_gold, SUM(sum_magic_damage_done)::bigint AS sum_magic_damage_done, SUM(sum_magic_damage_done_to_champion)::bigint AS sum_magic_damage_done_to_champion, SUM(sum_magic_damage_taken)::bigint AS sum_magic_damage_taken, SUM(sum_physical_damage_done)::bigint AS sum_physical_damage_done, SUM(sum_physical_damage_done_to_champion)::bigint AS sum_physical_damage_done_to_champion, SUM(sum_physical_damage_taken)::bigint AS sum_physical_damage_taken, SUM(sum_true_damage_done)::bigint AS sum_true_damage_done, SUM(sum_true_damage_done_to_champion)::bigint AS sum_true_damage_done_to_champion, SUM(sum_true_damage_taken)::bigint AS sum_true_damage_taken, SUM(sum_jungle_minions_killed)::bigint AS sum_jungle_minions_killed, SUM(sum_level)::bigint AS sum_level, SUM(sum_minions_killed)::bigint AS sum_minions_killed, SUM(sum_total_gold)::bigint AS sum_total_gold, SUM(sum_time_played)::bigint AS sum_time_played, SUM(sum_kills)::bigint AS sum_kills, SUM(sum_assists)::bigint AS sum_assists, SUM(sum_deaths)::bigint AS sum_deaths, SUM(sum_kills_assists)::bigint AS sum_kills_assists, SUM(sum_kd_diff_10)::bigint AS sum_kd_diff_10, SUM(sum_kd_diff_20)::bigint AS sum_kd_diff_20, SUM(count_kd_diff_10_positive_game)::bigint AS count_kd_diff_10_positive_game, SUM(count_kd_diff_10_positive_win)::bigint AS count_kd_diff_10_positive_win, SUM(count_kd_diff_20_positive_game)::bigint AS count_kd_diff_20_positive_game, SUM(count_kd_diff_20_positive_win)::bigint AS count_kd_diff_20_positive_win, SUM(count_game_end)::bigint AS count_game_end, SUM(count_time_enemy_spent_controlled)::bigint AS count_time_enemy_spent_controlled, SUM(transform_timestamp_ms)::bigint AS transform_timestamp_ms
    FROM champion_bucket
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_bucket;
    INSERT INTO champion_bucket (patch, role, rank_tier, region, champion_id, duration_bucket, champion_transform, count_win, count_game, sum_current_gold, sum_magic_damage_done, sum_magic_damage_done_to_champion, sum_magic_damage_taken, sum_physical_damage_done, sum_physical_damage_done_to_champion, sum_physical_damage_taken, sum_true_damage_done, sum_true_damage_done_to_champion, sum_true_damage_taken, sum_jungle_minions_killed, sum_level, sum_minions_killed, sum_total_gold, sum_time_played, sum_kills, sum_assists, sum_deaths, sum_kills_assists, sum_kd_diff_10, sum_kd_diff_20, count_kd_diff_10_positive_game, count_kd_diff_10_positive_win, count_kd_diff_20_positive_game, count_kd_diff_20_positive_win, count_game_end, count_time_enemy_spent_controlled, transform_timestamp_ms)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, duration_bucket, champion_transform, count_win, count_game, sum_current_gold, sum_magic_damage_done, sum_magic_damage_done_to_champion, sum_magic_damage_taken, sum_physical_damage_done, sum_physical_damage_done_to_champion, sum_physical_damage_taken, sum_true_damage_done, sum_true_damage_done_to_champion, sum_true_damage_taken, sum_jungle_minions_killed, sum_level, sum_minions_killed, sum_total_gold, sum_time_played, sum_kills, sum_assists, sum_deaths, sum_kills_assists, sum_kd_diff_10, sum_kd_diff_20, count_kd_diff_10_positive_game, count_kd_diff_10_positive_win, count_kd_diff_20_positive_game, count_kd_diff_20_positive_win, count_game_end, count_time_enemy_spent_controlled, transform_timestamp_ms
    FROM _migrate_champion_bucket;
    DROP TABLE _migrate_champion_bucket;
    ALTER TABLE champion_bucket
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_pick_order'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_pick_order;
    CREATE UNLOGGED TABLE _migrate_champion_pick_order AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, team, pick_order, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game
    FROM champion_pick_order
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_pick_order;
    INSERT INTO champion_pick_order (patch, role, rank_tier, region, champion_id, team, pick_order, champion_transform, count_win, count_game)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, team, pick_order, champion_transform, count_win, count_game
    FROM _migrate_champion_pick_order;
    DROP TABLE _migrate_champion_pick_order;
    ALTER TABLE champion_pick_order
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_runes_solo_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_runes_solo_stats;
    CREATE UNLOGGED TABLE _migrate_champion_runes_solo_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, perk_id, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game
    FROM champion_runes_solo_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_runes_solo_stats;
    INSERT INTO champion_runes_solo_stats (patch, role, rank_tier, region, champion_id, perk_id, champion_transform, count_win, count_game)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, perk_id, champion_transform, count_win, count_game
    FROM _migrate_champion_runes_solo_stats;
    DROP TABLE _migrate_champion_runes_solo_stats;
    ALTER TABLE champion_runes_solo_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_runes_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_runes_stats;
    CREATE UNLOGGED TABLE _migrate_champion_runes_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, rune_list, shard_list, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game
    FROM champion_runes_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_runes_stats;
    INSERT INTO champion_runes_stats (patch, role, rank_tier, region, champion_id, rune_list, shard_list, champion_transform, count_win, count_game)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, rune_list, shard_list, champion_transform, count_win, count_game
    FROM _migrate_champion_runes_stats;
    DROP TABLE _migrate_champion_runes_stats;
    ALTER TABLE champion_runes_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_shard_solo_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_shard_solo_stats;
    CREATE UNLOGGED TABLE _migrate_champion_shard_solo_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, shard_id, slot, champion_transform, SUM(count_win)::bigint AS count_win, SUM(count_game)::bigint AS count_game
    FROM champion_shard_solo_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_shard_solo_stats;
    INSERT INTO champion_shard_solo_stats (patch, role, rank_tier, region, champion_id, shard_id, slot, champion_transform, count_win, count_game)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, shard_id, slot, champion_transform, count_win, count_game
    FROM _migrate_champion_shard_solo_stats;
    DROP TABLE _migrate_champion_shard_solo_stats;
    ALTER TABLE champion_shard_solo_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_summoner_spell_pair_stats'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_summoner_spell_pair_stats;
    CREATE UNLOGGED TABLE _migrate_champion_summoner_spell_pair_stats AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, spell_d, spell_f, champion_transform, SUM(spell_d_casts)::bigint AS spell_d_casts, SUM(spell_f_casts)::bigint AS spell_f_casts, SUM(count_game)::bigint AS count_game, SUM(count_win)::bigint AS count_win
    FROM champion_summoner_spell_pair_stats
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
    TRUNCATE champion_summoner_spell_pair_stats;
    INSERT INTO champion_summoner_spell_pair_stats (patch, role, rank_tier, region, champion_id, spell_d, spell_f, champion_transform, spell_d_casts, spell_f_casts, count_game, count_win)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, spell_d, spell_f, champion_transform, spell_d_casts, spell_f_casts, count_game, count_win
    FROM _migrate_champion_summoner_spell_pair_stats;
    DROP TABLE _migrate_champion_summoner_spell_pair_stats;
    ALTER TABLE champion_summoner_spell_pair_stats
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_summoner_spells'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_summoner_spells;
    CREATE UNLOGGED TABLE _migrate_champion_summoner_spells AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, spell_id, champion_transform, SUM(count_win_d)::bigint AS count_win_d, SUM(count_win_f)::bigint AS count_win_f, SUM(count_game_d)::bigint AS count_game_d, SUM(count_game_f)::bigint AS count_game_f, SUM(count_slotd)::bigint AS count_slotd, SUM(count_slotf)::bigint AS count_slotf
    FROM champion_summoner_spells
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_summoner_spells;
    INSERT INTO champion_summoner_spells (patch, role, rank_tier, region, champion_id, spell_id, champion_transform, count_win_d, count_win_f, count_game_d, count_game_f, count_slotd, count_slotf)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, spell_id, champion_transform, count_win_d, count_win_f, count_game_d, count_game_f, count_slotd, count_slotf
    FROM _migrate_champion_summoner_spells;
    DROP TABLE _migrate_champion_summoner_spells;
    ALTER TABLE champion_summoner_spells
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_tier_daily_snapshots'
      AND column_name = 'role' AND udt_name <> 'lol_role'
  ) THEN
    DROP TABLE IF EXISTS _migrate_champion_tier_daily_snapshots;
    CREATE UNLOGGED TABLE _migrate_champion_tier_daily_snapshots AS
    SELECT patch, normalize_stats_role_text(role::text) AS role, upper(trim(rank_tier::text)) AS rank_tier, text_to_lol_region(region::text)::text AS region, champion_id, date_of_game, champion_transform, SUM(games)::bigint AS games, SUM(wins)::bigint AS wins, SUM(count_ban)::bigint AS count_ban
    FROM champion_tier_daily_snapshots
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    TRUNCATE champion_tier_daily_snapshots;
    INSERT INTO champion_tier_daily_snapshots (patch, role, rank_tier, region, champion_id, date_of_game, champion_transform, games, wins, count_ban)
    SELECT patch, normalize_stats_role_text(role), upper(trim(rank_tier)), text_to_lol_region(region)::text, champion_id, date_of_game, champion_transform, games, wins, count_ban
    FROM _migrate_champion_tier_daily_snapshots;
    DROP TABLE _migrate_champion_tier_daily_snapshots;
    ALTER TABLE champion_tier_daily_snapshots
      ALTER COLUMN role TYPE lol_role USING text_to_lol_role(role::text),
      ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text),
      ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_bans_by_banner'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE champion_bans_by_banner ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'botlane_duo_vs_duo_stats'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE botlane_duo_vs_duo_stats ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'item_tier_daily_snapshots'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE item_tier_daily_snapshots ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_outcome_stats'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE match_outcome_stats ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'objective_outcome_histogram'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE objective_outcome_histogram ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_core_stat'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE team_core_stat ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_rank_history'
      AND column_name = 'rank_tier' AND udt_name <> 'lol_rank_tier'
  ) THEN
    ALTER TABLE player_rank_history ALTER COLUMN rank_tier TYPE lol_rank_tier USING text_to_lol_rank_tier(rank_tier::text), ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players'
      AND column_name = 'region' AND udt_name <> 'lol_region'
  ) THEN
    ALTER TABLE players ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matchs'
      AND column_name = 'region' AND udt_name <> 'lol_region'
  ) THEN
    ALTER TABLE matchs ALTER COLUMN region TYPE lol_region USING text_to_lol_region(region::text);
  END IF;
END $$;

COMMIT;

DROP FUNCTION IF EXISTS normalize_stats_role_text(TEXT);
DROP FUNCTION IF EXISTS text_to_lol_role(TEXT);
DROP FUNCTION IF EXISTS text_to_lol_rank_tier(TEXT);
DROP FUNCTION IF EXISTS text_to_lol_region(TEXT);
