-- Support multiple rank tiers in stats (e.g. rankTier=GOLD&rankTier=PLATINUM → comma-separated in SQL).
-- When p_rank_tier contains ',', filter with IN (unnest(string_to_array(...))); otherwise keep = comparison.

-- 1) get_stats_overview
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
  empty_arr text := '(E''\x5b\x5d'')::jsonb';
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
  ELSIF position(',' in p_rank_tier) > 0 THEN
    rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) IN (SELECT UPPER(TRIM(unnest(string_to_array(' || quote_literal(p_rank_tier) || ', '','')))))';
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
    'SELECT COUNT(DISTINCT p.player_id) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
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
      %s
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
    empty_arr,
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
      %s
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
    empty_arr,
    match_cond,
    match_cond
  ) INTO top_pickrate;

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
      %s
    )
    FROM (
      SELECT champion_id,
        ban_count,
        ROUND(100.0 * ban_count / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS banrate
      FROM (
        SELECT (b->>%L)::int AS champion_id,
          COUNT(DISTINCT m.id)::bigint AS ban_count
        FROM matches m,
             jsonb_array_elements(COALESCE(m.teams, %s)) AS team,
             jsonb_array_elements(COALESCE(team->%L, %s)) AS b
        WHERE %s
          AND m.teams IS NOT NULL
          AND jsonb_typeof(team->%L) = 'array'
          AND b->>%L IS NOT NULL AND (b->>%L) ~ '^\d+$'
        GROUP BY (b->>%L)::int
      ) sub
      ORDER BY banrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id,
    empty_arr,
    match_cond,
    key_champion_id,
    empty_arr,
    key_bans,
    empty_arr,
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

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats. playerCount = COUNT(DISTINCT player_id). p_rank_tier can be comma-separated (e.g. GOLD,PLATINUM,EMERALD).';

-- 2) get_stats_champions: support comma-separated p_rank_tier. Single condition IN (unnest(...)) works for one or many.
CREATE OR REPLACE FUNCTION get_stats_champions(p_rank_tier text DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_matches bigint;
  total_games int;
  champions_json jsonb;
BEGIN
  WITH filtered AS (
    SELECT p.champion_id, p.match_id, p.win, COALESCE(p.role, 'UNKNOWN') AS role
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier IN (SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))))
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
  ),
  total AS (
    SELECT COUNT(DISTINCT match_id) AS matches FROM filtered
  ),
  champ_agg AS (
    SELECT champion_id, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id
  ),
  role_agg AS (
    SELECT champion_id, role, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id, role
  ),
  role_denom AS (
    SELECT role, COUNT(DISTINCT match_id)::bigint AS match_count
    FROM filtered GROUP BY role
  ),
  match_bans AS (
    SELECT DISTINCT m.id AS match_id, (b->>'championId')::int AS champion_id
    FROM matches m,
         jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS team,
         jsonb_array_elements(COALESCE(team->'bans', '[]'::jsonb)) AS b
    WHERE m.teams IS NOT NULL AND jsonb_typeof(team->'bans') = 'array'
      AND b->>'championId' IS NOT NULL AND (b->>'championId') ~ '^\d+$'
      AND m.id IN (SELECT match_id FROM filtered)
  ),
  ban_agg AS (
    SELECT champion_id, COUNT(*)::bigint AS ban_count
    FROM match_bans WHERE champion_id IS NOT NULL
    GROUP BY champion_id
  )
  SELECT COALESCE((SELECT matches FROM total), 0) INTO total_matches;

  IF total_matches = 0 THEN
    RETURN jsonb_build_object(
      'totalGames', 0,
      'totalMatches', 0,
      'champions', '[]'::jsonb,
      'generatedAt', to_jsonb(now())
    );
  END IF;

  WITH filtered AS (
    SELECT p.champion_id, p.match_id, p.win, COALESCE(p.role, 'UNKNOWN') AS role
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier IN (SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))))
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
  ),
  champ_agg AS (
    SELECT champion_id, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id
  ),
  role_agg AS (
    SELECT champion_id, role, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id, role
  ),
  role_denom AS (
    SELECT role, COUNT(DISTINCT match_id)::bigint AS match_count
    FROM filtered GROUP BY role
  ),
  match_bans AS (
    SELECT DISTINCT m.id AS match_id, (b->>'championId')::int AS champion_id
    FROM matches m,
         jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS team,
         jsonb_array_elements(COALESCE(team->'bans', '[]'::jsonb)) AS b
    WHERE m.teams IS NOT NULL AND jsonb_typeof(team->'bans') = 'array'
      AND b->>'championId' IS NOT NULL AND (b->>'championId') ~ '^\d+$'
      AND m.id IN (SELECT match_id FROM filtered)
  ),
  ban_agg AS (
    SELECT champion_id, COUNT(*)::bigint AS ban_count
    FROM match_bans WHERE champion_id IS NOT NULL
    GROUP BY champion_id
  ),
  presence_denom AS (
    SELECT (SELECT COUNT(DISTINCT match_id) FROM filtered) AS total
  ),
  champ_with_roles AS (
    SELECT c.champion_id, c.games, c.wins,
      ROUND(100.0 * c.wins / NULLIF(c.games, 0), 2) AS winrate,
      ROUND(100.0 * c.games / NULLIF((SELECT total FROM presence_denom), 0), 2) AS pickrate,
      ROUND(100.0 * COALESCE(b.ban_count, 0) / NULLIF((SELECT total FROM presence_denom), 0), 2) AS banrate,
      ROUND(100.0 * (c.games + COALESCE(b.ban_count, 0)) / NULLIF((SELECT total FROM presence_denom), 0), 2) AS presence,
      (SELECT jsonb_object_agg(r.role, jsonb_build_object('games', r.games, 'wins', r.wins, 'winrate', ROUND(100.0 * r.wins / NULLIF(r.games, 0), 2), 'pickrate', ROUND(100.0 * r.games / NULLIF(d.match_count, 0), 2)))
        FROM role_agg r
        LEFT JOIN role_denom d ON d.role = r.role
        WHERE r.champion_id = c.champion_id
      ) AS byRole
    FROM champ_agg c
    LEFT JOIN ban_agg b ON b.champion_id = c.champion_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'championId', champion_id,
      'games', games,
      'wins', wins,
      'winrate', winrate,
      'pickrate', pickrate,
      'banrate', banrate,
      'presence', presence,
      'byRole', COALESCE(byRole, '{}'::jsonb)
    )
    ORDER BY games DESC
  ) INTO champions_json
  FROM champ_with_roles;

  SELECT SUM(games)::int INTO total_games FROM champ_agg;

  RETURN jsonb_build_object(
    'totalGames', total_games,
    'totalMatches', (total_matches)::int,
    'champions', COALESCE(champions_json, '[]'::jsonb),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

COMMENT ON FUNCTION get_stats_champions(text, text) IS 'Champions stats. p_rank_tier can be comma-separated (e.g. GOLD,PLATINUM).';
