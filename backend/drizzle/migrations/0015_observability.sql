CREATE TABLE IF NOT EXISTS obs_rate_limit_windows (
  id              BIGSERIAL PRIMARY KEY,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  requests_sent   INT         NOT NULL DEFAULT 0,
  requests_target INT         NOT NULL DEFAULT 96,
  count_429       INT         NOT NULL DEFAULT 0,
  avg_queue_depth NUMERIC(6,2),
  header_syncs    INT         NOT NULL DEFAULT 0,
  headroom_min    INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS obs_rate_limit_windows_window_start_idx
  ON obs_rate_limit_windows (window_start DESC);

CREATE TABLE IF NOT EXISTS obs_pipeline_minutes (
  id               BIGSERIAL PRIMARY KEY,
  bucket_start     TIMESTAMPTZ NOT NULL,
  stage            VARCHAR(60) NOT NULL,
  items_processed  INT         NOT NULL DEFAULT 0,
  items_failed     INT         NOT NULL DEFAULT 0,
  avg_duration_ms  NUMERIC(10,2),
  p95_duration_ms  NUMERIC(10,2),
  queue_depth_avg  NUMERIC(6,2),
  UNIQUE (bucket_start, stage)
);
CREATE INDEX IF NOT EXISTS obs_pipeline_minutes_bucket_stage_idx
  ON obs_pipeline_minutes (bucket_start DESC, stage);

CREATE TABLE IF NOT EXISTS obs_hourly_summaries (
  id                       BIGSERIAL PRIMARY KEY,
  hour_start               TIMESTAMPTZ NOT NULL UNIQUE,
  total_api_requests       INT         NOT NULL DEFAULT 0,
  total_429s               INT         NOT NULL DEFAULT 0,
  total_matches_processed  INT         NOT NULL DEFAULT 0,
  total_players_updated    INT         NOT NULL DEFAULT 0,
  total_ranks_fetched      INT         NOT NULL DEFAULT 0,
  total_db_rows_written    INT         NOT NULL DEFAULT 0,
  total_errors             INT         NOT NULL DEFAULT 0,
  avg_requests_per_120s    NUMERIC(6,2),
  min_requests_per_120s    INT,
  max_requests_per_120s    INT,
  headroom_avg             NUMERIC(5,2),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS obs_errors (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage        VARCHAR(60),
  error_type   VARCHAR(120),
  message      TEXT,
  context      JSONB,
  match_id     TEXT,
  puuid        TEXT
);
CREATE INDEX IF NOT EXISTS obs_errors_occurred_at_idx
  ON obs_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS obs_errors_stage_occurred_at_idx
  ON obs_errors (stage, occurred_at DESC);

CREATE TABLE IF NOT EXISTS obs_db_write_stats (
  id           BIGSERIAL PRIMARY KEY,
  bucket_start TIMESTAMPTZ NOT NULL,
  table_name   VARCHAR(80) NOT NULL,
  rows_written INT         NOT NULL DEFAULT 0,
  write_errors INT         NOT NULL DEFAULT 0,
  avg_ms       NUMERIC(10,2),
  UNIQUE (bucket_start, table_name)
);
