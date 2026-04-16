ALTER TABLE match_players
ADD COLUMN skill_order JSONB;

WITH dedup_spell_orders AS (
  SELECT DISTINCT ON (so.match_player_id, so."order")
    so.match_player_id,
    so.spell_slot,
    so."order",
    so.id
  FROM match_player_spell_orders so
  ORDER BY so.match_player_id, so."order", so.id
),
backfilled_skill_order AS (
  SELECT
    dso.match_player_id,
    jsonb_agg(dso.spell_slot ORDER BY dso."order", dso.id) AS skill_order
  FROM dedup_spell_orders dso
  GROUP BY dso.match_player_id
)
UPDATE match_players mp
SET skill_order = bso.skill_order
FROM backfilled_skill_order bso
WHERE mp.id = bso.match_player_id;

DROP MATERIALIZED VIEW mv_champion_spell_solo_stats;
CREATE MATERIALIZED VIEW mv_champion_spell_solo_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  so.spell_slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  MIN(so.first_up_order)::int AS first_up_order,
  MAX(so.max_order)::int AS max_order
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL (
  SELECT
    (e.spell_slot_text)::int AS spell_slot,
    MIN(e.ord)::int AS first_up_order,
    MAX(e.ord)::int AS max_order
  FROM jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(mp.skill_order) = 'array' THEN mp.skill_order
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS e(spell_slot_text, ord)
  WHERE e.spell_slot_text ~ '^[0-9]+$'
  GROUP BY (e.spell_slot_text)::int
) so ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, so.spell_slot
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_spell_solo_stats (champion_stat_id, spell_slot);

DROP TABLE match_player_spell_orders;

REFRESH MATERIALIZED VIEW mv_champion_spell_solo_stats;
