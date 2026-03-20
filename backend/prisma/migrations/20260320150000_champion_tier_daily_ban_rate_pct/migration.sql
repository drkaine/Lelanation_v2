ALTER TABLE "champion_tier_daily_snapshots"
ADD COLUMN IF NOT EXISTS "ban_rate_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS "champion_tier_daily_snapshots_archive"
ADD COLUMN IF NOT EXISTS "ban_rate_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;
