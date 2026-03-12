-- Fix duration_winrate functions: participants.win was dropped; use match_teams.win via p_team (same pattern as 20260310130000_drop_participant_win).

-- 1) get_stats_overview_duration_winrate: get first_win from match_teams via first participant's team
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
        SELECT mt.win AS first_win
        FROM participants p
        INNER JOIN (
          SELECT id, match_id,
            CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
          FROM participants
        ) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
        INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
        WHERE p.match_id = m.id
        ORDER BY p.id
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

-- 2) get_stats_duration_winrate_by_champion: use match_teams.win via p_team
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
        SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)::bigint AS wins
      FROM participants p
      INNER JOIN (
        SELECT id, match_id,
          CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
        FROM participants
      ) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
      INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
      INNER JOIN matches m ON m.id = p.match_id
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
