-- Only keep matches with endOfGameResult (filter at insert). Drop column and update functions.

-- 1) get_stats_overview_duration_winrate: remove end_of_game_result filter
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
        AND %s
      GROUP BY (FLOOR((m.game_duration / 60.0) / 5) * 5)::int
    ) t
    $q$,
    match_cond
  ) INTO buckets_json;

  RETURN jsonb_build_object('buckets', COALESCE(buckets_json, '[]'::jsonb));
END;
$$;

-- 2) get_stats_duration_winrate_by_champion: remove end_of_game_result filter
CREATE OR REPLACE FUNCTION get_stats_duration_winrate_by_champion(
  p_champion_id int,
  p_version text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL
)
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
        COUNT(*)::bigint AS match_count,
        SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::bigint AS wins
      FROM participants p
      JOIN matches m ON m.id = p.match_id
      WHERE p.champion_id = %s
        AND m.game_duration IS NOT NULL
        AND m.game_duration > 0
        AND %s
      GROUP BY (FLOOR((m.game_duration / 60.0) / 5) * 5)::int
    ) t
    $q$,
    p_champion_id,
    match_cond
  ) INTO buckets_json;

  RETURN jsonb_build_object('buckets', COALESCE(buckets_json, '[]'::jsonb));
END;
$$;

-- 3) get_matchups_by_champion (same-lane version): remove end_of_game_result filter
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
          AND COALESCE(opp.role, 'UNKNOWN') = COALESCE(p.role, 'UNKNOWN')
        JOIN matches m ON m.id = p.match_id
        WHERE p.champion_id = %s
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

-- 4) get_rune_stats_by_champion: remove end_of_game_result filter
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
    'SELECT COUNT(*) FROM participants p JOIN matches m ON m.id = p.match_id WHERE p.champion_id = $1 AND %s',
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

-- 5) get_runes_by_champion: remove end_of_game_result filter
CREATE OR REPLACE FUNCTION get_runes_by_champion(
  p_champion_id int,
  p_rank_tier text DEFAULT NULL,
  p_patch text DEFAULT NULL,
  p_min_games int DEFAULT 10,
  p_limit int DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_games int;
  runes_json jsonb;
BEGIN
  WITH base AS (
    SELECT p.runes, p.win
    FROM participants p
    JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_patch IS NULL OR p_patch = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_patch || '.%'))
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND m.rank != '' AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
  ),
  rune_agg AS (
    SELECT COALESCE(runes, 'null'::jsonb) AS runes_key, COUNT(*)::int AS games, SUM(win::int)::int AS wins
    FROM base
    GROUP BY runes
  ),
  total AS (SELECT SUM(games)::int AS n FROM rune_agg)
  SELECT COALESCE((SELECT n FROM total), 0) INTO total_games;

  IF total_games = 0 THEN
    RETURN jsonb_build_object('totalGames', 0, 'runes', '[]'::jsonb);
  END IF;

  WITH base AS (
    SELECT p.runes, p.win
    FROM participants p
    JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_patch IS NULL OR p_patch = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_patch || '.%'))
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND m.rank != '' AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
  ),
  rune_agg AS (
    SELECT COALESCE(runes, 'null'::jsonb) AS runes_key, COUNT(*)::int AS games, SUM(win::int)::int AS wins
    FROM base
    GROUP BY runes
  ),
  primary_set AS (
    SELECT runes_key, games, wins,
      ROUND(100.0 * wins / NULLIF(games, 0), 2) AS winrate,
      ROUND(100.0 * games / total_games, 2) AS pickrate
    FROM rune_agg
    WHERE games >= p_min_games
    ORDER BY games DESC
    LIMIT p_limit
  ),
  fallback_set AS (
    SELECT runes_key, games, wins,
      ROUND(100.0 * wins / NULLIF(games, 0), 2) AS winrate,
      ROUND(100.0 * games / total_games, 2) AS pickrate
    FROM rune_agg
    WHERE games >= 1
    ORDER BY games DESC
    LIMIT p_limit
  ),
  chosen AS (
    SELECT * FROM primary_set
    UNION ALL
    SELECT f.* FROM fallback_set f
    WHERE (SELECT COUNT(*) FROM primary_set) = 0
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'runes', CASE WHEN runes_key = 'null'::jsonb THEN NULL ELSE runes_key END,
      'games', games,
      'wins', wins,
      'winrate', winrate,
      'pickrate', pickrate
    )
    ORDER BY games DESC
  ) INTO runes_json
  FROM chosen;

  RETURN jsonb_build_object(
    'totalGames', total_games,
    'runes', COALESCE(runes_json, '[]'::jsonb)
  );
END;
$$;

-- 6) Drop index and column
DROP INDEX IF EXISTS "matches_end_of_game_result_idx";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "end_of_game_result";
