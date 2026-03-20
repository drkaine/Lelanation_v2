ALTER TABLE "champion_tier_daily_snapshots"
RENAME COLUMN "snapshot_for_date" TO "date_of_game";

ALTER TABLE IF EXISTS "champion_tier_daily_snapshots_archive"
RENAME COLUMN "snapshot_for_date" TO "date_of_game";

ALTER TABLE "champion_tier_snapshot_runs"
RENAME COLUMN "snapshot_for_date" TO "date_of_game";
