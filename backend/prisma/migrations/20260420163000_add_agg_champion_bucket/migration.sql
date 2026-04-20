CREATE TABLE IF NOT EXISTS agg_champion_bucket (
  champion_stat_id BIGINT NOT NULL,
  duration_bucket INTEGER NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, duration_bucket)
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_bucket_duration
  ON agg_champion_bucket (duration_bucket);
