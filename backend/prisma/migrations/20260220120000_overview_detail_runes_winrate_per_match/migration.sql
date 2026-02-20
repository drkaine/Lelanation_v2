-- Add match_id to MV for rune winrate at match level (one rune counted once per match).
-- Then: rune winrate = wins_with_rune / distinct_matches_with_rune.

DROP MATERIALIZED VIEW IF EXISTS mv_overview_detail_base CASCADE;

CREATE MATERIALIZED VIEW mv_overview_detail_base AS
SELECT
  p.id,
  p.match_id,
  p.runes,
  p.items,
  p.summoner_spells,
  p.win,
  m.game_version,
  m.rank
FROM participants p
INNER JOIN matches m ON m.id = p.match_id;

CREATE UNIQUE INDEX idx_mv_overview_detail_base_id ON mv_overview_detail_base (id);
CREATE INDEX idx_mv_overview_detail_base_version_rank ON mv_overview_detail_base (game_version, rank)
  WHERE game_version IS NOT NULL AND rank IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_version ON mv_overview_detail_base (game_version)
  WHERE game_version IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_rank ON mv_overview_detail_base (rank)
  WHERE rank IS NOT NULL;

COMMENT ON MATERIALIZED VIEW mv_overview_detail_base IS 'Base for get_stats_overview_detail. Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_detail_base;';

-- Runes: winrate = (matches where at least one participant had rune and won) / (distinct matches with that rune).
-- Pickrate = distinct matches with rune / total distinct matches (in filter).
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
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'game_version IS NOT NULL AND game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
  ELSE
    rank_cond := 'rank IS NOT NULL AND rank != '''' AND UPPER(TRIM(split_part(rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM mv_overview_detail_base WHERE %s AND %s',
    version_cond,
    rank_cond
  ) INTO total_participants;

  EXECUTE format(
    'SELECT COUNT(DISTINCT match_id) FROM mv_overview_detail_base WHERE %s AND %s',
    version_cond,
    rank_cond
  ) INTO total_matches;

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
    SELECT match_id, runes, items, summoner_spells, win
    FROM mv_overview_detail_base
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
    version_cond,
    rank_cond,
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
