ALTER TABLE "champion_tier_daily_snapshots"
DROP COLUMN IF EXISTS "window_start",
DROP COLUMN IF EXISTS "window_end",
DROP COLUMN IF EXISTS "created_at";

ALTER TABLE IF EXISTS "champion_tier_daily_snapshots_archive"
DROP COLUMN IF EXISTS "window_start",
DROP COLUMN IF EXISTS "window_end",
DROP COLUMN IF EXISTS "created_at";
