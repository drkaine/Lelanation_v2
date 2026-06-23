-- match_aggregated : une ligne = agrégation terminée (plus de file d'attente aggregated=false).

DROP INDEX IF EXISTS idx_match_aggregated_pending;

DELETE FROM match_aggregated WHERE aggregated = FALSE;

CREATE INDEX IF NOT EXISTS idx_matchs_created_at ON matchs (created_at);
