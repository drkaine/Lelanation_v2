CREATE TABLE IF NOT EXISTS tracked_matches (
  match_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_ingest_raw_riot_match_unique
  ON match_ingest_raw (riot_match_id);
