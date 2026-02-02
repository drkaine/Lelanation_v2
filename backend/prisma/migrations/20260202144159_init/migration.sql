-- CreateTable
CREATE TABLE "matches" (
    "id" BIGSERIAL NOT NULL,
    "match_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "queue_id" INTEGER NOT NULL,
    "game_version" TEXT,
    "game_creation" BIGINT,
    "game_duration" INTEGER,
    "platform_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "puuid" TEXT NOT NULL,
    "summoner_id" TEXT,
    "champion_id" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "role" TEXT,
    "lane" TEXT,
    "team_position" TEXT,
    "rank_tier" TEXT,
    "rank_division" TEXT,
    "rank_lp" INTEGER,
    "items" JSONB,
    "runes" JSONB,
    "summoner_spells" JSONB,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_match_id_key" ON "matches"("match_id");

-- CreateIndex
CREATE INDEX "participants_match_id_idx" ON "participants"("match_id");

-- CreateIndex
CREATE INDEX "participants_puuid_idx" ON "participants"("puuid");

-- CreateIndex
CREATE INDEX "participants_champion_id_idx" ON "participants"("champion_id");

-- CreateIndex
CREATE INDEX "participants_rank_tier_idx" ON "participants"("rank_tier");

-- CreateIndex
CREATE INDEX "participants_role_idx" ON "participants"("role");

-- CreateIndex
CREATE INDEX "participants_champion_id_rank_tier_idx" ON "participants"("champion_id", "rank_tier");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
