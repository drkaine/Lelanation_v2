-- Jungle paths, ward heatmaps, position heatmaps (delta + agg + cursor).

CREATE TABLE IF NOT EXISTS aggregation_cursor (
  name        TEXT PRIMARY KEY,
  last_id     BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO aggregation_cursor (name, last_id) VALUES
  ('jungle_path_delta', 0),
  ('ward_heatmap_delta', 0),
  ('position_heatmap_delta', 0)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS agg_jungle_path (
  id                  BIGSERIAL PRIMARY KEY,
  champion_id         INT NOT NULL,
  patch               TEXT NOT NULL,
  queue_id            INT NOT NULL,
  team_id             INT NOT NULL,
  path_sequence       TEXT[] NOT NULL,
  path_hash           TEXT NOT NULL,
  games               INT NOT NULL DEFAULT 0,
  wins                INT NOT NULL DEFAULT 0,
  avg_clear_time_ms   BIGINT,
  UNIQUE (champion_id, patch, queue_id, team_id, path_hash)
);

CREATE INDEX IF NOT EXISTS idx_jungle_path_champion_patch
  ON agg_jungle_path (champion_id, patch, queue_id);

CREATE UNLOGGED TABLE IF NOT EXISTS jungle_path_delta (
  id              BIGSERIAL PRIMARY KEY,
  champion_id     INT NOT NULL,
  patch           TEXT NOT NULL,
  queue_id        INT NOT NULL,
  team_id         INT NOT NULL,
  win             BOOLEAN NOT NULL,
  path_sequence   TEXT[] NOT NULL,
  path_hash       TEXT NOT NULL,
  clear_time_ms   BIGINT,
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jungle_path_delta_id ON jungle_path_delta (id);

CREATE TABLE IF NOT EXISTS agg_ward_heatmap (
  champion_id     INT NOT NULL,
  patch           TEXT NOT NULL,
  queue_id        INT NOT NULL,
  team_position   TEXT NOT NULL,
  ward_type       TEXT NOT NULL,
  time_bucket     TEXT NOT NULL,
  cell_x          INT NOT NULL,
  cell_y          INT NOT NULL,
  count           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (champion_id, patch, queue_id, team_position, ward_type, time_bucket, cell_x, cell_y)
);

CREATE INDEX IF NOT EXISTS idx_ward_heatmap_champion_patch_position
  ON agg_ward_heatmap (champion_id, patch, team_position);

CREATE UNLOGGED TABLE IF NOT EXISTS ward_heatmap_delta (
  id              BIGSERIAL PRIMARY KEY,
  champion_id     INT NOT NULL,
  patch           TEXT NOT NULL,
  queue_id        INT NOT NULL,
  team_position   TEXT NOT NULL,
  ward_type       TEXT NOT NULL,
  time_bucket     TEXT NOT NULL,
  cell_x          INT NOT NULL,
  cell_y          INT NOT NULL,
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ward_heatmap_delta_id ON ward_heatmap_delta (id);

CREATE TABLE IF NOT EXISTS agg_position_heatmap (
  champion_id     INT NOT NULL,
  patch           TEXT NOT NULL,
  queue_id        INT NOT NULL,
  team_position   TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  time_bucket     TEXT NOT NULL,
  cell_x          INT NOT NULL,
  cell_y          INT NOT NULL,
  count           INT NOT NULL DEFAULT 0,
  PRIMARY KEY (champion_id, patch, queue_id, team_position, event_type, time_bucket, cell_x, cell_y)
);

CREATE INDEX IF NOT EXISTS idx_position_heatmap_champion_patch_position
  ON agg_position_heatmap (champion_id, patch, team_position);

CREATE UNLOGGED TABLE IF NOT EXISTS position_heatmap_delta (
  id              BIGSERIAL PRIMARY KEY,
  champion_id     INT NOT NULL,
  patch           TEXT NOT NULL,
  queue_id        INT NOT NULL,
  team_position   TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  time_bucket     TEXT NOT NULL,
  cell_x          INT NOT NULL,
  cell_y          INT NOT NULL,
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_position_heatmap_delta_id ON position_heatmap_delta (id);
