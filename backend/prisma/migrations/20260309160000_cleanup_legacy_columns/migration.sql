-- =============================================================================
-- MIGRATION: 20260309160000_cleanup_legacy_columns
-- Step 2 (DESTRUCTIVE) — Run ONLY after validating step 1 in production.
--
-- Drops all legacy columns that were kept for backward compatibility during
-- the step-1 double-write transition:
--   - participants: team_id, unreal_kills, team_early_surrendered,
--                   game_ended_in_surrender, game_ended_in_early_surrender,
--                   items, runes, summoner_spells, stat_perks, challenges,
--                   spell1..4_casts, summoner1..2_casts
--   - match_teams: ban_1..5
--
-- NOTE: participants.win is NOT dropped here — it is still in schema.prisma
--       and is still used by mv_overview_detail_base (see step 5).
-- =============================================================================

-- ─── 0. Drop materialized view that depends on legacy columns ────────────────
-- CASCADE also drops any functions/views that depend on it
-- (e.g. get_stats_overview_detail).

DROP MATERIALIZED VIEW IF EXISTS mv_overview_detail_base CASCADE;

-- ─── 1. Drop legacy JSON blob columns from participants ───────────────────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS items,
  DROP COLUMN IF EXISTS runes,
  DROP COLUMN IF EXISTS summoner_spells,
  DROP COLUMN IF EXISTS stat_perks,
  DROP COLUMN IF EXISTS challenges;

-- ─── 2. Drop legacy numeric spell cast columns ────────────────────────────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS spell1_casts,
  DROP COLUMN IF EXISTS spell2_casts,
  DROP COLUMN IF EXISTS spell3_casts,
  DROP COLUMN IF EXISTS spell4_casts,
  DROP COLUMN IF EXISTS summoner1_casts,
  DROP COLUMN IF EXISTS summoner2_casts;

-- ─── 3. Drop legacy columns moved to normalised tables / match level ──────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS team_id,
  DROP COLUMN IF EXISTS unreal_kills,
  DROP COLUMN IF EXISTS team_early_surrendered,
  DROP COLUMN IF EXISTS game_ended_in_surrender,
  DROP COLUMN IF EXISTS game_ended_in_early_surrender;

-- ─── 4. Drop legacy ban columns from match_teams ─────────────────────────────

ALTER TABLE match_teams
  DROP COLUMN IF EXISTS ban_1,
  DROP COLUMN IF EXISTS ban_2,
  DROP COLUMN IF EXISTS ban_3,
  DROP COLUMN IF EXISTS ban_4,
  DROP COLUMN IF EXISTS ban_5;

-- ─── 5. Drop backup tables ───────────────────────────────────────────────────

DROP TABLE IF EXISTS backup_matches_20260309;
DROP TABLE IF EXISTS backup_participants_20260309;
DROP TABLE IF EXISTS backup_match_teams_pre_20260309;
DROP TABLE IF EXISTS backup_match_teams_post_20260309;
DROP TABLE IF EXISTS backup_matches_teams_20260309;
DROP TABLE IF EXISTS backup_match_teams_20260309;

-- ─── 6. Recreate mv_overview_detail_base from normalised tables ───────────────
-- runes → participant_runes (reconstructed as [{id, selections:[{perk}]}])
-- items → participant_items (aggregated as [item_id, ...])
-- summoner_spells → participant_summoner_spells (aggregated as [spell_id, ...])
-- win → participants.win (column kept, still in schema.prisma)

CREATE MATERIALIZED VIEW mv_overview_detail_base AS
SELECT
  p.id,
  p.match_id,
  -- Runes: rebuild Riot styles format [{id, selections:[{perk}]}]
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', rune_styles.style_id,
        'selections', rune_styles.sel
      )
      ORDER BY rune_styles.min_slot
    )
    FROM (
      SELECT
        pr.style_id,
        jsonb_agg(jsonb_build_object('perk', pr.perk_id) ORDER BY pr.slot) AS sel,
        MIN(pr.slot) AS min_slot
      FROM participant_runes pr
      WHERE pr.participant_id = p.id
      GROUP BY pr.style_id
    ) rune_styles
  ), '[]'::jsonb) AS runes,
  -- Items: [item_id, ...] ordered by slot
  COALESCE((
    SELECT jsonb_agg(pi.item_id ORDER BY pi.item_slot)
    FROM participant_items pi
    WHERE pi.participant_id = p.id
  ), '[]'::jsonb) AS items,
  -- Summoner spells: [spell_id, ...] ordered by slot
  COALESCE((
    SELECT jsonb_agg(pss.spell_id ORDER BY pss.spell_slot)
    FROM participant_summoner_spells pss
    WHERE pss.participant_id = p.id
  ), '[]'::jsonb) AS summoner_spells,
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

-- ─── 7. Recreate get_stats_overview_detail (reads from updated MV) ───────────

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
