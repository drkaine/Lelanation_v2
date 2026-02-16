-- Matchups by champion: for a given champion, winrate vs each opponent (games vs X, wins, winrate).
-- Opponents = participants in the same match on the opposite team (team_id != our team_id).
CREATE OR REPLACE FUNCTION get_matchups_by_champion(
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
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'opponentChampionId', opponent_id,
          'games', games,
          'wins', wins,
          'winrate', winrate
        )
        ORDER BY winrate DESC, games DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        opponent_id,
        COUNT(*)::int AS games,
        SUM(win)::int AS wins,
        ROUND(100.0 * SUM(win) / NULLIF(COUNT(*), 0), 2) AS winrate
      FROM (
        SELECT p.match_id, opp.champion_id AS opponent_id, (BOOL_OR(p.win))::int AS win
        FROM participants p
        JOIN participants opp ON opp.match_id = p.match_id
          AND opp.team_id IS NOT NULL
          AND p.team_id IS NOT NULL
          AND opp.team_id <> p.team_id
        JOIN matches m ON m.id = p.match_id
        WHERE p.champion_id = %s
          AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
          AND %s
        GROUP BY p.match_id, opp.champion_id
      ) per_match
      GROUP BY opponent_id
      HAVING COUNT(*) >= %s
    ) agg
    $q$,
    p_champion_id,
    match_cond,
    GREATEST(1, p_min_games)
  ) INTO result_json;

  RETURN jsonb_build_object('matchups', COALESCE(result_json, '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION get_matchups_by_champion(int, text, text, int) IS 'Winrate of champion vs each opponent (lane/matchup). Optional version and rank_tier filter. Returns matchups: [{ opponentChampionId, games, wins, winrate }].';
