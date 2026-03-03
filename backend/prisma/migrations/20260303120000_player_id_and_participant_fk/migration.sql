-- Add numeric id to players and link participants to players by id.

-- 1) Add id column to players (if not present) and ensure it is unique.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "id" BIGSERIAL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_id_key'
  ) THEN
    ALTER TABLE "players" ADD CONSTRAINT "players_id_key" UNIQUE ("id");
  END IF;
END $$;

-- 2) Add player_id column to participants and backfill from players.puuid.
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "player_id" BIGINT;

-- Ensure every participant puuid exists in players (create missing rows so backfill has no nulls).
INSERT INTO "players" ("puuid", "region")
SELECT DISTINCT p."puuid", 'euw1'
FROM "participants" p
WHERE NOT EXISTS (SELECT 1 FROM "players" pl WHERE pl."puuid" = p."puuid");

UPDATE "participants" p
SET "player_id" = pl."id"
FROM "players" pl
WHERE pl."puuid" = p."puuid"
  AND p."player_id" IS NULL;

-- 3) Enforce NOT NULL and add index + foreign key.
ALTER TABLE "participants"
  ALTER COLUMN "player_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "participants_player_id_idx" ON "participants"("player_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participants_player_id_fkey'
  ) THEN
    ALTER TABLE "participants"
      ADD CONSTRAINT "participants_player_id_fkey"
      FOREIGN KEY ("player_id") REFERENCES "players"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

