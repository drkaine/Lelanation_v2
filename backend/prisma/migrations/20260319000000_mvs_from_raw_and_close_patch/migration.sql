-- Une seule source de vérité (phase 1) : close_patch snapshot depuis les MVs ; mv_team_core_stats depuis les brutes.
-- Contrainte de clôture : gérée en amont (runPatchCleanupFromConfig : count >= maxMatches dans match-filters.json).

-- 1. Id déterministe pour usage futur (MVs champion-from-raw)
CREATE OR REPLACE FUNCTION core_stat_id(
  p_champion_id INT, p_rank_tier TEXT, p_rank_division TEXT,
  p_game_version TEXT, p_role TEXT, p_region TEXT
) RETURNS BIGINT AS $$
  SELECT (abs(hashtext(p_champion_id::text || '|' || coalesce(p_rank_tier,'') || '|' || coalesce(p_rank_division,'') || '|' || coalesce(p_game_version,'') || '|' || coalesce(p_role,'') || '|' || coalesce(p_region,'')))::bigint << 31)
    | (abs(hashtext(p_region || '|' || p_role))::bigint & 2147483647);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION team_stat_id(
  p_team INT, p_rank_tier TEXT, p_rank_division TEXT, p_game_version TEXT, p_region TEXT
) RETURNS BIGINT AS $$
  SELECT (abs(hashtext(p_team::text || '|' || coalesce(p_rank_tier,'') || '|' || coalesce(p_rank_division,'') || '|' || coalesce(p_game_version,'') || '|' || coalesce(p_region,'')))::bigint << 31)
    | (abs(hashtext(p_region))::bigint & 2147483647);
$$ LANGUAGE sql IMMUTABLE;

-- 2. mv_team_core_stats : agrégat direct sur matchs + teams (patches actifs)
DROP MATERIALIZED VIEW IF EXISTS mv_team_core_stats;

CREATE MATERIALIZED VIEW mv_team_core_stats AS
SELECT
  team_stat_id(t.team, m.rank_tier, COALESCE(m.rank_division, ''), m.game_version, m.region) AS id,
  t.team,
  m.rank_tier,
  COALESCE(m.rank_division, '') AS rank_division,
  m.game_version,
  m.region,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(CASE WHEN t.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
  SUM(t.baron_kills)::int AS sum_baron_kills,
  SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
  SUM(t.dragon_kills)::int AS sum_dragon_kills,
  SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
  SUM(t.tower_kills)::int AS sum_tower_kills,
  SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
  SUM(t.horde_kills)::int AS sum_horde_kills,
  SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
  SUM(t.rift_herald_kills)::int AS sum_rift_herald_kills,
  SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
  SUM(t.inhibitor_kills)::int AS sum_inhibitor_kills,
  SUM(t.champion_kills)::int AS sum_champion_kills,
  SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
  SUM(t.elder_kills)::int AS sum_elder_kills
FROM matchs m
JOIN teams t ON t.match_id = m.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY t.team, m.rank_tier, m.rank_division, m.game_version, m.region;

CREATE UNIQUE INDEX ON mv_team_core_stats (id);
CREATE UNIQUE INDEX ON mv_team_core_stats (team, rank_tier, rank_division, game_version, region);

-- 3. close_patch : snapshot depuis les MVs (plus depuis les tables d'agrégat), puis suppression des brutes
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
