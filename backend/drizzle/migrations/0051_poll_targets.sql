-- Cibles de poll du jour : joueurs retenus par le balayage des rangs (à peu près autant par tier).
CREATE TABLE IF NOT EXISTS poll_targets (
  day date NOT NULL,
  region lol_region NOT NULL,
  puuid text NOT NULL,
  rank_tier lol_rank_tier NOT NULL,
  PRIMARY KEY (day, region, puuid)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS poll_targets_day_region_tier_idx ON poll_targets (day, region, rank_tier);
