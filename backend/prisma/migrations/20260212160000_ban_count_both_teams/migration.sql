-- Banrate: count each ban occurrence (if both teams ban the same champion = 2 bans).
-- ban_count = COUNT(*) of ban slots; banrate = 100 * ban_count / (2 * total_matches) so 100% = banned by both teams every match.
CREATE OR REPLACE FUNCTION get_stats_overview(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
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
  top_champs jsonb;
  top_pickrate jsonb;
  top_banrate jsonb;
  version_cond text;
  rank_cond text;
  match_cond text;
  division_cond text;
  key_champion_id text := 'championId';
  key_bans text := 'bans';
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
  division_cond := version_cond;

  EXECUTE format(
    'SELECT COUNT(*), MAX(m.created_at) FROM matches m WHERE %s',
    match_cond
  ) INTO total_matches, last_update;

  IF total_matches = 0 THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
      '[]'::jsonb
    ) INTO by_version FROM stats_matches_by_version;
    RETURN jsonb_build_object(
      'totalMatches', 0,
      'lastUpdate', to_jsonb(last_update),
      'playerCount', 0,
      'matchesByDivision', (
        SELECT jsonb_agg(jsonb_build_object('rankTier', t.rank_tier, 'matchCount', 0) ORDER BY t.ord)
        FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
      ),
      'matchesByVersion', COALESCE(by_version, '[]'::jsonb),
      'topWinrateChampions', '[]'::jsonb,
      'topPickrateChampions', '[]'::jsonb,
      'topBanrateChampions', '[]'::jsonb
    );
  END IF;

  EXECUTE format(
    'SELECT COUNT(DISTINCT p.puuid) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
    match_cond
  ) INTO player_count;

  EXECUTE format(
    $q$
    SELECT jsonb_agg(
      jsonb_build_object('rankTier', t.rank_tier, 'matchCount', COALESCE((d.cnt)::int, 0))
      ORDER BY t.ord
    )
    FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
    LEFT JOIN (
      SELECT UPPER(TRIM(split_part(rank, '_', 1))) AS rank_tier, COUNT(*)::bigint AS cnt
      FROM matches m
      WHERE %s AND rank IS NOT NULL AND rank != ''
      GROUP BY split_part(rank, '_', 1)
    ) d ON d.rank_tier = t.rank_tier
    $q$,
    division_cond
  ) INTO by_division;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
    '[]'::jsonb
  ) INTO by_version FROM stats_matches_by_version;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
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
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY winrate DESC
      LIMIT 10
    ) top
    $q$,
    key_champion_id,
    match_cond,
    match_cond
  ) INTO top_champs;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
          'games', (games)::int,
          'wins', (wins)::int,
          'winrate', winrate,
          'pickrate', pickrate
        )
        ORDER BY pickrate DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY pickrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id,
    match_cond,
    match_cond
  ) INTO top_pickrate;

  /* ban_count = total ban occurrences (both teams ban same = 2). banrate = 100 * ban_count / (2 * total_matches). */
  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
          'banCount', (ban_count)::int,
          'banrate', banrate
        )
        ORDER BY banrate DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT champion_id,
        ban_count,
        ROUND(100.0 * ban_count / NULLIF(2 * (SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS banrate
      FROM (
        SELECT (b->>%L)::int AS champion_id,
          COUNT(*)::bigint AS ban_count
        FROM matches m,
             jsonb_array_elements(COALESCE(m.teams, ''[]''::jsonb)) AS team,
             jsonb_array_elements(COALESCE(team->%L, ''[]''::jsonb)) AS b
        WHERE %s
          AND m.teams IS NOT NULL
          AND jsonb_typeof(team->%L) = ''array''
          AND b->>%L IS NOT NULL AND (b->>%L) ~ ''^\d+$''
        GROUP BY (b->>%L)::int
      ) sub
      ORDER BY banrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id,
    match_cond,
    key_champion_id,
    key_bans,
    match_cond,
    key_bans,
    key_champion_id,
    key_champion_id,
    key_champion_id
  ) INTO top_banrate;

  RETURN jsonb_build_object(
    'totalMatches', (total_matches)::int,
    'lastUpdate', to_jsonb(last_update),
    'playerCount', (player_count)::int,
    'matchesByDivision', COALESCE(by_division, '[]'::jsonb),
    'matchesByVersion', by_version,
    'topWinrateChampions', COALESCE(top_champs, '[]'::jsonb),
    'topPickrateChampions', COALESCE(top_pickrate, '[]'::jsonb),
    'topBanrateChampions', COALESCE(top_banrate, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats. Ban: count each ban (both teams ban same = 2); banrate = 100*ban_count/(2*total_matches).';
