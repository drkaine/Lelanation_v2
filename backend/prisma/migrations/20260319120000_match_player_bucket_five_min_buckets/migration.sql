-- Ne conserver que les buckets minute 5, 10, 15, … (multiples de 5 à partir de 5).
-- Les ingestions (riotPoller, dataEnrich) appliquent la même règle désormais.

DELETE FROM "match_player_bucket"
WHERE "duration_bucket" < 5
   OR ("duration_bucket" % 5) <> 0;

-- Rafraîchir la vue matérialisée si elle existe (dérivée de match_player_bucket).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_matviews
    WHERE schemaname = current_schema()
      AND matviewname = 'mv_champion_bucket'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_bucket;
  END IF;
END $$;
