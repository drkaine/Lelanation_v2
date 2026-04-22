CREATE TABLE IF NOT EXISTS agg_objective_outcome_stats (
  id BIGSERIAL PRIMARY KEY,
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  objective_key TEXT NOT NULL,
  objective_bucket INTEGER NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_loss INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  winrate_win_side NUMERIC(6,2) NOT NULL DEFAULT 0,
  winrate_other_side NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agg_objective_outcome_stats_unique_dims
    UNIQUE (game_version, rank_tier, objective_key, objective_bucket)
);

CREATE INDEX IF NOT EXISTS idx_agg_objective_outcome_patch_div
  ON agg_objective_outcome_stats (game_version, rank_tier, objective_key, objective_bucket);
