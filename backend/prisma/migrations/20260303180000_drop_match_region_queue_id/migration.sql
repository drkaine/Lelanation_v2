-- Drop region and queue_id from matches.
ALTER TABLE "matches" DROP COLUMN IF EXISTS "region";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "queue_id";
