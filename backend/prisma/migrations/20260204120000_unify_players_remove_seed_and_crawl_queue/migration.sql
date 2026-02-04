-- Migrate puuid_crawl_queue into players so no discovered PUUIDs are lost
INSERT INTO "players" ("puuid", "region", "total_games", "total_wins", "created_at", "updated_at")
SELECT q."puuid", q."platform", 0, 0, NOW(), NOW()
FROM "puuid_crawl_queue" q
ON CONFLICT ("puuid") DO NOTHING;

-- Index for crawl order (oldest last_seen first)
CREATE INDEX IF NOT EXISTS "players_last_seen_idx" ON "players"("last_seen");

-- Drop obsolete tables (seed list and crawl queue; players table is now the single source)
DROP TABLE IF EXISTS "puuid_crawl_queue";
DROP TABLE IF EXISTS "seed_players";
