-- Agrégation spatiale retirée : jungle path + analytics sur participants.

DROP TABLE IF EXISTS jungle_path_delta;
DROP TABLE IF EXISTS agg_jungle_path;
DROP TABLE IF EXISTS aggregation_cursor;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS jungle_path_sequence TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS jungle_path_hash TEXT;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS jungle_clear_time_ms BIGINT;
