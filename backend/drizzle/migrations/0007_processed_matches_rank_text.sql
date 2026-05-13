-- `rank` : libellé de tier (comme `rank_tier`), pas une valeur numérique.
ALTER TABLE processed_matches DROP COLUMN IF EXISTS rank;
ALTER TABLE processed_matches ADD COLUMN rank TEXT;
