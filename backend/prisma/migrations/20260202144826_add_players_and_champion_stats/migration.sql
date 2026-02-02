-- CreateTable
CREATE TABLE "players" (
    "puuid" TEXT NOT NULL,
    "summoner_id" TEXT,
    "summoner_name" TEXT,
    "region" TEXT NOT NULL,
    "current_rank_tier" TEXT,
    "current_rank_division" TEXT,
    "current_rank_lp" INTEGER,
    "total_games" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("puuid")
);

-- CreateTable
CREATE TABLE "champion_player_stats" (
    "id" BIGSERIAL NOT NULL,
    "puuid" TEXT NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "winrate" DECIMAL(5,2) NOT NULL,
    "avg_kills" DECIMAL(5,2),
    "avg_deaths" DECIMAL(5,2),
    "avg_assists" DECIMAL(5,2),
    "last_played" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "champion_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_region_idx" ON "players"("region");

-- CreateIndex
CREATE INDEX "players_current_rank_tier_idx" ON "players"("current_rank_tier");

-- CreateIndex
CREATE INDEX "champion_player_stats_puuid_idx" ON "champion_player_stats"("puuid");

-- CreateIndex
CREATE INDEX "champion_player_stats_champion_id_idx" ON "champion_player_stats"("champion_id");

-- CreateIndex
CREATE INDEX "champion_player_stats_champion_id_winrate_idx" ON "champion_player_stats"("champion_id", "winrate");

-- CreateIndex
CREATE UNIQUE INDEX "champion_player_stats_puuid_champion_id_key" ON "champion_player_stats"("puuid", "champion_id");

-- AddForeignKey
ALTER TABLE "champion_player_stats" ADD CONSTRAINT "champion_player_stats_puuid_fkey" FOREIGN KEY ("puuid") REFERENCES "players"("puuid") ON DELETE CASCADE ON UPDATE CASCADE;
