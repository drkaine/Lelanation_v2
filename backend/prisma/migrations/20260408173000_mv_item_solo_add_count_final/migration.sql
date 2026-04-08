-- Add count_final to mv_champion_item_solo_stats so finals are sourced directly from MV data.
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_solo_stats;

CREATE MATERIALIZED VIEW mv_champion_item_solo_stats AS
SELECT
  core_stat_id(
    mp.champion_id,
    COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
    ''::text,
    m.game_version,
    mp.role,
    m.region
  ) AS champion_stat_id,
  ((i.elem ->> 'itemId')::int) AS item_id,
  SUM(CASE WHEN COALESCE((i.elem ->> 'starter')::boolean, false) THEN 1 ELSE 0 END)::int AS count_starter,
  SUM(CASE WHEN COALESCE((i.elem ->> 'core')::boolean, false) THEN 1 ELSE 0 END)::int AS count_core,
  SUM(
    CASE
      WHEN
        NOT COALESCE((i.elem ->> 'starter')::boolean, false)
        AND NOT COALESCE((i.elem ->> 'core')::boolean, false)
      THEN 1
      ELSE 0
    END
  )::int AS count_final,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  LEAST(
    SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)),
    2147483647::bigint
  )::int AS sum_timestamp_ms
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL jsonb_array_elements(COALESCE(mp.items::jsonb, '[]'::jsonb)) AS i(elem)
  ON COALESCE((i.elem ->> 'order')::int, -1) < 6
 AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
  SELECT game_version FROM active_patches
)
GROUP BY
  mp.champion_id,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
  m.game_version,
  mp.role,
  m.region,
  ((i.elem ->> 'itemId')::int);

CREATE UNIQUE INDEX ON mv_champion_item_solo_stats (champion_stat_id, item_id);
