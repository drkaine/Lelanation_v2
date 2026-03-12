-- MV 1/3: cache get_stats_champions(NULL, NULL). Progress visible between MVs.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_champions AS
SELECT get_stats_champions(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_champions_one ON mv_stats_champions ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_champions IS 'Cache get_stats_champions(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_champions;';
