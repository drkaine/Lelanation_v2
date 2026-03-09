-- =============================================================================
-- MIGRATION: 20260309160000_cleanup_legacy_columns
-- Step 2 (DESTRUCTIVE) — Run ONLY after validating step 1 in production.
--
-- Drops all legacy columns that were kept for backward compatibility during
-- the step-1 double-write transition:
--   - participants: team_id, win, unreal_kills, team_early_surrendered,
--                   game_ended_in_surrender, game_ended_in_early_surrender,
--                   items, runes, summoner_spells, stat_perks, challenges,
--                   spell1..4_casts, summoner1..2_casts
--   - match_teams: ban_1..5
--
-- PRE-REQUISITES:
--   1. Migration 20260309150000 has been applied and validated.
--   2. The backend has been deployed with double-write code (riotPoller).
--   3. Spot-check queries have been run to confirm data parity between legacy
--      columns and the new normalised tables.
--   4. Backup tables from step 1 are intact (backup_matches_20260309, etc.)
--
-- =============================================================================

-- ─── 0. Safety check: verify counts are consistent (optional, informational) ─
-- Run these before applying the migration:
--
--   SELECT COUNT(*) AS legacy_items_rows FROM participants WHERE items IS NOT NULL;
--   SELECT COUNT(*) AS new_items_rows     FROM participant_items;
--   SELECT COUNT(*) AS legacy_runes_rows  FROM participants WHERE runes IS NOT NULL;
--   SELECT COUNT(*) AS new_runes_rows     FROM participant_runes;
--   SELECT COUNT(*) AS legacy_bans        FROM match_teams WHERE ban_1 IS NOT NULL OR ban_2 IS NOT NULL;
--   SELECT COUNT(*) AS new_bans_rows      FROM bans;
--

-- ─── 1. Drop legacy JSON columns from participants ────────────────────────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS items,
  DROP COLUMN IF EXISTS runes,
  DROP COLUMN IF EXISTS summoner_spells,
  DROP COLUMN IF EXISTS stat_perks,
  DROP COLUMN IF EXISTS challenges;

-- ─── 2. Drop legacy numeric columns being moved to sub-tables ────────────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS spell1_casts,
  DROP COLUMN IF EXISTS spell2_casts,
  DROP COLUMN IF EXISTS spell3_casts,
  DROP COLUMN IF EXISTS spell4_casts,
  DROP COLUMN IF EXISTS summoner1_casts,
  DROP COLUMN IF EXISTS summoner2_casts;

-- ─── 3. Drop legacy columns moved to normalised tables / match level ─────────

ALTER TABLE participants
  DROP COLUMN IF EXISTS team_id,
  DROP COLUMN IF EXISTS win,
  DROP COLUMN IF EXISTS unreal_kills,
  DROP COLUMN IF EXISTS team_early_surrendered,
  DROP COLUMN IF EXISTS game_ended_in_surrender,
  DROP COLUMN IF EXISTS game_ended_in_early_surrender;

-- ─── 4. Drop legacy ban columns from match_teams ─────────────────────────────

ALTER TABLE match_teams
  DROP COLUMN IF EXISTS ban_1,
  DROP COLUMN IF EXISTS ban_2,
  DROP COLUMN IF EXISTS ban_3,
  DROP COLUMN IF EXISTS ban_4,
  DROP COLUMN IF EXISTS ban_5;

-- ─── 5. Drop the old backup tables (no longer needed after validation) ────────
-- Uncomment when you're sure you won't need to roll back.
--
-- DROP TABLE IF EXISTS backup_matches_20260309;
-- DROP TABLE IF EXISTS backup_participants_20260309;
-- DROP TABLE IF EXISTS backup_match_teams_pre_20260309;
-- DROP TABLE IF EXISTS backup_match_teams_post_20260309;
-- DROP TABLE IF EXISTS backup_matches_teams_20260309;
-- DROP TABLE IF EXISTS backup_match_teams_20260309;
