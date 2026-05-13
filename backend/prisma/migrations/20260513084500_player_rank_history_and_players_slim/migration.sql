CREATE TABLE IF NOT EXISTS "player_rank_history" (
  "puuid" VARCHAR(78) NOT NULL,
  "date" DATE NOT NULL,
  "region" TEXT NOT NULL,
  "rank_tier" TEXT NOT NULL,
  "rank_division" TEXT NOT NULL,
  "rank_lp" SMALLINT NOT NULL,
  CONSTRAINT "player_rank_history_pkey" PRIMARY KEY ("puuid", "date", "region")
);

CREATE INDEX IF NOT EXISTS "idx_rank_history_lookup"
  ON "player_rank_history" ("puuid", "region", "date" DESC);

INSERT INTO "player_rank_history" ("puuid", "date", "region", "rank_tier", "rank_division", "rank_lp")
SELECT
  p."puuid",
  DATE(p."rank_snapshot_game_date") AS "date",
  p."region",
  p."rank_tier",
  p."rank_division",
  LEAST(GREATEST(COALESCE(p."rank_lp", 0), 0), 32767)::SMALLINT AS "rank_lp"
FROM "players" p
WHERE p."rank_snapshot_game_date" IS NOT NULL
  AND p."rank_tier" IS NOT NULL
  AND p."rank_division" IS NOT NULL
ON CONFLICT ("puuid", "date", "region") DO NOTHING;

ALTER TABLE "players" DROP COLUMN IF EXISTS "rank_tier";
ALTER TABLE "players" DROP COLUMN IF EXISTS "rank_division";
ALTER TABLE "players" DROP COLUMN IF EXISTS "rank_lp";
ALTER TABLE "players" DROP COLUMN IF EXISTS "rank_snapshot_game_date";
ALTER TABLE "players" DROP COLUMN IF EXISTS "game_name";
ALTER TABLE "players" DROP COLUMN IF EXISTS "tag_name";
