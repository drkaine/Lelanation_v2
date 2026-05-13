-- `player_rank_history` + slim `players` sont destinés à **lelanation_statistiques** (Drizzle : migration 0005).
-- Si la migration Prisma `20260513084500_player_rank_history_and_players_slim` a été appliquée par erreur sur
-- **lelanation_stats**, on annule ici : supprime la table et rétablit les colonnes sur `players`.

DROP TABLE IF EXISTS "player_rank_history";

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_tier" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_division" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_lp" INTEGER;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "rank_snapshot_game_date" TIMESTAMPTZ;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "game_name" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "tag_name" TEXT;
