-- =============================================================================
-- ROLLBACK: 20260309160000_cleanup_legacy_columns
-- Restores the legacy columns dropped in step 2.
-- Requires the backup tables from step 1 to still exist.
-- =============================================================================

BEGIN;

-- 1) Restore legacy columns to participants
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS items               jsonb,
  ADD COLUMN IF NOT EXISTS runes               jsonb,
  ADD COLUMN IF NOT EXISTS summoner_spells     jsonb,
  ADD COLUMN IF NOT EXISTS stat_perks          jsonb,
  ADD COLUMN IF NOT EXISTS challenges          jsonb,
  ADD COLUMN IF NOT EXISTS spell1_casts        int,
  ADD COLUMN IF NOT EXISTS spell2_casts        int,
  ADD COLUMN IF NOT EXISTS spell3_casts        int,
  ADD COLUMN IF NOT EXISTS spell4_casts        int,
  ADD COLUMN IF NOT EXISTS summoner1_casts     int,
  ADD COLUMN IF NOT EXISTS summoner2_casts     int,
  ADD COLUMN IF NOT EXISTS team_id             int,
  ADD COLUMN IF NOT EXISTS win                 boolean,
  ADD COLUMN IF NOT EXISTS unreal_kills        int,
  ADD COLUMN IF NOT EXISTS team_early_surrendered boolean,
  ADD COLUMN IF NOT EXISTS game_ended_in_surrender boolean,
  ADD COLUMN IF NOT EXISTS game_ended_in_early_surrender boolean;

-- 2) Restore data from backup_participants_20260309
UPDATE participants p
SET
  items               = b.items,
  runes               = b.runes,
  summoner_spells     = b.summoner_spells,
  stat_perks          = b.stat_perks,
  challenges          = b.challenges,
  spell1_casts        = b.spell1_casts,
  spell2_casts        = b.spell2_casts,
  spell3_casts        = b.spell3_casts,
  spell4_casts        = b.spell4_casts,
  summoner1_casts     = b.summoner1_casts,
  summoner2_casts     = b.summoner2_casts,
  team_id             = b.team_id,
  win                 = b.win,
  unreal_kills        = b.unreal_kills,
  team_early_surrendered          = b.team_early_surrendered,
  game_ended_in_surrender         = b.game_ended_in_surrender,
  game_ended_in_early_surrender   = b.game_ended_in_early_surrender
FROM backup_participants_20260309 b
WHERE p.id = b.id;

-- 3) Restore ban_1..5 to match_teams
ALTER TABLE match_teams
  ADD COLUMN IF NOT EXISTS ban_1 int,
  ADD COLUMN IF NOT EXISTS ban_2 int,
  ADD COLUMN IF NOT EXISTS ban_3 int,
  ADD COLUMN IF NOT EXISTS ban_4 int,
  ADD COLUMN IF NOT EXISTS ban_5 int;

UPDATE match_teams mt
SET
  ban_1 = b.ban_1,
  ban_2 = b.ban_2,
  ban_3 = b.ban_3,
  ban_4 = b.ban_4,
  ban_5 = b.ban_5
FROM backup_match_teams_pre_20260309 b
WHERE mt.id = b.id;

COMMIT;
