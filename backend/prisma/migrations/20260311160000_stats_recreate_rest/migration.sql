-- Recreate get_stats_overview_teams, get_stats_overview_detail, duration_winrate, progression, mv_stats_* (dropped in 20260311150000).

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
        'baron',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'dragon',     jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'tower',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'inhibitor',  jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'riftHerald', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'horde',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)
      )
    );
  END IF;

  -- bans from normalised bans table
  WITH filtered_mt AS (
    SELECT mt.id AS mt_id, mt.win
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
    SELECT b.champion_id AS champion_id, fm.win
    FROM filtered_mt fm
    INNER JOIN bans b ON b.match_team_id = fm.mt_id
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

  -- objectives: *_kills from match_teams; *_first from match_team_first_objectives (columns dropped in 20260310150000)
  WITH filtered_mt AS (
    SELECT mt.id, mt.win, mt.baron_kills, mt.dragon_kills, mt.tower_kills,
      mt.inhibitor_kills, mt.rift_herald_kills, mt.horde_kills
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
    SELECT fm.win,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'champion') AS first_blood,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'baron') AS baron_first,
      fm.baron_kills,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'dragon') AS dragon_first,
      fm.dragon_kills,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'tower') AS tower_first,
      fm.tower_kills,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'inhibitor') AS inhibitor_first,
      fm.inhibitor_kills,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'rift_herald') AS rift_herald_first,
      fm.rift_herald_kills,
      EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = fm.id AND o.objective_type = 'horde') AS horde_first,
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
      'baron',      COALESCE(obj_baron,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'dragon',     COALESCE(obj_dragon,      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'tower',      COALESCE(obj_tower,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'inhibitor',  COALESCE(obj_inhibitor,   jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'riftHerald', COALESCE(obj_rift_herald, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'horde',      COALESCE(obj_horde,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb))
    )
  );
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION get_stats_overview_detail(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_participants bigint;
  total_matches bigint;
  result jsonb;
  version_cond text;
  rank_cond text;
  m_version_cond text;
  m_rank_cond text;
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
    m_version_cond := '1=1';
  ELSE
    version_cond := 'game_version IS NOT NULL AND game_version LIKE ' || quote_literal(p_version || '.%');
    m_version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
    m_rank_cond := '1=1';
  ELSE
    rank_cond := 'rank IS NOT NULL AND rank != '''' AND UPPER(TRIM(split_part(rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
    m_rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
  END IF;

  EXECUTE format(
    $count$
    WITH base AS (
      SELECT p.match_id,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(''id'', rune_styles.style_id, ''selections'', rune_styles.sel) ORDER BY rune_styles.min_slot)
          FROM (
            SELECT pr.style_id, jsonb_agg(jsonb_build_object(''perk'', pr.perk_id) ORDER BY pr.slot) AS sel, MIN(pr.slot) AS min_slot
            FROM participant_runes pr WHERE pr.participant_id = p.id GROUP BY pr.style_id
          ) rune_styles
        ), ''[]''::jsonb) AS runes,
        COALESCE((SELECT jsonb_agg(pi.item_id ORDER BY pi.item_slot) FROM participant_items pi WHERE pi.participant_id = p.id), ''[]''::jsonb) AS items,
        COALESCE((SELECT jsonb_agg(pss.spell_id ORDER BY pss.spell_slot) FROM participant_summoner_spells pss WHERE pss.participant_id = p.id), ''[]''::jsonb) AS summoner_spells,
        mt.win
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      INNER JOIN (
        SELECT id, match_id, CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id FROM participants
      ) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
      INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
      WHERE %s AND %s
    )
    SELECT COUNT(*), COUNT(DISTINCT match_id) FROM base
    $count$,
    m_version_cond,
    m_rank_cond
  ) INTO total_participants, total_matches;

  IF total_participants = 0 THEN
    RETURN jsonb_build_object(
      'totalParticipants', 0,
      'runes', '[]'::jsonb,
      'runeSets', '[]'::jsonb,
      'items', '[]'::jsonb,
      'itemSets', '[]'::jsonb,
      'itemsByOrder', '{}'::jsonb,
      'summonerSpells', '[]'::jsonb
    );
  END IF;

  EXECUTE format(
    $query$
  WITH base AS (
    SELECT p.match_id,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(''id'', rune_styles.style_id, ''selections'', rune_styles.sel) ORDER BY rune_styles.min_slot)
        FROM (
          SELECT pr.style_id, jsonb_agg(jsonb_build_object(''perk'', pr.perk_id) ORDER BY pr.slot) AS sel, MIN(pr.slot) AS min_slot
          FROM participant_runes pr WHERE pr.participant_id = p.id GROUP BY pr.style_id
        ) rune_styles
      ), ''[]''::jsonb) AS runes,
      COALESCE((SELECT jsonb_agg(pi.item_id ORDER BY pi.item_slot) FROM participant_items pi WHERE pi.participant_id = p.id), ''[]''::jsonb) AS items,
      COALESCE((SELECT jsonb_agg(pss.spell_id ORDER BY pss.spell_slot) FROM participant_summoner_spells pss WHERE pss.participant_id = p.id), ''[]''::jsonb) AS summoner_spells,
      mt.win
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    INNER JOIN (
      SELECT id, match_id, CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id FROM participants
    ) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
    INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
    WHERE %s AND %s
  ),
  runes_array AS (
    SELECT b.match_id, b.runes, b.win,
           COALESCE(
             CASE WHEN jsonb_typeof(b.runes) = 'object' AND b.runes ? 'styles' THEN b.runes->'styles' ELSE NULL END,
             b.runes,
             '[]'::jsonb
           ) AS arr
    FROM base b
  ),
  rune_flat AS (
    SELECT (sel->>'perk')::int AS perk_id, ra.match_id, ra.win
    FROM runes_array ra,
         jsonb_array_elements(ra.arr) AS style,
         jsonb_array_elements(style->'selections') AS sel
    WHERE jsonb_typeof(ra.arr) = 'array'
      AND sel->>'perk' IS NOT NULL AND (sel->>'perk') ~ '^\d+$'
  ),
  rune_match_won AS (
    SELECT perk_id, match_id, MAX(win::int)::int AS match_won
    FROM rune_flat
    GROUP BY perk_id, match_id
  ),
  rune_agg AS (
    SELECT perk_id AS "runeId",
           COUNT(*)::int AS games,
           SUM(rm.match_won)::int AS wins,
           ROUND(100.0 * COUNT(*) / NULLIF(%s::bigint, 0), 2) AS pickrate,
           ROUND(100.0 * SUM(rm.match_won) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM rune_match_won rm
    GROUP BY perk_id
  ),
  runes_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('runeId', "runeId", 'games', games, 'wins', wins, 'pickrate', pickrate, 'winrate', winrate) ORDER BY games DESC), '[]'::jsonb) AS j
    FROM rune_agg
  ),
  runeset_agg AS (
    SELECT COALESCE(b.runes, 'null'::jsonb) AS runes_key,
           COUNT(*)::int AS games,
           SUM(b.win::int)::int AS wins,
           ROUND(100.0 * COUNT(*) / %s, 2) AS pickrate,
           ROUND(100.0 * SUM(b.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM base b
    WHERE b.runes IS NOT NULL
    GROUP BY b.runes
    ORDER BY games DESC
    LIMIT 30
  ),
  runesets_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('runes', CASE WHEN runes_key = 'null'::jsonb THEN NULL ELSE runes_key END, 'games', games, 'wins', wins, 'pickrate', pickrate, 'winrate', winrate)), '[]'::jsonb) AS j
    FROM runeset_agg
  ),
  item_flat AS (
    SELECT (elem)::int AS item_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE (elem)::int > 0
  ),
  item_agg AS (
    SELECT item_id AS "itemId",
           COUNT(*)::int AS games,
           SUM(win::int)::int AS wins,
           ROUND(100.0 * COUNT(*) / %s, 2) AS pickrate,
           ROUND(100.0 * SUM(win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM item_flat
    GROUP BY item_id
  ),
  items_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('itemId', "itemId", 'games', games, 'wins', wins, 'pickrate', pickrate, 'winrate', winrate) ORDER BY games DESC), '[]'::jsonb) AS j
    FROM item_agg
  ),
  items_canonical AS (
    SELECT
      (SELECT jsonb_agg(elem ORDER BY (elem::int)) FROM jsonb_array_elements_text(COALESCE(b.items, '[]'::jsonb)) AS elem) AS items_key,
      b.win
    FROM base b
    WHERE b.items IS NOT NULL AND jsonb_array_length(COALESCE(b.items, '[]'::jsonb)) >= 1
  ),
  itemset_agg AS (
    SELECT items_key,
           COUNT(*)::int AS games,
           SUM(win::int)::int AS wins,
           ROUND(100.0 * COUNT(*) / %s, 2) AS pickrate,
           ROUND(100.0 * SUM(win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM items_canonical
    GROUP BY items_key
    ORDER BY games DESC
    LIMIT 30
  ),
  itemsets_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('items', (SELECT jsonb_agg((x::text)::int) FROM jsonb_array_elements_text(items_key) AS x), 'games', games, 'wins', wins, 'pickrate', pickrate, 'winrate', winrate)), '[]'::jsonb) AS j
    FROM itemset_agg
  ),
  item_order_flat AS (
    SELECT (ord - 1)::int AS slot, (elem)::int AS item_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE (elem)::int > 0 AND ord <= 6
  ),
  item_order_agg AS (
    SELECT slot,
           item_id AS "itemId",
           COUNT(*)::int AS games,
           SUM(win::int)::int AS wins,
           ROUND(100.0 * SUM(win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM item_order_flat
    GROUP BY slot, item_id
  ),
  items_by_order_json AS (
    SELECT jsonb_object_agg(
      slot::text,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('itemId', "itemId", 'games', games, 'wins', wins, 'winrate', winrate) ORDER BY games DESC)
         FROM item_order_agg i2 WHERE i2.slot = i.slot),
        '[]'::jsonb
      )
    ) AS j
    FROM (SELECT DISTINCT slot FROM item_order_agg) i
  ),
  spell_flat AS (
    SELECT (elem)::int AS spell_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.summoner_spells, '[]'::jsonb)) AS elem
    WHERE b.summoner_spells IS NOT NULL AND jsonb_array_length(b.summoner_spells) >= 1
      AND elem ~ '^\d+$'
  ),
  spell_agg AS (
    SELECT spell_id AS "spellId",
           COUNT(*)::int AS games,
           SUM(win::int)::int AS wins,
           ROUND(100.0 * COUNT(*) / %s, 2) AS pickrate,
           ROUND(100.0 * SUM(win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM spell_flat
    GROUP BY spell_id
  ),
  spells_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('spellId', "spellId", 'games', games, 'wins', wins, 'pickrate', pickrate, 'winrate', winrate) ORDER BY games DESC), '[]'::jsonb) AS j
    FROM spell_agg
  )
  SELECT jsonb_build_object(
    'totalParticipants', %s,
    'runes', (SELECT j FROM runes_json),
    'runeSets', (SELECT j FROM runesets_json),
    'items', (SELECT j FROM items_json),
    'itemSets', (SELECT j FROM itemsets_json),
    'itemsByOrder', COALESCE((SELECT j FROM items_by_order_json), '{}'::jsonb),
    'summonerSpells', (SELECT j FROM spells_json)
  )
  FROM (SELECT 1) _
    $query$,
    m_version_cond,
    m_rank_cond,
    total_matches,
    total_participants,
    total_participants,
    total_participants,
    total_participants,
    total_participants,
    total_participants,
    total_participants
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_detail(text, text) IS 'Overview detail (runes, items, spells). Runes: winrate = wins_with_rune / distinct_matches_with_rune (one rune per match).';
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
CREATE OR REPLACE FUNCTION get_stats_overview_progression(
  p_version_oldest text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_version_oldest IS NULL OR p_version_oldest = '' THEN
    RETURN jsonb_build_object(
      'oldestVersion', null,
      'gainers', '[]'::jsonb,
      'losers', '[]'::jsonb
    );
  END IF;

  WITH
  relevant_matches AS (
    SELECT id FROM matches m
    WHERE m.game_version IS NOT NULL
      AND (
        m.game_version LIKE (p_version_oldest || '.%')
        OR (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      )
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
  ),
  p_team AS (
    SELECT p.id, p.match_id,
      CASE WHEN ROW_NUMBER() OVER (PARTITION BY p.match_id ORDER BY p.id) <= 5 THEN 100 ELSE 200 END AS team_id
    FROM participants p
    WHERE p.match_id IN (SELECT id FROM relevant_matches)
  ),
  oldest_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(CASE WHEN mt.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM participants p
    INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
    INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
    HAVING COUNT(*) >= 20
  ),
  since_agg AS (
    SELECT p.champion_id,
      ROUND(100.0 * SUM(CASE WHEN mt.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM participants p
    INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
    INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL
      AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
  ),
  merged AS (
    SELECT o.champion_id, o.winrate AS wr_oldest, s.winrate AS wr_since,
      (s.winrate - o.winrate) AS delta
    FROM oldest_agg o
    INNER JOIN since_agg s ON s.champion_id = o.champion_id
  ),
  gainers AS (
    SELECT jsonb_agg(
      jsonb_build_object('championId', champion_id, 'wrOldest', wr_oldest, 'wrSince', wr_since, 'delta', delta)
      ORDER BY delta DESC
    ) AS arr FROM (SELECT * FROM merged WHERE delta > 0 ORDER BY delta DESC LIMIT 5) sub
  ),
  losers AS (
    SELECT jsonb_agg(
      jsonb_build_object('championId', champion_id, 'wrOldest', wr_oldest, 'wrSince', wr_since, 'delta', delta)
      ORDER BY delta ASC
    ) AS arr FROM (SELECT * FROM merged WHERE delta < 0 ORDER BY delta ASC LIMIT 5) sub
  )
  SELECT jsonb_build_object(
    'oldestVersion', p_version_oldest,
    'gainers', COALESCE(g.arr, '[]'::jsonb),
    'losers', COALESCE(l.arr, '[]'::jsonb)
  ) INTO result
  FROM gainers g, losers l;

  RETURN result;
END;
$$;

-- 2) get_stats_overview_progression_full
CREATE OR REPLACE FUNCTION get_stats_overview_progression_full(
  p_version_oldest text DEFAULT NULL,
  p_rank_tier text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_oldest bigint;
  total_since bigint;
  result jsonb;
BEGIN
  IF p_version_oldest IS NULL OR p_version_oldest = '' THEN
    RETURN jsonb_build_object(
      'oldestVersion', null,
      'champions', '[]'::jsonb
    );
  END IF;

  SELECT COUNT(DISTINCT m.id) INTO total_oldest
  FROM matches m
  WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
    AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))));

  SELECT COUNT(DISTINCT m.id) INTO total_since
  FROM matches m
  WHERE m.game_version IS NOT NULL
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
    AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))));

  IF total_oldest = 0 OR total_since = 0 THEN
    RETURN jsonb_build_object(
      'oldestVersion', p_version_oldest,
      'champions', '[]'::jsonb
    );
  END IF;

  WITH
  relevant_matches AS (
    SELECT id FROM matches m
    WHERE m.game_version IS NOT NULL
      AND (
        m.game_version LIKE (p_version_oldest || '.%')
        OR (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      )
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
  ),
  p_team AS (
    SELECT p.id, p.match_id,
      CASE WHEN ROW_NUMBER() OVER (PARTITION BY p.match_id ORDER BY p.id) <= 5 THEN 100 ELSE 200 END AS team_id
    FROM participants p
    WHERE p.match_id IN (SELECT id FROM relevant_matches)
  ),
  oldest_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(CASE WHEN mt.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate,
      ROUND(100.0 * COUNT(*) / NULLIF(total_oldest, 0), 2) AS pickrate
    FROM participants p
    INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
    INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL AND m.game_version LIKE (p_version_oldest || '.%')
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
    HAVING COUNT(*) >= 20
  ),
  since_agg AS (
    SELECT p.champion_id,
      COUNT(*)::bigint AS games,
      ROUND(100.0 * SUM(CASE WHEN mt.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate,
      ROUND(100.0 * COUNT(*) / NULLIF(total_since, 0), 2) AS pickrate
    FROM participants p
    INNER JOIN p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
    INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
    INNER JOIN matches m ON m.id = p.match_id
    WHERE m.game_version IS NOT NULL
      AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) >= p_version_oldest
      AND (p_rank_tier IS NULL OR p_rank_tier = '' OR (m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM(p_rank_tier))))
    GROUP BY p.champion_id
  ),
  merged AS (
    SELECT
      o.champion_id,
      o.winrate AS wr_oldest,
      s.winrate AS wr_since,
      (s.winrate - o.winrate) AS delta_wr,
      o.pickrate AS pickrate_oldest,
      s.pickrate AS pickrate_since,
      (s.pickrate - o.pickrate) AS delta_pick
    FROM oldest_agg o
    INNER JOIN since_agg s ON s.champion_id = o.champion_id
  )
  SELECT jsonb_build_object(
    'oldestVersion', p_version_oldest,
    'champions', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'championId', champion_id,
          'wrOldest', wr_oldest,
          'wrSince', wr_since,
          'deltaWr', delta_wr,
          'pickrateOldest', pickrate_oldest,
          'pickrateSince', pickrate_since,
          'deltaPick', delta_pick
        )
        ORDER BY delta_wr DESC NULLS LAST
      ),
      '[]'::jsonb
    )
  ) INTO result
  FROM merged;

  RETURN result;
END;
$$;
-- No MVs: stats are computed via SQL functions only (get_stats_overview, get_stats_champions, get_stats_overview_teams, get_stats_overview_detail, get_players_with_stats).
