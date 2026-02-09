-- Functions for stats API: champions list, builds by champion, runes by champion.
-- Single round-trips, aggregations in DB.

-- Champions stats with optional rank_tier / role filter. Returns JSONB: totalGames, totalMatches, champions (with byRole).
CREATE OR REPLACE FUNCTION get_stats_champions(p_rank_tier text DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_games bigint;
  total_matches bigint;
  champions_json jsonb;
BEGIN
  WITH filtered AS (
    SELECT champion_id, match_id, win, COALESCE(role, 'UNKNOWN') AS role
    FROM participants
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR rank_tier = p_rank_tier)
      AND (p_role IS NULL OR p_role = '' OR role = p_role)
  ),
  total AS (
    SELECT COUNT(*) AS games, COUNT(DISTINCT match_id) AS matches FROM filtered
  ),
  champ_agg AS (
    SELECT champion_id, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id
  ),
  role_agg AS (
    SELECT champion_id, role, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id, role
  )
  SELECT t.games, t.matches INTO total_games, total_matches FROM total t;

  IF total_games = 0 THEN
    RETURN jsonb_build_object(
      'totalGames', 0,
      'totalMatches', 0,
      'champions', '[]'::jsonb,
      'generatedAt', to_jsonb(now())
    );
  END IF;

  WITH filtered AS (
    SELECT champion_id, match_id, win, COALESCE(role, 'UNKNOWN') AS role
    FROM participants
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR rank_tier = p_rank_tier)
      AND (p_role IS NULL OR p_role = '' OR role = p_role)
  ),
  champ_agg AS (
    SELECT champion_id, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id
  ),
  role_agg AS (
    SELECT champion_id, role, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id, role
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'championId', c.champion_id,
      'games', (c.games)::int,
      'wins', (c.wins)::int,
      'winrate', ROUND(100.0 * c.wins / NULLIF(c.games, 0), 2),
      'pickrate', ROUND(100.0 * c.games / total_games, 2),
      'byRole', COALESCE(
        (SELECT jsonb_object_agg(r.role, jsonb_build_object('games', (r.games)::int, 'wins', (r.wins)::int, 'winrate', ROUND(100.0 * r.wins / NULLIF(r.games, 0), 2)))
         FROM role_agg r WHERE r.champion_id = c.champion_id),
        '{}'::jsonb
      )
    )
    ORDER BY c.games DESC
  ) INTO champions_json
  FROM champ_agg c;

  RETURN jsonb_build_object(
    'totalGames', (total_games)::int,
    'totalMatches', (total_matches)::int,
    'champions', COALESCE(champions_json, '[]'::jsonb),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

-- Builds by champion: aggregate by normalized items (sorted array), optional rank_tier, role, patch.
-- Returns JSONB: totalGames, builds (items[], games, wins, winrate, pickrate). Fallback to builds with >= 1 game if none meet min_games.
CREATE OR REPLACE FUNCTION get_builds_by_champion(
  p_champion_id int,
  p_rank_tier text DEFAULT NULL,
  p_role text DEFAULT NULL,
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
  builds_json jsonb;
  items_canonical jsonb;
BEGIN
  WITH base AS (
    SELECT p.match_id, p.items, p.win
    FROM participants p
    LEFT JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
      AND (p_patch IS NULL OR p_patch = '' OR m.game_version ILIKE '%' || p_patch || '%')
  ),
  with_key AS (
    SELECT
      match_id,
      win,
      COALESCE(
        (SELECT jsonb_agg(elem ORDER BY elem) FROM jsonb_array_elements_text(COALESCE(items::jsonb, '[]'::jsonb)) AS elem),
        '[]'::jsonb
      ) AS items_key
    FROM base
  ),
  build_agg AS (
    SELECT items_key, COUNT(*)::int AS games, SUM(win::int)::int AS wins
    FROM with_key
    GROUP BY items_key
  ),
  total AS (SELECT SUM(games)::int AS n FROM build_agg)
  SELECT COALESCE((SELECT n FROM total), 0) INTO total_games;

  IF total_games = 0 THEN
    RETURN jsonb_build_object('totalGames', 0, 'builds', '[]'::jsonb);
  END IF;

  WITH base AS (
    SELECT p.match_id, p.items, p.win
    FROM participants p
    LEFT JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
      AND (p_patch IS NULL OR p_patch = '' OR m.game_version ILIKE '%' || p_patch || '%')
  ),
  with_key AS (
    SELECT
      win,
      COALESCE(
        (SELECT jsonb_agg(elem ORDER BY elem) FROM jsonb_array_elements_text(COALESCE(items::jsonb, '[]'::jsonb)) AS elem),
        '[]'::jsonb
      ) AS items_key
    FROM base
  ),
  build_agg AS (
    SELECT items_key, COUNT(*)::int AS games, SUM(win::int)::int AS wins
    FROM with_key
    GROUP BY items_key
  ),
  primary_set AS (
    SELECT items_key, games, wins,
      ROUND(100.0 * wins / NULLIF(games, 0), 2) AS winrate,
      ROUND(100.0 * games / total_games, 2) AS pickrate
    FROM build_agg
    WHERE games >= p_min_games
    ORDER BY games DESC
    LIMIT p_limit
  ),
  fallback_set AS (
    SELECT items_key, games, wins,
      ROUND(100.0 * wins / NULLIF(games, 0), 2) AS winrate,
      ROUND(100.0 * games / total_games, 2) AS pickrate
    FROM build_agg
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
      'items', items_key,
      'games', games,
      'wins', wins,
      'winrate', winrate,
      'pickrate', pickrate
    )
    ORDER BY games DESC
  ) INTO builds_json
  FROM chosen;

  RETURN jsonb_build_object(
    'totalGames', total_games,
    'builds', COALESCE(builds_json, '[]'::jsonb)
  );
END;
$$;

-- Runes by champion: aggregate by runes (jsonb), optional rank_tier, patch. Same fallback as builds.
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
    LEFT JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
      AND (p_patch IS NULL OR p_patch = '' OR m.game_version ILIKE '%' || p_patch || '%')
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

  WITH rune_agg AS (
    SELECT COALESCE(runes, 'null'::jsonb) AS runes_key, COUNT(*)::int AS games, SUM(win::int)::int AS wins
    FROM participants p
    LEFT JOIN matches m ON m.id = p.match_id
    WHERE p.champion_id = p_champion_id
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
      AND (p_patch IS NULL OR p_patch = '' OR m.game_version ILIKE '%' || p_patch || '%')
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

COMMENT ON FUNCTION get_stats_champions(text, text) IS 'Champions stats with optional rank_tier/role filter. Returns totalGames, totalMatches, champions (with byRole), generatedAt';
COMMENT ON FUNCTION get_builds_by_champion(int, text, text, text, int, int) IS 'Builds (items) by champion with optional filters. Returns totalGames, builds (items, games, wins, winrate, pickrate)';
COMMENT ON FUNCTION get_runes_by_champion(int, text, text, int, int) IS 'Runes by champion with optional filters. Returns totalGames, runes (runes, games, wins, winrate, pickrate)';
