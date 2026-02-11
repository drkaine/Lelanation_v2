-- Remove old 1-param and 0-param overloads of get_stats_overview_* functions.
-- The 2-param versions (p_version, p_rank_tier) from 20260210190000 are the canonical ones.
-- PostgreSQL CREATE OR REPLACE adds a new overload instead of replacing when signature differs,
-- causing "function is not unique" when calling with 1 arg.
DROP FUNCTION IF EXISTS get_stats_overview() CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_detail(text) CASCADE;
DROP FUNCTION IF EXISTS get_stats_overview_teams(text) CASCADE;
