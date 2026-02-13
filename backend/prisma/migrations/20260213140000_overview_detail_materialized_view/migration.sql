-- Optimisation overview-detail: vue matérialisée pour éviter la grosse jointure participants+matches
-- à chaque appel. À rafraîchir après collecte (cron) ou périodiquement:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_detail_base;

CREATE MATERIALIZED VIEW mv_overview_detail_base AS
SELECT
  p.id,
  p.runes,
  p.items,
  p.summoner_spells,
  p.win,
  m.game_version,
  m.rank
FROM participants p
INNER JOIN matches m ON m.id = p.match_id;

-- Obligatoire pour REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_overview_detail_base_id ON mv_overview_detail_base (id);

-- Filtres version / rank utilisés par get_stats_overview_detail
CREATE INDEX idx_mv_overview_detail_base_version_rank ON mv_overview_detail_base (game_version, rank)
  WHERE game_version IS NOT NULL AND rank IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_version ON mv_overview_detail_base (game_version)
  WHERE game_version IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_rank ON mv_overview_detail_base (rank)
  WHERE rank IS NOT NULL;

COMMENT ON MATERIALIZED VIEW mv_overview_detail_base IS 'Base pour get_stats_overview_detail. Rafraîchir après collecte: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_detail_base;';


-- get_stats_overview_detail lit depuis la MV au lieu de participants+matches
CREATE OR REPLACE FUNCTION get_stats_overview_detail(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_participants bigint;
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
    SELECT runes, items, summoner_spells, win
    FROM mv_overview_detail_base
    WHERE %s AND %s
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

COMMENT ON FUNCTION get_stats_overview_detail(text, text) IS 'Overview detail (runes, items, spells) from mv_overview_detail_base. Refresh MV after match collection: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_detail_base;';
