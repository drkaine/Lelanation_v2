-- Drop puuid_key_version from matches (kept on players).
ALTER TABLE "matches" DROP COLUMN IF EXISTS "puuid_key_version";
