CREATE TABLE IF NOT EXISTS matchup_tier_scores (
  id BIGSERIAL PRIMARY KEY,
  patch TEXT NOT NULL,
  lane TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  opponent_champion_id INTEGER NOT NULL,
  rank_filter_key TEXT NOT NULL DEFAULT 'GLOBAL',
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  sum_kda DOUBLE PRECISION NOT NULL DEFAULT 0,
  sum_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_kda DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  prev_patch_score INTEGER NULL,
  delta_vs_prev_patch INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS matchup_tier_scores_unique
  ON matchup_tier_scores (patch, lane, champion_id, opponent_champion_id, rank_filter_key);

CREATE INDEX IF NOT EXISTS matchup_tier_scores_patch_lane_rank_idx
  ON matchup_tier_scores (patch, lane, rank_filter_key, score DESC);

CREATE INDEX IF NOT EXISTS matchup_tier_scores_champ_patch_rank_idx
  ON matchup_tier_scores (champion_id, patch, rank_filter_key);
