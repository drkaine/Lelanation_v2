-- Ancienne ingestion (processed_matches) et observabilité SQL (obs_*) remplacées par
-- matchs / match_aggregated + poller-observability.json (Redis / fichier).

DROP TABLE IF EXISTS obs_errors CASCADE;
DROP TABLE IF EXISTS obs_db_write_stats CASCADE;
DROP TABLE IF EXISTS obs_pipeline_minutes CASCADE;
DROP TABLE IF EXISTS obs_hourly_summaries CASCADE;
DROP TABLE IF EXISTS obs_rate_limit_windows CASCADE;
DROP TABLE IF EXISTS processed_matches CASCADE;
