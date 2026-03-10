-- Single source of truth for "first" objectives: move all *_first from match_teams into match_team_first_objectives.
-- participant_id nullable: when null = team got first (participant unknown); timeline can add killer/assist later for herald, horde, dragon, baron.

ALTER TABLE match_team_first_objectives
  ALTER COLUMN participant_id DROP NOT NULL;

-- At most one "team first" row per (match_team_id, objective_type) when participant_id is null
CREATE UNIQUE INDEX IF NOT EXISTS match_team_first_objectives_team_first_unique
  ON match_team_first_objectives (match_team_id, objective_type)
  WHERE participant_id IS NULL;

-- Backfill from match_teams: one row per team per objective where *_first = true (participant_id null).
-- For champion/tower we only insert if no row exists yet (participant rows may already exist).
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'champion', NULL, true FROM match_teams mt
WHERE mt.champion_first = true
  AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'champion');
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'baron', NULL, true FROM match_teams mt
WHERE mt.baron_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'baron' AND o.participant_id IS NULL);
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'dragon', NULL, true FROM match_teams mt
WHERE mt.dragon_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'dragon' AND o.participant_id IS NULL);
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'tower', NULL, true FROM match_teams mt
WHERE mt.tower_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'tower');
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'horde', NULL, true FROM match_teams mt
WHERE mt.horde_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'horde' AND o.participant_id IS NULL);
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'rift_herald', NULL, true FROM match_teams mt
WHERE mt.rift_herald_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'rift_herald' AND o.participant_id IS NULL);
INSERT INTO match_team_first_objectives (match_team_id, objective_type, participant_id, is_kill)
SELECT mt.id, 'inhibitor', NULL, true FROM match_teams mt
WHERE mt.inhibitor_first = true AND NOT EXISTS (SELECT 1 FROM match_team_first_objectives o WHERE o.match_team_id = mt.id AND o.objective_type = 'inhibitor' AND o.participant_id IS NULL);

-- Drop *_first columns from match_teams
ALTER TABLE match_teams DROP COLUMN IF EXISTS champion_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS baron_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS dragon_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS tower_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS horde_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS rift_herald_first;
ALTER TABLE match_teams DROP COLUMN IF EXISTS inhibitor_first;
