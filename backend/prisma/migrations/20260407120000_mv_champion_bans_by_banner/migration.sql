-- Agrégat bans par champion banni, ligue, patch, côté (100/200) et rôle normalisé du banneur.
-- Alimenté comme les autres MVs à partir des matchs dont le préfixe de version est dans active_patches.

DROP MATERIALIZED VIEW IF EXISTS mv_champion_bans_by_banner;

CREATE MATERIALIZED VIEW mv_champion_bans_by_banner AS
WITH ban_rows AS (
  SELECT
    m.game_version,
    m.rank_tier,
    b.champion_id AS banned_champion_id,
    t.team AS team_num,
    CASE
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) = 'MID' THEN 'MIDDLE'
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) = 'ADC' THEN 'BOTTOM'
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) IN ('SUPPORT', 'UTILITY') THEN 'SUPPORT'
      ELSE UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN')))
    END AS banner_role_norm
  FROM bans b
  INNER JOIN teams t ON t.id = b.team_id
  INNER JOIN matchs m ON m.id = b.match_id
  INNER JOIN LATERAL (
    SELECT slot.role_raw AS role_raw
    FROM (
      SELECT
        mp_slot.role AS role_raw,
        ROW_NUMBER() OVER (ORDER BY mp_slot.participant_id) AS team_slot
      FROM match_players mp_slot
      WHERE mp_slot.match_id = b.match_id AND mp_slot.team_id = b.team_id
    ) slot
    WHERE slot.team_slot = b.pick_order
  ) x ON true
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
)
SELECT
  game_version,
  rank_tier,
  banned_champion_id,
  team_num,
  banner_role_norm,
  COUNT(*)::bigint AS ban_count
FROM ban_rows
GROUP BY game_version, rank_tier, banned_champion_id, team_num, banner_role_norm;

CREATE UNIQUE INDEX mv_champion_bans_by_banner_uidx ON mv_champion_bans_by_banner (
  game_version, rank_tier, banned_champion_id, team_num, banner_role_norm
);

-- Premier remplissage (non CONCURRENTLY : la vue vient d’être créée).
REFRESH MATERIALIZED VIEW mv_champion_bans_by_banner;

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
    'mv_champion_bucket',
    'mv_champion_bans_by_banner'
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

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_bans_by_banner_%s AS
       SELECT * FROM mv_champion_bans_by_banner WHERE game_version = %L OR game_version LIKE %L',
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
