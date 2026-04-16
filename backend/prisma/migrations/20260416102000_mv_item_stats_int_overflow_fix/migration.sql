-- Prevent integer overflow on item timestamp aggregates during MV refresh (SQLSTATE 22003).
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_stats;

CREATE MATERIALIZED VIEW mv_champion_item_stats AS
WITH item_lists AS (
  SELECT
    mp.id AS match_player_id,
    COALESCE(
      '[' || string_agg((i.elem ->> 'itemId'), ',' ORDER BY COALESCE((i.elem ->> 'order')::int, 0)) || ']',
      '[]'
    ) AS item_list,
    LEAST(
      COALESCE(SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)), 0),
      2147483647::bigint
    )::int AS ts
  FROM match_players mp
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(mp.items::jsonb, '[]'::jsonb)) AS i(elem)
    ON COALESCE((i.elem ->> 'order')::int, -1) < 6
   AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
  GROUP BY mp.id
)
SELECT
  core_stat_id(
    mp.champion_id,
    COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
    ''::text,
    m.game_version,
    mp.role,
    m.region
  ) AS champion_stat_id,
  COALESCE(il.item_list, '[]') AS item_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  LEAST(
    SUM(COALESCE(il.ts, 0)::bigint),
    2147483647::bigint
  )::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
LEFT JOIN item_lists il ON il.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
  SELECT game_version FROM active_patches
)
GROUP BY
  mp.champion_id,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
  m.game_version,
  mp.role,
  m.region,
  COALESCE(il.item_list, '[]');

CREATE UNIQUE INDEX ON mv_champion_item_stats (champion_stat_id, item_list);
