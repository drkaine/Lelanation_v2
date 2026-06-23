-- Heatmaps spatiales inutiles (positions x/y absentes côté API Riot pour les wards).
-- Les analytics vivent sur participants (buckets + history JSONB).

DROP TABLE IF EXISTS ward_heatmap_delta;
DROP TABLE IF EXISTS agg_ward_heatmap;
DROP TABLE IF EXISTS position_heatmap_delta;
DROP TABLE IF EXISTS agg_position_heatmap;

DROP TABLE IF EXISTS aggregation_cursor;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS ward_killed_history JSONB NOT NULL DEFAULT '[]';
