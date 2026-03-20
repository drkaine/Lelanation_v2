ALTER TABLE "champion_tier_daily_snapshots" DROP COLUMN IF EXISTS "win_rate_pct";

DO $$
BEGIN
  IF to_regclass('public.champion_tier_daily_snapshots_archive') IS NOT NULL THEN
    ALTER TABLE "champion_tier_daily_snapshots_archive" DROP COLUMN IF EXISTS "win_rate_pct";
  END IF;
END $$;
