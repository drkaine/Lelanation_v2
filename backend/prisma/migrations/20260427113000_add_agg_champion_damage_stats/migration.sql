CREATE TABLE IF NOT EXISTS agg_champion_damage_stats (
  champion_stat_id BIGINT PRIMARY KEY,
  sum_physical_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  sum_magic_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  sum_true_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  sum_total_damage_to_champions BIGINT NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_damage_stats_updated_at
  ON agg_champion_damage_stats (updated_at);
