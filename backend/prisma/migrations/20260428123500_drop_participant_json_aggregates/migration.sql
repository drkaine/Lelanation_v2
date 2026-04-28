ALTER TABLE IF EXISTS agg_champion_participant_stats
  DROP COLUMN IF EXISTS numeric_sums,
  DROP COLUMN IF EXISTS numeric_counts,
  DROP COLUMN IF EXISTS bool_true_counts,
  DROP COLUMN IF EXISTS bool_counts;

ALTER TABLE IF EXISTS archive_agg_champion_participant_stats
  DROP COLUMN IF EXISTS numeric_sums,
  DROP COLUMN IF EXISTS numeric_counts,
  DROP COLUMN IF EXISTS bool_true_counts,
  DROP COLUMN IF EXISTS bool_counts;
