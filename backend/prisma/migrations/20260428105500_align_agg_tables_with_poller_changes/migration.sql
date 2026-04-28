-- Align agg tables with poller enrichment changes while preserving data.

-- 1) Add requested matchup/economy columns on core/vs/duo/side tables.
ALTER TABLE IF EXISTS agg_champion_core_stats
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_core_stats
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS agg_champion_vs_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_vs_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS agg_champion_duo_role_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_duo_role_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS agg_champion_duo_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_duo_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS agg_champion_side_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_heal_from_map_sources BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_per_minute BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_effective_heal_and_shielding BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_buildings BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_epic_monsters BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_objectives BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_turrets BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_self_mitigated BIGINT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_side_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_heal_from_map_sources BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_per_minute BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_effective_heal_and_shielding BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_buildings BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_epic_monsters BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_objectives BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_turrets BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_self_mitigated BIGINT NOT NULL DEFAULT 0;

-- 2) Enrich bucket and damage satellite tables.
ALTER TABLE IF EXISTS agg_champion_bucket
  ADD COLUMN IF NOT EXISTS sum_current_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_jungle_minions_killed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_level BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_minions_killed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_time_enemy_spent_controlled BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_game_end INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_time_enemy_spent_controlled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_bucket
  ADD COLUMN IF NOT EXISTS sum_current_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done_to_champion BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_jungle_minions_killed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_level BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_minions_killed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_time_enemy_spent_controlled BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_game_end INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_time_enemy_spent_controlled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS agg_champion_damage_stats
  ADD COLUMN IF NOT EXISTS sum_true_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_time_enemy_spent_controlled INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_heal_from_map_sources BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_per_minute BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_effective_heal_and_shielding BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_buildings BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_epic_monsters BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_objectives BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_turrets BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_self_mitigated BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_time_cc_dealt BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_largest_critical_strike BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_heal BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_heals_on_teammates BIGINT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_damage_stats
  ADD COLUMN IF NOT EXISTS sum_true_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_taken BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_true_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_physical_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_magic_damage_done_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_time_enemy_spent_controlled INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_units_healed_to_champions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_heal_from_map_sources BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_per_minute BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_effective_heal_and_shielding BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_buildings BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_epic_monsters BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_objectives BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_dealt_to_turrets BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_damage_self_mitigated BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_time_cc_dealt BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_largest_critical_strike BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_heal BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_total_heals_on_teammates BIGINT NOT NULL DEFAULT 0;

-- 3) New botlane duo table (data-preserving) + synchronization with legacy table.
CREATE TABLE IF NOT EXISTS agg_champion_duo_botlane_stats
  (LIKE agg_champion_duo_stats INCLUDING ALL);

ALTER TABLE IF EXISTS agg_champion_duo_botlane_stats
  ADD COLUMN IF NOT EXISTS sum_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_more_enemy_jungle_than_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

INSERT INTO agg_champion_duo_botlane_stats (
  champion_stat_id,
  ally_champion_id,
  count_win,
  count_game,
  updated_at,
  sum_gold_earned,
  sum_gold_spent,
  sum_max_level_lead_lane_opponent,
  sum_max_kill_deficit,
  sum_more_enemy_jungle_than_opponent,
  sum_max_cs_advantage_on_lane_opponent,
  sum_vision_score_advantage_lane_opponent,
  sum_laning_phase_gold_exp_advantage,
  sum_early_laning_phase_gold_exp_advantage
)
SELECT
  champion_stat_id,
  ally_champion_id,
  count_win,
  count_game,
  updated_at,
  COALESCE(sum_gold_earned, 0),
  COALESCE(sum_gold_spent, 0),
  COALESCE(sum_max_level_lead_lane_opponent, 0),
  COALESCE(sum_max_kill_deficit, 0),
  COALESCE(sum_more_enemy_jungle_than_opponent, 0),
  COALESCE(sum_max_cs_advantage_on_lane_opponent, 0),
  COALESCE(sum_vision_score_advantage_lane_opponent, 0),
  COALESCE(sum_laning_phase_gold_exp_advantage, 0),
  COALESCE(sum_early_laning_phase_gold_exp_advantage, 0)
FROM agg_champion_duo_stats
ON CONFLICT (champion_stat_id, ally_champion_id) DO UPDATE
SET
  count_win = EXCLUDED.count_win,
  count_game = EXCLUDED.count_game,
  updated_at = GREATEST(agg_champion_duo_botlane_stats.updated_at, EXCLUDED.updated_at),
  sum_gold_earned = EXCLUDED.sum_gold_earned,
  sum_gold_spent = EXCLUDED.sum_gold_spent,
  sum_max_level_lead_lane_opponent = EXCLUDED.sum_max_level_lead_lane_opponent,
  sum_max_kill_deficit = EXCLUDED.sum_max_kill_deficit,
  sum_more_enemy_jungle_than_opponent = EXCLUDED.sum_more_enemy_jungle_than_opponent,
  sum_max_cs_advantage_on_lane_opponent = EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
  sum_vision_score_advantage_lane_opponent = EXCLUDED.sum_vision_score_advantage_lane_opponent,
  sum_laning_phase_gold_exp_advantage = EXCLUDED.sum_laning_phase_gold_exp_advantage,
  sum_early_laning_phase_gold_exp_advantage = EXCLUDED.sum_early_laning_phase_gold_exp_advantage;

CREATE TABLE IF NOT EXISTS archive_agg_champion_duo_botlane_stats
  (LIKE agg_champion_duo_botlane_stats INCLUDING ALL);

INSERT INTO archive_agg_champion_duo_botlane_stats
SELECT a.*
FROM archive_agg_champion_duo_stats a
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sync_new_duo_botlane_into_legacy_duo_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agg_champion_duo_stats (
    champion_stat_id,
    ally_champion_id,
    count_win,
    count_game,
    updated_at,
    sum_gold_earned,
    sum_gold_spent,
    sum_max_level_lead_lane_opponent,
    sum_max_kill_deficit,
    sum_more_enemy_jungle_than_opponent,
    sum_max_cs_advantage_on_lane_opponent,
    sum_vision_score_advantage_lane_opponent,
    sum_laning_phase_gold_exp_advantage,
    sum_early_laning_phase_gold_exp_advantage
  )
  VALUES (
    NEW.champion_stat_id,
    NEW.ally_champion_id,
    NEW.count_win,
    NEW.count_game,
    NEW.updated_at,
    NEW.sum_gold_earned,
    NEW.sum_gold_spent,
    NEW.sum_max_level_lead_lane_opponent,
    NEW.sum_max_kill_deficit,
    NEW.sum_more_enemy_jungle_than_opponent,
    NEW.sum_max_cs_advantage_on_lane_opponent,
    NEW.sum_vision_score_advantage_lane_opponent,
    NEW.sum_laning_phase_gold_exp_advantage,
    NEW.sum_early_laning_phase_gold_exp_advantage
  )
  ON CONFLICT (champion_stat_id, ally_champion_id) DO UPDATE
  SET
    count_win = EXCLUDED.count_win,
    count_game = EXCLUDED.count_game,
    updated_at = EXCLUDED.updated_at,
    sum_gold_earned = EXCLUDED.sum_gold_earned,
    sum_gold_spent = EXCLUDED.sum_gold_spent,
    sum_max_level_lead_lane_opponent = EXCLUDED.sum_max_level_lead_lane_opponent,
    sum_max_kill_deficit = EXCLUDED.sum_max_kill_deficit,
    sum_more_enemy_jungle_than_opponent = EXCLUDED.sum_more_enemy_jungle_than_opponent,
    sum_max_cs_advantage_on_lane_opponent = EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
    sum_vision_score_advantage_lane_opponent = EXCLUDED.sum_vision_score_advantage_lane_opponent,
    sum_laning_phase_gold_exp_advantage = EXCLUDED.sum_laning_phase_gold_exp_advantage,
    sum_early_laning_phase_gold_exp_advantage = EXCLUDED.sum_early_laning_phase_gold_exp_advantage;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_new_duo_botlane_into_legacy_duo_stats ON agg_champion_duo_botlane_stats;
CREATE TRIGGER trg_sync_new_duo_botlane_into_legacy_duo_stats
AFTER INSERT OR UPDATE ON agg_champion_duo_botlane_stats
FOR EACH ROW
EXECUTE FUNCTION sync_new_duo_botlane_into_legacy_duo_stats();

CREATE OR REPLACE FUNCTION sync_legacy_duo_delete_into_new_duo_botlane()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM agg_champion_duo_botlane_stats
  WHERE champion_stat_id = OLD.champion_stat_id
    AND ally_champion_id = OLD.ally_champion_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_legacy_duo_delete_into_new_duo_botlane ON agg_champion_duo_stats;
CREATE TRIGGER trg_sync_legacy_duo_delete_into_new_duo_botlane
AFTER DELETE ON agg_champion_duo_stats
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_duo_delete_into_new_duo_botlane();

-- 4) Remove style from runes_solo aggregate while preserving totals.
DO $$
BEGIN
  IF to_regclass('public.agg_champion_runes_solo_stats') IS NOT NULL THEN
    CREATE TEMP TABLE tmp_runes_solo_live AS
    SELECT
      champion_stat_id,
      perk_id,
      SUM(count_win)::INT AS count_win,
      SUM(count_game)::INT AS count_game,
      MAX(updated_at) AS updated_at
    FROM agg_champion_runes_solo_stats
    GROUP BY champion_stat_id, perk_id;

    ALTER TABLE agg_champion_runes_solo_stats
      DROP CONSTRAINT IF EXISTS agg_champion_runes_solo_stats_pkey;
    TRUNCATE TABLE agg_champion_runes_solo_stats;
    ALTER TABLE agg_champion_runes_solo_stats
      DROP COLUMN IF EXISTS style;
    ALTER TABLE agg_champion_runes_solo_stats
      ADD CONSTRAINT agg_champion_runes_solo_stats_pkey
      PRIMARY KEY (champion_stat_id, perk_id);
    INSERT INTO agg_champion_runes_solo_stats (champion_stat_id, perk_id, count_win, count_game, updated_at)
    SELECT champion_stat_id, perk_id, count_win, count_game, updated_at
    FROM tmp_runes_solo_live;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.archive_agg_champion_runes_solo_stats') IS NOT NULL THEN
    CREATE TEMP TABLE tmp_runes_solo_archive AS
    SELECT
      champion_stat_id,
      perk_id,
      SUM(count_win)::INT AS count_win,
      SUM(count_game)::INT AS count_game,
      MAX(updated_at) AS updated_at
    FROM archive_agg_champion_runes_solo_stats
    GROUP BY champion_stat_id, perk_id;

    ALTER TABLE archive_agg_champion_runes_solo_stats
      DROP CONSTRAINT IF EXISTS archive_agg_champion_runes_solo_stats_pkey;
    TRUNCATE TABLE archive_agg_champion_runes_solo_stats;
    ALTER TABLE archive_agg_champion_runes_solo_stats
      DROP COLUMN IF EXISTS style;
    ALTER TABLE archive_agg_champion_runes_solo_stats
      ADD CONSTRAINT archive_agg_champion_runes_solo_stats_pkey
      PRIMARY KEY (champion_stat_id, perk_id);
    INSERT INTO archive_agg_champion_runes_solo_stats (champion_stat_id, perk_id, count_win, count_game, updated_at)
    SELECT champion_stat_id, perk_id, count_win, count_game, updated_at
    FROM tmp_runes_solo_archive;
  END IF;
END $$;
