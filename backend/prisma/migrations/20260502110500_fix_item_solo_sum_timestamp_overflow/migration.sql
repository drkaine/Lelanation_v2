ALTER TABLE IF EXISTS agg_champion_item_solo_stats
  ALTER COLUMN sum_timestamp_ms TYPE BIGINT
  USING sum_timestamp_ms::bigint;

ALTER TABLE IF EXISTS archive_agg_champion_item_solo_stats
  ALTER COLUMN sum_timestamp_ms TYPE BIGINT
  USING sum_timestamp_ms::bigint;
