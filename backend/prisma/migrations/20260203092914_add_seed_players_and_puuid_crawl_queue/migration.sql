-- CreateTable
CREATE TABLE "seed_players" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puuid_crawl_queue" (
    "puuid" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puuid_crawl_queue_pkey" PRIMARY KEY ("puuid")
);

-- CreateIndex
CREATE INDEX "seed_players_platform_idx" ON "seed_players"("platform");

-- CreateIndex
CREATE INDEX "puuid_crawl_queue_added_at_idx" ON "puuid_crawl_queue"("added_at");
