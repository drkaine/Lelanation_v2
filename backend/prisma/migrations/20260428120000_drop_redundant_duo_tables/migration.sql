-- Remove redundant duo aggregate tables:
-- keep agg_champion_duo_role_stats and agg_botlane_duo_vs_duo_stats only.

DROP TRIGGER IF EXISTS trg_sync_new_duo_botlane_into_legacy_duo_stats ON agg_champion_duo_botlane_stats;
DROP TRIGGER IF EXISTS trg_sync_legacy_duo_delete_into_new_duo_botlane ON agg_champion_duo_stats;
DROP FUNCTION IF EXISTS sync_new_duo_botlane_into_legacy_duo_stats();
DROP FUNCTION IF EXISTS sync_legacy_duo_delete_into_new_duo_botlane();

DROP TABLE IF EXISTS archive_agg_champion_duo_botlane_stats;
DROP TABLE IF EXISTS agg_champion_duo_botlane_stats;
DROP TABLE IF EXISTS archive_agg_champion_duo_stats;
DROP TABLE IF EXISTS agg_champion_duo_stats;

CREATE OR REPLACE FUNCTION ensure_unified_agg_archive_tables()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS archive_agg_champion_core_stats (LIKE agg_champion_core_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_vs_stats (LIKE agg_champion_vs_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_match_outcome_stats (LIKE agg_match_outcome_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_team_core_stats (LIKE agg_team_core_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_bans_by_banner (LIKE agg_champion_bans_by_banner INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_side_stats (LIKE agg_champion_side_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_summoner_spell_pair_stats (LIKE agg_champion_summoner_spell_pair_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_item_starter_set_stats (LIKE agg_champion_item_starter_set_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_bucket (LIKE agg_champion_bucket INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_summoner_spells (LIKE agg_champion_summoner_spells INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_runes_stats (LIKE agg_champion_runes_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_runes_solo_stats (LIKE agg_champion_runes_solo_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_shard_solo_stats (LIKE agg_champion_shard_solo_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_item_stats (LIKE agg_champion_item_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_item_solo_stats (LIKE agg_champion_item_solo_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_damage_stats (LIKE agg_champion_damage_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_participant_stats (LIKE agg_champion_participant_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_champion_duo_role_stats (LIKE agg_champion_duo_role_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_botlane_duo_vs_duo_stats (LIKE agg_botlane_duo_vs_duo_stats INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS archive_agg_team_bucket (LIKE agg_team_bucket INCLUDING ALL);

  CREATE INDEX IF NOT EXISTS idx_archive_acs_gv ON archive_agg_champion_core_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_avs_gv ON archive_agg_champion_vs_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_mo_gv ON archive_agg_match_outcome_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_tcs_gv ON archive_agg_team_core_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_bans_gv ON archive_agg_champion_bans_by_banner (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_side_gv ON archive_agg_champion_side_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_ssp_gv ON archive_agg_champion_summoner_spell_pair_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_iss_gv ON archive_agg_champion_item_starter_set_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_cb_csid ON archive_agg_champion_bucket (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_css_csid ON archive_agg_champion_summoner_spells (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_crs_csid ON archive_agg_champion_runes_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_crss_csid ON archive_agg_champion_runes_solo_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_csso_csid ON archive_agg_champion_shard_solo_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_cis_csid ON archive_agg_champion_item_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_ciso_csid ON archive_agg_champion_item_solo_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_cds_csid ON archive_agg_champion_damage_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_cps_csid ON archive_agg_champion_participant_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_cdrs_csid ON archive_agg_champion_duo_role_stats (champion_stat_id);
  CREATE INDEX IF NOT EXISTS idx_archive_bdvd_gv ON archive_agg_botlane_duo_vs_duo_stats (game_version);
  CREATE INDEX IF NOT EXISTS idx_archive_tb_tsid ON archive_agg_team_bucket (team_stat_id);
END;
$$ LANGUAGE plpgsql;

SELECT ensure_unified_agg_archive_tables();

DROP FUNCTION IF EXISTS close_patch(TEXT);

CREATE OR REPLACE FUNCTION close_patch(p_game_version TEXT)
RETURNS JSONB AS $$
DECLARE
  v_like_patch   TEXT;
  v_ranked       BIGINT;
  v_games        INT;
  v_gmax         INT;
  v_arch_at      TIMESTAMPTZ;
  v_counts       JSONB := '{}'::JSONB;
  v_n            BIGINT;
BEGIN
  IF p_game_version IS NULL OR trim(p_game_version) = '' THEN
    RETURN NULL;
  END IF;

  IF length(p_game_version) > 0 AND position('.' in p_game_version) > 0 THEN
    v_like_patch := p_game_version || '.%';
  ELSE
    v_like_patch := p_game_version || '%';
  END IF;

  SELECT COALESCE(SUM(mo.count_match), 0)::BIGINT INTO v_ranked
  FROM agg_match_outcome_stats mo
  WHERE (mo.game_version = p_game_version OR mo.game_version LIKE v_like_patch)
    AND mo.rank_tier <> 'UNRANKED';

  UPDATE active_patches
  SET
    games_number = COALESCE(v_ranked, 0)::INT,
    is_current = false,
    archived_at = COALESCE(archived_at, NOW())
  WHERE game_version = p_game_version;

  SELECT ap.games_number, ap.game_number_max, ap.archived_at
  INTO v_games, v_gmax, v_arch_at
  FROM active_patches ap
  WHERE ap.game_version = p_game_version;

  IF NOT FOUND THEN
    v_games := COALESCE(v_ranked, 0)::INT;
    v_gmax := NULL;
    v_arch_at := NOW();
  END IF;

  PERFORM ensure_unified_agg_archive_tables();

  INSERT INTO archive_agg_champion_bucket
  SELECT cb.* FROM agg_champion_bucket cb
  INNER JOIN agg_champion_core_stats c ON c.id = cb.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_bucket', v_n);

  INSERT INTO archive_agg_champion_summoner_spells
  SELECT s.* FROM agg_champion_summoner_spells s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_summoner_spells', v_n);

  INSERT INTO archive_agg_champion_runes_stats
  SELECT s.* FROM agg_champion_runes_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_runes_stats', v_n);

  INSERT INTO archive_agg_champion_runes_solo_stats
  SELECT s.* FROM agg_champion_runes_solo_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_runes_solo_stats', v_n);

  INSERT INTO archive_agg_champion_shard_solo_stats
  SELECT s.* FROM agg_champion_shard_solo_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_shard_solo_stats', v_n);

  INSERT INTO archive_agg_champion_item_stats
  SELECT s.* FROM agg_champion_item_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_item_stats', v_n);

  INSERT INTO archive_agg_champion_item_solo_stats
  SELECT s.* FROM agg_champion_item_solo_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_item_solo_stats', v_n);

  INSERT INTO archive_agg_champion_damage_stats
  SELECT s.* FROM agg_champion_damage_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_damage_stats', v_n);

  INSERT INTO archive_agg_champion_participant_stats
  SELECT s.* FROM agg_champion_participant_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_participant_stats', v_n);

  INSERT INTO archive_agg_champion_duo_role_stats
  SELECT s.* FROM agg_champion_duo_role_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = p_game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_duo_role_stats', v_n);

  INSERT INTO archive_agg_team_bucket
  SELECT tb.* FROM agg_team_bucket tb
  INNER JOIN agg_team_core_stats t ON t.id = tb.team_stat_id
  WHERE t.game_version = p_game_version OR t.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_team_bucket', v_n);

  INSERT INTO archive_agg_champion_vs_stats
  SELECT * FROM agg_champion_vs_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_vs_stats', v_n);

  INSERT INTO archive_agg_champion_core_stats
  SELECT * FROM agg_champion_core_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_core_stats', v_n);

  INSERT INTO archive_agg_botlane_duo_vs_duo_stats
  SELECT * FROM agg_botlane_duo_vs_duo_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_botlane_duo_vs_duo_stats', v_n);

  INSERT INTO archive_agg_team_core_stats
  SELECT * FROM agg_team_core_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_team_core_stats', v_n);

  INSERT INTO archive_agg_match_outcome_stats
  SELECT * FROM agg_match_outcome_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_match_outcome_stats', v_n);

  INSERT INTO archive_agg_champion_bans_by_banner
  SELECT * FROM agg_champion_bans_by_banner
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_bans_by_banner', v_n);

  INSERT INTO archive_agg_champion_side_stats
  SELECT * FROM agg_champion_side_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_side_stats', v_n);

  INSERT INTO archive_agg_champion_summoner_spell_pair_stats
  SELECT * FROM agg_champion_summoner_spell_pair_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_summoner_spell_pair_stats', v_n);

  INSERT INTO archive_agg_champion_item_starter_set_stats
  SELECT * FROM agg_champion_item_starter_set_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agg_champion_item_starter_set_stats', v_n);

  DELETE FROM agg_champion_bucket
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_summoner_spells
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_runes_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_runes_solo_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_shard_solo_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_item_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_item_solo_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_damage_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_participant_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_duo_role_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_champion_vs_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_core_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_botlane_duo_vs_duo_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  DELETE FROM agg_team_bucket
  WHERE team_stat_id IN (
    SELECT id FROM agg_team_core_stats WHERE game_version = p_game_version OR game_version LIKE v_like_patch
  );
  DELETE FROM agg_team_core_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  DELETE FROM agg_match_outcome_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_bans_by_banner
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_side_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_summoner_spell_pair_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_item_starter_set_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  DELETE FROM ingest_matchs
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  RETURN jsonb_build_object(
    'patch', trim(p_game_version),
    'gamesNumber', v_games,
    'gameNumberMax', v_gmax,
    'rankedMatchCount', v_ranked,
    'archivedAt', v_arch_at,
    'rowsInserted', v_counts
  );
END;
$$ LANGUAGE plpgsql;
