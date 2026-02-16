-- Per-rune stats for a champion (runeId, games, wins, pickrate, winrate) for display like stats runes tab.
-- Expands participant runes JSON (styles[].selections[].perk) and aggregates by perk_id.
CREATE OR REPLACE FUNCTION get_rune_stats_by_champion(
  p_champion_id int,
  p_version text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL,
  p_min_games int DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  version_cond text;
  rank_cond text;
  match_cond text;
  total_games bigint;
  result_json jsonb;
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
    'SELECT COUNT(*) FROM participants p JOIN matches m ON m.id = p.match_id WHERE p.champion_id = $1 AND (m.end_of_game_result = ''GameComplete'' OR m.end_of_game_result IS NULL) AND %s',
    match_cond
  ) INTO total_games USING p_champion_id;

  IF total_games = 0 THEN
    RETURN jsonb_build_object('totalGames', 0, 'runes', '[]'::jsonb);
  END IF;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'runeId', perk_id,
          'games', games,
          'wins', wins,
          'pickrate', ROUND(100.0 * games / NULLIF(%s::bigint, 0), 2),
          'winrate', ROUND(100.0 * wins / NULLIF(games, 0), 2)
        )
        ORDER BY games DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT perk_id, COUNT(*)::int AS games, SUM(win)::int AS wins
      FROM (
        SELECT (sel->>'perk')::int AS perk_id, p.match_id, (BOOL_OR(p.win))::int AS win
        FROM participants p
        JOIN matches m ON m.id = p.match_id
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.runes->'styles') = 'array' THEN p.runes->'styles' ELSE '[]'::jsonb END) AS style
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(style->'selections') = 'array' THEN style->'selections' ELSE '[]'::jsonb END) AS sel
        WHERE p.champion_id = %s
          AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
          AND %s
          AND (sel->>'perk') IS NOT NULL AND (sel->>'perk') ~ '^\d+$'
        GROUP BY (sel->>'perk')::int, p.match_id
      ) per_match
      GROUP BY perk_id
      HAVING COUNT(*) >= %s
    ) agg
    $q$,
    total_games,
    p_champion_id,
    match_cond,
    GREATEST(1, p_min_games)
  ) INTO result_json;

  RETURN jsonb_build_object('totalGames', total_games, 'runes', COALESCE(result_json, '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION get_rune_stats_by_champion(int, text, text, int) IS 'Per-rune stats for a champion (runeId, games, wins, pickrate, winrate). Optional version and rank_tier filter.';
