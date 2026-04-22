-- Archive incremental agg_* rows for a closed patch into archive_agg_*_{major_minor},
-- purge hot agg_* + ingest for that patch, keep active_patches row with archived_at + frozen games_number.

ALTER TABLE active_patches
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION close_patch(p_game_version TEXT)
RETURNS VOID AS $$
DECLARE
  v_table_suffix TEXT := replace(replace(p_game_version, '.', '_'), '-', '_');
  v_like_patch   TEXT;
BEGIN
  IF p_game_version IS NULL OR trim(p_game_version) = '' THEN
    RAISE NOTICE 'close_patch: empty game_version';
    RETURN;
  END IF;

  IF length(p_game_version) > 0 AND position('.' in p_game_version) > 0 THEN
    v_like_patch := p_game_version || '.%';
  ELSE
    v_like_patch := p_game_version || '%';
  END IF;

  UPDATE active_patches
  SET
    games_number = COALESCE((
      SELECT SUM(mo.count_match)::int
      FROM agg_match_outcome_stats mo
      WHERE (mo.game_version = p_game_version OR mo.game_version LIKE v_like_patch)
        AND mo.rank_tier <> 'UNRANKED'
    ), 0),
    is_current = false,
    archived_at = COALESCE(archived_at, NOW())
  WHERE game_version = p_game_version;

  -- Core + direct game_version tables
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_core_stats_%s AS
     SELECT * FROM agg_champion_core_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_vs_stats_%s AS
     SELECT * FROM agg_champion_vs_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_match_outcome_stats_%s AS
     SELECT * FROM agg_match_outcome_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_team_core_stats_%s AS
     SELECT * FROM agg_team_core_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_bans_by_banner_%s AS
     SELECT * FROM agg_champion_bans_by_banner WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_side_stats_%s AS
     SELECT * FROM agg_champion_side_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_summoner_spell_pair_stats_%s AS
     SELECT * FROM agg_champion_summoner_spell_pair_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_item_starter_set_stats_%s AS
     SELECT * FROM agg_champion_item_starter_set_stats WHERE game_version = %L OR game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );

  -- Satellites keyed by champion_stat_id
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_bucket_%s AS
     SELECT cb.* FROM agg_champion_bucket cb
     INNER JOIN agg_champion_core_stats c ON c.id = cb.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_summoner_spells_%s AS
     SELECT s.* FROM agg_champion_summoner_spells s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_runes_stats_%s AS
     SELECT s.* FROM agg_champion_runes_stats s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_runes_solo_stats_%s AS
     SELECT s.* FROM agg_champion_runes_solo_stats s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_shard_solo_stats_%s AS
     SELECT s.* FROM agg_champion_shard_solo_stats s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_item_stats_%s AS
     SELECT s.* FROM agg_champion_item_stats s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_champion_item_solo_stats_%s AS
     SELECT s.* FROM agg_champion_item_solo_stats s
     INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
     WHERE c.game_version = %L OR c.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS archive_agg_team_bucket_%s AS
     SELECT tb.* FROM agg_team_bucket tb
     INNER JOIN agg_team_core_stats t ON t.id = tb.team_stat_id
     WHERE t.game_version = %L OR t.game_version LIKE %L',
    v_table_suffix, p_game_version, v_like_patch
  );

  -- Purge hot tables (children first — no FK, safe order)
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
  DELETE FROM agg_champion_vs_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;
  DELETE FROM agg_champion_core_stats
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

  RAISE NOTICE 'Patch % archivé vers archive_agg_*, hot tables purgées.', p_game_version;
END;
$$ LANGUAGE plpgsql;
