-- Retrait métrique ARAM peu utile en agrégat global.
ALTER TABLE champion_stats
  DROP COLUMN IF EXISTS sum_snowballs_hit;
