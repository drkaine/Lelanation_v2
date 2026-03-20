-- matchs: drop legacy timestamp columns
DROP INDEX IF EXISTS "matchs_aggregated_at_idx";
DROP INDEX IF EXISTS "matchs_ingested_at_idx";
ALTER TABLE "matchs" DROP COLUMN IF EXISTS "aggregated_at";
ALTER TABLE "matchs" DROP COLUMN IF EXISTS "ingested_at";

-- match_players: ordered summoner spell IDs; migrate from match_player_summoner_spells
ALTER TABLE "match_players" ADD COLUMN IF NOT EXISTS "summoner_spells" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "match_players" mp
SET "summoner_spells" = s.arr
FROM (
  SELECT "match_player_id", array_agg("spell_id" ORDER BY "spell_slot") AS arr
  FROM "match_player_summoner_spells"
  GROUP BY "match_player_id"
) s
WHERE mp.id = s.match_player_id;

DROP MATERIALIZED VIEW IF EXISTS "mv_champion_summoner_spells";

DROP TABLE IF EXISTS "match_player_summoner_spells";

ALTER TABLE "teams" DROP COLUMN IF EXISTS "rank_division";

ALTER TABLE "match_players" DROP COLUMN IF EXISTS "rank_lp";

-- Rebuild mv_champion_summoner_spells from summoner_spells array (slot order = ordinality)
CREATE MATERIALIZED VIEW "mv_champion_summoner_spells" AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  u.spell_id,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(CASE WHEN u.ord = 1 THEN 1 ELSE 0 END)::int AS count_slot0,
  SUM(CASE WHEN u.ord = 2 THEN 1 ELSE 0 END)::int AS count_slot1
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN LATERAL unnest(COALESCE(mp.summoner_spells, ARRAY[]::integer[])) WITH ORDINALITY AS u(spell_id, ord) ON true
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, u.spell_id
WITH NO DATA;

CREATE UNIQUE INDEX ON "mv_champion_summoner_spells" ("champion_stat_id", "spell_id");
