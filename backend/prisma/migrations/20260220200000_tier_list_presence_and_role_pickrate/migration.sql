-- Tier List formulas: add presence(c) = (games+bans)/|M| and pickrate(c,r) = games(c,r)/|M_role(r)| in byRole.
-- Formulas ref: games, wins, pickrate, banrate, winrate, byRole (games, wins, winrate) already present.

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
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
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
  /* |M_role(r)| = number of distinct matches where role r was played */
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
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier = p_rank_tier)
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
  )
  SELECT
    (SELECT jsonb_agg(
      jsonb_build_object(
        'championId', c.champion_id,
        'games', (c.games)::int,
        'wins', (c.wins)::int,
        'winrate', ROUND(100.0 * c.wins / NULLIF(c.games, 0), 2),
        'pickrate', ROUND(100.0 * c.games / total_matches, 2),
        'banrate', ROUND(100.0 * COALESCE(b.ban_count, 0) / total_matches, 2),
        'presence', ROUND(100.0 * (c.games + COALESCE(b.ban_count, 0)) / total_matches, 2),
        'byRole', COALESCE(
          (SELECT jsonb_object_agg(r.role, jsonb_build_object(
            'games', (r.games)::int,
            'wins', (r.wins)::int,
            'winrate', ROUND(100.0 * r.wins / NULLIF(r.games, 0), 2),
            'pickrate', ROUND(100.0 * r.games / NULLIF((SELECT rd.match_count FROM role_denom rd WHERE rd.role = r.role), 0), 2)
          ))
           FROM role_agg r WHERE r.champion_id = c.champion_id),
          '{}'::jsonb
        )
      )
      ORDER BY c.games DESC
    ) FROM champ_agg c
    LEFT JOIN ban_agg b ON b.champion_id = c.champion_id),
    (SELECT COALESCE(SUM(games), 0)::int FROM champ_agg)
  INTO champions_json, total_games
  FROM (SELECT 1) AS _;

  RETURN jsonb_build_object(
    'totalGames', total_games,
    'totalMatches', (total_matches)::int,
    'champions', COALESCE(champions_json, '[]'::jsonb),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

COMMENT ON FUNCTION get_stats_champions(text, text) IS 'Tier List: games, wins, winrate, pickrate, banrate, presence=(games+bans)/|M|, byRole(games,wins,winrate,pickrate=games/|M_role|).';
