-- ============================================================
-- Migration 20260317000000_init
-- Drop all tables/views/functions from old schema EXCEPT players,
-- then create all new tables from prisma2 schema.
-- The players table is preserved with its existing data.
-- ============================================================

-- ── Drop old views & functions (may not exist, so use IF EXISTS) ──────────────

DROP MATERIALIZED VIEW IF EXISTS mv_stats_overview_detail CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_stats_overview CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_stats_overview_teams CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stats_overview_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stats_champions_mv CASCADE;

DROP VIEW IF EXISTS players_with_stats CASCADE;

DROP FUNCTION IF EXISTS get_stats_overview() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_detail() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_detail(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_detail(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_detail(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_teams() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_teams(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_teams(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_duration_winrate() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_duration_winrate(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_duration_winrate(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression_full() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression_full(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_progression_full(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_champions() CASCADE;
DROP FUNCTION IF EXISTS get_stats_champions(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_champions(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int, text) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int, text, text, text, int) CASCADE;
DROP FUNCTION IF EXISTS get_builds_by_champion(int, text, text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS get_runes_by_champion(int) CASCADE;
DROP FUNCTION IF EXISTS get_runes_by_champion(int, text) CASCADE;
DROP FUNCTION IF EXISTS get_runes_by_champion(int, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_runes_by_champion(int, text, text, int) CASCADE;
DROP FUNCTION IF EXISTS get_runes_by_champion(int, text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS get_players_with_stats() CASCADE;

-- ── Drop old tables (FK order: children first) ───────────────────────────────

DROP TABLE IF EXISTS participant_jungle_first_clear CASCADE;
DROP TABLE IF EXISTS participant_spell_orders CASCADE;
DROP TABLE IF EXISTS participant_perks CASCADE;
DROP TABLE IF EXISTS participant_summoner_spells CASCADE;
DROP TABLE IF EXISTS participant_spells CASCADE;
DROP TABLE IF EXISTS participant_runes CASCADE;
DROP TABLE IF EXISTS participant_items CASCADE;
DROP TABLE IF EXISTS match_teams_objectives CASCADE;
DROP TABLE IF EXISTS match_teams_drake CASCADE;
DROP TABLE IF EXISTS bans CASCADE;
DROP TABLE IF EXISTS match_teams CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS challenge_keys_registry CASCADE;
DROP TABLE IF EXISTS stats_precomputed CASCADE;
DROP TABLE IF EXISTS matchup_tier_scores CASCADE;
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- ── Ensure players table exists (preserved from old schema, created fresh on new DB) ──

CREATE TABLE IF NOT EXISTS "players" (
    "id" BIGSERIAL NOT NULL,
    "puuid" TEXT NOT NULL,
    "game_name" TEXT,
    "tag_name" TEXT,
    "region" TEXT NOT NULL,
    "puuid_key_version" TEXT,
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "players_puuid_key" ON "players"("puuid");
CREATE INDEX IF NOT EXISTS "players_region_idx" ON "players"("region");
CREATE INDEX IF NOT EXISTS "players_last_seen_idx" ON "players"("last_seen");

-- ── Create new raw tables ─────────────────────────────────────────────────────

-- matchs
CREATE TABLE "matchs" (
    "id" BIGSERIAL NOT NULL,
    "riot_match_id" TEXT NOT NULL,
    "game_version" TEXT NOT NULL,
    "game_duration" INTEGER NOT NULL,
    "rank_tier" TEXT NOT NULL,
    "rank_division" TEXT NOT NULL,
    "game_ended_in_surrender" BOOLEAN NOT NULL DEFAULT false,
    "game_ended_in_early_surrender" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT NOT NULL,
    CONSTRAINT "matchs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "matchs_riot_match_id_key" ON "matchs"("riot_match_id");
CREATE INDEX "matchs_game_version_idx" ON "matchs"("game_version");
CREATE INDEX "matchs_rank_tier_idx" ON "matchs"("rank_tier");
CREATE INDEX "matchs_region_idx" ON "matchs"("region");
CREATE INDEX "matchs_game_version_region_rank_tier_idx" ON "matchs"("game_version", "region", "rank_tier");

-- teams
CREATE TABLE "teams" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "team" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "team_early_surrendered" BOOLEAN NOT NULL DEFAULT false,
    "baron_kills" INTEGER NOT NULL DEFAULT 0,
    "baron_first" BOOLEAN NOT NULL DEFAULT false,
    "dragon_kills" INTEGER NOT NULL DEFAULT 0,
    "dragon_first" BOOLEAN NOT NULL DEFAULT false,
    "tower_kills" INTEGER NOT NULL DEFAULT 0,
    "tower_first" BOOLEAN NOT NULL DEFAULT false,
    "horde_kills" INTEGER NOT NULL DEFAULT 0,
    "horde_first" BOOLEAN NOT NULL DEFAULT false,
    "rift_herald_kills" INTEGER NOT NULL DEFAULT 0,
    "rift_herald_first" BOOLEAN NOT NULL DEFAULT false,
    "inhibitor_kills" INTEGER NOT NULL DEFAULT 0,
    "champion_kills" INTEGER NOT NULL DEFAULT 0,
    "first_blood" BOOLEAN NOT NULL DEFAULT false,
    "elder_kills" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teams_match_id_team_key" ON "teams"("match_id", "team");
CREATE INDEX "teams_match_id_idx" ON "teams"("match_id");
ALTER TABLE "teams" ADD CONSTRAINT "teams_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- bans
CREATE TABLE "bans" (
    "id" BIGSERIAL NOT NULL,
    "team_id" BIGINT NOT NULL,
    "match_id" BIGINT NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "pick_order" INTEGER NOT NULL,
    CONSTRAINT "bans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bans_team_id_idx" ON "bans"("team_id");
CREATE INDEX "bans_match_id_idx" ON "bans"("match_id");
CREATE INDEX "bans_champion_id_idx" ON "bans"("champion_id");
ALTER TABLE "bans" ADD CONSTRAINT "bans_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- drake_details
CREATE TABLE "drake_details" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "drake_type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "soul" TEXT NOT NULL,
    CONSTRAINT "drake_details_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "drake_details_match_id_idx" ON "drake_details"("match_id");
CREATE INDEX "drake_details_team_id_idx" ON "drake_details"("team_id");
ALTER TABLE "drake_details" ADD CONSTRAINT "drake_details_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drake_details" ADD CONSTRAINT "drake_details_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_players
CREATE TABLE "match_players" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "player_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "rank_tier" TEXT NOT NULL DEFAULT 'UNRANKED',
    "rank_division" TEXT,
    "rank_lp" INTEGER,
    "participant_id" INTEGER NOT NULL,
    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_players_match_id_player_id_key" ON "match_players"("match_id", "player_id");
CREATE INDEX "match_players_match_id_idx" ON "match_players"("match_id");
CREATE INDEX "match_players_player_id_idx" ON "match_players"("player_id");
CREATE INDEX "match_players_team_id_idx" ON "match_players"("team_id");
CREATE INDEX "match_players_champion_id_idx" ON "match_players"("champion_id");
CREATE INDEX "match_players_champion_id_role_rank_tier_idx" ON "match_players"("champion_id", "role", "rank_tier");
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_core
CREATE TABLE "match_player_core" (
    "match_player_id" BIGINT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "champ_level" INTEGER NOT NULL DEFAULT 0,
    "champ_experience" INTEGER NOT NULL DEFAULT 0,
    "gold_earned" INTEGER NOT NULL DEFAULT 0,
    "gold_spent" INTEGER NOT NULL DEFAULT 0,
    "items_purchased" INTEGER NOT NULL DEFAULT 0,
    "consumables_purchased" INTEGER NOT NULL DEFAULT 0,
    "total_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "role_bound_item" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_core_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_core" ADD CONSTRAINT "match_player_core_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_visions
CREATE TABLE "match_player_visions" (
    "match_player_id" BIGINT NOT NULL,
    "detector_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "vision_score" INTEGER NOT NULL DEFAULT 0,
    "vision_wards_bought_in_game" INTEGER NOT NULL DEFAULT 0,
    "wards_killed" INTEGER NOT NULL DEFAULT 0,
    "wards_placed" INTEGER NOT NULL DEFAULT 0,
    "control_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "unseen_recalls" INTEGER NOT NULL DEFAULT 0,
    "vision_score_advantage_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "ward_takedowns" INTEGER NOT NULL DEFAULT 0,
    "ward_takedowns_before_20_m" INTEGER NOT NULL DEFAULT 0,
    "wards_guarded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_visions_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_visions" ADD CONSTRAINT "match_player_visions_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_matchup
CREATE TABLE "match_player_matchup" (
    "match_player_id" BIGINT NOT NULL,
    "bounty_gold" INTEGER NOT NULL DEFAULT 0,
    "complete_support_quest_in_time" INTEGER NOT NULL DEFAULT 0,
    "deaths_by_enemy_champs" INTEGER NOT NULL DEFAULT 0,
    "early_laning_phase_gold_exp_advantage" INTEGER NOT NULL DEFAULT 0,
    "initial_crab_count" INTEGER NOT NULL DEFAULT 0,
    "jungle_cs_before_10_minutes" INTEGER NOT NULL DEFAULT 0,
    "kills_near_enemy_turret" INTEGER NOT NULL DEFAULT 0,
    "kills_on_other_lanes_early_jungle_as_laner" INTEGER NOT NULL DEFAULT 0,
    "kills_under_own_turret" INTEGER NOT NULL DEFAULT 0,
    "land_skill_shots_early_game" INTEGER NOT NULL DEFAULT 0,
    "lane_minions_first_10_minutes" INTEGER NOT NULL DEFAULT 0,
    "laning_phase_gold_exp_advantage" INTEGER NOT NULL DEFAULT 0,
    "max_cs_advantage_on_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "max_kill_deficit" INTEGER NOT NULL DEFAULT 0,
    "max_level_lead_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "outnumbered_kills" INTEGER NOT NULL DEFAULT 0,
    "quick_solo_kills" INTEGER NOT NULL DEFAULT 0,
    "solo_kills" INTEGER NOT NULL DEFAULT 0,
    "takedowns_after_gaining_level_advantage" INTEGER NOT NULL DEFAULT 0,
    "more_enemy_jungle_than_opponent" INTEGER NOT NULL DEFAULT 0,
    "total_ally_jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "total_enemy_jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "neutral_minions_killed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_matchup_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_matchup" ADD CONSTRAINT "match_player_matchup_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_objectives
CREATE TABLE "match_player_objectives" (
    "match_player_id" BIGINT NOT NULL,
    "dragon_kills" INTEGER NOT NULL DEFAULT 0,
    "first_blood_kill" BOOLEAN NOT NULL DEFAULT false,
    "first_blood_assist" BOOLEAN NOT NULL DEFAULT false,
    "first_tower_kill" BOOLEAN NOT NULL DEFAULT false,
    "first_tower_assist" BOOLEAN NOT NULL DEFAULT false,
    "inhibitor_kills" INTEGER NOT NULL DEFAULT 0,
    "inhibitor_takedowns" INTEGER NOT NULL DEFAULT 0,
    "inhibitors_lost" INTEGER NOT NULL DEFAULT 0,
    "objectives_stolen" INTEGER NOT NULL DEFAULT 0,
    "objectives_stolen_assists" INTEGER NOT NULL DEFAULT 0,
    "turret_kills" INTEGER NOT NULL DEFAULT 0,
    "turret_takedowns" INTEGER NOT NULL DEFAULT 0,
    "turrets_lost" INTEGER NOT NULL DEFAULT 0,
    "dragon_takedowns" INTEGER NOT NULL DEFAULT 0,
    "earliest_baron" INTEGER NOT NULL DEFAULT 0,
    "elder_dragon_kills_with_opposing_soul" INTEGER NOT NULL DEFAULT 0,
    "elder_dragon_multikills" INTEGER NOT NULL DEFAULT 0,
    "epic_monster_kills_near_enemy_jungler" INTEGER NOT NULL DEFAULT 0,
    "epic_monster_kills_within_30_seconds_of_spawn" INTEGER NOT NULL DEFAULT 0,
    "epic_monster_steals" INTEGER NOT NULL DEFAULT 0,
    "epic_monster_stolen_without_smite" INTEGER NOT NULL DEFAULT 0,
    "first_turret_killed_time" INTEGER NOT NULL DEFAULT 0,
    "rift_herald_takedowns" INTEGER NOT NULL DEFAULT 0,
    "turret_plates_taken" INTEGER NOT NULL DEFAULT 0,
    "turrets_taken_with_rift_herald" INTEGER NOT NULL DEFAULT 0,
    "baron_takedowns" INTEGER NOT NULL DEFAULT 0,
    "quick_first_turret" INTEGER NOT NULL DEFAULT 0,
    "solo_baron_kills" INTEGER NOT NULL DEFAULT 0,
    "solo_turrets_lategame" INTEGER NOT NULL DEFAULT 0,
    "takedown_on_first_turret" INTEGER NOT NULL DEFAULT 0,
    "multi_turret_rift_herald_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_objectives_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_objectives" ADD CONSTRAINT "match_player_objectives_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_combats
CREATE TABLE "match_player_combats" (
    "match_player_id" BIGINT NOT NULL,
    "damage_dealt_to_buildings" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt_to_epic_monsters" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt_to_objectives" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt_to_turrets" INTEGER NOT NULL DEFAULT 0,
    "damage_self_mitigated" INTEGER NOT NULL DEFAULT 0,
    "double_kills" INTEGER NOT NULL DEFAULT 0,
    "killing_sprees" INTEGER NOT NULL DEFAULT 0,
    "largest_critical_strike" INTEGER NOT NULL DEFAULT 0,
    "largest_killing_spree" INTEGER NOT NULL DEFAULT 0,
    "longest_time_spent_living" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "penta_kills" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "quadra_kills" INTEGER NOT NULL DEFAULT 0,
    "total_damage_shielded_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "total_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "total_heal" INTEGER NOT NULL DEFAULT 0,
    "total_heals_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "total_time_cc_dealt" INTEGER NOT NULL DEFAULT 0,
    "total_units_healed" INTEGER NOT NULL DEFAULT 0,
    "triple_kills" INTEGER NOT NULL DEFAULT 0,
    "true_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "true_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "true_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "effective_heal_and_shielding" INTEGER NOT NULL DEFAULT 0,
    "time_ccing_others" INTEGER NOT NULL DEFAULT 0,
    "enemy_champion_immobilizations" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_combats_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_combats" ADD CONSTRAINT "match_player_combats_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_challenges
CREATE TABLE "match_player_challenges" (
    "match_player_id" BIGINT NOT NULL,
    "heal_from_map_sources" INTEGER NOT NULL DEFAULT 0,
    "buffs_stolen" INTEGER NOT NULL DEFAULT 0,
    "dodge_skill_shots_small_window" INTEGER NOT NULL DEFAULT 0,
    "had_open_nexus" INTEGER NOT NULL DEFAULT 0,
    "immobilize_and_kill_with_ally" INTEGER NOT NULL DEFAULT 0,
    "jungler_takedowns_near_damaged_epic_monster" INTEGER NOT NULL DEFAULT 0,
    "kill_after_hidden_with_ally" INTEGER NOT NULL DEFAULT 0,
    "killed_champ_took_full_team_damage_survived" INTEGER NOT NULL DEFAULT 0,
    "kills_with_help_from_epic_monster" INTEGER NOT NULL DEFAULT 0,
    "knock_enemy_into_team_and_kill" INTEGER NOT NULL DEFAULT 0,
    "mejais_full_stack_in_time" INTEGER NOT NULL DEFAULT 0,
    "multikills_after_aggressive_flash" INTEGER NOT NULL DEFAULT 0,
    "quick_cleanse" INTEGER NOT NULL DEFAULT 0,
    "save_ally_from_death" INTEGER NOT NULL DEFAULT 0,
    "scuttle_crab_kills" INTEGER NOT NULL DEFAULT 0,
    "skillshots_dodged" INTEGER NOT NULL DEFAULT 0,
    "skillshots_hit" INTEGER NOT NULL DEFAULT 0,
    "stealth_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "survived_single_digit_hp_count" INTEGER NOT NULL DEFAULT 0,
    "survived_three_immobilizes_in_fight" INTEGER NOT NULL DEFAULT 0,
    "takedowns_before_jungle_minion_spawn" INTEGER NOT NULL DEFAULT 0,
    "takedowns_in_alcove" INTEGER NOT NULL DEFAULT 0,
    "takedowns_in_enemy_fountain" INTEGER NOT NULL DEFAULT 0,
    "took_large_damage_survived" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_challenges_pkey" PRIMARY KEY ("match_player_id")
);
ALTER TABLE "match_player_challenges" ADD CONSTRAINT "match_player_challenges_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_items
CREATE TABLE "match_player_items" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "starter" BOOLEAN NOT NULL DEFAULT false,
    "core" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "timestamp_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_player_items_match_player_id_item_id_order_key" ON "match_player_items"("match_player_id", "item_id", "order");
CREATE INDEX "match_player_items_match_player_id_idx" ON "match_player_items"("match_player_id");
CREATE INDEX "match_player_items_item_id_idx" ON "match_player_items"("item_id");
ALTER TABLE "match_player_items" ADD CONSTRAINT "match_player_items_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_runes
CREATE TABLE "match_player_runes" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "perk_id" INTEGER NOT NULL,
    "style" INTEGER NOT NULL,
    CONSTRAINT "match_player_runes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "match_player_runes_match_player_id_idx" ON "match_player_runes"("match_player_id");
ALTER TABLE "match_player_runes" ADD CONSTRAINT "match_player_runes_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_summoner_spells
CREATE TABLE "match_player_summoner_spells" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "spell_id" INTEGER NOT NULL,
    "spell_slot" INTEGER NOT NULL,
    CONSTRAINT "match_player_summoner_spells_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_player_summoner_spells_match_player_id_spell_slot_key" ON "match_player_summoner_spells"("match_player_id", "spell_slot");
CREATE INDEX "match_player_summoner_spells_match_player_id_idx" ON "match_player_summoner_spells"("match_player_id");
ALTER TABLE "match_player_summoner_spells" ADD CONSTRAINT "match_player_summoner_spells_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_shards
CREATE TABLE "match_player_shards" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "shard_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    CONSTRAINT "match_player_shards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_player_shards_match_player_id_slot_key" ON "match_player_shards"("match_player_id", "slot");
CREATE INDEX "match_player_shards_match_player_id_idx" ON "match_player_shards"("match_player_id");
ALTER TABLE "match_player_shards" ADD CONSTRAINT "match_player_shards_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_spell_orders
CREATE TABLE "match_player_spell_orders" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "spell_slot" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "timestamp_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_spell_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "match_player_spell_orders_match_player_id_idx" ON "match_player_spell_orders"("match_player_id");
ALTER TABLE "match_player_spell_orders" ADD CONSTRAINT "match_player_spell_orders_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- match_player_bucket
CREATE TABLE "match_player_bucket" (
    "id" BIGSERIAL NOT NULL,
    "match_player_id" BIGINT NOT NULL,
    "duration_bucket" INTEGER NOT NULL,
    "current_gold" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_done" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "magic_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_done" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "physical_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "total_damage_done" INTEGER NOT NULL DEFAULT 0,
    "total_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "total_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "true_damage_done" INTEGER NOT NULL DEFAULT 0,
    "true_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "true_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "gold_per_second" INTEGER NOT NULL DEFAULT 0,
    "jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "minions_killed" INTEGER NOT NULL DEFAULT 0,
    "time_enemy_spent_controlled" INTEGER NOT NULL DEFAULT 0,
    "total_gold" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_player_bucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_player_bucket_match_player_id_duration_bucket_key" ON "match_player_bucket"("match_player_id", "duration_bucket");
CREATE INDEX "match_player_bucket_match_player_id_idx" ON "match_player_bucket"("match_player_id");
ALTER TABLE "match_player_bucket" ADD CONSTRAINT "match_player_bucket_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Aggregate tables ──────────────────────────────────────────────────────────

-- champion_core_stats
CREATE TABLE "champion_core_stats" (
    "id" BIGSERIAL NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "rank_tier" TEXT NOT NULL,
    "rank_division" TEXT,
    "game_version" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "sum_game_duration" BIGINT NOT NULL DEFAULT 0,
    "count_team_100" INTEGER NOT NULL DEFAULT 0,
    "count_team_200" INTEGER NOT NULL DEFAULT 0,
    "count_game_ended_in_surrender" INTEGER NOT NULL DEFAULT 0,
    "count_game_ended_in_early_surrender" INTEGER NOT NULL DEFAULT 0,
    "count_team_early_surrendered" INTEGER NOT NULL DEFAULT 0,
    "count_ban" INTEGER NOT NULL DEFAULT 0,
    "sum_kills" BIGINT NOT NULL DEFAULT 0,
    "sum_deaths" BIGINT NOT NULL DEFAULT 0,
    "sum_assists" BIGINT NOT NULL DEFAULT 0,
    "sum_champ_level" BIGINT NOT NULL DEFAULT 0,
    "sum_champ_experience" BIGINT NOT NULL DEFAULT 0,
    "sum_gold_earned" BIGINT NOT NULL DEFAULT 0,
    "sum_gold_spent" BIGINT NOT NULL DEFAULT 0,
    "sum_total_minions_killed" BIGINT NOT NULL DEFAULT 0,
    "sum_consumables_purchased" BIGINT NOT NULL DEFAULT 0,
    "sum_items_purchased" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "champion_core_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "champion_core_stats_champion_id_rank_tier_rank_division_game__key" ON "champion_core_stats"("champion_id", "rank_tier", "rank_division", "game_version", "role", "region");
CREATE INDEX "champion_core_stats_champion_id_game_version_rank_tier_role_r_idx" ON "champion_core_stats"("champion_id", "game_version", "rank_tier", "role", "region");
CREATE INDEX "champion_core_stats_game_version_idx" ON "champion_core_stats"("game_version");

-- champion_vs_stats
CREATE TABLE "champion_vs_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "opponent_champion_id" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_vs_stats_pkey" PRIMARY KEY ("champion_stat_id", "opponent_champion_id")
);
CREATE INDEX "champion_vs_stats_champion_stat_id_idx" ON "champion_vs_stats"("champion_stat_id");
CREATE INDEX "champion_vs_stats_opponent_champion_id_idx" ON "champion_vs_stats"("opponent_champion_id");
ALTER TABLE "champion_vs_stats" ADD CONSTRAINT "champion_vs_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- team_core_stats
CREATE TABLE "team_core_stats" (
    "id" BIGSERIAL NOT NULL,
    "team" INTEGER NOT NULL,
    "rank_tier" TEXT NOT NULL,
    "rank_division" TEXT,
    "game_version" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "count_team_early_surrendered" INTEGER NOT NULL DEFAULT 0,
    "sum_baron_kills" INTEGER NOT NULL DEFAULT 0,
    "count_baron_first" INTEGER NOT NULL DEFAULT 0,
    "sum_dragon_kills" INTEGER NOT NULL DEFAULT 0,
    "count_dragon_first" INTEGER NOT NULL DEFAULT 0,
    "sum_tower_kills" INTEGER NOT NULL DEFAULT 0,
    "count_tower_first" INTEGER NOT NULL DEFAULT 0,
    "sum_horde_kills" INTEGER NOT NULL DEFAULT 0,
    "count_horde_first" INTEGER NOT NULL DEFAULT 0,
    "sum_rift_herald_kills" INTEGER NOT NULL DEFAULT 0,
    "count_rift_herald_first" INTEGER NOT NULL DEFAULT 0,
    "sum_inhibitor_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_champion_kills" INTEGER NOT NULL DEFAULT 0,
    "count_first_blood" INTEGER NOT NULL DEFAULT 0,
    "sum_elder_kills" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "team_core_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_core_stats_team_rank_tier_rank_division_game_version_reg_key" ON "team_core_stats"("team", "rank_tier", "rank_division", "game_version", "region");
CREATE INDEX "team_core_stats_team_game_version_rank_tier_region_idx" ON "team_core_stats"("team", "game_version", "rank_tier", "region");

-- champion_first_objectif_stats
CREATE TABLE "champion_first_objectif_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "count_baron_first" INTEGER NOT NULL DEFAULT 0,
    "count_dragon_first" INTEGER NOT NULL DEFAULT 0,
    "count_tower_first" INTEGER NOT NULL DEFAULT 0,
    "count_horde_first" INTEGER NOT NULL DEFAULT 0,
    "count_rift_herald_first" INTEGER NOT NULL DEFAULT 0,
    "count_first_blood" INTEGER NOT NULL DEFAULT 0,
    "count_first_blood_kill" INTEGER NOT NULL DEFAULT 0,
    "count_first_blood_assist" INTEGER NOT NULL DEFAULT 0,
    "count_first_tower_kill" INTEGER NOT NULL DEFAULT 0,
    "count_first_tower_assist" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_first_objectif_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_first_objectif_stats" ADD CONSTRAINT "champion_first_objectif_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_objectif_stats
CREATE TABLE "champion_objectif_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "sum_baron_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_dragon_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_tower_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_horde_kills" INTEGER NOT NULL DEFAULT 0,
    "count_rift_herald_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_inhibitor_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_champion_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_elder_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_inhibitor_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_inhibitors_lost" INTEGER NOT NULL DEFAULT 0,
    "sum_objectives_stolen" INTEGER NOT NULL DEFAULT 0,
    "sum_objectives_stolen_assists" INTEGER NOT NULL DEFAULT 0,
    "sum_turret_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_turret_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_turrets_lost" INTEGER NOT NULL DEFAULT 0,
    "count_earth_drake" INTEGER NOT NULL DEFAULT 0,
    "count_water_drake" INTEGER NOT NULL DEFAULT 0,
    "count_wind_drake" INTEGER NOT NULL DEFAULT 0,
    "count_fire_drake" INTEGER NOT NULL DEFAULT 0,
    "count_hextec_drake" INTEGER NOT NULL DEFAULT 0,
    "count_chem_drake" INTEGER NOT NULL DEFAULT 0,
    "count_earth_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "count_water_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "count_wind_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "count_fire_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "count_hextec_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "count_chem_drake_soul" INTEGER NOT NULL DEFAULT 0,
    "sum_dragon_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_earliest_baron" INTEGER NOT NULL DEFAULT 0,
    "sum_elder_dragon_kills_with_opposing_soul" INTEGER NOT NULL DEFAULT 0,
    "sum_elder_dragon_multikills" INTEGER NOT NULL DEFAULT 0,
    "sum_epic_monster_kills_near_enemy_jungler" INTEGER NOT NULL DEFAULT 0,
    "sum_epic_monster_kills_within_30_seconds_of_spawn" INTEGER NOT NULL DEFAULT 0,
    "sum_epic_monster_steals" INTEGER NOT NULL DEFAULT 0,
    "sum_epic_monster_stolen_without_smite" INTEGER NOT NULL DEFAULT 0,
    "sum_first_turret_killed_time" INTEGER NOT NULL DEFAULT 0,
    "sum_multi_turret_rift_herald_count" INTEGER NOT NULL DEFAULT 0,
    "sum_quick_first_turret" INTEGER NOT NULL DEFAULT 0,
    "sum_rift_herald_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_solo_baron_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_solo_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_solo_turrets_lategame" INTEGER NOT NULL DEFAULT 0,
    "sum_takedown_on_first_turret" INTEGER NOT NULL DEFAULT 0,
    "sum_turrets_taken_with_rift_herald" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_objectif_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_objectif_stats" ADD CONSTRAINT "champion_objectif_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_vision_stats
CREATE TABLE "champion_vision_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "sum_detector_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "sum_vision_score" INTEGER NOT NULL DEFAULT 0,
    "sum_vision_wards_bought_in_game" INTEGER NOT NULL DEFAULT 0,
    "sum_wards_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "sum_control_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "sum_stealth_wards_placed" INTEGER NOT NULL DEFAULT 0,
    "sum_unseen_recalls" INTEGER NOT NULL DEFAULT 0,
    "sum_vision_score_advantage_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "sum_ward_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_ward_takedowns_before_20_m" INTEGER NOT NULL DEFAULT 0,
    "sum_wards_guarded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_vision_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_vision_stats" ADD CONSTRAINT "champion_vision_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_combat_stats
CREATE TABLE "champion_combat_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "sum_damage_dealt_to_buildings" INTEGER NOT NULL DEFAULT 0,
    "sum_damage_dealt_to_epic_monsters" INTEGER NOT NULL DEFAULT 0,
    "sum_damage_dealt_to_objectives" INTEGER NOT NULL DEFAULT 0,
    "sum_damage_dealt_to_turrets" INTEGER NOT NULL DEFAULT 0,
    "sum_damage_self_mitigated" INTEGER NOT NULL DEFAULT 0,
    "sum_double_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_killing_sprees" INTEGER NOT NULL DEFAULT 0,
    "sum_largest_critical_strike" INTEGER NOT NULL DEFAULT 0,
    "sum_largest_killing_spree" INTEGER NOT NULL DEFAULT 0,
    "sum_longest_time_spent_living" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_penta_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_quadra_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_time_ccing_others" INTEGER NOT NULL DEFAULT 0,
    "sum_total_damage_shielded_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "sum_total_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_total_heal" INTEGER NOT NULL DEFAULT 0,
    "sum_total_heals_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "sum_total_time_cc_dealt" INTEGER NOT NULL DEFAULT 0,
    "sum_total_units_healed" INTEGER NOT NULL DEFAULT 0,
    "sum_triple_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_dealt_to_champions" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_effective_heal_and_shielding" INTEGER NOT NULL DEFAULT 0,
    "sum_immobilize_and_kill_with_ally" INTEGER NOT NULL DEFAULT 0,
    "sum_outnumbered_kills" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_combat_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_combat_stats" ADD CONSTRAINT "champion_combat_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_matchup_stats
CREATE TABLE "champion_matchup_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "sum_total_enemy_jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_neutral_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_total_ally_jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_bounty_gold" INTEGER NOT NULL DEFAULT 0,
    "sum_complete_support_quest_in_time" INTEGER NOT NULL DEFAULT 0,
    "sum_deaths_by_enemy_champs" INTEGER NOT NULL DEFAULT 0,
    "sum_early_laning_phase_gold_exp_advantage" INTEGER NOT NULL DEFAULT 0,
    "sum_initial_crab_count" INTEGER NOT NULL DEFAULT 0,
    "sum_jungle_cs_before_10_minutes" INTEGER NOT NULL DEFAULT 0,
    "sum_kills_near_enemy_turret" INTEGER NOT NULL DEFAULT 0,
    "sum_kills_on_other_lanes_early_jungle_as_laner" INTEGER NOT NULL DEFAULT 0,
    "sum_kills_under_own_turret" INTEGER NOT NULL DEFAULT 0,
    "sum_land_skill_shots_early_game" INTEGER NOT NULL DEFAULT 0,
    "sum_lane_minions_first_10_minutes" INTEGER NOT NULL DEFAULT 0,
    "sum_laning_phase_gold_exp_advantage" INTEGER NOT NULL DEFAULT 0,
    "sum_max_cs_advantage_on_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "sum_max_kill_deficit" INTEGER NOT NULL DEFAULT 0,
    "sum_max_level_lead_lane_opponent" INTEGER NOT NULL DEFAULT 0,
    "sum_more_enemy_jungle_than_opponent" INTEGER NOT NULL DEFAULT 0,
    "sum_turret_plates_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_takedowns_after_gaining_level_advantage" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_matchup_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_matchup_stats" ADD CONSTRAINT "champion_matchup_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_challenge_stats
CREATE TABLE "champion_challenge_stats" (
    "champion_core_stat_id" BIGINT NOT NULL,
    "sum_heal_from_map_sources" INTEGER NOT NULL DEFAULT 0,
    "sum_baron_takedowns" INTEGER NOT NULL DEFAULT 0,
    "sum_buffs_stolen" INTEGER NOT NULL DEFAULT 0,
    "sum_dodge_skill_shots_small_window" INTEGER NOT NULL DEFAULT 0,
    "sum_get_takedowns_in_all_lanes_early_jungle_as_laner" INTEGER NOT NULL DEFAULT 0,
    "count_had_open_nexus" INTEGER NOT NULL DEFAULT 0,
    "sum_jungler_takedowns_near_damaged_epic_monster" INTEGER NOT NULL DEFAULT 0,
    "sum_kill_after_hidden_with_ally" INTEGER NOT NULL DEFAULT 0,
    "sum_killed_champ_took_full_team_damage_survived" INTEGER NOT NULL DEFAULT 0,
    "sum_kills_with_help_from_epic_monster" INTEGER NOT NULL DEFAULT 0,
    "sum_knock_enemy_into_team_and_kill" INTEGER NOT NULL DEFAULT 0,
    "sum_mejais_full_stack_in_time" INTEGER NOT NULL DEFAULT 0,
    "sum_multikills_after_aggressive_flash" INTEGER NOT NULL DEFAULT 0,
    "sum_quick_cleanse" INTEGER NOT NULL DEFAULT 0,
    "sum_quick_solo_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_save_ally_from_death" INTEGER NOT NULL DEFAULT 0,
    "sum_scuttle_crab_kills" INTEGER NOT NULL DEFAULT 0,
    "sum_skillshots_dodged" INTEGER NOT NULL DEFAULT 0,
    "sum_skillshots_hit" INTEGER NOT NULL DEFAULT 0,
    "sum_survived_single_digit_hp_count" INTEGER NOT NULL DEFAULT 0,
    "sum_survived_three_immobilizes_in_fight" INTEGER NOT NULL DEFAULT 0,
    "sum_takedowns_before_jungle_minion_spawn" INTEGER NOT NULL DEFAULT 0,
    "sum_takedowns_in_alcove" INTEGER NOT NULL DEFAULT 0,
    "sum_takedowns_in_enemy_fountain" INTEGER NOT NULL DEFAULT 0,
    "sum_took_large_damage_survived" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_challenge_stats_pkey" PRIMARY KEY ("champion_core_stat_id")
);
ALTER TABLE "champion_challenge_stats" ADD CONSTRAINT "champion_challenge_stats_champion_core_stat_id_fkey" FOREIGN KEY ("champion_core_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_shard_solo_stats
CREATE TABLE "champion_shard_solo_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "shard_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_shard_solo_stats_pkey" PRIMARY KEY ("champion_stat_id", "shard_id", "slot")
);
CREATE INDEX "champion_shard_solo_stats_champion_stat_id_idx" ON "champion_shard_solo_stats"("champion_stat_id");
ALTER TABLE "champion_shard_solo_stats" ADD CONSTRAINT "champion_shard_solo_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_runes_solo_stats
CREATE TABLE "champion_runes_solo_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "perk_id" INTEGER NOT NULL,
    "style" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_runes_solo_stats_pkey" PRIMARY KEY ("champion_stat_id", "perk_id", "style")
);
CREATE INDEX "champion_runes_solo_stats_champion_stat_id_idx" ON "champion_runes_solo_stats"("champion_stat_id");
ALTER TABLE "champion_runes_solo_stats" ADD CONSTRAINT "champion_runes_solo_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_shard_stats
CREATE TABLE "champion_shard_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "shard_list" TEXT NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_shard_stats_pkey" PRIMARY KEY ("champion_stat_id", "shard_list")
);
CREATE INDEX "champion_shard_stats_champion_stat_id_idx" ON "champion_shard_stats"("champion_stat_id");
ALTER TABLE "champion_shard_stats" ADD CONSTRAINT "champion_shard_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_runes_stats
CREATE TABLE "champion_runes_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "rune_list" TEXT NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_runes_stats_pkey" PRIMARY KEY ("champion_stat_id", "rune_list")
);
CREATE INDEX "champion_runes_stats_champion_stat_id_idx" ON "champion_runes_stats"("champion_stat_id");
ALTER TABLE "champion_runes_stats" ADD CONSTRAINT "champion_runes_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_item_solo_stats
CREATE TABLE "champion_item_solo_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "count_starter" INTEGER NOT NULL DEFAULT 0,
    "count_core" INTEGER NOT NULL DEFAULT 0,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "sum_timestamp_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_item_solo_stats_pkey" PRIMARY KEY ("champion_stat_id", "item_id")
);
CREATE INDEX "champion_item_solo_stats_champion_stat_id_idx" ON "champion_item_solo_stats"("champion_stat_id");
ALTER TABLE "champion_item_solo_stats" ADD CONSTRAINT "champion_item_solo_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_item_stats
CREATE TABLE "champion_item_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "item_list" TEXT NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "sum_timestamp_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_item_stats_pkey" PRIMARY KEY ("champion_stat_id", "item_list")
);
CREATE INDEX "champion_item_stats_champion_stat_id_idx" ON "champion_item_stats"("champion_stat_id");
ALTER TABLE "champion_item_stats" ADD CONSTRAINT "champion_item_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_spell_solo_stats
CREATE TABLE "champion_spell_solo_stats" (
    "champion_stat_id" BIGINT NOT NULL,
    "spell_slot" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "first_up_order" INTEGER NOT NULL DEFAULT 0,
    "max_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_spell_solo_stats_pkey" PRIMARY KEY ("champion_stat_id", "spell_slot")
);
CREATE INDEX "champion_spell_solo_stats_champion_stat_id_idx" ON "champion_spell_solo_stats"("champion_stat_id");
ALTER TABLE "champion_spell_solo_stats" ADD CONSTRAINT "champion_spell_solo_stats_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_summoner_spells
CREATE TABLE "champion_summoner_spells" (
    "champion_stat_id" BIGINT NOT NULL,
    "spell_id" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "count_slot0" INTEGER NOT NULL DEFAULT 0,
    "count_slot1" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_summoner_spells_pkey" PRIMARY KEY ("champion_stat_id", "spell_id")
);
CREATE INDEX "champion_summoner_spells_champion_stat_id_idx" ON "champion_summoner_spells"("champion_stat_id");
ALTER TABLE "champion_summoner_spells" ADD CONSTRAINT "champion_summoner_spells_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- champion_bucket
CREATE TABLE "champion_bucket" (
    "champion_stat_id" BIGINT NOT NULL,
    "duration_bucket" INTEGER NOT NULL,
    "count_win" INTEGER NOT NULL DEFAULT 0,
    "count_game" INTEGER NOT NULL DEFAULT 0,
    "sum_current_gold" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_done" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "sum_magic_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_done" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "sum_physical_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_total_damage_done" INTEGER NOT NULL DEFAULT 0,
    "sum_total_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "sum_total_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_done" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_done_to_champion" INTEGER NOT NULL DEFAULT 0,
    "sum_true_damage_taken" INTEGER NOT NULL DEFAULT 0,
    "sum_gold_per_second" INTEGER NOT NULL DEFAULT 0,
    "sum_jungle_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_level" INTEGER NOT NULL DEFAULT 0,
    "sum_minions_killed" INTEGER NOT NULL DEFAULT 0,
    "sum_time_enemy_spent_controlled" INTEGER NOT NULL DEFAULT 0,
    "sum_total_gold" INTEGER NOT NULL DEFAULT 0,
    "sum_xp" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "champion_bucket_pkey" PRIMARY KEY ("champion_stat_id", "duration_bucket")
);
CREATE INDEX "champion_bucket_champion_stat_id_idx" ON "champion_bucket"("champion_stat_id");
ALTER TABLE "champion_bucket" ADD CONSTRAINT "champion_bucket_champion_stat_id_fkey" FOREIGN KEY ("champion_stat_id") REFERENCES "champion_core_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update players table: add puuid_key_version index if missing (compatible with both old and new schema)
CREATE INDEX IF NOT EXISTS "players_puuid_key_version_idx" ON "players"("puuid_key_version");
