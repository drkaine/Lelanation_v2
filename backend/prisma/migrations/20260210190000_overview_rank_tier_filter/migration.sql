-- Optional rank_tier filter for overview: filter stats by match rank tier (e.g. GOLD for GOLD_II).
-- get_stats_overview(p_version, p_rank_tier), get_stats_overview_detail(p_version, p_rank_tier), get_stats_overview_teams(p_version, p_rank_tier).
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
  version_cond text;
  rank_cond text;
  match_cond text;
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
      'topWinrateChampions', '[]'::jsonb
    );
  END IF;

  EXECUTE format(
    'SELECT COUNT(DISTINCT p.puuid) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
    match_cond
  ) INTO player_count;

  -- Divisions from filtered matches; all tiers with 0 when missing
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
    match_cond
  ) INTO by_division;

  -- Version list (always full list for filter buttons)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
    '[]'::jsonb
  ) INTO by_version FROM stats_matches_by_version;

  -- Top winrate champions from filtered participants
  EXECUTE format(
    $q$
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
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM participants p2 INNER JOIN matches m ON m.id = p2.match_id WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY winrate DESC
      LIMIT 10
    ) top
    $q$,
    match_cond,
    match_cond
  ) INTO top_champs;

  RETURN jsonb_build_object(
    'totalMatches', (total_matches)::int,
    'lastUpdate', to_jsonb(last_update),
    'playerCount', (player_count)::int,
    'matchesByDivision', COALESCE(by_division, '[]'::jsonb),
    'matchesByVersion', by_version,
    'topWinrateChampions', COALESCE(top_champs, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats; p_version filters by game_version; p_rank_tier filters by match rank tier (e.g. GOLD). matchesByVersion always full list.';

-- get_stats_overview_detail: add p_rank_tier filter
CREATE OR REPLACE FUNCTION get_stats_overview_detail(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  version_cond text;
  rank_cond text;
  match_cond text;
  total_participants bigint;
  result jsonb;
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
    'SELECT COUNT(*) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
    match_cond
  ) INTO total_participants;

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
    SELECT p.runes, p.items, p.summoner_spells, p.win
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE %s
  ),
  rune_flat AS (
    SELECT (sel->>'perk')::int AS perk_id, b.win
    FROM base b,
         jsonb_array_elements(COALESCE(b.runes, '[]'::jsonb)) AS style,
         jsonb_array_elements(style->'selections') AS sel
    WHERE jsonb_typeof(COALESCE(b.runes, '[]'::jsonb)) = 'array'
      AND sel->>'perk' IS NOT NULL AND (sel->>'perk') ~ '^\d+$'
  ),
  rune_agg AS (
    SELECT perk_id AS "runeId",
           COUNT(*)::int AS games,
           SUM(win::int)::int AS wins,
           ROUND(100.0 * COUNT(*) / %s, 2) AS pickrate,
           ROUND(100.0 * SUM(win::int) / NULLIF(COUNT(*), 0), 2) AS winrate
    FROM rune_flat
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
    SELECT (elem#>>'{}')::int AS item_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE (elem#>>'{}')::int > 0
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
    SELECT (ord - 1)::int AS slot, (elem#>>'{}')::int AS item_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE (elem#>>'{}')::int > 0 AND ord <= 6
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
    SELECT (elem#>>'{}')::int AS spell_id, b.win
    FROM base b,
         jsonb_array_elements_text(COALESCE(b.summoner_spells, '[]'::jsonb)) AS elem
    WHERE b.summoner_spells IS NOT NULL AND jsonb_array_length(b.summoner_spells) >= 1
      AND (elem#>>'{}') ~ '^\d+$'
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
    'totalParticipants', total_participants,
    'runes', (SELECT j FROM runes_json),
    'runeSets', (SELECT j FROM runesets_json),
    'items', (SELECT j FROM items_json),
    'itemSets', (SELECT j FROM itemsets_json),
    'itemsByOrder', COALESCE((SELECT j FROM items_by_order_json), '{}'::jsonb),
    'summonerSpells', (SELECT j FROM spells_json)
  )
  FROM (SELECT 1) _
    $query$,
    match_cond,
    total_participants,
    total_participants,
    total_participants,
    total_participants,
    total_participants
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview_detail(text, text) IS 'Overview detail with optional version and rank_tier filter.';

-- get_stats_overview_teams: add p_rank_tier filter (same structure as 20180000: distribution + horde)
CREATE OR REPLACE FUNCTION get_stats_overview_teams(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  version_cond text;
  rank_cond text;
  match_cond text;
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
    'SELECT COUNT(*) FROM matches m WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0 AND %s',
    match_cond
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
        'riftHerald', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'horde', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)
      )
    );
  END IF;

  EXECUTE format(
    'WITH match_teams AS (
      SELECT m.id AS match_id, (elem->>''win'')::boolean AS win, elem->''bans'' AS bans
      FROM matches m, jsonb_array_elements(COALESCE(m.teams, ''[]''::jsonb)) AS elem
      WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0 AND %s
    ),
    ban_rows AS (
      SELECT (b->>''championId'')::int AS champion_id, mt.win
      FROM match_teams mt, jsonb_array_elements(COALESCE(mt.bans, ''[]''::jsonb)) AS b
      WHERE mt.bans IS NOT NULL AND jsonb_typeof(mt.bans) = ''array'' AND b->>''championId'' IS NOT NULL AND (b->>''championId'') ~ ''^\d+$''
    ),
    bans_win_agg AS (SELECT jsonb_agg(jsonb_build_object(''championId'', champion_id, ''count'', cnt) ORDER BY cnt DESC) AS j FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = true GROUP BY champion_id) t),
    bans_loss_agg AS (SELECT jsonb_agg(jsonb_build_object(''championId'', champion_id, ''count'', cnt) ORDER BY cnt DESC) AS j FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = false GROUP BY champion_id) t)
    SELECT COALESCE((SELECT j FROM bans_win_agg), ''[]''::jsonb), COALESCE((SELECT j FROM bans_loss_agg), ''[]''::jsonb)',
    match_cond
  ) INTO bans_by_win, bans_by_loss;

  EXECUTE format(
    $obj$
  WITH match_teams AS (
    SELECT m.id AS match_id, (elem->>'win')::boolean AS win, elem->'objectives' AS objectives
    FROM matches m, jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
    WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0 AND %s
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
      COALESCE((mt.objectives->'riftHerald'->>'kills')::int, 0) AS rift_herald_kills,
      (mt.objectives->'horde'->>'first')::boolean AS horde_first,
      COALESCE((mt.objectives->'horde'->>'kills')::int, 0) AS horde_kills
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
  FROM obj_agg o
    $obj$,
    match_cond
  ) INTO obj_first_blood, obj_baron, obj_dragon, obj_tower, obj_inhibitor, obj_rift_herald, obj_horde;

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

COMMENT ON FUNCTION get_stats_overview_teams(text, text) IS 'Bans and objectives (with distribution, horde); optional version and rank_tier filter.';
