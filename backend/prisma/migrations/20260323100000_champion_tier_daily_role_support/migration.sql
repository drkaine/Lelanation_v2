-- Align daily snapshot role with app convention: SUPPORT (not UTILITY).
UPDATE "champion_tier_daily_snapshots"
SET "role" = 'SUPPORT'
WHERE "role" = 'UTILITY';

DO $$
BEGIN
  IF to_regclass('public.champion_tier_daily_snapshots_archive') IS NOT NULL THEN
    UPDATE "champion_tier_daily_snapshots_archive"
    SET "role" = 'SUPPORT'
    WHERE "role" = 'UTILITY';
  END IF;
END $$;
