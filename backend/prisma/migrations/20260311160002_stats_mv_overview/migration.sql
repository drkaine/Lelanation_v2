-- MV 2/3: cache get_stats_overview(NULL, NULL). Progress visible between MVs.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_overview AS
SELECT get_stats_overview(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_overview_one ON mv_stats_overview ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_overview IS 'Cache get_stats_overview(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_overview;';
