ALTER TABLE "champion_tier_daily_snapshots"
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'ALL';

ALTER TABLE "champion_tier_daily_snapshots"
DROP CONSTRAINT IF EXISTS "champion_tier_daily_snapshots_snapshot_for_date_rank_tier_champion_id_key";

ALTER TABLE "champion_tier_daily_snapshots"
ADD CONSTRAINT "champion_tier_daily_snapshots_snapshot_for_date_rank_tier_role_champion_id_key"
UNIQUE ("snapshot_for_date", "rank_tier", "role", "champion_id");

DROP INDEX IF EXISTS "champion_tier_daily_snapshots_tier_date_idx";
CREATE INDEX IF NOT EXISTS "champion_tier_daily_snapshots_tier_role_date_idx"
ON "champion_tier_daily_snapshots" ("rank_tier", "role", "snapshot_for_date" DESC);
