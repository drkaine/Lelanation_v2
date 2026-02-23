-- Vues matérialisées pour servir les stats en < 1 s (sans filtre version/rank).
-- À rafraîchir après collecte : REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_champions;
-- Idem pour mv_stats_overview et mv_stats_overview_teams.

-- Champions (résultat get_stats_champions(NULL, NULL))
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_champions AS
SELECT get_stats_champions(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_champions_one ON mv_stats_champions ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_champions IS 'Cache get_stats_champions(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_champions;';

-- Overview (résultat get_stats_overview(NULL, NULL))
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_overview AS
SELECT get_stats_overview(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_overview_one ON mv_stats_overview ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_overview IS 'Cache get_stats_overview(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_overview;';

-- Overview teams (résultat get_stats_overview_teams(NULL, NULL))
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_overview_teams AS
SELECT get_stats_overview_teams(NULL, NULL) AS data;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_overview_teams_one ON mv_stats_overview_teams ((1));

COMMENT ON MATERIALIZED VIEW mv_stats_overview_teams IS 'Cache get_stats_overview_teams(NULL,NULL). Refresh after collect: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stats_overview_teams;';
