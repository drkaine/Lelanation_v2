-- OTP : flag joueur (catégorie statistique, aucun nom stocké) + colonne `otp` dans les agrégats.
-- Participant : son flag ; équipe/match : au moins un OTP ; bans : le banneur.
-- Total d'une stat = somme des lignes otp=false et otp=true.
CREATE TABLE IF NOT EXISTS otp_players (
  puuid varchar(78) PRIMARY KEY,
  games integer NOT NULL,
  top_champion_games integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE botlane_duo_vs_duo_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE botlane_duo_vs_duo_stats DROP CONSTRAINT IF EXISTS botlane_duo_vs_duo_stats_pkey;
ALTER TABLE botlane_duo_vs_duo_stats ADD CONSTRAINT botlane_duo_vs_duo_stats_pkey PRIMARY KEY (patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id, otp);

ALTER TABLE champion_bans_by_banner ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_bans_by_banner DROP CONSTRAINT IF EXISTS champion_bans_by_banner_pkey;
ALTER TABLE champion_bans_by_banner ADD CONSTRAINT champion_bans_by_banner_pkey PRIMARY KEY (patch, rank_tier, region, banned_champion_id, otp);

ALTER TABLE champion_bucket ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_bucket DROP CONSTRAINT IF EXISTS champion_bucket_pkey;
ALTER TABLE champion_bucket ADD CONSTRAINT champion_bucket_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, transform_timestamp_ms, duration_bucket, otp);

ALTER TABLE champion_duo_role_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_duo_role_stats DROP CONSTRAINT IF EXISTS champion_duo_role_stats_pkey;
ALTER TABLE champion_duo_role_stats ADD CONSTRAINT champion_duo_role_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, ally_champion_id, ally_role, otp);

ALTER TABLE champion_item_set_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_item_set_stats DROP CONSTRAINT IF EXISTS champion_item_set_stats_pkey;
ALTER TABLE champion_item_set_stats ADD CONSTRAINT champion_item_set_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, phase, item_set_key, otp);

ALTER TABLE champion_item_solo_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_item_solo_stats DROP CONSTRAINT IF EXISTS champion_item_solo_stats_pkey;
ALTER TABLE champion_item_solo_stats ADD CONSTRAINT champion_item_solo_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, item_id, otp);

ALTER TABLE champion_jungle_path ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_jungle_path DROP CONSTRAINT IF EXISTS champion_jungle_path_pkey;
ALTER TABLE champion_jungle_path ADD CONSTRAINT champion_jungle_path_pkey PRIMARY KEY (patch, rank_tier, region, champion_id, opponent_champion_id, path_hash, otp);

ALTER TABLE champion_pick_order ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_pick_order DROP CONSTRAINT IF EXISTS champion_pick_order_pkey;
ALTER TABLE champion_pick_order ADD CONSTRAINT champion_pick_order_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, team, pick_order, otp);

ALTER TABLE champion_runes_solo_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_runes_solo_stats DROP CONSTRAINT IF EXISTS champion_runes_solo_stats_pkey;
ALTER TABLE champion_runes_solo_stats ADD CONSTRAINT champion_runes_solo_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, perk_id, otp);

ALTER TABLE champion_runes_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_runes_stats DROP CONSTRAINT IF EXISTS champion_runes_stats_pkey;
ALTER TABLE champion_runes_stats ADD CONSTRAINT champion_runes_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, rune_list, shard_list, otp);

ALTER TABLE champion_shard_solo_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_shard_solo_stats DROP CONSTRAINT IF EXISTS champion_shard_solo_stats_pkey;
ALTER TABLE champion_shard_solo_stats ADD CONSTRAINT champion_shard_solo_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, shard_id, slot, otp);

ALTER TABLE champion_spell_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_spell_stats DROP CONSTRAINT IF EXISTS champion_spell_stats_pkey;
ALTER TABLE champion_spell_stats ADD CONSTRAINT champion_spell_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, spell_order_hash, otp);

ALTER TABLE champion_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_stats DROP CONSTRAINT IF EXISTS champion_stats_pkey;
ALTER TABLE champion_stats ADD CONSTRAINT champion_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, team, otp);

ALTER TABLE champion_summoner_spell_pair_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_summoner_spell_pair_stats DROP CONSTRAINT IF EXISTS champion_summoner_spell_pair_stats_pkey;
ALTER TABLE champion_summoner_spell_pair_stats ADD CONSTRAINT champion_summoner_spell_pair_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, spell_d, spell_f, otp);

ALTER TABLE champion_summoner_spells ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_summoner_spells DROP CONSTRAINT IF EXISTS champion_summoner_spells_pkey;
ALTER TABLE champion_summoner_spells ADD CONSTRAINT champion_summoner_spells_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, spell_id, otp);

ALTER TABLE champion_tier_daily_snapshots ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_tier_daily_snapshots DROP CONSTRAINT IF EXISTS champion_tier_daily_snapshots_pkey;
ALTER TABLE champion_tier_daily_snapshots ADD CONSTRAINT champion_tier_daily_snapshots_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, date_of_game, otp);

ALTER TABLE champion_vs_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE champion_vs_stats DROP CONSTRAINT IF EXISTS champion_vs_stats_pkey;
ALTER TABLE champion_vs_stats ADD CONSTRAINT champion_vs_stats_pkey PRIMARY KEY (patch, role, rank_tier, region, champion_id, champion_transform, opponent_champion_id, set_item, otp);

ALTER TABLE item_tier_daily_snapshots ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE item_tier_daily_snapshots DROP CONSTRAINT IF EXISTS item_tier_daily_snapshots_pkey;
ALTER TABLE item_tier_daily_snapshots ADD CONSTRAINT item_tier_daily_snapshots_pkey PRIMARY KEY (patch, rank_tier, region, item_id, date_of_game, otp);

ALTER TABLE match_outcome_stats ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE match_outcome_stats DROP CONSTRAINT IF EXISTS match_outcome_stats_pkey;
ALTER TABLE match_outcome_stats ADD CONSTRAINT match_outcome_stats_pkey PRIMARY KEY (patch, rank_tier, otp);

ALTER TABLE objective_outcome_histogram ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE objective_outcome_histogram DROP CONSTRAINT IF EXISTS objective_outcome_histogram_pkey;
ALTER TABLE objective_outcome_histogram ADD CONSTRAINT objective_outcome_histogram_pkey PRIMARY KEY (patch, rank_tier, region, team, objective_type, type_drake_key, is_soul, outcome, obj_count, otp);

ALTER TABLE team_core_stat ADD COLUMN IF NOT EXISTS otp boolean NOT NULL DEFAULT false;
ALTER TABLE team_core_stat DROP CONSTRAINT IF EXISTS team_core_stat_pkey;
ALTER TABLE team_core_stat ADD CONSTRAINT team_core_stat_pkey PRIMARY KEY (patch, rank_tier, region, team, otp);
