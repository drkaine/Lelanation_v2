CREATE TABLE IF NOT EXISTS agg_champion_runes_stats (
  champion_stat_id BIGINT NOT NULL,
  rune_list TEXT NOT NULL,
  shard_list TEXT NOT NULL DEFAULT '',
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, rune_list, shard_list)
);

CREATE TABLE IF NOT EXISTS agg_champion_runes_solo_stats (
  champion_stat_id BIGINT NOT NULL,
  perk_id INTEGER NOT NULL,
  style TEXT NOT NULL DEFAULT '',
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, perk_id, style)
);

CREATE TABLE IF NOT EXISTS agg_champion_shard_solo_stats (
  champion_stat_id BIGINT NOT NULL,
  shard_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, shard_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_runes_solo_perk
  ON agg_champion_runes_solo_stats (perk_id);

CREATE INDEX IF NOT EXISTS idx_agg_champion_shard_solo_shard
  ON agg_champion_shard_solo_stats (shard_id);
