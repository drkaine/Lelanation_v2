-- Rune sets: inclure les fragments (mp.shards) dans la clé d’agrégation pour que l’API puisse les renvoyer avec chaque combinaison runes + shards.
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_stats;

CREATE MATERIALIZED VIEW mv_champion_runes_stats AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  COALESCE('[' || array_to_string(mp.runes, ',') || ']', '[]') AS rune_list,
  COALESCE(array_to_string(mp.shards, ','), '') AS shard_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY
  mp.champion_id,
  COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier),
  m.game_version,
  mp.role,
  m.region,
  COALESCE('[' || array_to_string(mp.runes, ',') || ']', '[]'),
  COALESCE(array_to_string(mp.shards, ','), '')
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_runes_stats (champion_stat_id, rune_list, shard_list);
