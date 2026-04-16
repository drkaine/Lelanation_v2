-- Parallel lean ingest tables (no MV changes; legacy matchs unchanged).

CREATE TABLE "ingest_matchs" (
    "id" BIGSERIAL NOT NULL,
    "riot_match_id" TEXT NOT NULL,
    "game_version" TEXT NOT NULL,
    "game_duration" INTEGER NOT NULL,
    "game_date" TIMESTAMP(3),
    "rank_tier" TEXT NOT NULL,
    "rank_division" TEXT NOT NULL,
    "game_ended_in_surrender" BOOLEAN NOT NULL DEFAULT false,
    "game_ended_in_early_surrender" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT NOT NULL,
    CONSTRAINT "ingest_matchs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingest_matchs_riot_match_id_key" ON "ingest_matchs"("riot_match_id");
CREATE INDEX "ingest_matchs_game_version_idx" ON "ingest_matchs"("game_version");
CREATE INDEX "ingest_matchs_rank_tier_idx" ON "ingest_matchs"("rank_tier");
CREATE INDEX "ingest_matchs_region_idx" ON "ingest_matchs"("region");
CREATE INDEX "ingest_matchs_game_version_region_rank_tier_idx" ON "ingest_matchs"("game_version", "region", "rank_tier");
CREATE INDEX "ingest_matchs_game_date_idx" ON "ingest_matchs"("game_date");

CREATE TABLE "ingest_teams" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "team" INTEGER NOT NULL,
    "rank_tier" TEXT NOT NULL DEFAULT 'UNRANKED',
    "win" BOOLEAN NOT NULL,
    "team_early_surrendered" BOOLEAN NOT NULL DEFAULT false,
    "baron_kills" INTEGER NOT NULL DEFAULT 0,
    "baron_first" BOOLEAN NOT NULL DEFAULT false,
    "dragon_kills" INTEGER NOT NULL DEFAULT 0,
    "dragon_first" BOOLEAN NOT NULL DEFAULT false,
    "tower_kills" INTEGER NOT NULL DEFAULT 0,
    "tower_first" BOOLEAN NOT NULL DEFAULT false,
    "horde_kills" INTEGER NOT NULL DEFAULT 0,
    "horde_first" BOOLEAN NOT NULL DEFAULT false,
    "rift_herald_kills" INTEGER NOT NULL DEFAULT 0,
    "rift_herald_first" BOOLEAN NOT NULL DEFAULT false,
    "inhibitor_kills" INTEGER NOT NULL DEFAULT 0,
    "champion_kills" INTEGER NOT NULL DEFAULT 0,
    "first_blood" BOOLEAN NOT NULL DEFAULT false,
    "elder_kills" INTEGER NOT NULL DEFAULT 0,
    "bans_json" JSONB NOT NULL DEFAULT '[]',
    "drakes_json" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "ingest_teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingest_teams_match_id_team_key" ON "ingest_teams"("match_id", "team");
CREATE INDEX "ingest_teams_match_id_idx" ON "ingest_teams"("match_id");

ALTER TABLE "ingest_teams"
  ADD CONSTRAINT "ingest_teams_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "ingest_matchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ingest_match_players" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "player_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "rank_tier" TEXT NOT NULL DEFAULT 'UNRANKED',
    "rank_division" TEXT,
    "participant_id" INTEGER NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "runes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "shards" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "summoner_spells" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "skill_order" JSONB,
    "win" BOOLEAN NOT NULL DEFAULT false,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "ingest_match_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingest_match_players_match_id_player_id_key" ON "ingest_match_players"("match_id", "player_id");
CREATE INDEX "ingest_match_players_match_id_idx" ON "ingest_match_players"("match_id");
CREATE INDEX "ingest_match_players_player_id_idx" ON "ingest_match_players"("player_id");
CREATE INDEX "ingest_match_players_team_id_idx" ON "ingest_match_players"("team_id");
CREATE INDEX "ingest_match_players_champion_id_idx" ON "ingest_match_players"("champion_id");
CREATE INDEX "ingest_match_players_champion_id_role_rank_tier_idx" ON "ingest_match_players"("champion_id", "role", "rank_tier");

ALTER TABLE "ingest_match_players"
  ADD CONSTRAINT "ingest_match_players_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "ingest_matchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingest_match_players"
  ADD CONSTRAINT "ingest_match_players_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingest_match_players"
  ADD CONSTRAINT "ingest_match_players_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "ingest_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
