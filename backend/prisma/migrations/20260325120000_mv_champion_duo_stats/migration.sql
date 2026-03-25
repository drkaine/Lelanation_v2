-- Add synergy/together aggregate MV: mv_champion_duo_stats
-- Purpose: enable champion pair ("together") calculations without scanning raw tables.
--
-- Definition:
-- - champion_stat_id: deterministic key (core_stat_id) for champion A with filters (rank/patch/role/region)
-- - ally_champion_id: champion B on the SAME team in the same match
-- - count_game/count_win: number of games played together and wins for champion A when paired with B
--
-- Notes:
-- - Role filter applies to champion A (mp.role), ally role is not constrained.
-- - Pair is directional (A,B) and (B,A) both exist (useful for per-champion queries).

DROP MATERIALIZED VIEW IF EXISTS mv_champion_duo_stats;

CREATE MATERIALIZED VIEW mv_champion_duo_stats AS
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
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  mp.role,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier) AS rank_tier,
  m.game_version,
  m.region
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
  mp.role,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
  m.game_version,
  m.region;

CREATE UNIQUE INDEX ON mv_champion_duo_stats (champion_stat_id, ally_champion_id);

-- Extend close_patch() archiving to include mv_champion_duo_stats.
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
      'CREATE TABLE IF NOT EXISTS archive_champion_duo_%s AS SELECT * FROM mv_champion_duo_stats WHERE game_version = %L OR game_version LIKE %L',
      v_table_suffix, p_game_version, v_like_patch
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

