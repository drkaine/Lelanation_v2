-- Indexes for overview stats: get_stats_overview and get_stats_overview_detail
-- filter by m.game_version and m.rank; without indexes the join on 700k+ participants is slow.
CREATE INDEX IF NOT EXISTS idx_matches_game_version ON matches (game_version) WHERE game_version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_rank ON matches (rank) WHERE rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_version_rank ON matches (game_version, rank) WHERE game_version IS NOT NULL AND rank IS NOT NULL;
