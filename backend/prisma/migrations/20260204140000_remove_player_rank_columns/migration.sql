-- Remove rank columns from players (rank is per-participation in participants table)
ALTER TABLE "players" DROP COLUMN IF EXISTS "current_rank_tier";
ALTER TABLE "players" DROP COLUMN IF EXISTS "current_rank_division";
ALTER TABLE "players" DROP COLUMN IF EXISTS "current_rank_lp";
