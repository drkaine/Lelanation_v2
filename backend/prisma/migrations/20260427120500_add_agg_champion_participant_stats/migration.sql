CREATE TABLE IF NOT EXISTS agg_champion_participant_stats (
  champion_stat_id BIGINT PRIMARY KEY,
  numeric_sums JSONB NOT NULL DEFAULT '{}'::jsonb,
  numeric_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  bool_true_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  bool_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_agg_champion_participant_stats_core
    FOREIGN KEY (champion_stat_id) REFERENCES agg_champion_core_stats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_participant_stats_updated_at
  ON agg_champion_participant_stats (updated_at);
