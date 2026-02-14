-- Progressions complètes (tous les champions): winrate et pickrate, delta depuis la version la plus ancienne.
-- Pour onglet "Progressions" type LeagueOfGraphs (progression du winrate + progression de la popularité).
CREATE OR REPLACE FUNCTION get_stats_overview_progression_full(
  p_version_oldest text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_oldest bigint;
  total_since bigint;
  result jsonb;
BEGIN
  IF p_version_oldest IS NULL OR p_version_oldest = '' THEN
    RETURN jsonb_build_object(
      'oldestVersion', null,
      'champions', '[]'::jsonb
    );
  END IF;

  SELECT COUNT(DISTINCT m.id) INTO total_oldest
  FROM matches m
  WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
    AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))));

  SELECT COUNT(DISTINCT m.id) INTO total_since
  FROM matches m
  WHERE m.game_version IS NOT NULL
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
    AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))));

  IF total_oldest = 0 OR total_since = 0 THEN
    RETURN jsonb_build_object(
      'oldestVersion', p_version_oldest,
      'champions', '[]'::jsonb
    );
  END IF;

  WITH
  oldest_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
      ROUND(100.0 * COUNT(*) / NULLIF(total_oldest, 0), 2) AS pickrate
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
    HAVING COUNT(*) >= 20
  ),
  since_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
      ROUND(100.0 * COUNT(*) / NULLIF(total_since, 0), 2) AS pickrate
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL
      AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
  ),
  merged AS (
    SELECT
      o.champion_id,
      o.winrate AS wr_oldest,
      s.winrate AS wr_since,
      (s.winrate - o.winrate) AS delta_wr,
      o.pickrate AS pickrate_oldest,
      s.pickrate AS pickrate_since,
      (s.pickrate - o.pickrate) AS delta_pick
    FROM oldest_agg o
    INNER JOIN since_agg s ON s.champion_id = o.champion_id
  )
  SELECT jsonb_build_object(
    'oldestVersion', p_version_oldest,
    'champions', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'championId', champion_id,
          'wrOldest', wr_oldest,
          'wrSince', wr_since,
          'deltaWr', delta_wr,
          'pickrateOldest', pickrate_oldest,
          'pickrateSince', pickrate_since,
          'deltaPick', delta_pick
        )
        ORDER BY delta_wr DESC NULLS LAST
      ),
      '[]'::jsonb
    )
  ) INTO result
  FROM merged;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_progression_full(text, text) IS 'Full progression: all champions with WR and pickrate delta from oldest version to all since. For Progressions tab.';
