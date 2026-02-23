-- Runes by champion: utiliser m.rank et m.game_version (comme runes-per-rune et matchups)
-- au lieu de p.rank_tier pour que les runes ne restent pas vides quand un filtre rank est appliqué.
-- Garde les sets avec games, wins, winrate, pickrate (déjà présents).

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
      AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
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
      AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
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

COMMENT ON FUNCTION get_runes_by_champion(int, text, text, int, int) IS 'Rune sets by champion (runes, games, wins, winrate, pickrate). Filter by match.rank and match.game_version like runes-per-rune.';
