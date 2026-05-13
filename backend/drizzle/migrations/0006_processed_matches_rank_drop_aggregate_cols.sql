-- processed_matches (LIST patch) : score ladder moyen du match + suppression des colonnes d’agrégat non utilisées.

ALTER TABLE processed_matches ADD COLUMN IF NOT EXISTS rank DOUBLE PRECISION;

ALTER TABLE processed_matches DROP COLUMN IF EXISTS aggregate_status;
ALTER TABLE processed_matches DROP COLUMN IF EXISTS aggregate_attempt_count;
ALTER TABLE processed_matches DROP COLUMN IF EXISTS aggregate_last_error;
ALTER TABLE processed_matches DROP COLUMN IF EXISTS aggregated_at;
