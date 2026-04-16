-- Legacy match graph dropped; close_patch purges ingest_matchs; Prisma schema no longer maps legacy tables.
CREATE OR REPLACE FUNCTION close_patch(p_game_version TEXT)
RETURNS VOID AS $$
DECLARE
  v_table_suffix TEXT := replace(replace(p_game_version, '.', '_'), '-', '_');
  v_count_mv     BIGINT;
  v_like_patch   TEXT := p_game_version || '.%';
BEGIN
  IF length(p_game_version) > 0 AND position('.' in p_game_version) > 0 THEN
    v_like_patch := p_game_version || '.%';
  ELSE
    v_like_patch := p_game_version || '%';
  END IF;

  SELECT COUNT(*) INTO v_count_mv
  FROM mv_champion_core_stats
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  IF v_count_mv = 0 THEN
    RAISE NOTICE 'Aucune donnée MV pour le patch %. Retrait du patch actif et suppression données brutes.', p_game_version;
  ELSE
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_core_stats_%s AS
       SELECT * FROM mv_champion_core_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_vs_%s AS
       SELECT * FROM mv_champion_vs_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_duo_role_%s AS
       SELECT d.*
       FROM mv_champion_duo_role_stats d
       JOIN mv_champion_core_stats c ON c.id = d.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_botlane_duo_vs_duo_%s AS
       SELECT * FROM mv_botlane_duo_vs_duo_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_team_core_stats_%s AS
       SELECT * FROM mv_team_core_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_first_objectif_%s AS
       SELECT s.*
       FROM mv_champion_first_objectif_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_objectif_%s AS
       SELECT s.*
       FROM mv_champion_objectif_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_vision_%s AS
       SELECT s.*
       FROM mv_champion_vision_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_combat_%s AS
       SELECT s.*
       FROM mv_champion_combat_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_matchup_%s AS
       SELECT s.*
       FROM mv_champion_matchup_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_challenge_%s AS
       SELECT s.*
       FROM mv_champion_challenge_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_core_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_shard_solo_%s AS
       SELECT s.*
       FROM mv_champion_shard_solo_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_runes_solo_%s AS
       SELECT s.*
       FROM mv_champion_runes_solo_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_shard_%s AS
       SELECT s.*
       FROM mv_champion_shard_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_runes_%s AS
       SELECT s.*
       FROM mv_champion_runes_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_item_solo_%s AS
       SELECT s.*
       FROM mv_champion_item_solo_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_item_%s AS
       SELECT s.*
       FROM mv_champion_item_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_spell_solo_%s AS
       SELECT s.*
       FROM mv_champion_spell_solo_stats s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_summoner_spells_%s AS
       SELECT s.*
       FROM mv_champion_summoner_spells s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_bucket_%s AS
       SELECT s.*
       FROM mv_champion_bucket s
       JOIN mv_champion_core_stats c ON c.id = s.champion_stat_id
       WHERE c.game_version = %L OR c.game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_bans_by_banner_%s AS
       SELECT * FROM mv_champion_bans_by_banner WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );

    RAISE NOTICE 'Archives complètes créées pour le patch % (depuis MVs)', p_game_version;
  END IF;

  DELETE FROM active_patches WHERE game_version = p_game_version;

  DELETE FROM ingest_matchs
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  RAISE NOTICE 'Patch % clôturé.', p_game_version;
END;
$$ LANGUAGE plpgsql;

-- Drop legacy tables (empty or already purged in app).
DROP TABLE IF EXISTS "match_player_bucket" CASCADE;
DROP TABLE IF EXISTS "match_player_challenges" CASCADE;
DROP TABLE IF EXISTS "match_player_combats" CASCADE;
DROP TABLE IF EXISTS "match_player_objectives" CASCADE;
DROP TABLE IF EXISTS "match_player_matchup" CASCADE;
DROP TABLE IF EXISTS "match_player_visions" CASCADE;
DROP TABLE IF EXISTS "match_player_core" CASCADE;
DROP TABLE IF EXISTS "match_players" CASCADE;
DROP TABLE IF EXISTS "bans" CASCADE;
DROP TABLE IF EXISTS "drake_details" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;
DROP TABLE IF EXISTS "matchs" CASCADE;
