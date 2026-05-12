-- Partition LIST(patch) pour toutes les tables agrégées sauf `players`.
-- Généré par scripts/regenerate_statistiques_partition_migration.py
-- Idempotent : DROP des tables agrégées puis CREATE partitionnés.

DROP TABLE IF EXISTS botlane_duo_vs_duo_stats CASCADE;
DROP TABLE IF EXISTS champion_spell_stats CASCADE;
DROP TABLE IF EXISTS champion_duo_role_stats CASCADE;
DROP TABLE IF EXISTS champion_item_set_stats CASCADE;
DROP TABLE IF EXISTS champion_item_solo_stats CASCADE;
DROP TABLE IF EXISTS champion_bucket CASCADE;
DROP TABLE IF EXISTS champion_pick_order CASCADE;
DROP TABLE IF EXISTS champion_stats CASCADE;
DROP TABLE IF EXISTS champion_runes_solo_stats CASCADE;
DROP TABLE IF EXISTS champion_runes_stats CASCADE;
DROP TABLE IF EXISTS champion_shard_solo_stats CASCADE;
DROP TABLE IF EXISTS champion_tier_daily_snapshots CASCADE;
DROP TABLE IF EXISTS champion_bans_by_banner CASCADE;
DROP TABLE IF EXISTS champion_summoner_spell_pair_stats CASCADE;
DROP TABLE IF EXISTS champion_summoner_spells CASCADE;
DROP TABLE IF EXISTS champion_vs_stats CASCADE;
DROP TABLE IF EXISTS match_outcome_stats CASCADE;
DROP TABLE IF EXISTS objective_outcome_histogram CASCADE;
DROP TABLE IF EXISTS processed_matches CASCADE;
DROP TABLE IF EXISTS team_core_stat CASCADE;

CREATE TABLE botlane_duo_vs_duo_stats (
  patch    TEXT        NOT NULL,
  rank_tier       TEXT        NOT NULL,
  region          TEXT        NOT NULL,
  adc_id          INTEGER     NOT NULL,
  support_id      INTEGER     NOT NULL,
  opp_adc_id      INTEGER     NOT NULL,
  opp_support_id  INTEGER     NOT NULL,
  
  count_win       INTEGER     NOT NULL DEFAULT 0,
  count_game      INTEGER     NOT NULL DEFAULT 0,    
  
  -- ADC côté friendly
  sum_adc_gold_earned                           BIGINT  NOT NULL DEFAULT 0,
  sum_adc_gold_spent                            BIGINT  NOT NULL DEFAULT 0,
  sum_adc_max_level_lead_lane_opponent          INTEGER NOT NULL DEFAULT 0,
  sum_adc_max_kill_deficit                      INTEGER NOT NULL DEFAULT 0,
  sum_adc_max_cs_advantage_on_lane_opponent     INTEGER NOT NULL DEFAULT 0,
  sum_adc_vision_score_advantage_lane_opponent  INTEGER NOT NULL DEFAULT 0,
  sum_adc_laning_phase_gold_exp_advantage       INTEGER NOT NULL DEFAULT 0,
  sum_adc_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  sum_adc_physique_damage_done_to_champion_u15  BIGINT  NOT NULL DEFAULT 0,
  sum_adc_magic_damage_done_to_champion_u15     BIGINT  NOT NULL DEFAULT 0,
  sum_adc_true_damage_done_to_champion_u15      BIGINT  NOT NULL DEFAULT 0,
  sum_adc_kill_u15                              INTEGER NOT NULL DEFAULT 0,
  sum_adc_assist_u15                            INTEGER NOT NULL DEFAULT 0,
  sum_adc_death_u15                             INTEGER NOT NULL DEFAULT 0,
  sum_adc_vision_score_u15                      INTEGER NOT NULL DEFAULT 0,
  sum_adc_shield_and_heal_u15                   BIGINT  NOT NULL DEFAULT 0,
  sum_adc_minions_killed_u15                    INTEGER NOT NULL DEFAULT 0,

  -- Support côté friendly
  sum_support_gold_earned                           BIGINT  NOT NULL DEFAULT 0,
  sum_support_gold_spent                            BIGINT  NOT NULL DEFAULT 0,
  sum_support_max_level_lead_lane_opponent          INTEGER NOT NULL DEFAULT 0,
  sum_support_max_kill_deficit                      INTEGER NOT NULL DEFAULT 0,
  sum_support_max_cs_advantage_on_lane_opponent     INTEGER NOT NULL DEFAULT 0,
  sum_support_vision_score_advantage_lane_opponent  INTEGER NOT NULL DEFAULT 0,
  sum_support_laning_phase_gold_exp_advantage       INTEGER NOT NULL DEFAULT 0,
  sum_support_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  sum_support_physique_damage_done_to_champion_u15  BIGINT  NOT NULL DEFAULT 0,
  sum_support_magic_damage_done_to_champion_u15     BIGINT  NOT NULL DEFAULT 0,
  sum_support_true_damage_done_to_champion_u15      BIGINT  NOT NULL DEFAULT 0,
  sum_support_kill_u15                              INTEGER NOT NULL DEFAULT 0,
  sum_support_assist_u15                            INTEGER NOT NULL DEFAULT 0,
  sum_support_death_u15                             INTEGER NOT NULL DEFAULT 0,
  sum_support_vision_score_u15                      INTEGER NOT NULL DEFAULT 0,
  sum_support_shield_and_heal_u15                   BIGINT  NOT NULL DEFAULT 0,
  sum_support_minions_killed_u15                    INTEGER NOT NULL DEFAULT 0,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id)
) PARTITION BY LIST (patch);

CREATE TABLE botlane_duo_vs_duo_stats_p_default PARTITION OF botlane_duo_vs_duo_stats DEFAULT;

CREATE TABLE champion_spell_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  spell_order TEXT     NOT NULL,  -- "1-2-1-3-1-4-1-2-1-2-4-2-3-3-4-3-3" avec 1 Q spell 2 w spell 3 e spell 4 r
 
  spell1_casts  INTEGER     NOT NULL DEFAULT 0,
  spell2_casts  INTEGER     NOT NULL DEFAULT 0,
  spell3_casts  INTEGER     NOT NULL DEFAULT 0,
  spell4_casts  INTEGER     NOT NULL DEFAULT 0,
  sum_timestamp_ms BIGINT   NOT NULL DEFAULT 0,  -- somme des timestamps (ms) pour timing moyen de montée de sort
  count_game    INTEGER     NOT NULL DEFAULT 0,
  count_win     INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, spell_order)
) PARTITION BY LIST (patch);

CREATE TABLE champion_spell_stats_p_default PARTITION OF champion_spell_stats DEFAULT;

CREATE TABLE champion_duo_role_stats (
  -- Dimensions du champion principal
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
 
  -- Dimensions de l'allié
  ally_champion_id                          INTEGER     NOT NULL,
  ally_role                                 TEXT        NOT NULL,
  -- Métriques
  count_win                                 INTEGER     NOT NULL DEFAULT 0,
  count_game                                INTEGER     NOT NULL DEFAULT 0,
  sum_gold_earned                           BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_gold_spent                            BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_max_level_lead_lane_opponent          INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_max_kill_deficit                      INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_more_enemy_jungle_than_opponent       INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_max_cs_advantage_on_lane_opponent     INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_vision_score_advantage_lane_opponent  INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_laning_phase_gold_exp_advantage       INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_early_laning_phase_gold_exp_advantage INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, ally_champion_id, ally_role)
) PARTITION BY LIST (patch);

CREATE TABLE champion_duo_role_stats_p_default PARTITION OF champion_duo_role_stats DEFAULT;

CREATE TABLE champion_item_set_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,

  phase         TEXT      NOT NULL,  -- 'starter' | 'core' | 'final'
  item_set_key  TEXT      NOT NULL,  -- clé sérialisée et triée : '1001_2003_2003'
  count_game    INTEGER   NOT NULL DEFAULT 0,
  count_win     INTEGER   NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, phase, item_set_key)
) PARTITION BY LIST (patch);

CREATE TABLE champion_item_set_stats_p_default PARTITION OF champion_item_set_stats DEFAULT;

CREATE TABLE champion_item_solo_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,

  item_id           INTEGER     NOT NULL,
  count_starter     INTEGER     NOT NULL DEFAULT 0,
  count_win_starter INTEGER     NOT NULL DEFAULT 0,
  count_core        INTEGER     NOT NULL DEFAULT 0,
  count_win_core    INTEGER     NOT NULL DEFAULT 0,
  count_final       INTEGER     NOT NULL DEFAULT 0,
  count_win_final   INTEGER     NOT NULL DEFAULT 0,
  count_win         INTEGER     NOT NULL DEFAULT 0,
  count_game        INTEGER     NOT NULL DEFAULT 0,
  sum_timestamp_ms  BIGINT      NOT NULL DEFAULT 0,  -- pour calculer le timing moyen d'achat
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, item_id)
) PARTITION BY LIST (patch);

CREATE TABLE champion_item_solo_stats_p_default PARTITION OF champion_item_solo_stats DEFAULT;

CREATE TABLE champion_bucket (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  duration_bucket                   TEXT        NOT NULL,  -- ex: '0-25', '25-30', '30-35', '35+'
  count_win                         INTEGER     NOT NULL DEFAULT 0,
  count_game                        INTEGER     NOT NULL DEFAULT 0,
  sum_current_gold                  BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_done             BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_done_to_champion BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_taken            BIGINT      NOT NULL DEFAULT 0,
  sum_physical_damage_done          BIGINT      NOT NULL DEFAULT 0,
  sum_physical_damage_done_to_champion BIGINT   NOT NULL DEFAULT 0,
  sum_physical_damage_taken         BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_done              BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_done_to_champion  BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_taken             BIGINT      NOT NULL DEFAULT 0,
  sum_jungle_minions_killed         INTEGER     NOT NULL DEFAULT 0,
  sum_level                         INTEGER     NOT NULL DEFAULT 0,
  sum_minions_killed                INTEGER     NOT NULL DEFAULT 0,
  sum_total_gold                    BIGINT      NOT NULL DEFAULT 0,
  sum_time_played                   BIGINT      NOT NULL DEFAULT 0,
  sum_kills                         INTEGER     NOT NULL DEFAULT 0,
  sum_assists                       INTEGER     NOT NULL DEFAULT 0,
  sum_deaths                        INTEGER     NOT NULL DEFAULT 0,
  sum_kills_assists                 INTEGER     NOT NULL DEFAULT 0,
  sum_kd_diff_10                    INTEGER     NOT NULL DEFAULT 0,
  sum_kd_diff_20                    INTEGER     NOT NULL DEFAULT 0,
  count_kd_diff_10_positive_game    INTEGER     NOT NULL DEFAULT 0,
  count_kd_diff_10_positive_win     INTEGER     NOT NULL DEFAULT 0,
  count_kd_diff_20_positive_game    INTEGER     NOT NULL DEFAULT 0,
  count_kd_diff_20_positive_win     INTEGER     NOT NULL DEFAULT 0,
  count_game_end                    INTEGER     NOT NULL DEFAULT 0,
  count_time_enemy_spent_controlled INTEGER     NOT NULL DEFAULT 0,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, duration_bucket)
) PARTITION BY LIST (patch);

CREATE TABLE champion_bucket_p_default PARTITION OF champion_bucket DEFAULT;

CREATE TABLE champion_pick_order (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  team          SMALLINT    NOT NULL,

  pick_order    TEXT        NOT NULL,
  count_win                                 INTEGER     NOT NULL DEFAULT 0,
  count_game                                INTEGER     NOT NULL DEFAULT 0,
  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, team, pick_order)
) PARTITION BY LIST (patch);

CREATE TABLE champion_pick_order_p_default PARTITION OF champion_pick_order DEFAULT;

CREATE TABLE champion_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  team          SMALLINT    NOT NULL,

  -- Compteurs de base
  count_win                                 INTEGER     NOT NULL DEFAULT 0,
  count_game                                INTEGER     NOT NULL DEFAULT 0,

  -- Économie
  sum_gold_earned                           BIGINT      NOT NULL DEFAULT 0,
  sum_gold_spent                            BIGINT      NOT NULL DEFAULT 0,
  sum_bounty_gold                           BIGINT      NOT NULL DEFAULT 0,

  -- Avantages de lane
  sum_max_level_lead_lane_opponent          INTEGER     NOT NULL DEFAULT 0,
  sum_max_kill_deficit                      INTEGER     NOT NULL DEFAULT 0,
  sum_more_enemy_jungle_than_opponent       INTEGER     NOT NULL DEFAULT 0,
  sum_max_cs_advantage_on_lane_opponent     INTEGER     NOT NULL DEFAULT 0,
  sum_vision_score_advantage_lane_opponent  INTEGER     NOT NULL DEFAULT 0,
  sum_laning_phase_gold_exp_advantage       INTEGER     NOT NULL DEFAULT 0,
  sum_early_laning_phase_gold_exp_advantage INTEGER     NOT NULL DEFAULT 0,

  -- Dégâts infligés
  sum_physical_damage_done                  BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_done                     BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_done                      BIGINT      NOT NULL DEFAULT 0,
  sum_physical_damage_done_to_champions     BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_done_to_champions        BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_done_to_champions         BIGINT      NOT NULL DEFAULT 0,
  sum_damage_dealt_to_buildings             BIGINT      NOT NULL DEFAULT 0,
  sum_damage_dealt_to_turrets               BIGINT      NOT NULL DEFAULT 0,
  sum_damage_dealt_to_objectives            BIGINT      NOT NULL DEFAULT 0,
  sum_damage_dealt_to_epic_monsters         BIGINT      NOT NULL DEFAULT 0,
  sum_largest_critical_strike               BIGINT      NOT NULL DEFAULT 0,
  sum_damage_per_minute                     BIGINT      NOT NULL DEFAULT 0,

  -- Dégâts subis / mitigation
  sum_physical_damage_taken                 BIGINT      NOT NULL DEFAULT 0,
  sum_magic_damage_taken                    BIGINT      NOT NULL DEFAULT 0,
  sum_true_damage_taken                     BIGINT      NOT NULL DEFAULT 0,
  sum_damage_self_mitigated                 BIGINT      NOT NULL DEFAULT 0,

  -- Soins & boucliers
  sum_total_heal                            BIGINT      NOT NULL DEFAULT 0,
  sum_total_heals_on_teammates              BIGINT      NOT NULL DEFAULT 0,
  sum_total_units_healed                    BIGINT      NOT NULL DEFAULT 0,
  sum_total_units_healed_to_champions       BIGINT      NOT NULL DEFAULT 0,
  sum_heal_from_map_sources                 BIGINT      NOT NULL DEFAULT 0,
  sum_effective_heal_and_shielding          BIGINT      NOT NULL DEFAULT 0,

  -- Vision
  sum_vision_score                          BIGINT      NOT NULL DEFAULT 0,
  sum_wards_placed                          BIGINT      NOT NULL DEFAULT 0,
  sum_wards_killed                          BIGINT      NOT NULL DEFAULT 0,
  sum_control_wards_placed                  BIGINT      NOT NULL DEFAULT 0,

  -- Combat
  sum_kills                                 BIGINT      NOT NULL DEFAULT 0,
  sum_assists                               BIGINT      NOT NULL DEFAULT 0,
  sum_total_time_cc_dealt                   BIGINT      NOT NULL DEFAULT 0,
  count_time_enemy_spent_controlled         BIGINT      NOT NULL DEFAULT 0,

  -- Farm
  sum_total_minions_killed                  BIGINT      NOT NULL DEFAULT 0,
  sum_baron_kills                           BIGINT      NOT NULL DEFAULT 0,

  -- Pings
  sum_all_in_pings                          BIGINT      NOT NULL DEFAULT 0,
  sum_assist_me_pings                       BIGINT      NOT NULL DEFAULT 0,
  sum_basic_pings                           BIGINT      NOT NULL DEFAULT 0,

  -- First blood / tower
  count_first_blood_kill_true               BIGINT      NOT NULL DEFAULT 0,
  count_first_blood_assist_true             BIGINT      NOT NULL DEFAULT 0,
  count_first_tower_kill_true               BIGINT      NOT NULL DEFAULT 0,
  count_first_tower_assist_true             BIGINT      NOT NULL DEFAULT 0,

  -- Objectifs : kills/assists bruts
  count_baron_kill                          BIGINT      NOT NULL DEFAULT 0,
  count_baron_assist                        BIGINT      NOT NULL DEFAULT 0,
  count_dragon_kill                         BIGINT      NOT NULL DEFAULT 0,
  count_dragon_assist                       BIGINT      NOT NULL DEFAULT 0,
  count_rift_herald_kill                    BIGINT      NOT NULL DEFAULT 0,
  count_rift_herald_assist                  BIGINT      NOT NULL DEFAULT 0,
  count_horde_kill                          BIGINT      NOT NULL DEFAULT 0,
  count_horde_assist                        BIGINT      NOT NULL DEFAULT 0,
  count_elder_kill                          BIGINT      NOT NULL DEFAULT 0,
  count_elder_assist                        BIGINT      NOT NULL DEFAULT 0,
  count_tower_kill                          BIGINT      NOT NULL DEFAULT 0,
  count_tower_assist                        BIGINT      NOT NULL DEFAULT 0,
  count_inhibitor_kill                      BIGINT      NOT NULL DEFAULT 0,
  count_inhibitor_assist                    BIGINT      NOT NULL DEFAULT 0,

  -- Objectifs : contexte game (involved = kill OU assist)
  count_baron_involved_win                  BIGINT      NOT NULL DEFAULT 0,
  count_dragon_involved_win                 BIGINT      NOT NULL DEFAULT 0,
  count_rift_herald_involved_win            BIGINT      NOT NULL DEFAULT 0,
  count_horde_involved_win                  BIGINT      NOT NULL DEFAULT 0,
  count_elder_involved_win                  BIGINT      NOT NULL DEFAULT 0,
  count_tower_involved_win                  BIGINT      NOT NULL DEFAULT 0,
  count_inhibitor_involved_win              BIGINT      NOT NULL DEFAULT 0,

  -- Drakes par type
  count_earth_drake_kill                    BIGINT      NOT NULL DEFAULT 0,
  count_earth_drake_assist                  BIGINT      NOT NULL DEFAULT 0,
  count_water_drake_kill                    BIGINT      NOT NULL DEFAULT 0,
  count_water_drake_assist                  BIGINT      NOT NULL DEFAULT 0,
  count_wind_drake_kill                     BIGINT      NOT NULL DEFAULT 0,
  count_wind_drake_assist                   BIGINT      NOT NULL DEFAULT 0,
  count_fire_drake_kill                     BIGINT      NOT NULL DEFAULT 0,
  count_fire_drake_assist                   BIGINT      NOT NULL DEFAULT 0,
  count_hextec_drake_kill                   BIGINT      NOT NULL DEFAULT 0,
  count_hextec_drake_assist                 BIGINT      NOT NULL DEFAULT 0,
  count_chem_drake_kill                     BIGINT      NOT NULL DEFAULT 0,
  count_chem_drake_assist                   BIGINT      NOT NULL DEFAULT 0,

  -- Souls
  count_earth_soul                          BIGINT      NOT NULL DEFAULT 0,
  count_water_soul                          BIGINT      NOT NULL DEFAULT 0,
  count_wind_soul                           BIGINT      NOT NULL DEFAULT 0,
  count_fire_soul                           BIGINT      NOT NULL DEFAULT 0,
  count_hextec_soul                         BIGINT      NOT NULL DEFAULT 0,
  count_chem_soul                           BIGINT      NOT NULL DEFAULT 0,

  sum_12_assist_streak_count BIGINT      NOT NULL DEFAULT 0,
  sum_infernal_scale_pickup BIGINT      NOT NULL DEFAULT 0,
  sum_aces_before_15_minutes BIGINT      NOT NULL DEFAULT 0,
  sum_allied_jungle_monster_kills BIGINT      NOT NULL DEFAULT 0,
  sum_baron_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_buffs_stolen BIGINT      NOT NULL DEFAULT 0,
  sum_complete_support_quest_in_time BIGINT      NOT NULL DEFAULT 0,
  sum_damage_taken_on_team_percentage NUMERIC(10,4)      NOT NULL DEFAULT 0,
  sum_deaths_by_enemy_champs BIGINT      NOT NULL DEFAULT 0,
  sum_dodge_skill_shots_small_window BIGINT      NOT NULL DEFAULT 0,
  sum_double_aces BIGINT      NOT NULL DEFAULT 0,
  sum_dragon_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_earliest_baron BIGINT      NOT NULL DEFAULT 0,
  sum_elder_dragon_kills_with_opposing_soul BIGINT      NOT NULL DEFAULT 0,
  sum_elder_dragon_multikills BIGINT      NOT NULL DEFAULT 0,
  sum_enemy_champion_immobilizations BIGINT      NOT NULL DEFAULT 0,
  sum_enemy_jungle_monster_kills BIGINT      NOT NULL DEFAULT 0,
  sum_epic_monster_kills_near_enemy_jungler BIGINT      NOT NULL DEFAULT 0,
  sum_epic_monster_kills_within_30_seconds_of_spawn BIGINT      NOT NULL DEFAULT 0,
  sum_epic_monster_steals BIGINT      NOT NULL DEFAULT 0,
  sum_epic_monster_stolen_without_smite BIGINT      NOT NULL DEFAULT 0,
  sum_first_turret_killed_time BIGINT      NOT NULL DEFAULT 0,
  sum_fist_bump_participation BIGINT      NOT NULL DEFAULT 0,
  sum_flawless_aces BIGINT      NOT NULL DEFAULT 0,
  sum_full_team_takedown BIGINT      NOT NULL DEFAULT 0,
  sum_game_length BIGINT      NOT NULL DEFAULT 0,
  sum_gold_per_minute BIGINT      NOT NULL DEFAULT 0,
  sum_had_open_nexus BIGINT      NOT NULL DEFAULT 0,
  sum_immobilize_and_kill_with_ally BIGINT      NOT NULL DEFAULT 0,
  sum_initial_buff_count BIGINT      NOT NULL DEFAULT 0,
  sum_initial_crab_count BIGINT      NOT NULL DEFAULT 0,
  sum_jungle_cs_before_10_minutes BIGINT      NOT NULL DEFAULT 0,
  sum_jungler_takedowns_near_damaged_epic_monster BIGINT      NOT NULL DEFAULT 0,
  sum_k_turrets_destroyed_before_plates_fall BIGINT      NOT NULL DEFAULT 0,
  sum_kill_after_hidden_with_ally BIGINT      NOT NULL DEFAULT 0,
  sum_killed_champ_took_full_team_damage_survived BIGINT      NOT NULL DEFAULT 0,
  sum_kills_near_enemy_turret BIGINT      NOT NULL DEFAULT 0,
  sum_kills_on_other_lanes_early_jungle_as_laner BIGINT      NOT NULL DEFAULT 0,
  sum_kills_under_own_turret BIGINT      NOT NULL DEFAULT 0,
  sum_kills_with_help_from_epic_monster BIGINT      NOT NULL DEFAULT 0,
  sum_knock_enemy_into_team_and_kill BIGINT      NOT NULL DEFAULT 0,
  sum_land_skill_shots_early_game BIGINT      NOT NULL DEFAULT 0,
  sum_lane_minions_first_10_minutes BIGINT      NOT NULL DEFAULT 0,
  sum_lost_an_inhibitor BIGINT      NOT NULL DEFAULT 0,
  sum_mejais_full_stack_in_time BIGINT      NOT NULL DEFAULT 0,
  sum_multi_kill_one_spell BIGINT      NOT NULL DEFAULT 0,
  sum_multi_turret_rift_herald_count BIGINT      NOT NULL DEFAULT 0,
  sum_multikills BIGINT      NOT NULL DEFAULT 0,
  sum_multikills_after_aggressive_flash BIGINT      NOT NULL DEFAULT 0,
  sum_outer_turret_executes_before_10_minutes BIGINT      NOT NULL DEFAULT 0,
  sum_outnumbered_kills BIGINT      NOT NULL DEFAULT 0,
  sum_outnumbered_nexus_kill BIGINT      NOT NULL DEFAULT 0,
  sum_perfect_dragon_souls_taken BIGINT      NOT NULL DEFAULT 0,
  sum_perfect_game BIGINT      NOT NULL DEFAULT 0,
  sum_pick_kill_with_ally BIGINT      NOT NULL DEFAULT 0,
  sum_quick_cleanse BIGINT      NOT NULL DEFAULT 0,
  sum_quick_first_turret BIGINT      NOT NULL DEFAULT 0,
  sum_quick_solo_kills BIGINT      NOT NULL DEFAULT 0,
  sum_rift_herald_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_save_ally_from_death BIGINT      NOT NULL DEFAULT 0,
  sum_scuttle_crab_kills BIGINT      NOT NULL DEFAULT 0,
  sum_skillshots_dodged BIGINT      NOT NULL DEFAULT 0,
  sum_skillshots_hit BIGINT      NOT NULL DEFAULT 0,
  sum_snowballs_hit BIGINT      NOT NULL DEFAULT 0,
  sum_solo_baron_kills BIGINT      NOT NULL DEFAULT 0,
  sum_solo_kills BIGINT      NOT NULL DEFAULT 0,
  sum_solo_turrets_lategame BIGINT      NOT NULL DEFAULT 0,
  sum_stealth_wards_placed BIGINT      NOT NULL DEFAULT 0,
  sum_survived_single_digit_hp_count BIGINT      NOT NULL DEFAULT 0,
  sum_survived_three_immobilizes_in_fight BIGINT      NOT NULL DEFAULT 0,
  sum_takedown_on_first_turret BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns_after_gaining_level_advantage BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns_before_jungle_minion_spawn BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns_first_x_minutes BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns_in_alcove BIGINT      NOT NULL DEFAULT 0,
  sum_takedowns_in_enemy_fountain BIGINT      NOT NULL DEFAULT 0,
  sum_team_damage_percentage NUMERIC(10,4)      NOT NULL DEFAULT 0,
  sum_took_large_damage_survived BIGINT      NOT NULL DEFAULT 0,
  sum_turret_plates_taken BIGINT      NOT NULL DEFAULT 0,
  sum_turret_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_turrets_taken_with_rift_herald BIGINT      NOT NULL DEFAULT 0,
  sum_twenty_minions_in_3_seconds_count BIGINT      NOT NULL DEFAULT 0,
  sum_two_wards_one_sweeper_count BIGINT      NOT NULL DEFAULT 0,
  sum_unseen_recalls BIGINT      NOT NULL DEFAULT 0,
  sum_vision_score_per_minute BIGINT      NOT NULL DEFAULT 0,
  sum_ward_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_ward_takedowns_before_20_m BIGINT      NOT NULL DEFAULT 0,
  sum_wards_guarded BIGINT      NOT NULL DEFAULT 0,
  sum_command_pings BIGINT      NOT NULL DEFAULT 0,
  sum_consumables_purchased BIGINT      NOT NULL DEFAULT 0,
  sum_danger_pings BIGINT      NOT NULL DEFAULT 0,
  sum_detector_wards_placed BIGINT      NOT NULL DEFAULT 0,
  sum_double_kills BIGINT      NOT NULL DEFAULT 0,
  sum_dragon_kills BIGINT      NOT NULL DEFAULT 0,
  sum_enemy_missing_pings BIGINT      NOT NULL DEFAULT 0,
  sum_enemy_vision_pings BIGINT      NOT NULL DEFAULT 0,
  sum_game_ended_in_early_surrender BIGINT      NOT NULL DEFAULT 0,
  sum_game_ended_in_surrender BIGINT      NOT NULL DEFAULT 0,
  sum_get_back_pings BIGINT      NOT NULL DEFAULT 0,
  sum_hold_pings BIGINT      NOT NULL DEFAULT 0,
  sum_inhibitor_kills BIGINT      NOT NULL DEFAULT 0,
  sum_inhibitor_takedowns BIGINT      NOT NULL DEFAULT 0,
  sum_inhibitors_lost BIGINT      NOT NULL DEFAULT 0,
  sum_items_purchased BIGINT      NOT NULL DEFAULT 0,
  sum_killing_sprees BIGINT      NOT NULL DEFAULT 0,
  sum_largest_killing_spree BIGINT      NOT NULL DEFAULT 0,
  sum_largest_multi_kill BIGINT      NOT NULL DEFAULT 0,
  sum_longest_time_spent_living BIGINT      NOT NULL DEFAULT 0,
  sum_need_vision_pings BIGINT      NOT NULL DEFAULT 0,
  sum_neutral_minions_killed BIGINT      NOT NULL DEFAULT 0,
  sum_objectives_stolen BIGINT      NOT NULL DEFAULT 0,
  sum_objectives_stolen_assists BIGINT      NOT NULL DEFAULT 0,
  sum_on_my_way_pings BIGINT      NOT NULL DEFAULT 0,
  sum_penta_kills BIGINT      NOT NULL DEFAULT 0,
  sum_push_pings BIGINT      NOT NULL DEFAULT 0,
  sum_quadra_kills BIGINT      NOT NULL DEFAULT 0,
  sum_retreat_pings BIGINT      NOT NULL DEFAULT 0,
  sum_sight_wards_bought_in_game BIGINT      NOT NULL DEFAULT 0,
  sum_team_early_surrendered BIGINT      NOT NULL DEFAULT 0,
  sum_time_ccing_others BIGINT      NOT NULL DEFAULT 0,
  sum_total_ally_jungle_minions_killed BIGINT      NOT NULL DEFAULT 0,
  sum_total_damage_shielded_on_teammates BIGINT      NOT NULL DEFAULT 0,
  sum_total_enemy_jungle_minions_killed BIGINT      NOT NULL DEFAULT 0,
  sum_total_time_spent_dead BIGINT      NOT NULL DEFAULT 0,
  sum_triple_kills BIGINT      NOT NULL DEFAULT 0,
  sum_turret_kills BIGINT      NOT NULL DEFAULT 0,
  sum_turrets_lost BIGINT      NOT NULL DEFAULT 0,
  sum_unreal_kills BIGINT      NOT NULL DEFAULT 0,
  sum_vision_cleared_pings BIGINT      NOT NULL DEFAULT 0,
  sum_vision_wards_bought_in_game BIGINT      NOT NULL DEFAULT 0,

  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, team)
) PARTITION BY LIST (patch);

CREATE TABLE champion_stats_p_default PARTITION OF champion_stats DEFAULT;

CREATE TABLE champion_runes_solo_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  perk_id       INTEGER     NOT NULL,
  count_win     INTEGER     NOT NULL DEFAULT 0,
  count_game    INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, perk_id)
) PARTITION BY LIST (patch);

CREATE TABLE champion_runes_solo_stats_p_default PARTITION OF champion_runes_solo_stats DEFAULT;

CREATE TABLE champion_runes_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  rune_list     TEXT        NOT NULL,  -- clé composite sérialisée (ex: "8021_8010_9111_8299")
  shard_list    TEXT        NOT NULL,  -- ex: "5008_5008_5001"
  count_win     INTEGER     NOT NULL DEFAULT 0,
  count_game    INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, rune_list, shard_list)
) PARTITION BY LIST (patch);

CREATE TABLE champion_runes_stats_p_default PARTITION OF champion_runes_stats DEFAULT;

CREATE TABLE champion_shard_solo_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  shard_id      INTEGER     NOT NULL,
  slot          SMALLINT    NOT NULL,  -- 0, 1 ou 2
  count_win     INTEGER     NOT NULL DEFAULT 0,
  count_game    INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, shard_id, slot)
) PARTITION BY LIST (patch);

CREATE TABLE champion_shard_solo_stats_p_default PARTITION OF champion_shard_solo_stats DEFAULT;

CREATE TABLE champion_tier_daily_snapshots (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  date_of_game  DATE        NOT NULL,

  games         INTEGER     NOT NULL DEFAULT 0,
  wins          INTEGER     NOT NULL DEFAULT 0,
  count_ban     INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, date_of_game)
) PARTITION BY LIST (patch);

CREATE TABLE champion_tier_daily_snapshots_p_default PARTITION OF champion_tier_daily_snapshots DEFAULT;

CREATE TABLE champion_bans_by_banner (
  patch          TEXT        NOT NULL,
  rank_tier             TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  banned_champion_id    SMALLINT    NOT NULL,

  count_banner_team_100 INTEGER     NOT NULL DEFAULT 0,
  count_banner_team_200 INTEGER     NOT NULL DEFAULT 0,
  count_banner_top      INTEGER     NOT NULL DEFAULT 0,
  count_banner_jungle   INTEGER     NOT NULL DEFAULT 0,
  count_banner_mid      INTEGER     NOT NULL DEFAULT 0,
  count_banner_adc      INTEGER     NOT NULL DEFAULT 0,
  count_banner_support  INTEGER     NOT NULL DEFAULT 0,

  PRIMARY KEY (patch, rank_tier, region, banned_champion_id)
) PARTITION BY LIST (patch);

CREATE TABLE champion_bans_by_banner_p_default PARTITION OF champion_bans_by_banner DEFAULT;

CREATE TABLE champion_summoner_spell_pair_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  spell_d       INTEGER     NOT NULL,
  spell_f       INTEGER     NOT NULL,
  spell_d_casts INTEGER     NOT NULL DEFAULT 0,
  spell_f_casts INTEGER     NOT NULL DEFAULT 0,
  count_game    INTEGER     NOT NULL DEFAULT 0,
  count_win     INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, spell_d, spell_f)
) PARTITION BY LIST (patch);

CREATE TABLE champion_summoner_spell_pair_stats_p_default PARTITION OF champion_summoner_spell_pair_stats DEFAULT;

CREATE TABLE champion_summoner_spells (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  spell_id      INTEGER     NOT NULL,
  count_win_d   INTEGER     NOT NULL DEFAULT 0,
  count_win_f   INTEGER     NOT NULL DEFAULT 0,
  count_game_d  INTEGER     NOT NULL DEFAULT 0,
  count_game_f  INTEGER     NOT NULL DEFAULT 0,
  count_slotd   INTEGER     NOT NULL DEFAULT 0,
  count_slotf   INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, spell_id)
) PARTITION BY LIST (patch);

CREATE TABLE champion_summoner_spells_p_default PARTITION OF champion_summoner_spells DEFAULT;

CREATE TABLE champion_vs_stats (
  patch  TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  champion_id   INTEGER     NOT NULL,
  
  opponent_champion_id                      SmallInt     NOT NULL,     
  count_win                                 INTEGER     NOT NULL DEFAULT 0,
  count_game                                INTEGER     NOT NULL DEFAULT 0,
  sum_gold_earned                           BIGINT      NOT NULL DEFAULT 0,
  sum_gold_spent                            BIGINT      NOT NULL DEFAULT 0,
  sum_max_level_lead_lane_opponent          INTEGER     NOT NULL DEFAULT 0,
  sum_max_kill_deficit                      INTEGER     NOT NULL DEFAULT 0,
  sum_more_enemy_jungle_than_opponent       INTEGER     NOT NULL DEFAULT 0,
  sum_max_cs_advantage_on_lane_opponent     INTEGER     NOT NULL DEFAULT 0,
  sum_vision_score_advantage_lane_opponent  INTEGER     NOT NULL DEFAULT 0,
  sum_laning_phase_gold_exp_advantage       INTEGER     NOT NULL DEFAULT 0,
  sum_early_laning_phase_gold_exp_advantage INTEGER     NOT NULL DEFAULT 0,

  -- Stats under 15 min
  sum_physique_damage_done_to_champion_u15  BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_magic_damage_done_to_champion_u15     BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_true_damage_done_to_champion_u15      BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_kill_u15                              INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_assist_u15                            INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_death_u15                             INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_vision_score_u15                      INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_shield_and_heal_u15                   BIGINT      NOT NULL DEFAULT 0,  -- [INFÉRÉ]
  sum_minions_killed_u15                    INTEGER     NOT NULL DEFAULT 0,  -- [INFÉRÉ]

  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, role, rank_tier, region, champion_id, opponent_champion_id)
) PARTITION BY LIST (patch);

CREATE TABLE champion_vs_stats_p_default PARTITION OF champion_vs_stats DEFAULT;

CREATE TABLE match_outcome_stats (
  patch  TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  count_match   INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, rank_tier)
) PARTITION BY LIST (patch);

CREATE TABLE match_outcome_stats_p_default PARTITION OF match_outcome_stats DEFAULT;

CREATE TABLE objective_outcome_histogram (
  patch    TEXT      NOT NULL,
  rank_tier       TEXT      NOT NULL,
  region        TEXT        NOT NULL,
  team       SMALLINT  NOT NULL,   -- 100 ou 200
  objective_type  TEXT      NOT NULL,   -- 'baron', 'drake', 'elder', 'herald', 'inhibitor', 'tower', 'firstBlood', 'firstTower', 'firstInhibitor', 'firstDragon', 'firstRiftHerald', etc.
  outcome         TEXT      NOT NULL,   -- 'win' ou 'loss'
  obj_count       SMALLINT  NOT NULL,   -- 0, 1, 2, 3... (jamais pré-défini)
  count_games     INTEGER   NOT NULL DEFAULT 0,
  sum_timestamp_ms BIGINT   NOT NULL DEFAULT 0,  -- somme des timestamps (ms) pour timing moyen de kill objectif
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, rank_tier, region, team, objective_type, outcome, obj_count)
) PARTITION BY LIST (patch);

CREATE TABLE objective_outcome_histogram_p_default PARTITION OF objective_outcome_histogram DEFAULT;

CREATE TABLE IF NOT EXISTS players (
  puuid                   VARCHAR(78)            PRIMARY KEY,
  game_name               TEXT,
  tag_name                TEXT,
  region                  TEXT            NOT NULL,
  puuid_key_version       TEXT,                             -- 'dev' | 'persos' | 'prod'
  last_seen               TIMESTAMPTZ,
  rank_tier               TEXT,
  rank_division           TEXT,
  rank_lp                 INTEGER,
  rank_snapshot_game_date TIMESTAMPTZ,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE TABLE processed_matches (
  patch            TEXT        NOT NULL,
  riot_match_id           TEXT        NOT NULL,
  game_date               DATE        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'PENDING',
  aggregate_status        TEXT        NOT NULL DEFAULT 'PENDING',
  aggregate_attempt_count INTEGER   NOT NULL DEFAULT 0,
  aggregate_last_error    TEXT,
  aggregated_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (patch, riot_match_id)
) PARTITION BY LIST (patch);

CREATE TABLE processed_matches_p_default PARTITION OF processed_matches DEFAULT;

CREATE TABLE team_core_stat (
  patch                TEXT        NOT NULL,
  rank_tier                   TEXT        NOT NULL,
  region                      TEXT        NOT NULL,
  team                        SMALLINT    NOT NULL,
  count_win                   INTEGER     NOT NULL DEFAULT 0,
  count_game                  INTEGER     NOT NULL DEFAULT 0,
  count_team_early_surrendered INTEGER    NOT NULL DEFAULT 0,
  count_team_surrendered      INTEGER     NOT NULL DEFAULT 0,

  PRIMARY KEY (patch, rank_tier, region, team)
) PARTITION BY LIST (patch);

CREATE TABLE team_core_stat_p_default PARTITION OF team_core_stat DEFAULT;

CREATE INDEX idx_champion_tier_snapshot_champ
  ON champion_tier_daily_snapshots (champion_id, date_of_game DESC);
CREATE INDEX idx_champion_tier_snapshot_tier
  ON champion_tier_daily_snapshots (rank_tier, role, date_of_game DESC);
CREATE INDEX idx_champion_bans
  ON champion_bans_by_banner (patch, rank_tier, banned_champion_id);
CREATE INDEX idx_champion_vs_dims
  ON champion_vs_stats (role, rank_tier, patch, region);
CREATE INDEX idx_objective_outcome_patch_div
  ON objective_outcome_histogram (patch, rank_tier);
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
