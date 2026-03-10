-- Drop participant columns redundant with match / match_teams.
-- match has game_ended_in_surrender, game_ended_in_early_surrender (aggregated).
-- match_teams has team_early_surrendered.

ALTER TABLE participants
  DROP COLUMN IF EXISTS game_ended_in_surrender,
  DROP COLUMN IF EXISTS game_ended_in_early_surrender,
  DROP COLUMN IF EXISTS team_early_surrendered;
