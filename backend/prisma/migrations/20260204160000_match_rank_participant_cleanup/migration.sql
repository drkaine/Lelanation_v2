-- Match: remove game_creation, add rank (average rank of players)
ALTER TABLE "matches" DROP COLUMN IF EXISTS "game_creation";
ALTER TABLE "matches" ADD COLUMN "rank" TEXT;

-- Participant: remove summoner_id (puuid is the identifier) and lane (unused, null)
ALTER TABLE "participants" DROP COLUMN IF EXISTS "summoner_id";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "lane";
