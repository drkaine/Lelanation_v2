-- Duration vs winrate by 5-min buckets (uses version and rank_tier filters).
-- game_duration is in seconds; buckets: 15, 20, 25, 30... min.
CREATE OR REPLACE FUNCTION get_stats_overview_duration_winrate(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  version_cond text;
  rank_cond text;
  match_cond text;
  buckets_json jsonb;
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
  ELSE
    rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
  END IF;
  match_cond := version_cond || ' AND ' || rank_cond;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'durationMin', duration_min,
          'matchCount', (match_count)::int,
          'wins', (wins)::int,
          'winrate', ROUND(100.0 * wins / NULLIF(match_count, 0), 2)
        )
        ORDER BY duration_min
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        (FLOOR((m.game_duration / 60.0) / 5) * 5)::int AS duration_min,
        COUNT(DISTINCT m.id)::bigint AS match_count,
        SUM(CASE WHEN first_win THEN 1 ELSE 0 END)::bigint AS wins
      FROM matches m
      CROSS JOIN LATERAL (
        SELECT p.win AS first_win
        FROM participants p
        WHERE p.match_id = m.id
        LIMIT 1
      ) p
      WHERE m.game_duration IS NOT NULL
        AND m.game_duration > 0
        AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
        AND %s
      GROUP BY (FLOOR((m.game_duration / 60.0) / 5) * 5)::int
    ) t
    $q$,
    match_cond
  ) INTO buckets_json;

  RETURN jsonb_build_object('buckets', COALESCE(buckets_json, '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION get_stats_overview_duration_winrate(text, text) IS 'Duration (5-min buckets) vs winrate; optional version and rank_tier filter.';
