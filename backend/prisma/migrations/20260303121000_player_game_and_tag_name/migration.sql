-- Add game_name and tag_name to players and backfill from summoner_name (Riot ID: gameName#tagLine).

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "game_name" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "tag_name" TEXT;

-- Backfill existing rows where possible.
UPDATE "players"
SET
  "game_name" = NULLIF(split_part("summoner_name", '#', 1), ''),
  "tag_name" = NULLIF(split_part("summoner_name", '#', 2), '')
WHERE "summoner_name" IS NOT NULL
  AND ("game_name" IS NULL OR "tag_name" IS NULL);

