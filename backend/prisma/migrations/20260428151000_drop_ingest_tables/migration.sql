-- Final decommission of legacy ingest lean tables.
-- Execute in controlled window after raw-only runtime validation.
DROP TABLE IF EXISTS ingest_match_players;
DROP TABLE IF EXISTS ingest_teams;
DROP TABLE IF EXISTS ingest_matchs;
