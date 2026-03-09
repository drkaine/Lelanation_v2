-- Normalize match teams storage:
-- - Move matches.teams JSON data into match_teams relational table
-- - Keep backup tables to enable rollback
-- - Update stats SQL functions to read from match_teams

-- 0) Backup current JSON payloads before migration (rollback safety)
CREATE TABLE IF NOT EXISTS backup_matches_teams_20260309 (
  match_id bigint PRIMARY KEY,
  teams jsonb,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO backup_matches_teams_20260309 (match_id, teams, backed_up_at)
SELECT m.id, m.teams, now()
FROM matches m
WHERE m.teams IS NOT NULL
ON CONFLICT (match_id) DO NOTHING;

-- 1) New relational table for match teams
CREATE TABLE IF NOT EXISTS match_teams (
  id bigserial PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id int NOT NULL CHECK (team_id IN (100, 200)),
  win boolean NOT NULL DEFAULT false,
  ban_1 int NULL,
  ban_2 int NULL,
  ban_3 int NULL,
  ban_4 int NULL,
  ban_5 int NULL,
  baron_first boolean NOT NULL DEFAULT false,
  baron_kills int NOT NULL DEFAULT 0,
  dragon_first boolean NOT NULL DEFAULT false,
  dragon_kills int NOT NULL DEFAULT 0,
  tower_first boolean NOT NULL DEFAULT false,
  tower_kills int NOT NULL DEFAULT 0,
  horde_first boolean NOT NULL DEFAULT false,
  horde_kills int NOT NULL DEFAULT 0,
  rift_herald_first boolean NOT NULL DEFAULT false,
  rift_herald_kills int NOT NULL DEFAULT 0,
  inhibitor_first boolean NOT NULL DEFAULT false,
  inhibitor_kills int NOT NULL DEFAULT 0,
  champion_first boolean NOT NULL DEFAULT false,
  champion_kills int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_match_teams_match_id_team_id UNIQUE (match_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_match_teams_match_id ON match_teams(match_id);
CREATE INDEX IF NOT EXISTS idx_match_teams_team_id ON match_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_match_teams_win ON match_teams(win);

-- 2) Backfill match_teams from matches.teams JSON
INSERT INTO match_teams (
  match_id,
  team_id,
  win,
  ban_1, ban_2, ban_3, ban_4, ban_5,
  baron_first, baron_kills,
  dragon_first, dragon_kills,
  tower_first, tower_kills,
  horde_first, horde_kills,
  rift_herald_first, rift_herald_kills,
  inhibitor_first, inhibitor_kills,
  champion_first, champion_kills
)
SELECT
  m.id AS match_id,
  (team->>'teamId')::int AS team_id,
  COALESCE((team->>'win')::boolean, false) AS win,
  CASE WHEN (bans->0->>'championId') ~ '^\d+$' THEN (bans->0->>'championId')::int ELSE NULL END AS ban_1,
  CASE WHEN (bans->1->>'championId') ~ '^\d+$' THEN (bans->1->>'championId')::int ELSE NULL END AS ban_2,
  CASE WHEN (bans->2->>'championId') ~ '^\d+$' THEN (bans->2->>'championId')::int ELSE NULL END AS ban_3,
  CASE WHEN (bans->3->>'championId') ~ '^\d+$' THEN (bans->3->>'championId')::int ELSE NULL END AS ban_4,
  CASE WHEN (bans->4->>'championId') ~ '^\d+$' THEN (bans->4->>'championId')::int ELSE NULL END AS ban_5,
  COALESCE((objectives->'baron'->>'first')::boolean, false) AS baron_first,
  COALESCE((objectives->'baron'->>'kills')::int, 0) AS baron_kills,
  COALESCE((objectives->'dragon'->>'first')::boolean, false) AS dragon_first,
  COALESCE((objectives->'dragon'->>'kills')::int, 0) AS dragon_kills,
  COALESCE((objectives->'tower'->>'first')::boolean, false) AS tower_first,
  COALESCE((objectives->'tower'->>'kills')::int, 0) AS tower_kills,
  COALESCE((objectives->'horde'->>'first')::boolean, false) AS horde_first,
  COALESCE((objectives->'horde'->>'kills')::int, 0) AS horde_kills,
  COALESCE((objectives->'riftHerald'->>'first')::boolean, false) AS rift_herald_first,
  COALESCE((objectives->'riftHerald'->>'kills')::int, 0) AS rift_herald_kills,
  COALESCE((objectives->'inhibitor'->>'first')::boolean, false) AS inhibitor_first,
  COALESCE((objectives->'inhibitor'->>'kills')::int, 0) AS inhibitor_kills,
  COALESCE((objectives->'champion'->>'first')::boolean, false) AS champion_first,
  COALESCE((objectives->'champion'->>'kills')::int, 0) AS champion_kills
FROM matches m
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS team
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN jsonb_typeof(team->'bans') = 'array' THEN team->'bans' ELSE '[]'::jsonb END AS bans,
    CASE WHEN jsonb_typeof(team->'objectives') = 'object' THEN team->'objectives' ELSE '{}'::jsonb END AS objectives
) obj
WHERE m.teams IS NOT NULL
  AND (team->>'teamId') ~ '^(100|200)$'
ON CONFLICT (match_id, team_id) DO NOTHING;

-- Backup backfilled table for rollback (point-in-time after import)
CREATE TABLE IF NOT EXISTS backup_match_teams_20260309 AS
SELECT * FROM match_teams;

-- 3) Update function get_stats_overview (banrate now uses match_teams)
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
          'championId', champion_id,
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
        SELECT b.champion_id::int AS champion_id,
          COUNT(DISTINCT mt.match_id)::bigint AS ban_count
        FROM match_teams mt
        INNER JOIN matches m ON m.id = mt.match_id
        CROSS JOIN LATERAL unnest(ARRAY[mt.ban_1, mt.ban_2, mt.ban_3, mt.ban_4, mt.ban_5]) AS b(champion_id)
        WHERE %s
          AND b.champion_id IS NOT NULL
        GROUP BY b.champion_id
      ) sub
      ORDER BY banrate DESC
      LIMIT 5
    ) top
    $q$,
    empty_arr,
    match_cond,
    match_cond
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

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats on normalized match_teams table. p_rank_tier can be comma-separated (e.g. GOLD,PLATINUM,EMERALD).';

-- 4) Update function get_stats_champions (banrate now uses match_teams)
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
    SELECT DISTINCT mt.match_id, b.champion_id::int AS champion_id
    FROM match_teams mt
    CROSS JOIN LATERAL unnest(ARRAY[mt.ban_1, mt.ban_2, mt.ban_3, mt.ban_4, mt.ban_5]) AS b(champion_id)
    WHERE b.champion_id IS NOT NULL
      AND mt.match_id IN (SELECT match_id FROM filtered)
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
    SELECT DISTINCT mt.match_id, b.champion_id::int AS champion_id
    FROM match_teams mt
    CROSS JOIN LATERAL unnest(ARRAY[mt.ban_1, mt.ban_2, mt.ban_3, mt.ban_4, mt.ban_5]) AS b(champion_id)
    WHERE b.champion_id IS NOT NULL
      AND mt.match_id IN (SELECT match_id FROM filtered)
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

COMMENT ON FUNCTION get_stats_champions(text, text) IS 'Champions stats on normalized match_teams table. p_rank_tier can be comma-separated (e.g. GOLD,PLATINUM).';

-- 5) Update function get_stats_overview_teams (bans/objectives on match_teams)
CREATE OR REPLACE FUNCTION get_stats_overview_teams(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  match_team_rows bigint;
  bans_by_win jsonb;
  bans_by_loss jsonb;
  obj_first_blood jsonb;
  obj_baron jsonb;
  obj_dragon jsonb;
  obj_tower jsonb;
  obj_inhibitor jsonb;
  obj_rift_herald jsonb;
  obj_horde jsonb;
  result jsonb;
BEGIN
  WITH filtered_mt AS (
    SELECT mt.*
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  )
  SELECT COUNT(*) INTO match_team_rows FROM filtered_mt;

  IF match_team_rows = 0 THEN
    RETURN jsonb_build_object(
      'matchCount', 0,
      'bans', jsonb_build_object('byWin', '[]'::jsonb, 'byLoss', '[]'::jsonb),
      'objectives', jsonb_build_object(
        'firstBlood', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0),
        'baron', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'dragon', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'tower', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'inhibitor', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'riftHerald', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'horde', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)
      )
    );
  END IF;

  WITH filtered_mt AS (
    SELECT mt.*
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  ),
  ban_rows AS (
    SELECT b.champion_id::int AS champion_id, fm.win
    FROM filtered_mt fm
    CROSS JOIN LATERAL unnest(ARRAY[fm.ban_1, fm.ban_2, fm.ban_3, fm.ban_4, fm.ban_5]) AS b(champion_id)
    WHERE b.champion_id IS NOT NULL
  ),
  bans_win_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = true GROUP BY champion_id) t
  ),
  bans_loss_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = false GROUP BY champion_id) t
  )
  SELECT COALESCE((SELECT j FROM bans_win_agg), '[]'::jsonb),
         COALESCE((SELECT j FROM bans_loss_agg), '[]'::jsonb)
    INTO bans_by_win, bans_by_loss;

  WITH filtered_mt AS (
    SELECT mt.*
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  ),
  obj_flat AS (
    SELECT
      fm.win,
      fm.champion_first AS first_blood,
      fm.baron_first,
      fm.baron_kills,
      fm.dragon_first,
      fm.dragon_kills,
      fm.tower_first,
      fm.tower_kills,
      fm.inhibitor_first,
      fm.inhibitor_kills,
      fm.rift_herald_first,
      fm.rift_herald_kills,
      fm.horde_first,
      fm.horde_kills
    FROM filtered_mt fm
  ),
  obj_agg AS (
    SELECT
      SUM(CASE WHEN win AND first_blood THEN 1 ELSE 0 END)::int AS fb_first_win,
      SUM(CASE WHEN NOT win AND first_blood THEN 1 ELSE 0 END)::int AS fb_first_loss,
      SUM(CASE WHEN win AND baron_first THEN 1 ELSE 0 END)::int AS baron_first_win,
      SUM(CASE WHEN NOT win AND baron_first THEN 1 ELSE 0 END)::int AS baron_first_loss,
      SUM(CASE WHEN win THEN baron_kills ELSE 0 END)::int AS baron_kills_win,
      SUM(CASE WHEN NOT win THEN baron_kills ELSE 0 END)::int AS baron_kills_loss,
      SUM(CASE WHEN win AND dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_win,
      SUM(CASE WHEN NOT win AND dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_loss,
      SUM(CASE WHEN win THEN dragon_kills ELSE 0 END)::int AS dragon_kills_win,
      SUM(CASE WHEN NOT win THEN dragon_kills ELSE 0 END)::int AS dragon_kills_loss,
      SUM(CASE WHEN win AND tower_first THEN 1 ELSE 0 END)::int AS tower_first_win,
      SUM(CASE WHEN NOT win AND tower_first THEN 1 ELSE 0 END)::int AS tower_first_loss,
      SUM(CASE WHEN win THEN tower_kills ELSE 0 END)::int AS tower_kills_win,
      SUM(CASE WHEN NOT win THEN tower_kills ELSE 0 END)::int AS tower_kills_loss,
      SUM(CASE WHEN win AND inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_win,
      SUM(CASE WHEN NOT win AND inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_loss,
      SUM(CASE WHEN win THEN inhibitor_kills ELSE 0 END)::int AS inhibitor_kills_win,
      SUM(CASE WHEN NOT win THEN inhibitor_kills ELSE 0 END)::int AS inhibitor_kills_loss,
      SUM(CASE WHEN win AND rift_herald_first THEN 1 ELSE 0 END)::int AS rift_herald_first_win,
      SUM(CASE WHEN NOT win AND rift_herald_first THEN 1 ELSE 0 END)::int AS rift_herald_first_loss,
      SUM(CASE WHEN win THEN rift_herald_kills ELSE 0 END)::int AS rift_herald_kills_win,
      SUM(CASE WHEN NOT win THEN rift_herald_kills ELSE 0 END)::int AS rift_herald_kills_loss,
      SUM(CASE WHEN win AND horde_first THEN 1 ELSE 0 END)::int AS horde_first_win,
      SUM(CASE WHEN NOT win AND horde_first THEN 1 ELSE 0 END)::int AS horde_first_loss,
      SUM(CASE WHEN win THEN horde_kills ELSE 0 END)::int AS horde_kills_win,
      SUM(CASE WHEN NOT win THEN horde_kills ELSE 0 END)::int AS horde_kills_loss
    FROM obj_flat
  ),
  baron_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT baron_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY baron_kills) t),
  baron_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT baron_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY baron_kills) t),
  dragon_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT dragon_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY dragon_kills) t),
  dragon_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT dragon_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY dragon_kills) t),
  tower_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT tower_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY tower_kills) t),
  tower_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT tower_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY tower_kills) t),
  inhibitor_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT inhibitor_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY inhibitor_kills) t),
  inhibitor_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT inhibitor_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY inhibitor_kills) t),
  rift_herald_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT rift_herald_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY rift_herald_kills) t),
  rift_herald_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT rift_herald_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY rift_herald_kills) t),
  horde_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT horde_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY horde_kills) t),
  horde_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT horde_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY horde_kills) t)
  SELECT
    jsonb_build_object('firstByWin', o.fb_first_win, 'firstByLoss', o.fb_first_loss),
    jsonb_build_object('firstByWin', o.baron_first_win, 'firstByLoss', o.baron_first_loss, 'killsByWin', o.baron_kills_win, 'killsByLoss', o.baron_kills_loss, 'distributionByWin', (SELECT j FROM baron_dw), 'distributionByLoss', (SELECT j FROM baron_dl)),
    jsonb_build_object('firstByWin', o.dragon_first_win, 'firstByLoss', o.dragon_first_loss, 'killsByWin', o.dragon_kills_win, 'killsByLoss', o.dragon_kills_loss, 'distributionByWin', (SELECT j FROM dragon_dw), 'distributionByLoss', (SELECT j FROM dragon_dl)),
    jsonb_build_object('firstByWin', o.tower_first_win, 'firstByLoss', o.tower_first_loss, 'killsByWin', o.tower_kills_win, 'killsByLoss', o.tower_kills_loss, 'distributionByWin', (SELECT j FROM tower_dw), 'distributionByLoss', (SELECT j FROM tower_dl)),
    jsonb_build_object('firstByWin', o.inhibitor_first_win, 'firstByLoss', o.inhibitor_first_loss, 'killsByWin', o.inhibitor_kills_win, 'killsByLoss', o.inhibitor_kills_loss, 'distributionByWin', (SELECT j FROM inhibitor_dw), 'distributionByLoss', (SELECT j FROM inhibitor_dl)),
    jsonb_build_object('firstByWin', o.rift_herald_first_win, 'firstByLoss', o.rift_herald_first_loss, 'killsByWin', o.rift_herald_kills_win, 'killsByLoss', o.rift_herald_kills_loss, 'distributionByWin', (SELECT j FROM rift_herald_dw), 'distributionByLoss', (SELECT j FROM rift_herald_dl)),
    jsonb_build_object('firstByWin', o.horde_first_win, 'firstByLoss', o.horde_first_loss, 'killsByWin', o.horde_kills_win, 'killsByLoss', o.horde_kills_loss, 'distributionByWin', (SELECT j FROM horde_dw), 'distributionByLoss', (SELECT j FROM horde_dl))
  INTO obj_first_blood, obj_baron, obj_dragon, obj_tower, obj_inhibitor, obj_rift_herald, obj_horde
  FROM obj_agg o;

  result := jsonb_build_object(
    'matchCount', match_team_rows,
    'bans', jsonb_build_object('byWin', COALESCE(bans_by_win, '[]'::jsonb), 'byLoss', COALESCE(bans_by_loss, '[]'::jsonb)),
    'objectives', jsonb_build_object(
      'firstBlood', COALESCE(obj_first_blood, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0)),
      'baron', COALESCE(obj_baron, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'dragon', COALESCE(obj_dragon, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'tower', COALESCE(obj_tower, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'inhibitor', COALESCE(obj_inhibitor, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'riftHerald', COALESCE(obj_rift_herald, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'horde', COALESCE(obj_horde, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb))
    )
  );
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_teams(text, text) IS 'Bans/objectives stats from normalized match_teams table. Supports optional version and comma-separated rank tiers.';

-- 6) Drop old JSON column (data is now normalized in match_teams)
ALTER TABLE matches DROP COLUMN IF EXISTS teams;

