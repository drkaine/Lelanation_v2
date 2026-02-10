-- Add distribution (count per 0, 1, 2, ... kills) for objectives so frontend can show % per count.
-- First/kills totals kept for backward compatibility; frontend will use % (first: win rate when got first; kills: % of matches per count).
CREATE OR REPLACE FUNCTION get_stats_overview_teams(p_version text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  version_cond text;
  match_team_rows bigint;
  bans_by_win jsonb;
  bans_by_loss jsonb;
  obj_first_blood jsonb;
  obj_baron jsonb;
  obj_dragon jsonb;
  obj_tower jsonb;
  obj_inhibitor jsonb;
  obj_rift_herald jsonb;
  result jsonb;
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM matches m WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0 AND %s',
    version_cond
  ) INTO match_team_rows;

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
        'riftHerald', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)
      )
    );
  END IF;

  WITH match_teams AS (
    SELECT m.id AS match_id,
           (elem->>'win')::boolean AS win,
           elem->'bans' AS bans
    FROM matches m,
         jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
    WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0
      AND (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE (p_version || '.%')))
  ),
  ban_rows AS (
    SELECT (b->>'championId')::int AS champion_id, mt.win
    FROM match_teams mt,
         jsonb_array_elements(COALESCE(mt.bans, '[]'::jsonb)) AS b
    WHERE mt.bans IS NOT NULL AND jsonb_typeof(mt.bans) = 'array'
      AND b->>'championId' IS NOT NULL AND (b->>'championId') ~ '^\d+$'
  ),
  bans_win_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = true GROUP BY champion_id) t
  ),
  bans_loss_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = false GROUP BY champion_id) t
  )
  SELECT COALESCE((SELECT j FROM bans_win_agg), '[]'::jsonb), COALESCE((SELECT j FROM bans_loss_agg), '[]'::jsonb)
  INTO bans_by_win, bans_by_loss;

  WITH match_teams AS (
    SELECT m.id AS match_id,
           (elem->>'win')::boolean AS win,
           elem->'objectives' AS objectives
    FROM matches m,
         jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
    WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0
      AND (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE (p_version || '.%')))
  ),
  obj_flat AS (
    SELECT
      mt.win,
      (mt.objectives->'champion'->>'first')::boolean AS first_blood,
      (mt.objectives->'baron'->>'first')::boolean AS baron_first,
      COALESCE((mt.objectives->'baron'->>'kills')::int, 0) AS baron_kills,
      (mt.objectives->'dragon'->>'first')::boolean AS dragon_first,
      COALESCE((mt.objectives->'dragon'->>'kills')::int, 0) AS dragon_kills,
      (mt.objectives->'tower'->>'first')::boolean AS tower_first,
      COALESCE((mt.objectives->'tower'->>'kills')::int, 0) AS tower_kills,
      (mt.objectives->'inhibitor'->>'first')::boolean AS inhibitor_first,
      COALESCE((mt.objectives->'inhibitor'->>'kills')::int, 0) AS inhibitor_kills,
      (mt.objectives->'riftHerald'->>'first')::boolean AS rift_herald_first,
      COALESCE((mt.objectives->'riftHerald'->>'kills')::int, 0) AS rift_herald_kills
    FROM match_teams mt
    WHERE mt.objectives IS NOT NULL
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
      SUM(CASE WHEN NOT win THEN rift_herald_kills ELSE 0 END)::int AS rift_herald_kills_loss
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
  rift_herald_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT rift_herald_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY rift_herald_kills) t)
  SELECT
    jsonb_build_object('firstByWin', o.fb_first_win, 'firstByLoss', o.fb_first_loss),
    jsonb_build_object('firstByWin', o.baron_first_win, 'firstByLoss', o.baron_first_loss, 'killsByWin', o.baron_kills_win, 'killsByLoss', o.baron_kills_loss, 'distributionByWin', (SELECT j FROM baron_dw), 'distributionByLoss', (SELECT j FROM baron_dl)),
    jsonb_build_object('firstByWin', o.dragon_first_win, 'firstByLoss', o.dragon_first_loss, 'killsByWin', o.dragon_kills_win, 'killsByLoss', o.dragon_kills_loss, 'distributionByWin', (SELECT j FROM dragon_dw), 'distributionByLoss', (SELECT j FROM dragon_dl)),
    jsonb_build_object('firstByWin', o.tower_first_win, 'firstByLoss', o.tower_first_loss, 'killsByWin', o.tower_kills_win, 'killsByLoss', o.tower_kills_loss, 'distributionByWin', (SELECT j FROM tower_dw), 'distributionByLoss', (SELECT j FROM tower_dl)),
    jsonb_build_object('firstByWin', o.inhibitor_first_win, 'firstByLoss', o.inhibitor_first_loss, 'killsByWin', o.inhibitor_kills_win, 'killsByLoss', o.inhibitor_kills_loss, 'distributionByWin', (SELECT j FROM inhibitor_dw), 'distributionByLoss', (SELECT j FROM inhibitor_dl)),
    jsonb_build_object('firstByWin', o.rift_herald_first_win, 'firstByLoss', o.rift_herald_first_loss, 'killsByWin', o.rift_herald_kills_win, 'killsByLoss', o.rift_herald_kills_loss, 'distributionByWin', (SELECT j FROM rift_herald_dw), 'distributionByLoss', (SELECT j FROM rift_herald_dl))
  INTO obj_first_blood, obj_baron, obj_dragon, obj_tower, obj_inhibitor, obj_rift_herald
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
      'riftHerald', COALESCE(obj_rift_herald, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb))
    )
  );
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_teams(text) IS 'Stats from matches.teams: bans, objectives (first + kills + distribution by count for %).';
