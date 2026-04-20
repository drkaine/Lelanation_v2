DROP TABLE IF EXISTS player_summaries;
DROP TABLE IF EXISTS champion_stats_core;

CREATE TABLE IF NOT EXISTS agg_champion_core_stats (
  id BIGINT PRIMARY KEY,
  champion_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  game_version TEXT NOT NULL,
  region TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  count_ban INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_champion_core_dims
  ON agg_champion_core_stats (champion_id, role, rank_tier, game_version, region);

CREATE TABLE IF NOT EXISTS agg_champion_vs_stats (
  champion_stat_id BIGINT NOT NULL,
  opponent_champion_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  game_version TEXT NOT NULL,
  region TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, opponent_champion_id)
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_vs_dims
  ON agg_champion_vs_stats (role, rank_tier, game_version, region);

CREATE TABLE IF NOT EXISTS agg_match_outcome_stats (
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  count_match INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_version, rank_tier)
);

CREATE TABLE IF NOT EXISTS agg_team_core_stats (
  id BIGINT PRIMARY KEY,
  team INTEGER NOT NULL,
  rank_tier TEXT NOT NULL,
  game_version TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  count_team_early_surrendered INTEGER NOT NULL DEFAULT 0,
  count_team_surrendered INTEGER NOT NULL DEFAULT 0,
  sum_baron_kills INTEGER NOT NULL DEFAULT 0,
  count_baron_first INTEGER NOT NULL DEFAULT 0,
  sum_dragon_kills INTEGER NOT NULL DEFAULT 0,
  count_dragon_first INTEGER NOT NULL DEFAULT 0,
  sum_tower_kills INTEGER NOT NULL DEFAULT 0,
  count_tower_first INTEGER NOT NULL DEFAULT 0,
  sum_horde_kills INTEGER NOT NULL DEFAULT 0,
  count_horde_first INTEGER NOT NULL DEFAULT 0,
  sum_rift_herald_kills INTEGER NOT NULL DEFAULT 0,
  count_rift_herald_first INTEGER NOT NULL DEFAULT 0,
  sum_inhibitor_kills INTEGER NOT NULL DEFAULT 0,
  count_first_blood INTEGER NOT NULL DEFAULT 0,
  sum_elder_kills INTEGER NOT NULL DEFAULT 0,
  count_earth_drake INTEGER NOT NULL DEFAULT 0,
  count_water_drake INTEGER NOT NULL DEFAULT 0,
  count_wind_drake INTEGER NOT NULL DEFAULT 0,
  count_fire_drake INTEGER NOT NULL DEFAULT 0,
  count_hextec_drake INTEGER NOT NULL DEFAULT 0,
  count_chem_drake INTEGER NOT NULL DEFAULT 0,
  count_earth_drake_soul INTEGER NOT NULL DEFAULT 0,
  count_water_drake_soul INTEGER NOT NULL DEFAULT 0,
  count_wind_drake_soul INTEGER NOT NULL DEFAULT 0,
  count_fire_drake_soul INTEGER NOT NULL DEFAULT 0,
  count_hextec_drake_soul INTEGER NOT NULL DEFAULT 0,
  count_chem_drake_soul INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_team_core_dims
  ON agg_team_core_stats (team, rank_tier, game_version);

CREATE TABLE IF NOT EXISTS agg_champion_bans_by_banner (
  team_num INTEGER NOT NULL,
  banner_role_norm TEXT NOT NULL,
  banned_champion_id INTEGER NOT NULL,
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  ban_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_num, banner_role_norm, banned_champion_id, game_version, rank_tier)
);

CREATE TABLE IF NOT EXISTS agg_champion_side_stats (
  team_num INTEGER NOT NULL,
  champion_id INTEGER NOT NULL,
  role_norm TEXT NOT NULL,
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_num, champion_id, role_norm, game_version, rank_tier)
);

CREATE TABLE IF NOT EXISTS agg_team_bucket (
  team_stat_id BIGINT NOT NULL,
  objective_key TEXT NOT NULL,
  objective_bucket INTEGER NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_stat_id, objective_key, objective_bucket)
);
