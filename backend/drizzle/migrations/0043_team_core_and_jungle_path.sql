-- team_core_stat : kills totaux + first elder par côté
ALTER TABLE team_core_stat
  ADD COLUMN IF NOT EXISTS sum_champion_kills BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_elder_drake_first INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS champion_jungle_path (
  patch TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  region TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  opponent_champion_id INTEGER NOT NULL,
  path_hash TEXT NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  jungle_camp_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (patch, rank_tier, region, champion_id, opponent_champion_id, path_hash)
) PARTITION BY LIST (patch);

CREATE TABLE IF NOT EXISTS champion_jungle_path_p_default
  PARTITION OF champion_jungle_path DEFAULT;

CREATE INDEX IF NOT EXISTS idx_champion_jungle_path_lookup
  ON champion_jungle_path (patch, rank_tier, region, champion_id, opponent_champion_id);
