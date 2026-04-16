CREATE UNLOGGED TABLE IF NOT EXISTS match_ingest_raw (
  id BIGSERIAL PRIMARY KEY,
  riot_match_id TEXT NOT NULL,
  region TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  timeline_json JSONB NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  normalized_at TIMESTAMPTZ NULL,
  processing_started_at TIMESTAMPTZ NULL,
  next_retry_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_status_id
  ON match_ingest_raw (status, id);

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_riot_match_id
  ON match_ingest_raw (riot_match_id);

CREATE INDEX IF NOT EXISTS idx_match_ingest_raw_next_retry
  ON match_ingest_raw (status, next_retry_at, id);
