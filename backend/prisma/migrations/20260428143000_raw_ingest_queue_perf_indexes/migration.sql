-- Raw ingest queue indexes for low-lock claim/retry/cleanup scans.
CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_pending_claim
  ON match_ingest_raw (id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_processing_started
  ON match_ingest_raw (processing_started_at, id)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_done_normalized
  ON match_ingest_raw (normalized_at, id)
  WHERE status = 'done';

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_error_retry
  ON match_ingest_raw (next_retry_at, id)
  WHERE status = 'error';
