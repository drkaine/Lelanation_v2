-- Add aggregated_at to matchs table to track which matches have been aggregated.
ALTER TABLE "matchs" ADD COLUMN IF NOT EXISTS "aggregated_at" TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS "matchs_aggregated_at_idx" ON "matchs" ("aggregated_at");

-- Make rank_division non-nullable (default '') in aggregate tables so ON CONFLICT works cleanly.
-- champion_core_stats
ALTER TABLE "champion_core_stats" ALTER COLUMN "rank_division" SET DEFAULT '';
UPDATE "champion_core_stats" SET "rank_division" = '' WHERE "rank_division" IS NULL;
ALTER TABLE "champion_core_stats" ALTER COLUMN "rank_division" SET NOT NULL;

-- team_core_stats
ALTER TABLE "team_core_stats" ALTER COLUMN "rank_division" SET DEFAULT '';
UPDATE "team_core_stats" SET "rank_division" = '' WHERE "rank_division" IS NULL;
ALTER TABLE "team_core_stats" ALTER COLUMN "rank_division" SET NOT NULL;
