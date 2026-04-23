DROP TABLE IF EXISTS agg_objective_outcome_stats;

CREATE TABLE agg_objective_outcome_stats (
  id BIGSERIAL PRIMARY KEY,
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  baron_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  baron_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  void_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  void_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  herald_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  herald_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  inhibitor_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  inhibitor_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  tower_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  tower_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_blood_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_blood_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  elder_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  elder_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  earth_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  earth_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  water_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  water_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  wind_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  wind_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  fire_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  fire_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  hextec_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  hextec_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  chem_drake_win_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  chem_drake_loose_team JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agg_objective_outcome_stats_unique_patch_tier UNIQUE (game_version, rank_tier)
);

CREATE INDEX idx_agg_objective_outcome_patch_div
  ON agg_objective_outcome_stats (game_version, rank_tier);
