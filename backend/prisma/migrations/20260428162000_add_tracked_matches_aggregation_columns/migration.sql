ALTER TABLE tracked_matches
  ADD COLUMN IF NOT EXISTS aggregate_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS aggregate_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aggregate_last_error TEXT,
  ADD COLUMN IF NOT EXISTS aggregated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tracked_matches_aggregate_status
  ON tracked_matches (aggregate_status);

CREATE INDEX IF NOT EXISTS idx_tracked_matches_aggregated_at
  ON tracked_matches (aggregated_at);
