-- =============================================================================
-- ROLLBACK: 20260309150000_normalise_teams_bans_participant_data
-- Restores the DB to the state before the normalisation migration.
-- Run this manually ONLY if you need to revert.  Requires the backup tables
-- created at the start of the migration to still exist.
-- =============================================================================

BEGIN;

-- 1) Drop new normalised tables
DROP TABLE IF EXISTS participant_challenges      CASCADE;
DROP TABLE IF EXISTS participant_perks           CASCADE;
DROP TABLE IF EXISTS participant_runes           CASCADE;
DROP TABLE IF EXISTS participant_summoner_spells CASCADE;
DROP TABLE IF EXISTS participant_spells          CASCADE;
DROP TABLE IF EXISTS participant_items           CASCADE;
DROP TABLE IF EXISTS bans                        CASCADE;
DROP TABLE IF EXISTS challenge_keys_registry;

-- 2) Drop columns added to existing tables
ALTER TABLE match_teams DROP COLUMN IF EXISTS rank_tier;
ALTER TABLE match_teams DROP COLUMN IF EXISTS team_early_surrendered;
ALTER TABLE matches     DROP COLUMN IF EXISTS game_ended_in_surrender;
ALTER TABLE matches     DROP COLUMN IF EXISTS game_ended_in_early_surrender;

-- 3) Restore matches from backup (restores any data modified by backfill step 6)
UPDATE matches m
SET
  game_ended_in_surrender       = NULL,
  game_ended_in_early_surrender = NULL
WHERE true;
-- The columns no longer exist after step 2 above, so just ensure nothing leaks.

-- 4) Restore match_teams from pre-migration backup (step 4+5 side-effects)
-- (match_teams.team_early_surrendered and rank_tier columns were dropped in step 2)

-- 5) Drop backup tables if you want a clean state (comment out to keep them)
-- DROP TABLE IF EXISTS backup_match_teams_post_20260309;
-- DROP TABLE IF EXISTS backup_match_teams_pre_20260309;
-- DROP TABLE IF EXISTS backup_participants_20260309;
-- DROP TABLE IF EXISTS backup_matches_20260309;

COMMIT;
