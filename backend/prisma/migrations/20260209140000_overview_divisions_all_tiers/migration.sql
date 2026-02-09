-- Ensure matchesByDivision always includes all tiers (IRON, BRONZE, ...) with 0 when no matches.
CREATE OR REPLACE FUNCTION get_stats_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_matches bigint;
  last_update timestamptz;
  player_count bigint;
  by_division jsonb;
  by_version jsonb;
BEGIN
  SELECT COUNT(*) INTO total_matches FROM matches;
  SELECT MAX(created_at) INTO last_update FROM matches;
  SELECT COUNT(DISTINCT puuid) INTO player_count FROM participants;

  -- All tiers in order; left-join view so missing tiers get matchCount 0
  SELECT jsonb_agg(
    jsonb_build_object('rankTier', t.rank_tier, 'matchCount', COALESCE((d.match_count)::int, 0))
    ORDER BY t.ord
  ) INTO by_division
  FROM (
    VALUES
      ('IRON', 1), ('BRONZE', 2), ('SILVER', 3), ('GOLD', 4), ('PLATINUM', 5),
      ('EMERALD', 6), ('DIAMOND', 7), ('MASTER', 8), ('GRANDMASTER', 9),
      ('CHALLENGER', 10), ('UNRANKED', 11)
  ) AS t(rank_tier, ord)
  LEFT JOIN stats_matches_by_division d ON UPPER(TRIM(d.rank_tier)) = t.rank_tier;

  -- Version counts (already ordered by version_prefix in view)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
    '[]'::jsonb
  ) INTO by_version
  FROM stats_matches_by_version;

  RETURN jsonb_build_object(
    'totalMatches', (total_matches)::int,
    'lastUpdate', to_jsonb(last_update),
    'playerCount', (player_count)::int,
    'matchesByDivision', COALESCE(by_division, '[]'::jsonb),
    'matchesByVersion', by_version,
    'topWinrateChampions', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'championId', champion_id,
            'games', (games)::int,
            'wins', (wins)::int,
            'winrate', winrate,
            'pickrate', pickrate
          )
          ORDER BY winrate DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT champion_id, games, wins, winrate, pickrate
        FROM stats_champion_winrate
        WHERE games >= 20
        ORDER BY winrate DESC
        LIMIT 10
      ) top
    )
  );
END;
$$;

COMMENT ON FUNCTION get_stats_overview() IS 'Returns overview stats as JSONB; matchesByDivision includes all tiers (IRON..UNRANKED) with 0 when no matches';
