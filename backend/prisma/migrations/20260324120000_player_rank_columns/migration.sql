-- Player rank snapshot (solo / flex from ingest) to avoid redundant League v4 calls on old matches.

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_tier" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_division" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_lp" INTEGER;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_snapshot_game_date" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "players_rank_tier_idx" ON "players"("rank_tier");
