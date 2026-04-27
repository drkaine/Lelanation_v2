CREATE TABLE IF NOT EXISTS agg_champion_duo_role_stats (
  champion_stat_id BIGINT NOT NULL,
  ally_champion_id INT NOT NULL,
  ally_role TEXT NOT NULL,
  count_win INT NOT NULL DEFAULT 0,
  count_game INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agg_champion_duo_role_stats_pkey
    PRIMARY KEY (champion_stat_id, ally_champion_id, ally_role),
  CONSTRAINT fk_agg_champion_duo_role_stats_core
    FOREIGN KEY (champion_stat_id) REFERENCES agg_champion_core_stats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_duo_role_stats_updated_at
  ON agg_champion_duo_role_stats (updated_at);

CREATE INDEX IF NOT EXISTS idx_agg_champion_duo_role_stats_ally
  ON agg_champion_duo_role_stats (ally_champion_id, ally_role);

CREATE TABLE IF NOT EXISTS agg_champion_duo_stats (
  champion_stat_id BIGINT NOT NULL,
  ally_champion_id INT NOT NULL,
  count_win INT NOT NULL DEFAULT 0,
  count_game INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agg_champion_duo_stats_pkey
    PRIMARY KEY (champion_stat_id, ally_champion_id),
  CONSTRAINT fk_agg_champion_duo_stats_core
    FOREIGN KEY (champion_stat_id) REFERENCES agg_champion_core_stats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_duo_stats_updated_at
  ON agg_champion_duo_stats (updated_at);

CREATE INDEX IF NOT EXISTS idx_agg_champion_duo_stats_ally
  ON agg_champion_duo_stats (ally_champion_id);

CREATE TABLE IF NOT EXISTS agg_botlane_duo_vs_duo_stats (
  adc_id INT NOT NULL,
  support_id INT NOT NULL,
  opp_adc_id INT NOT NULL,
  opp_support_id INT NOT NULL,
  rank_tier TEXT NOT NULL,
  game_version TEXT NOT NULL,
  region TEXT NOT NULL,
  count_win INT NOT NULL DEFAULT 0,
  count_game INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agg_botlane_duo_vs_duo_stats_pkey
    PRIMARY KEY (adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region)
);

CREATE INDEX IF NOT EXISTS idx_agg_botlane_duo_vs_duo_stats_patch
  ON agg_botlane_duo_vs_duo_stats (game_version, rank_tier);

CREATE INDEX IF NOT EXISTS idx_agg_botlane_duo_vs_duo_stats_updated_at
  ON agg_botlane_duo_vs_duo_stats (updated_at);
