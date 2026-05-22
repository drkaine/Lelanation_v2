-- Index pour rank fill nocturne (selectRankFillTargets) et discovery ORDER BY last_seen.
-- player_rank_history utilise la colonne `date` (PK + idx_rank_history_lookup couvrent NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_players_last_seen_desc
  ON players (last_seen DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_players_last_seen_asc_nulls_first
  ON players (last_seen ASC NULLS FIRST);
