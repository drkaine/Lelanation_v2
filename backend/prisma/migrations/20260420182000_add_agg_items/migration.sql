CREATE TABLE IF NOT EXISTS agg_champion_item_solo_stats (
  champion_stat_id BIGINT NOT NULL,
  item_id INTEGER NOT NULL,
  count_starter INTEGER NOT NULL DEFAULT 0,
  count_core INTEGER NOT NULL DEFAULT 0,
  count_final INTEGER NOT NULL DEFAULT 0,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  sum_timestamp_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, item_id)
);

CREATE TABLE IF NOT EXISTS agg_champion_item_stats (
  champion_stat_id BIGINT NOT NULL,
  item_list TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  sum_timestamp_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, item_list)
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_item_solo_item
  ON agg_champion_item_solo_stats (item_id);
