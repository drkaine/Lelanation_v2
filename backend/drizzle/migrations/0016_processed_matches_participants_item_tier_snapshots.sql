-- processed_matches : identité des 10 participants (puuid + Riot ID).
-- item_tier_daily_snapshots : tendances item par patch / tier / région / jour.

DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    EXECUTE format(
      'ALTER TABLE processed_matches ADD COLUMN IF NOT EXISTS participant%s_puuid TEXT',
      i
    );
    EXECUTE format(
      'ALTER TABLE processed_matches ADD COLUMN IF NOT EXISTS participant%s_tag_name TEXT',
      i
    );
    EXECUTE format(
      'ALTER TABLE processed_matches ADD COLUMN IF NOT EXISTS participant%s_game_name TEXT',
      i
    );
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS item_tier_daily_snapshots (
  patch         TEXT        NOT NULL,
  rank_tier     TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  item_id       INTEGER     NOT NULL,
  date_of_game  DATE        NOT NULL,

  games         INTEGER     NOT NULL DEFAULT 0,
  wins          INTEGER     NOT NULL DEFAULT 0,
  "order"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  sum_achat_tmps BIGINT     NOT NULL DEFAULT 0,

  PRIMARY KEY (patch, rank_tier, region, item_id, date_of_game)
) PARTITION BY LIST (patch);

CREATE TABLE IF NOT EXISTS item_tier_daily_snapshots_p_default
  PARTITION OF item_tier_daily_snapshots DEFAULT;

CREATE INDEX IF NOT EXISTS idx_item_tier_snapshot_item
  ON item_tier_daily_snapshots (item_id, date_of_game DESC);

CREATE INDEX IF NOT EXISTS idx_item_tier_snapshot_tier
  ON item_tier_daily_snapshots (rank_tier, date_of_game DESC);

COMMENT ON COLUMN item_tier_daily_snapshots."order" IS
  'JSON ordre d''achat → nombre de wins (ex. {"1-2-3": 42})';

COMMENT ON COLUMN item_tier_daily_snapshots.sum_achat_tmps IS
  'Somme des timestamps (ms) d''achat pour timing moyen';
