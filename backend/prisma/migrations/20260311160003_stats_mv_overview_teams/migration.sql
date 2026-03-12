-- MV 3/3: cache get_stats_overview_teams(NULL, NULL). Progress visible between MVs.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_overview_teams AS
SELECT get_stats_overview_teams(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_overview_teams_one ON mv_stats_overview_teams ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_overview_teams IS 'Cache get_stats_overview_teams(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_overview_teams;';
