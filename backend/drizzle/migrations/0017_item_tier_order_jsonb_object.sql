-- Rows where "order" is not a JSON object break jsonb_set during ingestion upsert.
UPDATE item_tier_daily_snapshots
SET "order" = '{}'::jsonb
WHERE jsonb_typeof("order") != 'object';
