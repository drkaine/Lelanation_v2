-- Rebuild MVs that depended on legacy normalized tables.
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_solo_stats;

-- Drop legacy tables now that payload lives on match_players.
DROP TABLE IF EXISTS match_player_items;
DROP TABLE IF EXISTS match_player_runes;
DROP TABLE IF EXISTS match_player_shards;

CREATE MATERIALIZED VIEW mv_champion_shard_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  s.shard_id,
  (s.slot - 1)::int AS slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL unnest(COALESCE(mp.shards, ARRAY[]::int[])) WITH ORDINALITY AS s(shard_id, slot) ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, s.shard_id, (s.slot - 1)
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_shard_solo_stats (champion_stat_id, shard_id, slot);

CREATE MATERIALIZED VIEW mv_champion_runes_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  r.perk_id,
  0::int AS style,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL unnest(COALESCE(mp.runes, ARRAY[]::int[])) AS r(perk_id) ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, r.perk_id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_runes_solo_stats (champion_stat_id, perk_id, style);

CREATE MATERIALIZED VIEW mv_champion_shard_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE(array_to_string(mp.shards, ','), '') AS shard_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE(array_to_string(mp.shards, ','), '')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_shard_stats (champion_stat_id, shard_list);

CREATE MATERIALIZED VIEW mv_champion_runes_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE('[' || array_to_string(mp.runes, ',') || ']', '[]') AS rune_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE('[' || array_to_string(mp.runes, ',') || ']', '[]')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_runes_stats (champion_stat_id, rune_list);

CREATE MATERIALIZED VIEW mv_champion_item_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  ((i.elem ->> 'itemId')::int) AS item_id,
  SUM(CASE WHEN COALESCE((i.elem ->> 'starter')::boolean, false) THEN 1 ELSE 0 END)::int AS count_starter,
  SUM(CASE WHEN COALESCE((i.elem ->> 'core')::boolean, false) THEN 1 ELSE 0 END)::int AS count_core,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE((i.elem ->> 'timestampMs')::int, 0))::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL jsonb_array_elements(COALESCE(mp.items::jsonb, '[]'::jsonb)) AS i(elem)
  ON COALESCE((i.elem ->> 'order')::int, -1) < 6
 AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, ((i.elem ->> 'itemId')::int)
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_item_solo_stats (champion_stat_id, item_id);

CREATE MATERIALIZED VIEW mv_champion_item_stats AS
WITH item_lists AS (
  SELECT
    mp.id AS match_player_id,
    COALESCE(
      '[' || string_agg((i.elem ->> 'itemId'), ',' ORDER BY COALESCE((i.elem ->> 'order')::int, 0)) || ']',
      '[]'
    ) AS item_list,
    COALESCE(SUM(COALESCE((i.elem ->> 'timestampMs')::int, 0)), 0)::int AS ts
  FROM match_players mp
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(mp.items::jsonb, '[]'::jsonb)) AS i(elem)
    ON COALESCE((i.elem ->> 'order')::int, -1) < 6
   AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
  GROUP BY mp.id
)
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE(il.item_list, '[]') AS item_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE(il.ts, 0))::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN item_lists il ON il.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, COALESCE(il.item_list, '[]')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_item_stats (champion_stat_id, item_list);
