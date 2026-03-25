-- Cleanup synergy MVs:
-- - Drop mv_champion_duo_stats (redundant; use mv_champion_duo_role_stats instead).
-- - Recreate mv_champion_duo_role_stats with only the needed columns.
-- - Replace close_patch() so it no longer references mv_champion_duo_stats.
-- - Drop champion_tier_snapshot_runs table.

-- 1) Drop redundant MV
DROP MATERIALIZED VIEW IF EXISTS mv_champion_duo_stats;

-- 2) Recreate mv_champion_duo_role_stats (minimal payload)
DROP MATERIALIZED VIEW IF EXISTS mv_champion_duo_role_stats;

CREATE MATERIALIZED VIEW mv_champion_duo_role_stats AS
SELECT
  core_stat_id(
    mp.champion_id,
    COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
    COALESCE(mp.rank_division, m.rank_division, ''),
    m.game_version,
    mp.role,
    m.region
  ) AS champion_stat_id,
  ally.champion_id AS ally_champion_id,
  ally.role AS ally_role,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_players ally
  ON ally.match_id = mp.match_id
 AND ally.team_id = mp.team_id
 AND ally.id != mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
  SELECT game_version FROM active_patches
)
GROUP BY
  core_stat_id(
    mp.champion_id,
    COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
    COALESCE(mp.rank_division, m.rank_division, ''),
    m.game_version,
    mp.role,
    m.region
  ),
  ally.champion_id,
  ally.role;

CREATE UNIQUE INDEX ON mv_champion_duo_role_stats (champion_stat_id, ally_champion_id, ally_role);

-- 3) close_patch(): archive only what still exists
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
      'CREATE TABLE IF NOT EXISTS archive_champion_core_stats_%s AS SELECT * FROM mv_champion_core_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_vs_%s AS SELECT * FROM mv_champion_vs_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_champion_duo_role_%s AS SELECT * FROM mv_champion_duo_role_stats WHERE EXISTS (SELECT 1 FROM mv_champion_core_stats ccs WHERE ccs.id = mv_champion_duo_role_stats.champion_stat_id AND (ccs.game_version = %L OR ccs.game_version LIKE %L))',
      v_table_suffix, p_game_version, v_like_patch, p_game_version, v_like_patch
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS archive_team_core_stats_%s AS SELECT * FROM mv_team_core_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
    );
    RAISE NOTICE 'Archives créées pour le patch % (depuis MVs)', p_game_version;
  END IF;

  DELETE FROM active_patches WHERE game_version = p_game_version;

  DELETE FROM matchs
  WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

  RAISE NOTICE 'Patch % clôturé.', p_game_version;
END;
$$ LANGUAGE plpgsql;

-- 4) Drop daily snapshot runs table (no longer used)
DROP TABLE IF EXISTS champion_tier_snapshot_runs;

