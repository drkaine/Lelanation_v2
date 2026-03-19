-- Ingestion time for matches (rolling windows / daily snapshots).
ALTER TABLE "matchs" ADD COLUMN IF NOT EXISTS "ingested_at" TIMESTAMPTZ;
UPDATE "matchs" SET "ingested_at" = COALESCE("aggregated_at", NOW()) WHERE "ingested_at" IS NULL;
ALTER TABLE "matchs" ALTER COLUMN "ingested_at" SET DEFAULT NOW();
ALTER TABLE "matchs" ALTER COLUMN "ingested_at" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "matchs_ingested_at_idx" ON "matchs" ("ingested_at");

-- Daily snapshot: one row per (UTC calendar day summarized, rank tier, champion).
-- Filled by app job once per day; stores games, wins, WR, bans, pick rate for charts / trends.
CREATE TABLE "champion_tier_daily_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "snapshot_for_date" DATE NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "window_end" TIMESTAMPTZ NOT NULL,
    "rank_tier" TEXT NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "bans" INTEGER NOT NULL DEFAULT 0,
    "pick_rate_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "win_rate_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "champion_tier_daily_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "champion_tier_daily_snapshots_snapshot_for_date_rank_tier_champion_id_key" UNIQUE ("snapshot_for_date", "rank_tier", "champion_id")
);

CREATE INDEX "champion_tier_daily_snapshots_champion_date_idx" ON "champion_tier_daily_snapshots" ("champion_id", "snapshot_for_date" DESC);
CREATE INDEX "champion_tier_daily_snapshots_tier_date_idx" ON "champion_tier_daily_snapshots" ("rank_tier", "snapshot_for_date" DESC);

-- Marks UTC days already snapshotted (including zero-match days) so the job does not retry forever.
CREATE TABLE "champion_tier_snapshot_runs" (
    "snapshot_for_date" DATE NOT NULL,
    "rows_inserted" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "champion_tier_snapshot_runs_pkey" PRIMARY KEY ("snapshot_for_date")
);
