-- Views and function for stats overview: single round-trip from backend, aggregations in DB.
-- Used by GET /api/stats/overview (StatsOverviewService).

-- Matches per division (tier from match.rank, e.g. GOLD from GOLD_II)
CREATE OR REPLACE VIEW stats_matches_by_division AS
SELECT
  UPPER(TRIM(split_part(rank, '_', 1))) AS rank_tier,
  COUNT(*)::bigint AS match_count
FROM matches
WHERE rank IS NOT NULL AND rank != ''
GROUP BY split_part(rank, '_', 1);

-- Matches per game version prefix (16.1, 16.2, 16.3)
CREATE OR REPLACE VIEW stats_matches_by_version AS
SELECT
  split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2) AS version_prefix,
  COUNT(*)::bigint AS match_count
FROM matches
WHERE game_version IS NOT NULL AND game_version LIKE '16.%'
GROUP BY split_part(game_version, '.', 1), split_part(game_version, '.', 2)
ORDER BY 1;

-- Champion winrate/pickrate from participants (for overview top 10 and reuse elsewhere)
CREATE OR REPLACE VIEW stats_champion_winrate AS
SELECT
  champion_id,
  COUNT(*)::bigint AS games,
  SUM(CASE WHEN win THEN 1 ELSE 0 END)::bigint AS wins,
  ROUND(100.0 * SUM(CASE WHEN win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM participants), 0), 2) AS pickrate
FROM participants
GROUP BY champion_id;

-- Single function returning full overview as JSONB (one round-trip)
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
  tier_ord int;
BEGIN
  SELECT COUNT(*) INTO total_matches FROM matches;
  SELECT MAX(created_at) INTO last_update FROM matches;
  SELECT COUNT(DISTINCT puuid) INTO player_count FROM participants;

  -- Division counts ordered by tier (IRON first, then BRONZE, ...)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('rankTier', rank_tier, 'matchCount', (match_count)::int)
      ORDER BY CASE UPPER(TRIM(rank_tier))
        WHEN 'IRON' THEN 1 WHEN 'BRONZE' THEN 2 WHEN 'SILVER' THEN 3 WHEN 'GOLD' THEN 4
        WHEN 'PLATINUM' THEN 5 WHEN 'EMERALD' THEN 6 WHEN 'DIAMOND' THEN 7 WHEN 'MASTER' THEN 8
        WHEN 'GRANDMASTER' THEN 9 WHEN 'CHALLENGER' THEN 10 WHEN 'UNRANKED' THEN 11
        ELSE 12 END
    ),
    '[]'::jsonb
  ) INTO by_division
  FROM stats_matches_by_division;

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
    'matchesByDivision', by_division,
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

COMMENT ON VIEW stats_matches_by_division IS 'Match count per rank tier (from matches.rank) for stats overview';
COMMENT ON VIEW stats_matches_by_version IS 'Match count per game version prefix (16.x) for stats overview';
COMMENT ON VIEW stats_champion_winrate IS 'Champion games/wins/winrate/pickrate from participants for stats and overview';
COMMENT ON FUNCTION get_stats_overview() IS 'Returns overview stats as JSONB: totalMatches, lastUpdate, playerCount, matchesByDivision, matchesByVersion, topWinrateChampions (min 20 games)';
