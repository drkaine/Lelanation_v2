-- Vues matérialisées pour toutes les stats satellites (uniquement patches actifs).
-- Même filtre que mv_champion_core_stats : champion_core_stat_id IN (core stats actifs).

-- Expression réutilisable : ids des champion_core_stats dont le patch est actif
-- (on la répète dans chaque MV pour éviter les dépendances entre MVs)

DROP MATERIALIZED VIEW IF EXISTS mv_champion_bucket;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spells;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_spell_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_challenge_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_matchup_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_combat_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vision_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_objectif_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_first_objectif_stats;

CREATE MATERIALIZED VIEW mv_champion_first_objectif_stats AS
SELECT * FROM champion_first_objectif_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_first_objectif_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_objectif_stats AS
SELECT * FROM champion_objectif_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_objectif_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_vision_stats AS
SELECT * FROM champion_vision_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_vision_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_combat_stats AS
SELECT * FROM champion_combat_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_combat_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_matchup_stats AS
SELECT * FROM champion_matchup_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_matchup_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_challenge_stats AS
SELECT * FROM champion_challenge_stats
WHERE champion_core_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_challenge_stats (champion_core_stat_id);

CREATE MATERIALIZED VIEW mv_champion_shard_solo_stats AS
SELECT * FROM champion_shard_solo_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_shard_solo_stats (champion_stat_id, shard_id, slot);

CREATE MATERIALIZED VIEW mv_champion_runes_solo_stats AS
SELECT * FROM champion_runes_solo_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_runes_solo_stats (champion_stat_id, perk_id, style);

CREATE MATERIALIZED VIEW mv_champion_shard_stats AS
SELECT * FROM champion_shard_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_shard_stats (champion_stat_id, shard_list);

CREATE MATERIALIZED VIEW mv_champion_runes_stats AS
SELECT * FROM champion_runes_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_runes_stats (champion_stat_id, rune_list);

CREATE MATERIALIZED VIEW mv_champion_item_solo_stats AS
SELECT * FROM champion_item_solo_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_item_solo_stats (champion_stat_id, item_id);

CREATE MATERIALIZED VIEW mv_champion_item_stats AS
SELECT * FROM champion_item_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_item_stats (champion_stat_id, item_list);

CREATE MATERIALIZED VIEW mv_champion_spell_solo_stats AS
SELECT * FROM champion_spell_solo_stats
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_spell_solo_stats (champion_stat_id, spell_slot);

CREATE MATERIALIZED VIEW mv_champion_summoner_spells AS
SELECT * FROM champion_summoner_spells
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_summoner_spells (champion_stat_id, spell_id);

CREATE MATERIALIZED VIEW mv_champion_bucket AS
SELECT * FROM champion_bucket
WHERE champion_stat_id IN (
  SELECT id FROM champion_core_stats c
  WHERE (split_part(c.game_version, '.', 1) || '.' || split_part(c.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
);
CREATE UNIQUE INDEX ON mv_champion_bucket (champion_stat_id, duration_bucket);

-- Mise à jour de la fonction de refresh pour inclure toutes les MVs (ordre : core puis satellites)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_core_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_vs_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_core_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_first_objectif_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_objectif_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_vision_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_combat_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_matchup_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_challenge_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_shard_solo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_runes_solo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_shard_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_runes_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_item_solo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_item_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_spell_solo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_summoner_spells;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_bucket;
END;
$$ LANGUAGE plpgsql;
