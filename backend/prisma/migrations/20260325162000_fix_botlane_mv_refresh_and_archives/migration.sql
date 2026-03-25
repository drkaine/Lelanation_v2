-- Fixes:
-- 1) mv_botlane_duo_vs_duo_stats was empty because role filter expected ADC while ingestion stores BOTTOM.
-- 2) close_patch() archive scope extended to include duo/botlane + champion satellite MVs.
-- 3) refresh_all_materialized_views() SQL function updated with full MV list.

DROP MATERIALIZED VIEW IF EXISTS mv_botlane_duo_vs_duo_stats;

CREATE MATERIALIZED VIEW mv_botlane_duo_vs_duo_stats AS
WITH botlane_duos AS (
  SELECT
    m.id AS match_id,
    m.region,
    m.game_version,
    m.rank_tier,
    t.id AS team_id,
    t.win AS team_win,
    MAX(CASE WHEN upper(mp.role) IN ('BOTTOM', 'ADC') THEN mp.champion_id END) AS adc_id,
    MAX(CASE WHEN upper(mp.role) = 'SUPPORT' THEN mp.champion_id END) AS support_id
  FROM matchs m
  JOIN teams t ON t.match_id = m.id
  JOIN match_players mp ON mp.match_id = m.id AND mp.team_id = t.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
  GROUP BY m.id, m.region, m.game_version, m.rank_tier, t.id, t.win
  HAVING
    COUNT(*) FILTER (WHERE upper(mp.role) IN ('BOTTOM', 'ADC')) = 1
    AND COUNT(*) FILTER (WHERE upper(mp.role) = 'SUPPORT') = 1
),
duo_vs_duo AS (
  SELECT
    a.region,
    a.game_version,
    a.rank_tier,
    a.adc_id,
    a.support_id,
    b.adc_id AS opp_adc_id,
    b.support_id AS opp_support_id,
    a.team_win
  FROM botlane_duos a
  JOIN botlane_duos b
    ON b.match_id = a.match_id
   AND b.team_id != a.team_id
  WHERE a.adc_id IS NOT NULL
    AND a.support_id IS NOT NULL
    AND b.adc_id IS NOT NULL
    AND b.support_id IS NOT NULL
)
SELECT
  adc_id,
  support_id,
  opp_adc_id,
  opp_support_id,
  rank_tier,
  game_version,
  region,
  SUM(CASE WHEN team_win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM duo_vs_duo
GROUP BY
  adc_id,
  support_id,
  opp_adc_id,
  opp_support_id,
  rank_tier,
  game_version,
  region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_botlane_duo_vs_duo_stats (
  adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region
);

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
DECLARE
  mv_name TEXT;
BEGIN
  FOREACH mv_name IN ARRAY ARRAY[
    'mv_champion_core_stats',
    'mv_champion_vs_stats',
    'mv_champion_duo_role_stats',
    'mv_botlane_duo_vs_duo_stats',
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

    RAISE NOTICE 'Archives complètes créées pour le patch % (depuis MVs)', p_game_version;
  END IF;

  DELETE FROM active_patches WHERE game_version = p_game_version;

  DELETE FROM matchs
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  RAISE NOTICE 'Patch % clôturé.', p_game_version;
END;
$$ LANGUAGE plpgsql;
