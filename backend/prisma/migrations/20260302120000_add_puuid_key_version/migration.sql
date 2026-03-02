-- Add puuid_key_version to Match and Player.
-- Tracks which Riot API key (dev|perso|prod) the PUUIDs are associated with.
-- Enables skipping already-migrated matches and knowing when re-migration is needed.

ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "puuid_key_version" TEXT;

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "puuid_key_version" TEXT;

CREATE INDEX IF NOT EXISTS "players_puuid_key_version_idx" ON "players"("puuid_key_version");

COMMENT ON COLUMN "matches"."puuid_key_version" IS 'Riot API key version (dev|perso|prod) — match PUUIDs verified with this key';
COMMENT ON COLUMN "players"."puuid_key_version" IS 'Riot API key version (dev|perso|prod) — this PUUID was collected/migrated with this key';
