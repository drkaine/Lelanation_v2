-- Champion winrate progression: delta from oldest version to all (since oldest).
-- Used for "Winrate depuis X" encart (top gainers / top losers).
CREATE OR REPLACE FUNCTION get_stats_overview_progression(
  p_version_oldest text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_version_oldest IS NULL OR p_version_oldest = '' THEN
    RETURN jsonb_build_object(
      'oldestVersion', null,
      'gainers', '[]'::jsonb,
      'losers', '[]'::jsonb
    );
  END IF;

  WITH
  oldest_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
    HAVING COUNT(*) >= 20
  ),
  since_agg AS (
    SELECT p.champion_id,
      ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL
      AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
  ),
  merged AS (
    SELECT o.champion_id, o.winrate AS wr_oldest, s.winrate AS wr_since,
      (s.winrate - o.winrate) AS delta
    FROM oldest_agg o
    INNER JOIN since_agg s ON s.champion_id = o.champion_id
  ),
  gainers AS (
    SELECT jsonb_agg(
      jsonb_build_object('championId', champion_id, 'wrOldest', wr_oldest, 'wrSince', wr_since, 'delta', delta)
      ORDER BY delta DESC
    ) AS arr FROM (SELECT * FROM merged WHERE delta > 0 ORDER BY delta DESC LIMIT 5) sub
  ),
  losers AS (
    SELECT jsonb_agg(
      jsonb_build_object('championId', champion_id, 'wrOldest', wr_oldest, 'wrSince', wr_since, 'delta', delta)
      ORDER BY delta ASC
    ) AS arr FROM (SELECT * FROM merged WHERE delta < 0 ORDER BY delta ASC LIMIT 5) sub
  )
  SELECT jsonb_build_object(
    'oldestVersion', p_version_oldest,
    'gainers', COALESCE(g.arr, '[]'::jsonb),
    'losers', COALESCE(l.arr, '[]'::jsonb)
  ) INTO result
  FROM gainers g, losers l;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_progression(text, text) IS 'Champion WR progression: delta from oldest version to all since. Returns gainers (top 5) and losers (top 5).';
